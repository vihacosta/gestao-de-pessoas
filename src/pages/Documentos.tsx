import { AlertTriangle, Download, FileText, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Botao, Cabecalho, Campo, Cartao, Entrada, Selecao, Selo, Vazio, cx } from '../components/ui'
import { apagarArquivo, baixarArquivo, enviarArquivo, salvarNoComputador } from '../lib/arquivos'
import { hojeISO } from '../lib/hoje'
import {
  camposDoModelo,
  camposFuncionario,
  dadosFuncionario,
  modelosPadrao,
  montarDados,
  nomeArquivo,
  nomesGrupo,
  preencher,
  type CampoExtra,
  type Modelo,
} from '../lib/modelos'
import { novoId, remover, salvar, useTabela } from '../lib/store'
import type { ConfigEmpresa, Funcionario, GrupoModelo, ModeloEnviado } from '../lib/types'

const grupos: GrupoModelo[] = ['admissao', 'demissao', 'avulso', 'coletivo']
/** Os modelos padrão de demissão têm prazos calculados: são gerados pelo botão Desligamento, na ficha */
const geraNestaTela = (m: Modelo) => !m.id.startsWith('demissao-')
const conhecidos = new Set([...camposFuncionario.map(([k]) => k), 'socio_nome', 'socio_cpf'])

export function useModelos() {
  const { rows } = useTabela<ModeloEnviado>('modelos')
  return useMemo<Modelo[]>(
    () => [
      ...modelosPadrao,
      ...rows.map((r) => ({ id: r.id, titulo: r.titulo, grupo: r.grupo, extras: [], caminho: r.caminho })),
    ],
    [rows],
  )
}

export async function carregarModelo(m: Modelo): Promise<ArrayBuffer> {
  if (m.caminho) return (await baixarArquivo(m.caminho)).arrayBuffer()
  const r = await fetch(m.url!)
  if (!r.ok) throw new Error('Modelo não encontrado')
  return r.arrayBuffer()
}

/** Campos que o modelo usa mas que estão vazios no cadastro do funcionário */
export function camposFaltando(campos: string[], f: Funcionario, dataDoc: string) {
  const dados = dadosFuncionario(f, dataDoc)
  const rotulos = Object.fromEntries(camposFuncionario)
  return campos.filter((c) => c in dados && !dados[c]).map((c) => rotulos[c] ?? c)
}

export default function Documentos() {
  const [params, setParams] = useSearchParams()
  const aba = params.get('aba') === 'modelos' ? 'modelos' : 'gerar'
  return (
    <>
      <Cabecalho titulo="Documentos" subtitulo="Modelos da empresa preenchidos com os dados do funcionário" />
      <div className="mb-5 flex gap-6 border-b border-gray-200 text-sm">
        {(
          [
            ['gerar', 'Gerar documento'],
            ['modelos', 'Modelos'],
          ] as const
        ).map(([k, r]) => (
          <button
            key={k}
            onClick={() => setParams(k === 'gerar' ? {} : { aba: k })}
            className={cx('-mb-px border-b-2 pb-2', aba === k ? 'border-marca-600 font-semibold text-gray-900' : 'border-transparent text-gray-500')}
          >
            {r}
          </button>
        ))}
      </div>
      {aba === 'gerar' ? <Gerar /> : <Modelos />}
    </>
  )
}

// ---------------------------------------------------------------- gerar

function Gerar() {
  const modelos = useModelos()
  const { rows: funcionarios } = useTabela<Funcionario>('funcionarios')
  const { rows: configs } = useTabela<ConfigEmpresa>('config')
  const [params] = useSearchParams()
  const [modeloId, setModeloId] = useState(params.get('modelo') ?? '')
  const [funcId, setFuncId] = useState(params.get('funcionario') ?? '')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [dataDoc, setDataDoc] = useState(hojeISO())
  const [extras, setExtras] = useState<Record<string, string>>({})
  const [campos, setCampos] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)

  const ativos = useMemo(() => funcionarios.filter((f) => !f.dataDemissao).sort((a, b) => a.nome.localeCompare(b.nome)), [funcionarios])
  const m = modelos.find((x) => x.id === modeloId)
  const coletivo = m?.grupo === 'coletivo'

  // ao trocar de modelo: lê os campos e preenche os valores padrão
  useEffect(() => {
    setErro(null)
    if (!m) return setCampos([])
    setExtras(Object.fromEntries(m.extras.map((c) => [c.chave, c.padrao ?? ''])))
    carregarModelo(m)
      .then((b) => setCampos(camposDoModelo(b)))
      .catch((e) => setErro(String(e.message ?? e)))
  }, [m])

  // modelos enviados: campos desconhecidos viram perguntas de texto
  const camposExtras: CampoExtra[] = m?.caminho
    ? campos
        .filter((c) => !conhecidos.has(c) && !c.startsWith('#') && !c.startsWith('/'))
        .map((c) => ({ chave: c, rotulo: c.replace(/_/g, ' '), tipo: 'texto' }))
    : (m?.extras ?? [])

  const escolhidos = coletivo ? ativos.filter((f) => selecionados.has(f.id)) : ativos.filter((f) => f.id === funcId)
  const faltando = escolhidos.flatMap((f) => camposFaltando(campos, f, dataDoc).map((c) => `${f.nome}: ${c}`))
  const config = configs.find((c) => c.id === 'empresa')
  const faltaSocio = campos.some((c) => c.startsWith('socio_')) && !(config?.socioNome && config?.socioCpf)

  async function gerar(e: FormEvent) {
    e.preventDefault()
    if (!m || escolhidos.length === 0) return
    setGerando(true)
    setErro(null)
    try {
      const buf = await carregarModelo(m)
      const blob = preencher(buf, montarDados(m, { funcionarios: escolhidos, dataDoc, extras, config }))
      salvarNoComputador(blob, nomeArquivo(m, escolhidos))
    } catch (err) {
      setErro('Não foi possível gerar o documento: ' + String((err as Error).message ?? err))
    }
    setGerando(false)
  }

  return (
    <form onSubmit={gerar} className="grid gap-4 lg:grid-cols-3">
      <Cartao className="space-y-4 p-5 lg:col-span-2">
        <Campo rotulo="Documento">
          <Selecao required value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
            <option value="">Escolha o documento…</option>
            {grupos
              .filter((g) => modelos.some((x) => x.grupo === g && geraNestaTela(x)))
              .map((g) => (
                <optgroup key={g} label={nomesGrupo[g]}>
                  {modelos
                    .filter((x) => x.grupo === g && geraNestaTela(x))
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.titulo}
                      </option>
                    ))}
                </optgroup>
              ))}
          </Selecao>
        </Campo>

        {m && !coletivo && (
          <Campo rotulo="Funcionário">
            <Selecao required value={funcId} onChange={(e) => setFuncId(e.target.value)}>
              <option value="">Escolha…</option>
              {ativos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Selecao>
          </Campo>
        )}

        {m && coletivo && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Funcionários que vão assinar</span>
              <button
                type="button"
                className="text-xs text-marca-600 underline"
                onClick={() => setSelecionados(selecionados.size === ativos.length ? new Set() : new Set(ativos.map((f) => f.id)))}
              >
                {selecionados.size === ativos.length ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            </div>
            <div className="grid gap-1 rounded-lg border border-gray-200 p-2 sm:grid-cols-2">
              {ativos.map((f) => (
                <label key={f.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selecionados.has(f.id)}
                    onChange={(e) => {
                      const s = new Set(selecionados)
                      if (e.target.checked) s.add(f.id)
                      else s.delete(f.id)
                      setSelecionados(s)
                    }}
                  />
                  {f.nome}
                </label>
              ))}
            </div>
          </div>
        )}

        {m && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Data do documento">
              <Entrada type="date" required value={dataDoc} onChange={(e) => setDataDoc(e.target.value)} />
            </Campo>
            {camposExtras.map((c) => (
              <Campo key={c.chave} rotulo={c.rotulo} dica={c.dica}>
                <Entrada
                  type={c.tipo === 'data' || c.tipo === 'dataSemana' ? 'date' : c.tipo === 'mes' ? 'month' : 'text'}
                  inputMode={c.tipo === 'valor' ? 'decimal' : undefined}
                  placeholder={c.tipo === 'valor' ? '0,00' : undefined}
                  value={extras[c.chave] ?? ''}
                  onChange={(e) => setExtras({ ...extras, [c.chave]: e.target.value })}
                />
              </Campo>
            ))}
          </div>
        )}

        {(faltando.length > 0 || faltaSocio) && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle size={16} /> Informações em branco no cadastro
            </div>
            <ul className="ml-6 mt-1 list-disc">
              {faltando.map((x) => (
                <li key={x}>{x}</li>
              ))}
              {faltaSocio && <li>Nome e CPF do sócio (em Configurações)</li>}
            </ul>
            <div className="mt-1 text-xs">O documento sai com esses espaços vazios.</div>
          </div>
        )}
        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <div className="flex justify-end">
          <Botao type="submit" disabled={!m || escolhidos.length === 0 || gerando}>
            <Download size={16} /> Baixar documento (Word)
          </Botao>
        </div>
      </Cartao>

      <Cartao className="p-5 text-sm text-gray-600">
        <div className="mb-2 flex items-center gap-2 font-semibold text-gray-800">
          <FileText size={16} /> Como funciona
        </div>
        <p>Escolha o documento e o funcionário: o sistema preenche nome, CPF, carteira de trabalho e data, e baixa o arquivo em Word pronto para imprimir.</p>
        <p className="mt-2">Para gerar todos os documentos de admissão de uma vez, use o botão <b>Kit de admissão</b> na ficha do funcionário. Os documentos de demissão saem pelo botão <b>Desligamento</b>, na mesma ficha.</p>
      </Cartao>
    </form>
  )
}

// ---------------------------------------------------------------- modelos

function Modelos() {
  const modelos = useModelos()
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [titulo, setTitulo] = useState('')
  const [grupo, setGrupo] = useState<GrupoModelo>('avulso')
  const [campos, setCampos] = useState<string[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function escolher(f: File | null) {
    setArquivo(f)
    setCampos(null)
    setErro(null)
    if (!f) return
    if (!titulo) setTitulo(f.name.replace(/\.docx$/i, ''))
    try {
      setCampos(camposDoModelo(await f.arrayBuffer()))
    } catch {
      setErro('Não consegui ler este arquivo. Ele precisa ser um Word .docx (se for .doc antigo, abra no Word e use "Salvar como" .docx).')
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!arquivo || erro) return
    setEnviando(true)
    try {
      const id = novoId()
      const caminho = `modelos/${id}.docx`
      await enviarArquivo(caminho, arquivo)
      await salvar<ModeloEnviado>('modelos', { id, titulo, grupo, caminho, criadoEm: hojeISO() })
      setArquivo(null)
      setTitulo('')
      setCampos(null)
      ;(e.target as HTMLFormElement).reset()
    } catch (err) {
      setErro(String((err as Error).message ?? err))
    }
    setEnviando(false)
  }

  async function baixarModelo(m: Modelo) {
    salvarNoComputador(new Blob([await carregarModelo(m)]), `${m.titulo} (modelo).docx`)
  }

  async function excluir(m: Modelo) {
    if (!m.caminho || !confirm(`Excluir o modelo "${m.titulo}"?`)) return
    await apagarArquivo(m.caminho).catch(() => {})
    await remover('modelos', m.id)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {grupos.map((g) => (
          <Cartao key={g}>
            <div className="border-b border-gray-100 px-4 py-3 font-semibold">{nomesGrupo[g]}</div>
            {modelos.filter((x) => x.grupo === g).length === 0 && <Vazio>Nenhum modelo.</Vazio>}
            <ul className="divide-y divide-gray-100">
              {modelos
                .filter((x) => x.grupo === g)
                .map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <FileText size={16} className="text-gray-400" />
                    <span className="flex-1">{m.titulo}</span>
                    {m.caminho && <Selo cor="azul">enviado</Selo>}
                    <Botao variante="fantasma" className="px-2 py-1" onClick={() => baixarModelo(m)} title="Baixar o modelo em branco">
                      <Download size={14} />
                    </Botao>
                    {m.caminho && (
                      <Botao variante="fantasma" className="px-2 py-1" onClick={() => excluir(m)} aria-label="Excluir">
                        <Trash2 size={14} />
                      </Botao>
                    )}
                  </li>
                ))}
            </ul>
          </Cartao>
        ))}
      </div>

      <div className="space-y-4">
        <Cartao className="p-5">
          <form onSubmit={enviar} className="space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <Upload size={16} /> Adicionar modelo
            </div>
            <Campo rotulo="Arquivo Word (.docx)">
              <input type="file" accept=".docx" required onChange={(e) => escolher(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
            </Campo>
            <Campo rotulo="Nome do documento">
              <Entrada required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </Campo>
            <Campo rotulo="Tipo">
              <Selecao value={grupo} onChange={(e) => setGrupo(e.target.value as GrupoModelo)}>
                {grupos.map((g) => (
                  <option key={g} value={g}>
                    {nomesGrupo[g]}
                  </option>
                ))}
              </Selecao>
            </Campo>
            {campos && (
              <div className="text-xs text-gray-600">
                {campos.length === 0 ? (
                  <span className="text-amber-700">Nenhum campo {'{{...}}'} encontrado: o documento sairá sempre igual.</span>
                ) : (
                  <>Campos encontrados: {campos.map((c) => <code key={c} className="mr-1 rounded bg-gray-100 px-1">{c}</code>)}</>
                )}
              </div>
            )}
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <Botao type="submit" disabled={!arquivo || !!erro || enviando} className="w-full">
              Salvar modelo
            </Botao>
          </form>
        </Cartao>

        <Cartao className="p-5 text-sm">
          <div className="mb-2 font-semibold">Campos que você pode usar</div>
          <p className="mb-2 text-xs text-gray-500">
            Escreva no Word o nome do campo entre chaves duplas, por exemplo <code className="rounded bg-gray-100 px-1">{'{{nome}}'}</code>. Outros nomes viram perguntas na hora de gerar.
          </p>
          <ul className="space-y-1 text-xs">
            {camposFuncionario.map(([k, r]) => (
              <li key={k}>
                <code className="rounded bg-gray-100 px-1">{`{{${k}}}`}</code> <span className="text-gray-600">{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            Em documentos coletivos, a linha de assinatura que se repete fica assim:
            <code className="mt-1 block rounded bg-gray-100 px-1">{'{{#funcionarios}}{{nome}} - {{cpf}} ____{{/funcionarios}}'}</code>
          </p>
        </Cartao>
      </div>
    </div>
  )
}
