/**
 * Documentos assinados: junta fotos e PDFs num único PDF (bom para várias fotos tiradas no celular)
 * e guarda no armazenamento. Outros arquivos (planilhas, Word, fotos HEIC do iPhone...) são guardados
 * como vieram, um documento por arquivo.
 */
import { PDFDocument } from 'pdf-lib'
import { apagarArquivo, baixarArquivo, enviarArquivo, salvarNoComputador } from './arquivos'
import { hojeISO } from './hoje'
import { novoId, remover, salvar } from './store'
import type { CategoriaDocumento, DocumentoGuardado } from './types'

export const nomesCategoria: Record<CategoriaDocumento, string> = {
  holerite: 'Holerite assinado',
  holerite_original: 'Holerite da contabilidade',
  ponto_assinado: 'Cartão ponto assinado',
  admissao: 'Admissão',
  demissao: 'Demissão',
  outro: 'Outros',
  justificativas: 'Folha de justificativas assinada',
  pessoal: 'Documentos pessoais',
}

const LADO_MAXIMO = 2000 // px: suficiente para ler e economiza espaço

/** Converte qualquer imagem que o navegador consiga abrir em JPEG, reduzindo fotos muito grandes. */
async function imagemParaJpeg(arquivo: Blob): Promise<{ bytes: ArrayBuffer; largura: number; altura: number }> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => erro(new Error('Não consegui abrir a imagem. Use foto em JPG ou PNG, ou um PDF.'))
      i.src = url
    })
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight))
    const largura = Math.round(img.naturalWidth * escala)
    const altura = Math.round(img.naturalHeight * escala)
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    canvas.getContext('2d')!.drawImage(img, 0, 0, largura, altura)
    const blob = await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b!), 'image/jpeg', 0.85))
    return { bytes: await blob.arrayBuffer(), largura, altura }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Junta fotos e PDFs, na ordem, num único PDF. Um PDF sozinho é mantido como está. */
export async function juntarEmPdf(arquivos: File[]): Promise<Blob> {
  if (arquivos.length === 1 && arquivos[0].type === 'application/pdf') return arquivos[0]
  const pdf = await PDFDocument.create()
  for (const a of arquivos) {
    if (a.type === 'application/pdf' || /\.pdf$/i.test(a.name)) {
      const origem = await PDFDocument.load(await a.arrayBuffer(), { ignoreEncryption: true })
      const paginas = await pdf.copyPages(origem, origem.getPageIndices())
      paginas.forEach((p) => pdf.addPage(p))
    } else {
      const { bytes, largura, altura } = await imagemParaJpeg(a)
      const img = await pdf.embedJpg(bytes)
      // página A4 na orientação da foto, com a imagem ajustada
      const [pw, ph] = largura > altura ? [842, 595] : [595, 842]
      const escala = Math.min(pw / largura, ph / altura)
      const w = largura * escala
      const h = altura * escala
      pdf.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
    }
  }
  return new Blob([(await pdf.save()) as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
}

/** Fotos que o navegador consegue converter e PDFs: estes viram um PDF só */
export const podeVirarPdf = (a: { type: string; name: string }) =>
  a.type === 'application/pdf' || /\.pdf$/i.test(a.name) || /^image\/(jpeg|png|webp|gif|bmp)$/.test(a.type)

/** Nome seguro para o armazenamento (o Supabase recusa acentos e alguns símbolos no caminho) */
export const nomeSeguro = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(-100) || 'arquivo'

export const extensao = (nome: string) => /\.([a-z0-9]{1,8})$/i.exec(nome)?.[1].toLowerCase() ?? 'bin'

export async function guardarDocumento(args: {
  funcionarioId: string
  categoria: CategoriaDocumento
  arquivos: File[]
  titulo?: string
  mes?: string
  data?: string
  /** Documento que este substitui (é apagado depois de salvar o novo) */
  substitui?: DocumentoGuardado
  holerite?: DocumentoGuardado['holerite']
  tipoPessoal?: DocumentoGuardado['tipoPessoal']
}): Promise<DocumentoGuardado> {
  const titulo = args.titulo || nomesCategoria[args.categoria]
  const base = { funcionarioId: args.funcionarioId, categoria: args.categoria, mes: args.mes, data: args.data, holerite: args.holerite, tipoPessoal: args.tipoPessoal }

  async function gravar(conteudo: Blob, ext: string, tituloDoc: string, nomeArquivo?: string): Promise<DocumentoGuardado> {
    const id = novoId()
    const caminho = `documentos/${args.funcionarioId}/${args.categoria}/${id}.${ext}`
    await enviarArquivo(caminho, conteudo)
    const doc: DocumentoGuardado = { id, ...base, titulo: tituloDoc, caminho, tamanho: conteudo.size, enviadoEm: hojeISO(), nomeArquivo }
    await salvar('documentos', doc)
    return doc
  }

  let docs: DocumentoGuardado[] = []
  let pdf: Blob | undefined
  if (args.arquivos.every(podeVirarPdf)) pdf = await juntarEmPdf(args.arquivos).catch(() => undefined)
  if (pdf) {
    docs = [await gravar(pdf, 'pdf', titulo)]
  } else {
    // planilhas, Word, HEIC, PDF protegido...: guarda cada arquivo como veio
    const varios = args.arquivos.length > 1
    for (const a of args.arquivos) docs.push(await gravar(a, extensao(a.name), varios ? `${titulo} – ${a.name}` : titulo, a.name))
  }
  if (args.substitui) await excluirDocumento(args.substitui)
  return docs[0]
}

export async function excluirDocumento(doc: DocumentoGuardado) {
  await apagarArquivo(doc.caminho).catch(() => {})
  await remover('documentos', doc.id)
}

const TIPOS_VISIVEIS: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  txt: 'text/plain',
}

/** Abre o documento numa nova aba (PDF, fotos); planilhas e outros arquivos são baixados com o nome original */
export async function abrirDocumento(caminho: string, nomeArquivo?: string) {
  const ext = extensao(caminho)
  const tipo = TIPOS_VISIVEIS[ext]
  if (!tipo) {
    salvarNoComputador(await baixarArquivo(caminho), nomeArquivo ?? caminho.split('/').pop() ?? `arquivo.${ext}`)
    return
  }
  const aba = window.open('', '_blank')
  const blob = await baixarArquivo(caminho)
  const url = URL.createObjectURL(new Blob([blob], { type: tipo }))
  if (aba) aba.location.href = url
  else window.location.href = url
}

export const tamanhoTexto = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
