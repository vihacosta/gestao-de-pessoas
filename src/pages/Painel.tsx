import { AlertTriangle, Cake, ClipboardCheck, FolderArchive, Gift, Palmtree, PartyPopper, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { areas, principaisCelular } from '../components/Layout'
import { SeloStatusFerias } from '../components/SolicitarFerias'
import { Cabecalho, Cartao, Selo, Vazio, Oculto } from '../components/ui'
import { aniversarioEmpresa, brl, dataBR, decimoTerceiro, fgtsMensal, periodosAquisitivos, salarioEm, statusFerias } from '../lib/clt'
import { hojeISO } from '../lib/hoje'
import { ehMarcoPresente, proximosAniversariantes, textoMarco } from '../lib/aniversarios'
import { precisaConferir } from '../lib/conferenciaAnual'
import { useTabela } from '../lib/store'
import type { Ausencia, CartaoPontoSalvo, DocumentoGuardado, Ferias, Funcionario } from '../lib/types'
import { mesAnterior, nomeMes, pendenciasAssinatura } from './Holerites'
import { useConfig } from './Configuracoes'
import { pendenciaJustificativas } from './Justificativas'

function Numero({ icone, rotulo, valor, sub }: { icone: ReactNode; rotulo: string; valor: ReactNode; sub?: ReactNode }) {
  return (
    <Cartao className="p-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">{icone}{rotulo}</div>
      <div className="mt-1 text-2xl font-bold">{valor}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </Cartao>
  )
}

export default function Painel() {
  const { rows: todos } = useTabela<Funcionario>('funcionarios')
  const { rows: ferias } = useTabela<Ferias>('ferias')
  const { rows: ausencias } = useTabela<Ausencia>('ausencias')
  const { rows: documentos } = useTabela<DocumentoGuardado>('documentos')
  const mesAssinar = mesAnterior()
  const { rows: pontos } = useTabela<CartaoPontoSalvo>('pontos')
  const pend = pendenciasAssinatura(todos, documentos, mesAssinar)
  const tolerancia = useConfig().toleranciaJustificativa ?? 0
  const pendJust = pendenciaJustificativas(todos, pontos, ausencias, documentos, mesAssinar, tolerancia)
  const faltaFolha = pendJust.ocorrencias > 0 && !pendJust.assinada
  const hoje = hojeISO()
  const ano = Number(hoje.slice(0, 4))
  const ativos = todos.filter((f) => !f.dataDemissao)
  const aConferir = ativos.filter((f) => precisaConferir(f, hoje)).sort((a, b) => a.nome.localeCompare(b.nome))

  const comStatus = ativos.map((f) => ({ f, status: statusFerias(periodosAquisitivos(f, ferias, ausencias, hoje), hoje) }))
  const alertasFerias = comStatus
    .filter((x) => x.status.codigo === 'vencida' || x.status.codigo === 'vence_em_breve')
    .sort((a, b) => (a.status.diasParaLimite ?? 0) - (b.status.diasParaLimite ?? 0))
  const deFerias = ferias.filter((x) => x.status === 'aprovada' && x.inicio <= hoje && x.fim >= hoje)
  const pendentes = ferias.filter((x) => x.status === 'solicitada')
  const aniversarios = ativos
    .map((f) => ({ f, a: aniversarioEmpresa(f.dataAdmissao, hoje) }))
    .filter((x) => x.a.diasAte <= 30 && x.a.anosNoProximo > 0)
    .sort((a, b) => a.a.diasAte - b.a.diasAte)
  const aniversariantes = proximosAniversariantes(ativos, hoje, 30)
  const festaHoje = [
    ...aniversariantes.filter((x) => x.a.diasAte === 0).map((x) => `${x.f.nome} faz aniversário (${x.a.idade} anos)`),
    ...aniversarios
      .filter((x) => x.a.diasAte === 0)
      .map((x) => `${x.f.nome} completa ${x.a.anosNoProximo} ${x.a.anosNoProximo === 1 ? 'ano' : 'anos'} de casa${ehMarcoPresente(x.a.anosNoProximo) ? ' (tem presente)' : ''}`),
  ]

  const folha = ativos.reduce((s, f) => s + salarioEm(f, hoje), 0)
  const fgts = ativos.reduce((s, f) => s + fgtsMensal(f, hoje), 0)
  const decimo = ativos.reduce((s, f) => s + decimoTerceiro(f, ano, hoje).valor, 0)
  const nome = (id: string) => todos.find((f) => f.id === id)?.nome ?? ''

  return (
    <>
      <Cabecalho titulo="Painel" subtitulo={`Hoje é ${dataBR(hoje)}`} />

      {festaHoje.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-900">
          <PartyPopper size={22} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Hoje tem comemoração!</div>
            {festaHoje.map((t) => (
              <div key={t} className="text-sm">{t}</div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero icone={<Users size={16} />} rotulo="Ativos" valor={ativos.length} sub={`${ativos.filter((f) => f.tipo === 'estagio').length} estagiários`} />
        <Numero icone={<Palmtree size={16} />} rotulo="De férias hoje" valor={deFerias.length} sub={`${pendentes.length} pedidos aguardando`} />
        <Numero icone={null} rotulo="Folha mensal" valor={<Oculto>{brl(folha)}</Oculto>} sub={<>FGTS do mês: <Oculto>{brl(fgts)}</Oculto></>} />
        <Numero icone={null} rotulo={`13º de ${ano}`} valor={<Oculto>{brl(decimo)}</Oculto>} sub="Soma estimada (sem encargos)" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao>
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 font-semibold">
            <AlertTriangle size={18} className="text-amber-600" /> Férias que precisam de atenção
          </div>
          {alertasFerias.length === 0 ? (
            <Vazio>Nenhuma férias vencendo nos próximos 90 dias.</Vazio>
          ) : (
            <ul className="divide-y divide-gray-100">
              {alertasFerias.map(({ f, status }) => (
                <li key={f.id}>
                  <Link to={`/funcionarios/${f.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                    <div>
                      <div className="font-medium">{f.nome}</div>
                      <div className="text-xs text-gray-500">
                        {status.periodo?.saldo} dias de saldo · iniciar até {dataBR(status.periodo?.limiteInicio)}
                      </div>
                    </div>
                    <SeloStatusFerias status={status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 font-semibold">
            <Cake size={18} className="text-marca-600" /> Aniversariantes (próximos 30 dias)
          </div>
          {aniversariantes.length === 0 ? (
            <Vazio>Nenhum aniversário nos próximos 30 dias.</Vazio>
          ) : (
            <ul className="divide-y divide-gray-100">
              {aniversariantes.map(({ f, a }) => (
                <li key={f.id} className={a.diasAte === 0 ? 'bg-green-50' : undefined}>
                  <Link to={`/funcionarios/${f.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                    <div>
                      <div className="font-medium">{f.nome}</div>
                      <div className="text-xs text-gray-500">
                        {dataBR(a.proximo).slice(0, 5)} · faz {a.idade} anos
                      </div>
                    </div>
                    <Selo cor={a.diasAte === 0 ? 'verde' : a.diasAte <= 7 ? 'amarelo' : 'cinza'}>
                      {a.diasAte === 0 ? 'Hoje!' : a.diasAte === 1 ? 'Amanhã' : `em ${a.diasAte} dias`}
                    </Selo>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {ativos.some((f) => !f.dataNascimento) && (
            <Link to="/funcionarios" className="block border-t border-gray-100 px-4 py-2 text-xs text-amber-700 hover:bg-gray-50">
              {ativos.filter((f) => !f.dataNascimento).length} funcionário(s) sem data de nascimento no cadastro
            </Link>
          )}
        </Cartao>

        <Cartao>
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 font-semibold">
            <Gift size={18} className="text-marca-600" /> Aniversários de empresa (próximos 30 dias)
          </div>
          {aniversarios.length === 0 ? (
            <Vazio>Nenhum nos próximos 30 dias.</Vazio>
          ) : (
            <ul className="divide-y divide-gray-100">
              {aniversarios.map(({ f, a }) => (
                <li key={f.id} className={a.diasAte === 0 ? 'bg-green-50' : undefined}>
                  <Link to={`/funcionarios/${f.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                    <div>
                      <div className="font-medium">{f.nome}</div>
                      <div className="text-xs text-gray-500">{dataBR(a.proximo)}</div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {ehMarcoPresente(a.anosNoProximo) && (
                        <Selo cor="roxo">
                          <Gift size={12} /> {textoMarco(a.anosNoProximo)}
                        </Selo>
                      )}
                      <Selo cor={a.diasAte === 0 ? 'verde' : 'cinza'}>
                        {!ehMarcoPresente(a.anosNoProximo) && `${a.anosNoProximo} ${a.anosNoProximo === 1 ? 'ano' : 'anos'} · `}
                        {a.diasAte === 0 ? 'hoje!' : `em ${a.diasAte} dias`}
                      </Selo>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        {aConferir.length > 0 && (
          <Cartao>
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 font-semibold">
              <ClipboardCheck size={18} className="text-amber-600" /> Conferir dados do cadastro ({ano})
            </div>
            <p className="px-4 pt-3 text-xs text-gray-500">
              Todo começo de ano: confirme endereço, telefone, contatos de emergência etc. com cada pessoa e marque "Está tudo certo" na ficha.
            </p>
            <ul className="divide-y divide-gray-100">
              {aConferir.map((f) => (
                <li key={f.id}>
                  <Link to={`/funcionarios/${f.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-50">
                    <span className="font-medium">{f.nome}</span>
                    <Selo cor="amarelo">Conferir</Selo>
                  </Link>
                </li>
              ))}
            </ul>
          </Cartao>
        )}

        {(pend.holerites > 0 || pend.pontos > 0 || faltaFolha) && (
          <Cartao>
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 font-semibold">
              <FolderArchive size={18} className="text-amber-600" /> Assinaturas de {nomeMes(mesAssinar).toLowerCase()}
            </div>
            {(pend.holerites > 0 || pend.pontos > 0) && (
              <Link to={`/holerites?mes=${mesAssinar}`} className="block space-y-1 px-4 py-3 text-sm hover:bg-gray-50">
                {pend.holerites > 0 && <div>{pend.holerites} holerite(s) assinado(s) faltando</div>}
                {pend.pontos > 0 && <div>{pend.pontos} cartão(ões) ponto assinado(s) faltando</div>}
                <div className="text-xs text-marca-600 underline">Guardar agora</div>
              </Link>
            )}
            {faltaFolha && (
              <Link to={`/justificativas?mes=${mesAssinar}`} className="block space-y-1 border-t border-gray-100 px-4 py-3 text-sm hover:bg-gray-50">
                <div>Folha de justificativas assinada faltando ({pendJust.ocorrencias} ocorrência(s))</div>
                <div className="text-xs text-marca-600 underline">Imprimir ou guardar a folha</div>
              </Link>
            )}
          </Cartao>
        )}

        {pendentes.length > 0 && (
          <Cartao>
            <div className="border-b border-gray-100 px-4 py-3 font-semibold">Pedidos de férias aguardando aprovação</div>
            <ul className="divide-y divide-gray-100">
              {pendentes.map((x) => (
                <li key={x.id}>
                  <Link to="/ferias" className="block px-4 py-3 hover:bg-gray-50">
                    <div className="font-medium">{nome(x.funcionarioId)}</div>
                    <div className="text-xs text-gray-500">{dataBR(x.inicio)} a {dataBR(x.fim)} · {x.dias} dias</div>
                  </Link>
                </li>
              ))}
            </ul>
          </Cartao>
        )}

        {/* No celular, as áreas que não cabem na barra inferior */}
        <Cartao className="md:hidden">
          <div className="border-b border-gray-100 px-4 py-3 font-semibold">Outras áreas</div>
          <ul className="divide-y divide-gray-100">
            {areas.filter((a) => !principaisCelular.includes(a.to)).map((a) => (
              <li key={a.to}>
                <Link to={a.to} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <a.icone size={18} className="text-gray-500" />
                  <span className="flex-1">{a.rotulo}</span>
                  {a.embreve && <span className="text-[10px] uppercase text-gray-400">em breve</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>
    </>
  )
}
