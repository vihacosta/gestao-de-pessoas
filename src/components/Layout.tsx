import {
  CalendarCheck,
  Clock,
  ClipboardList,
  FileSignature,
  FolderArchive,
  LayoutDashboard,
  LogOut,
  Palmtree,
  Receipt,
  Settings,
  Stethoscope,
  UserCog,
  Users,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth'
import { modoDemo, resetarDemo } from '../lib/store'
import { cx } from './ui'

export const areas = [
  { to: '/', rotulo: 'Painel', icone: LayoutDashboard, fim: true },
  { to: '/funcionarios', rotulo: 'Funcionários', icone: Users },
  { to: '/ferias', rotulo: 'Férias', icone: Palmtree },
  { to: '/documentos', rotulo: 'Documentos', icone: FileSignature },
  { to: '/holerites', rotulo: 'Holerites', icone: FolderArchive },
  { to: '/ponto', rotulo: 'Cartão ponto', icone: Clock, fim: true, submenu: [{ to: '/ponto/ocorrencias', rotulo: 'Ocorrências', icone: ClipboardList }] },
  { to: '/ausencias', rotulo: 'Faltas e bônus', icone: Stethoscope },
  { to: '/em-breve/fechamento', rotulo: 'Fechamento mensal', icone: Receipt, embreve: true },
  { to: '/usuarios', rotulo: 'Usuários', icone: UserCog },
  { to: '/configuracoes', rotulo: 'Configurações', icone: Settings },
]

export const principaisCelular = ['/', '/funcionarios', '/ferias', '/holerites']

export default function Layout() {
  const { email, sair } = useAuth()
  return (
    <div className="flex h-full">
      {/* Barra lateral (computador) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <CalendarCheck className="text-marca-600" />
          <span className="font-bold">Gestão de Pessoas</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {areas.map((a) => (
            <div key={a.to} className="space-y-1">
              <NavLink
                to={a.to}
                end={a.fim}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                    isActive ? 'bg-marca-50 font-semibold text-marca-700' : 'text-gray-700 hover:bg-gray-100',
                  )
                }
              >
                <a.icone size={18} />
                <span className="flex-1">{a.rotulo}</span>
                {a.embreve && <span className="text-[10px] uppercase text-gray-400">em breve</span>}
              </NavLink>
              {a.submenu?.map((s) => (
                <NavLink
                  key={s.to}
                  to={s.to}
                  className={({ isActive }) =>
                    cx(
                      'ml-6 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm',
                      isActive ? 'bg-marca-50 font-semibold text-marca-700' : 'text-gray-600 hover:bg-gray-100',
                    )
                  }
                >
                  <s.icone size={16} />
                  {s.rotulo}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-3 text-xs text-gray-500">
          <div className="mb-2 truncate px-2">{email}</div>
          <button onClick={sair} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-gray-100">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {modoDemo && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
            <span>
              <b>Modo demonstração:</b> os dados ficam só neste navegador e os funcionários de exemplo são fictícios.
            </span>
            <button className="underline" onClick={() => confirm('Apagar tudo e voltar aos dados de exemplo?') && resetarDemo()}>
              Restaurar exemplo
            </button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-6 md:px-8 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-200 bg-white md:hidden">
        {areas
          .filter((a) => principaisCelular.includes(a.to))
          .map((a) => (
            <NavLink
              key={a.to}
              to={a.to}
              end={a.fim}
              className={({ isActive }) =>
                cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]', isActive ? 'text-marca-600' : 'text-gray-500')
              }
            >
              <a.icone size={20} />
              {a.rotulo}
            </NavLink>
          ))}
        <button onClick={sair} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-gray-500">
          <LogOut size={20} />
          Sair
        </button>
      </nav>
    </div>
  )
}
