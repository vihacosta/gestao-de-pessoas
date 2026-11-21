import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { Botao, Cabecalho, Campo, Cartao, Entrada, Selecao } from '../components/ui'
import { lerValor } from '../lib/extenso'
import { hojeISO } from '../lib/hoje'
import { novoId, salvar, useTabela } from '../lib/store'
import type { Funcionario } from '../lib/types'

function mascaraCPF(v: string) {
  const n = v.replace(/\D/g, '').slice(0, 11)
  return n
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

const vazio = (): Funcionario => ({
  id: novoId(),
  nome: '',
  cpf: '',
  cargo: '',
  tipo: 'clt',
  dataAdmissao: hojeISO(),
  salarios: [],
  ctpsUF: 'PR',
  horarioJornada: '220 horas mensais',
})

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{titulo}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  )
}

type CampoTexto = Exclude<{ [K in keyof Funcionario]-?: Funcionario[K] extends string | undefined ? K : never }[keyof Funcionario], undefined>

export default function FuncionarioForm() {
  const { id } = useParams()
  const navegar = useNavigate()
  const editaValores = useAuth().podeAlterar('valores')
  const { rows, carregando } = useTabela<Funcionario>('funcionarios')
  const [f, setF] = useState<Funcionario>(vazio)
  const [salarioInicial, setSalarioInicial] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const editando = !!id
  const numeroRepetido = f.numeroCadastro ? rows.find((r) => r.id !== f.id && r.numeroCadastro === f.numeroCadastro) : undefined

  useEffect(() => {
    if (!id || carregando) return
    const atual = rows.find((r) => r.id === id)
    if (atual) setF(atual)
  }, [id, rows, carregando])

  const set = <K extends keyof Funcionario>(k: K, v: Funcionario[K]) => setF((x) => ({ ...x, [k]: v }))

  /** Campo de texto simples ligado a uma propriedade do funcionário */
  const texto = (k: CampoTexto, rotulo: string, extra: { className?: string; required?: boolean; type?: string; placeholder?: string } = {}) => (
    <Campo rotulo={rotulo} className={extra.className}>
      <Entrada
        required={extra.required}
        type={extra.type}
        placeholder={extra.placeholder}
        value={(f[k] as string | undefined) ?? ''}
        onChange={(e) => set(k, (e.target.value || undefined) as never)}
      />
    </Campo>
  )

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      const reg: Funcionario = { ...f }
      if (!editando) reg.salarios = editaValores ? [{ data: f.dataAdmissao, valor: lerValor(salarioInicial), motivo: 'Admissão' }] : []
      await salvar('funcionarios', reg)
      navegar(`/funcionarios/${reg.id}`)
    } catch (err) {
      setErro(String((err as Error).message ?? err))
      setSalvando(false)
    }
  }

  return (
    <>
      <Cabecalho titulo={editando ? 'Editar funcionário' : 'Novo funcionário'} subtitulo="Os mesmos dados da ficha de admissão. Só os campos com * são obrigatórios." />
      <form onSubmit={enviar}>
        <Cartao className="space-y-8 p-5">
          <Secao titulo="Dados pessoais">
            {texto('nome', 'Nome completo *', { required: true, className: 'sm:col-span-2' })}
            {texto('dataNascimento', 'Data de nascimento', { type: 'date' })}
            <Campo rotulo="Sexo">
              <Selecao value={f.sexo ?? ''} onChange={(e) => set('sexo', e.target.value || undefined)}>
                <option value="" />
                <option>Feminino</option>
                <option>Masculino</option>
              </Selecao>
            </Campo>
            <Campo rotulo="Estado civil">
              <Selecao value={f.estadoCivil ?? ''} onChange={(e) => set('estadoCivil', e.target.value || undefined)}>
                <option value="" />
                {['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Selecao>
            </Campo>
            <Campo rotulo="Grau de instrução">
              <Selecao value={f.grauInstrucao ?? ''} onChange={(e) => set('grauInstrucao', e.target.value || undefined)}>
                <option value="" />
                {['Fundamental incompleto', 'Fundamental completo', 'Médio incompleto', 'Médio completo', 'Superior incompleto', 'Superior completo', 'Pós-graduação'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Selecao>
            </Campo>
            {texto('naturalidade', 'Naturalidade')}
            {texto('nomeMae', 'Nome da mãe')}
            {texto('nomePai', 'Nome do pai')}
            {texto('telefone', 'Telefone', { type: 'tel' })}
            {texto('email', 'E-mail', { type: 'email' })}
          </Secao>

          <Secao titulo="Documentos">
            <Campo rotulo="CPF *">
              <Entrada required inputMode="numeric" value={f.cpf} onChange={(e) => set('cpf', mascaraCPF(e.target.value))} placeholder="000.000.000-00" />
            </Campo>
            {texto('rg', 'RG')}
            {texto('pis', 'PIS')}
            {texto('ctps', 'Carteira de trabalho (número)')}
            {texto('ctpsSerie', 'Série')}
            {texto('ctpsUF', 'UF da carteira', { placeholder: 'PR' })}
          </Secao>

          <Secao titulo="Endereço">
            {texto('cep', 'CEP')}
            {texto('endereco', 'Rua / avenida', { className: 'sm:col-span-2' })}
            {texto('numero', 'Número')}
            {texto('complemento', 'Complemento')}
            {texto('bairro', 'Bairro')}
            {texto('municipio', 'Município')}
          </Secao>

          <Secao titulo="Contrato">
            <Campo
              rotulo="Nº de cadastro (ponto)"
              dica={numeroRepetido ? `Atenção: este número já é de ${numeroRepetido.nome}.` : 'O número usado para cadastrar a pessoa no ponto.'}
            >
              <Entrada value={f.numeroCadastro ?? ''} onChange={(e) => set('numeroCadastro', e.target.value.trim() || undefined)} className={numeroRepetido ? 'border-amber-500' : undefined} />
            </Campo>
            {texto('cargo', 'Cargo *', { required: true })}
            <Campo rotulo="Tipo de contratação *">
              <Selecao value={f.tipo} onChange={(e) => set('tipo', e.target.value as Funcionario['tipo'])}>
                <option value="clt">CLT</option>
                <option value="estagio">Estágio</option>
              </Selecao>
            </Campo>
            <Campo rotulo="Data de admissão *">
              <Entrada type="date" required value={f.dataAdmissao} onChange={(e) => set('dataAdmissao', e.target.value)} />
            </Campo>
            {texto('horarioJornada', 'Horário da jornada')}
            {editando ? (
              <Campo rotulo="Data de desligamento" dica="Preencha só se o funcionário saiu da empresa.">
                <Entrada type="date" value={f.dataDemissao ?? ''} onChange={(e) => set('dataDemissao', e.target.value || undefined)} />
              </Campo>
            ) : editaValores ? (
              <Campo rotulo={f.tipo === 'estagio' ? 'Bolsa-auxílio (R$) *' : 'Salário (R$) *'} dica="Reajustes são registrados depois, na ficha.">
                <Entrada required inputMode="decimal" value={salarioInicial} onChange={(e) => setSalarioInicial(e.target.value)} placeholder="2.500,00" />
              </Campo>
            ) : (
              <p className="self-end pb-2 text-xs text-gray-500">O salário será preenchido por quem tem acesso a valores.</p>
            )}
          </Secao>

          <Secao titulo="Cartão benefício">
            {editaValores && (
              <Campo rotulo="Cultura (R$ por mês)" dica="Valor fixo de Cultura no cartão benefício. Vazio = não recebe.">
                <Entrada
                  type="number"
                  min={0}
                  step={0.01}
                  value={f.beneficioCultura ?? ''}
                  onChange={(e) => set('beneficioCultura', e.target.value === '' ? undefined : Number(e.target.value))}
                />
              </Campo>
            )}
            <label className="flex items-center gap-2 self-end pb-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={!!f.semCartaoBeneficio} onChange={(e) => set('semCartaoBeneficio', e.target.checked || undefined)} />
              Não entra na planilha do cartão benefício (ex.: sócias)
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={!!f.semFerias} onChange={(e) => set('semFerias', e.target.checked || undefined)} />
              Não entra no controle de férias (ex.: sócios)
            </label>
          </Secao>

          <Secao titulo="Família, contatos e banco">
            <Campo rotulo="Dependentes (nome e parentesco)" className="sm:col-span-2 lg:col-span-3">
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-marca-500"
                rows={2}
                value={f.dependentes ?? ''}
                onChange={(e) => set('dependentes', e.target.value || undefined)}
              />
            </Campo>
            {texto('contatoEmergencia1', 'Contato em caso de necessidade 1', { placeholder: 'Nome e telefone' })}
            {texto('contatoEmergencia2', 'Contato em caso de necessidade 2', { placeholder: 'Nome e telefone' })}
            {editaValores && texto('pix', 'Pix')}
            {editaValores && texto('dadosBancarios', 'Banco, agência e conta', { className: 'sm:col-span-2' })}
          </Secao>

          <Campo rotulo="Observações">
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-marca-500"
              rows={3}
              value={f.observacoes ?? ''}
              onChange={(e) => set('observacoes', e.target.value || undefined)}
            />
          </Campo>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => navegar(-1)}>
              Cancelar
            </Botao>
            <Botao type="submit" disabled={salvando}>
              Salvar
            </Botao>
          </div>
        </Cartao>
      </form>
    </>
  )
}
