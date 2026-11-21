/**
 * Foto do funcionário: guardada como imagem (não vira PDF) no item "foto" dos documentos pessoais.
 */
import { enviarArquivo } from './arquivos'
import { excluirDocumento } from './documentos'
import { hojeISO } from './hoje'
import { novoId, salvar } from './store'
import type { DocumentoGuardado } from './types'

/** px do lado da foto quadrada: nítida na ficha e com menos de 100 KB */
export const LADO_FOTO = 640
const QUALIDADE_FOTO = 0.85

/** Maior quadrado centralizado da imagem */
export function recorteCentral(largura: number, altura: number) {
  const lado = Math.min(largura, altura)
  return { x: Math.floor((largura - lado) / 2), y: Math.floor((altura - lado) / 2), lado }
}

/** Recorta o centro da imagem (quadro do vídeo ou foto) e devolve um JPEG quadrado */
export function fotoQuadrada(origem: CanvasImageSource, largura: number, altura: number): Promise<Blob> {
  const { x, y, lado } = recorteCentral(largura, altura)
  const saida = Math.min(LADO_FOTO, lado)
  const canvas = document.createElement('canvas')
  canvas.width = saida
  canvas.height = saida
  canvas.getContext('2d')!.drawImage(origem, x, y, lado, lado, 0, 0, saida, saida)
  return new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('Não consegui gerar a foto.'))), 'image/jpeg', QUALIDADE_FOTO))
}

/** Foto escolhida do computador ou celular → JPEG quadrado */
export async function fotoDeArquivo(arquivo: Blob): Promise<Blob> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => erro(new Error('Não consegui abrir a imagem. Use uma foto em JPG ou PNG.'))
      i.src = url
    })
    return await fotoQuadrada(img, img.naturalWidth, img.naturalHeight)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function guardarFoto(funcionarioId: string, foto: Blob, substitui?: DocumentoGuardado) {
  const id = novoId()
  const caminho = `documentos/${funcionarioId}/pessoal/${id}.jpg`
  await enviarArquivo(caminho, foto)
  await salvar('documentos', {
    id,
    funcionarioId,
    categoria: 'pessoal',
    tipoPessoal: 'foto',
    titulo: 'Foto do funcionário',
    caminho,
    tamanho: foto.size,
    enviadoEm: hojeISO(),
  } satisfies DocumentoGuardado)
  if (substitui) await excluirDocumento(substitui)
}
