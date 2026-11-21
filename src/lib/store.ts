/**
 * Camada de dados.
 * - Com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY: dados no Supabase (nuvem, com login).
 * - Sem elas: "modo demonstração", dados guardados só neste navegador.
 *
 * Cada tabela guarda o registro inteiro numa coluna jsonb `data` (ver supabase/schema.sql).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { dadosDemo } from './demo'

export type Tabela = 'funcionarios' | 'ferias' | 'ausencias' | 'config' | 'modelos' | 'pontos' | 'documentos' | 'justificativas' | 'erros' | 'aquisicoes'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

/** Cliente separado, sem guardar sessão: cria a conta de outra pessoa sem deslogar quem está usando */
export const clienteCadastro = (): SupabaseClient | null =>
  url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'gp-cadastro' } }) : null
export const modoDemo = !supabase

export const novoId = () => crypto.randomUUID()

// ---------------------------------------------------------------- local

const LS = 'gp:'
function lerLocal<T>(t: Tabela): T[] {
  const raw = localStorage.getItem(LS + t)
  if (raw == null) {
    const seed = ((dadosDemo as Record<string, unknown[]>)[t] ?? []) as T[]
    localStorage.setItem(LS + t, JSON.stringify(seed))
    return seed
  }
  return JSON.parse(raw)
}
function gravarLocal<T>(t: Tabela, rows: T[]) {
  localStorage.setItem(LS + t, JSON.stringify(rows))
}

// ---------------------------------------------------------------- API

/** A pessoa tentou alterar algo fora das suas permissões */
export class SemPermissao extends Error {
  constructor() {
    super('Você não tem permissão para fazer esta alteração. Fale com quem administra o sistema.')
    this.name = 'SemPermissao'
  }
}

type RegraEscrita = (tabela: Tabela, registro: unknown, operacao: 'salvar' | 'remover') => boolean
let regraEscrita: RegraEscrita = () => true
let acessoRestrito = false

/** Definida no login. O banco também confere: isto é para mostrar um aviso claro. */
export function definirRegraEscrita(regra: RegraEscrita, restrito: boolean) {
  regraEscrita = regra
  acessoRestrito = restrito
}

const traduzirErro = (e: { code?: string; message?: string }) => (e.code === '42501' ? new SemPermissao() : e)

export async function listar<T extends { id: string }>(t: Tabela): Promise<T[]> {
  if (!supabase) return lerLocal<T>(t)
  const sb = supabase
  // Funcionários vêm por uma função do banco, que entrega só os campos permitidos para cada pessoa
  const consulta = () => (t === 'funcionarios' ? sb.rpc('funcionarios_visiveis').select('data') : sb.from(t).select('data'))
  // o Supabase devolve no máximo 1000 linhas por consulta: busca em páginas
  const todas: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta().order('id').range(de, de + 999)
    if (error) throw error
    const linhas = (data ?? []) as unknown as { data: T }[]
    todas.push(...linhas.map((r) => r.data))
    if (linhas.length < 1000) break
  }
  return todas
}

export async function salvar<T extends { id: string }>(t: Tabela, row: T): Promise<void> {
  if (!regraEscrita(t, row, 'salvar')) throw new SemPermissao()
  if (supabase && t === 'funcionarios') {
    const { error } = await supabase.rpc('salvar_funcionarios', { registros: [row] })
    if (error) throw traduzirErro(error)
    avisar(t)
    return
  }
  if (!supabase) {
    const rows = lerLocal<T>(t)
    const i = rows.findIndex((r) => r.id === row.id)
    if (i >= 0) rows[i] = row
    else rows.push(row)
    gravarLocal(t, rows)
  } else {
    const { error } = await supabase.from(t).upsert({ id: row.id, data: row })
    if (error) throw traduzirErro(error)
  }
  avisar(t)
}

/** Grava vários registros de uma vez (importações) */
export async function salvarVarios<T extends { id: string }>(t: Tabela, novos: T[]): Promise<void> {
  if (!novos.length) return
  if (novos.some((r) => !regraEscrita(t, r, 'salvar'))) throw new SemPermissao()
  if (!supabase) {
    const porId = new Map(lerLocal<T>(t).map((r) => [r.id, r]))
    for (const r of novos) porId.set(r.id, r)
    gravarLocal(t, [...porId.values()])
  } else {
    for (let i = 0; i < novos.length; i += 200) {
      const parte = novos.slice(i, i + 200)
      const { error } =
        t === 'funcionarios'
          ? await supabase.rpc('salvar_funcionarios', { registros: parte })
          : await supabase.from(t).upsert(parte.map((r) => ({ id: r.id, data: r })))
      if (error) throw traduzirErro(error)
    }
  }
  avisar(t)
}

export async function remover(t: Tabela, id: string): Promise<void> {
  if (!regraEscrita(t, undefined, 'remover')) throw new SemPermissao()
  if (!supabase) {
    gravarLocal(t, lerLocal<{ id: string }>(t).filter((r) => r.id !== id))
  } else {
    const { data, error } = await supabase.from(t).delete().eq('id', id).select('id')
    if (error) throw traduzirErro(error)
    // O banco não dá erro ao recusar uma exclusão: apenas não apaga nada
    if (acessoRestrito && !data?.length) throw new SemPermissao()
  }
  avisar(t)
}

export function resetarDemo() {
  for (const t of Object.keys(dadosDemo) as Tabela[]) localStorage.removeItem(LS + t)
  for (const t of Object.keys(dadosDemo) as Tabela[]) avisar(t)
}

// ---------------------------------------------------------------- React

const ouvintes = new Map<Tabela, Set<() => void>>()
function avisar(t: Tabela) {
  ouvintes.get(t)?.forEach((fn) => fn())
}

/** Lê uma tabela e atualiza a tela sempre que ela mudar. */
export function useTabela<T extends { id: string }>(t: Tabela) {
  const [rows, setRows] = useState<T[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(() => {
    listar<T>(t)
      .then((r) => {
        setRows(r)
        setErro(null)
      })
      .catch((e) => setErro(String(e.message ?? e)))
      .finally(() => setCarregando(false))
  }, [t])

  useEffect(() => {
    recarregar()
    if (!ouvintes.has(t)) ouvintes.set(t, new Set())
    ouvintes.get(t)!.add(recarregar)
    return () => {
      ouvintes.get(t)!.delete(recarregar)
    }
  }, [t, recarregar])

  return { rows, carregando, erro }
}
