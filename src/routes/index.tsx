import { Suspense, type ReactNode } from 'react'
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
        <Route
          path="/"
          element={
            <Suspense fallback={<PageLoader />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="/clientes"
          element={
            <Suspense fallback={<PageLoader />}>
              <ClientesPage />
            </Suspense>
          }
        />
        <Route
          path="/pagamentos"
          element={
            <Suspense fallback={<PageLoader />}>
              <PagamentosPage />
            </Suspense>
          }
        />
        <Route
          path="/recibos"
          element={
            <Suspense fallback={<PageLoader />}>
              <RecibosPage />
            </Suspense>
          }
        />
        <Route
          path="/relatorios"
          element={
            <Suspense fallback={<PageLoader />}>
              <RelatoriosPage />
            </Suspense>
          }
        />
        <Route
          path="/fechamento"
          element={
            <Suspense fallback={<PageLoader />}>
              <FechamentoPage />
            </Suspense>
          }
        />
        <Route
          path="/configuracoes"
          element={
            <Suspense fallback={<PageLoader />}>
              <ConfiguracoesPage />
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
