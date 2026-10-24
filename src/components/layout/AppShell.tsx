import { Suspense, useEffect, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router'
import { precarregarPaginas } from '@/routes/paginas'
import { Navbar } from '@/components/layout/Navbar'
import { PageLoader } from '@/components/ui/PageLoader'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { MINUTOS_INATIVIDADE } from '@/config/constants'
import { useInatividade } from '@/hooks/useInatividade'
import { cn } from '@/lib/utils'

/** Telas com tabelas de muitas colunas: usam mais da largura da tela, para não rolar para o lado. */
const ROTAS_LARGAS = ['/pagamentos', '/recibos']

export function AppShell({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation()
  const { signOut } = useAuth()
  const toast = useToast()
  const larga = ROTAS_LARGAS.includes(pathname)

  useInatividade(MINUTOS_INATIVIDADE, () => {
    toast.info('Você foi desconectado por ficar muito tempo sem usar o sistema.')
    void signOut()
  })

  useEffect(() => {
    // Depois que a tela principal aparece, baixa as outras páginas sem atrapalhar.
    const timer = window.setTimeout(precarregarPaginas, 1500)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main
        className={cn(
          'mx-auto w-full flex-1 px-4 py-6',
          larga ? 'max-w-[100rem]' : 'max-w-6xl',
        )}
      >
        <Suspense fallback={<PageLoader />}>{children ?? <Outlet />}</Suspense>
      </main>
    </div>
  )
}
