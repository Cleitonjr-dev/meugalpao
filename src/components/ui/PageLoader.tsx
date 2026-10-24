import { useEffect, useState } from 'react'
import { Loading } from '@/components/ui/Loading'

interface PageLoaderProps {
  /** Espera (ms) antes de mostrar o loading: carregamentos rápidos não piscam na tela. */
  delay?: number
  /** Ocupa a tela toda (usado antes de existir a barra de navegação). */
  fullScreen?: boolean
}

export function PageLoader({ delay = 200, fullScreen = false }: PageLoaderProps) {
  const [visivel, setVisivel] = useState(delay <= 0)

  useEffect(() => {
    if (delay <= 0) return
    const timer = window.setTimeout(() => setVisivel(true), delay)
    return () => window.clearTimeout(timer)
  }, [delay])

  return (
    <div
      className={
        fullScreen
          ? 'flex min-h-screen items-center justify-center'
          : 'flex min-h-[60vh] items-center justify-center'
      }
    >
      {visivel && <Loading size={40} label="Carregando..." />}
    </div>
  )
}
