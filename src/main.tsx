import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

const configurado = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)

function esconderSplash() {
  const bootLoader = document.getElementById('boot-loader')
  if (!bootLoader) return
  const MIN_SPLASH_MS = 600
  const wait = Math.max(0, MIN_SPLASH_MS - performance.now())
  window.setTimeout(() => {
    bootLoader.classList.add('is-leaving')
    window.setTimeout(() => bootLoader.remove(), 450)
  }, wait)
}

async function iniciar() {
  const root = createRoot(document.getElementById('root')!)

  if (!configurado) {
    root.render(
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold">Configuração ausente</h1>
        <p className="max-w-md text-sm text-slate-600">
          Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env (veja .env.example) e
          reinicie o servidor.
        </p>
      </div>,
    )
    esconderSplash()
    return
  }

  // Importado só depois da checagem: o cliente do Supabase falha se faltar configuração.
  const { default: App } = await import('./App.tsx')
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
  esconderSplash()
}

void iniciar()
