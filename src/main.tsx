import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './index.css'
import { AuthProvider, useAuth } from './auth'
import Layout from './components/Layout'
import Login, { DefinirSenha } from './pages/Login'
import Usuarios from './pages/Usuarios'
import Painel from './pages/Painel'
import Funcionarios from './pages/Funcionarios'
import FuncionarioForm from './pages/FuncionarioForm'
import FuncionarioDetalhe from './pages/FuncionarioDetalhe'
import FeriasPage from './pages/Ferias'
import EmBreve from './pages/EmBreve'
import Documentos from './pages/Documentos'
import Configuracoes from './pages/Configuracoes'
import Ausencias from './pages/Ausencias'
import CartaoPontoPage from './pages/CartaoPonto'
import Holerites from './pages/Holerites'
import Justificativas from './pages/Justificativas'

/** Endereço antigo da tela, mantendo o mês escolhido */
function RedirecionarOcorrencias() {
  const { search } = useLocation()
  return <Navigate to={`/ponto/ocorrencias${search}`} replace />
}

function Rotas() {
  const { logado, carregando, recuperandoSenha } = useAuth()
  if (carregando) return null
  if (recuperandoSenha) return <DefinirSenha />
  if (!logado) return <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Painel />} />
        <Route path="funcionarios" element={<Funcionarios />} />
        <Route path="funcionarios/novo" element={<FuncionarioForm />} />
        <Route path="funcionarios/:id" element={<FuncionarioDetalhe />} />
        <Route path="funcionarios/:id/editar" element={<FuncionarioForm />} />
        <Route path="ferias" element={<FeriasPage />} />
        <Route path="documentos" element={<Documentos />} />
        <Route path="holerites" element={<Holerites />} />
        <Route path="justificativas" element={<RedirecionarOcorrencias />} />
        <Route path="ponto" element={<CartaoPontoPage />} />
        <Route path="ponto/ocorrencias" element={<Justificativas />} />
        <Route path="ausencias" element={<Ausencias />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="em-breve/:area" element={<EmBreve />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Rotas />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
