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
