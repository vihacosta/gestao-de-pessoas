/** Leitura de texto e separação de páginas de PDFs, no navegador. */
import { PDFDocument } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { TextoPosicionado } from './cartaoPonto'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Textos de cada página, com posição */
export async function lerTextoPdf(buf: ArrayBuffer): Promise<TextoPosicionado[][]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise
  const paginas: TextoPosicionado[][] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent()
    paginas.push(
      tc.items
        .filter((it): it is Extract<typeof it, { str: string }> => 'str' in it)
        .map((it) => ({ x: it.transform[4], y: it.transform[5], str: it.str })),
    )
  }
  return paginas
}

/** Novo PDF só com as páginas indicadas (começando em 0) */
export async function separarPaginas(buf: ArrayBuffer, paginas: number[]): Promise<Blob> {
  const origem = await PDFDocument.load(buf.slice(0))
  const novo = await PDFDocument.create()
  const copiadas = await novo.copyPages(origem, paginas)
  copiadas.forEach((p) => novo.addPage(p))
  return new Blob([(await novo.save()) as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
}

/**
 * PDF digitalizado (páginas que são só imagem) → cada página vira um JPEG menor, no mesmo tamanho de página.
 * Devolve undefined se o PDF tiver texto (não perde texto selecionável) ou se não ficar pelo menos 20% menor.
 */
export async function comprimirPdfDigitalizado(buf: ArrayBuffer, ladoMaximo: number, qualidade: number): Promise<Blob | undefined> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise
  for (let i = 1; i <= Math.min(doc.numPages, 2); i++) {
    const tc = await (await doc.getPage(i)).getTextContent()
    if (tc.items.filter((it) => 'str' in it && it.str.trim()).length > 20) return undefined
  }
  const novo = await PDFDocument.create()
  for (let i = 1; i <= doc.numPages; i++) {
    const pagina = await doc.getPage(i)
    const base = pagina.getViewport({ scale: 1 })
    const escala = Math.min(3, ladoMaximo / Math.max(base.width, base.height))
    const viewport = pagina.getViewport({ scale: escala })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await pagina.render({ canvas, canvasContext: ctx, viewport }).promise
    const jpg = await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b!), 'image/jpeg', qualidade))
    const img = await novo.embedJpg(await jpg.arrayBuffer())
    novo.addPage([base.width, base.height]).drawImage(img, { x: 0, y: 0, width: base.width, height: base.height })
  }
  const saida = new Blob([(await novo.save()) as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
  return saida.size < buf.byteLength * 0.8 ? saida : undefined
}
