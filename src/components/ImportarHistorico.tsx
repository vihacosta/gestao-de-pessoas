import { FileSpreadsheet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { dataBR } from '../lib/clt'
import { classificar, linhasDaPlanilha, lerXlsx, registrosDoHistorico, sugerirVinculo, type LinhaPlanilha } from '../lib/historicoPlanilha'
import type { Justificativa } from '../lib/justificativas'
import { novoId, salvarVarios, useTabela } from '../lib/store'
import type { Funcionario } from '../lib/types'
import { EnviarArquivos } from './EnviarArquivos'
import { Botao, Modal, Selecao } from './ui'

const NOVO = '__novo'
const NAO = ''

const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())

interface Pessoa {
  nome: string
  abas: Set<string>
  validas: number
  primeira: string
  ultima: string
}

/** Importa a planilha antiga "CONTROLE ATRASOS E FALTAS.xlsx" para o histórico */
export function ImportarHistorico() {
  const [aberto, setAberto] = useState(false)
  const [linhas, setLinhas] = useState<LinhaPlanilha[] | null>(null)
  const [vinculo, setVinculo] = useState<Record<string, string>>({})
  const [gravando, setGravando] = useState(false)
  const [feito, setFeito] = useState<string | null>(null)
  const { rows: funcionarios } = useTabela<Funcionario>('funcionarios')

  const pessoas = useMemo(() => {
    const m = new Map<string, Pessoa>()
    for (const l of linhas ?? []) {
      if ('ignorar' in classificar(l)) continue
      const p = m.get(l.nome) ?? { nome: l.nome, abas: new Set(), validas: 0, primeira: l.data!, ultima: l.data! }
      p.abas.add(l.aba)
      p.validas++
      if (l.data! < p.primeira) p.primeira = l.data!
      if (l.data! > p.ultima) p.ultima = l.data!
      m.set(l.nome, p)
    }
    return [...m.values()].sort((a, b) => b.validas - a.validas)
  }, [linhas])

  const ignoradas = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of linhas ?? []) {
      const c = classificar(l)
      if ('ignorar' in c) m.set(c.ignorar, (m.get(c.ignorar) ?? 0) + 1)
    }
    return [...m.entries()]
  }, [linhas])

  async function ler(arquivos: File[]) {
    const lidas = linhasDaPlanilha(lerXlsx(await arquivos[0].arrayBuffer()))
    if (!lidas.length) throw new Error('Não encontrei as colunas DATA e NOME nesta planilha.')
    setLinhas(lidas)
    setFeito(null)
    const v: Record<string, string> = {}
    for (const nome of new Set(lidas.map((l) => l.nome))) v[nome] = sugerirVinculo(nome, funcionarios) ?? NAO
    setVinculo(v)
  }

  async function importar() {
    if (!linhas) return
    setGravando(true)
    try {
      const mapa = new Map<string, string>()
      const novos: Funcionario[] = []
      for (const p of pessoas) {
        const v = vinculo[p.nome]
        if (v === NOVO) {
          const f: Funcionario = {
            id: novoId(),
            nome: titulo(p.nome),
            cpf: '',
            cargo: '',
            tipo: 'clt',
            dataAdmissao: p.primeira,
            dataDemissao: p.ultima,
            salarios: [],
            semCartaoBeneficio: true,
            observacoes: 'Cadastrado pela importação da planilha de atrasos e faltas. Admissão e desligamento são só a primeira e a última ocorrência da planilha: corrija se souber as datas.',
          }
          novos.push(f)
          mapa.set(p.nome, f.id)
        } else if (v) mapa.set(p.nome, v)
      }
      const registros = registrosDoHistorico(linhas, mapa)
      await salvarVarios<Funcionario>('funcionarios', novos)
      await salvarVarios<Justificativa>('justificativas', registros)
      setFeito(`${registros.length} ocorrência(s) importada(s)${novos.length ? ` e ${novos.length} ex-colaborador(s) cadastrado(s)` : ''}.`)
      setLinhas(null)
    } catch (e) {
      alert('Não foi possível importar: ' + String((e as Error).message ?? e))
    }
    setGravando(false)
  }

  const total = pessoas.filter((p) => vinculo[p.nome]).reduce((s, p) => s + p.validas, 0)
  const ordenados = [...funcionarios].sort((a, b) => Number(!!a.dataDemissao) - Number(!!b.dataDemissao) || a.nome.localeCompare(b.nome))

  return (
    <>
      <Botao variante="secundario" onClick={() => setAberto(true)}>
        <FileSpreadsheet size={16} /> Importar planilha antiga
      </Botao>
      <Modal titulo="Importar planilha de atrasos e faltas" aberto={aberto} onFechar={() => setAberto(false)} largura="max-w-3xl">
        <div className="space-y-4 p-5 text-sm">
          {feito && <p className="rounded-lg bg-green-50 px-3 py-2 text-green-800">{feito}</p>}
          {!linhas ? (
            <>
              <p className="text-gray-600">
                Envie a planilha <b>CONTROLE ATRASOS E FALTAS.xlsx</b> (colunas DATA, NOME, FALTA/ATRASO/PONTO/EXTRA, ANOTAÇÕES e OCORRÊNCIA). Todas as abas são lidas, de ativos e de
                inativos. Você confere com quem cada nome vai ser ligado antes de importar.
              </p>
              <EnviarArquivos onArquivos={ler}>Escolher planilha</EnviarArquivos>
            </>
          ) : (
            <>
              <p className="text-gray-600">
                Escolha com quem cada nome da planilha vai ser ligado. Quem não está no sistema (ex-colaboradores) pode ser cadastrado como desligado, só com o nome. Importar de novo
                a mesma planilha não duplica nada.
              </p>
              <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-50 text-left text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Na planilha</th>
                      <th className="px-3 py-2 font-medium">Ocorrências</th>
                      <th className="px-3 py-2 font-medium">Ligar a</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pessoas.map((p) => (
                      <tr key={p.nome}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{p.nome}</div>
                          <div className="text-xs text-gray-400">{[...p.abas].map((a) => a.replace(/^FUNCIONARIOS /i, '').toLowerCase()).join(', ')}</div>
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {p.validas}
                          <div className="text-xs text-gray-400">
                            {dataBR(p.primeira)} a {dataBR(p.ultima)}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Selecao value={vinculo[p.nome] ?? NAO} onChange={(e) => setVinculo({ ...vinculo, [p.nome]: e.target.value })} className="py-1.5">
                            <option value={NAO}>Não importar</option>
                            <option value={NOVO}>Cadastrar como ex-colaborador ({titulo(p.nome)})</option>
                            {ordenados.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.nome}
                                {f.dataDemissao ? ' (desligado)' : ''}
                              </option>
                            ))}
                          </Selecao>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ignoradas.length > 0 && (
                <p className="text-xs text-gray-500">
                  Não entram (não são faltas nem atrasos): {ignoradas.map(([motivo, n]) => `${n} de ${motivo}`).join(' · ')}.
                </p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Botao variante="fantasma" onClick={() => setLinhas(null)}>
                  Trocar planilha
                </Botao>
                <Botao onClick={importar} disabled={gravando || total === 0}>
                  {gravando ? 'Importando...' : `Importar ${total} ocorrência(s)`}
                </Botao>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
