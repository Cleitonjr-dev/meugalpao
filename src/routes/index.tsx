import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from '@/context/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoader } from '@/components/ui/PageLoader'
import { LoginPage } from '@/features/auth/LoginPage'
import { VerificarReciboPage } from '@/features/verificacao/VerificarReciboPage'
import {
  ClientesPage,
  ConfiguracoesPage,
  DashboardPage,
  FechamentoPage,
  PagamentosPage,
  RecibosPage,
  RelatoriosPage,
} from '@/routes/paginas'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, recovering } = useAuth()

  if (loading) {
    return <PageLoader fullScreen />
  }

  // Sem sessão, ou no meio da redefinição de senha: volta para a tela de login.
  if (!session || recovering) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

/** Logado: abre dentro do sistema (com o menu). Sem login: página pública. */
function VerificarRota() {
  const { session, loading, recovering } = useAuth()

  if (loading) return <PageLoader fullScreen />

  if (session && !recovering) {
    return (
      <AppShell>
        <VerificarReciboPage embutido />
      </AppShell>
    )
  }
  return <VerificarReciboPage />
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verificar" element={<VerificarRota />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/pagamentos" element={<PagamentosPage />} />
        <Route path="/recibos" element={<RecibosPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="/fechamento" element={<FechamentoPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
