/**
 * Armazenamento de arquivos (modelos enviados, documentos assinados, fotos...).
 * - Supabase: bucket privado "arquivos".
 * - Modo demonstração: IndexedDB deste navegador.
 */
import { SemPermissao, supabase } from './store'

const BUCKET = 'arquivos'
const DB = 'gp-arquivos'

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('arquivos')
    req.onsuccess = () => ok(req.result)
    req.onerror = () => erro(req.error)
  })
}

async function idb<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await abrir()
  return new Promise((ok, erro) => {
    const req = fn(db.transaction('arquivos', modo).objectStore('arquivos'))
    req.onsuccess = () => ok(req.result as T)
    req.onerror = () => erro(req.error)
  })
}

export async function enviarArquivo(caminho: string, arquivo: Blob): Promise<void> {
  if (!supabase) {
    await idb('readwrite', (s) => s.put(arquivo, caminho))
    return
  }
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { upsert: true })
  if (error) throw /row-level|policy|unauthorized/i.test(error.message) ? new SemPermissao() : error
}

export async function baixarArquivo(caminho: string): Promise<Blob> {
  if (!supabase) {
    const b = await idb<Blob | undefined>('readonly', (s) => s.get(caminho))
    if (!b) throw new Error('Arquivo não encontrado')
    return b
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(caminho)
  if (error) throw error
  return data
}

export async function apagarArquivo(caminho: string): Promise<void> {
  if (!supabase) {
    await idb('readwrite', (s) => s.delete(caminho))
    return
  }
  const { error } = await supabase.storage.from(BUCKET).remove([caminho])
  if (error) throw error
}

/** Faz o navegador baixar um arquivo. */
export function salvarNoComputador(arquivo: Blob, nome: string) {
  const url = URL.createObjectURL(arquivo)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
