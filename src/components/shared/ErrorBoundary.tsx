import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  falhou: boolean
}

/** Evita a "tela branca": se algo quebrar na renderização, mostra uma mensagem e permite recarregar. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { falhou: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { falhou: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Ponto único para ligar um serviço de monitoramento no futuro.
    console.error('Erro inesperado na interface', error, info.componentStack)
  }

  render() {
    if (!this.state.falhou) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center dark:bg-slate-950">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Algo deu errado
        </h1>
        <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">
          Ocorreu um erro inesperado. Seus dados já salvos não foram afetados. Recarregue a página
          para continuar.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700"
        >
          Recarregar
        </button>
      </div>
    )
  }
}
