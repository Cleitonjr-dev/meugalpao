import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

function Quebrado(): never {
  throw new Error('falha de teste')
}

afterEach(() => vi.restoreAllMocks())

describe('ErrorBoundary', () => {
  it('sem erro, mostra o conteúdo normalmente', () => {
    render(
      <ErrorBoundary>
        <p>tudo certo</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('tudo certo')).toBeInTheDocument()
  })

  it('se algo quebra na tela, mostra a mensagem em vez de uma tela em branco e registra o erro', () => {
    const console_ = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Quebrado />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('heading', { name: 'Algo deu errado' })).toBeInTheDocument()
    expect(screen.getByText(/Seus dados já salvos não foram afetados/)).toBeInTheDocument()
    expect(console_).toHaveBeenCalledWith('Erro inesperado na interface', expect.any(Error), expect.any(String))
  })

  it('o botão Recarregar recarrega a página', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const recarregar = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload: recarregar } })
    try {
      render(
        <ErrorBoundary>
          <Quebrado />
        </ErrorBoundary>,
      )
      await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Recarregar' }))
      expect(recarregar).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
  })
})
