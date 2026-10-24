// Preparação comum dos testes: ambiente de navegador simulado, relógio fixo e Supabase falso.
// Em todos os testes: fuso de Fortaleza (definido em vite.config.ts) e "agora" = sábado, 11/10/2025, 10:00
// (dia de cobrança).
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { bancoFalso, moduloSupabaseFalso } from '@/test/bancoFalso'

export const AGORA_DOS_TESTES = new Date(2025, 9, 11, 10, 0, 0)

vi.mock('@/lib/supabase', () => moduloSupabaseFalso())

// O jsdom não implementa estas partes do navegador.
if (typeof window !== 'undefined') {
  window.matchMedia ??= ((consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia

  class ResizeObserverFalso {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver ??= ResizeObserverFalso as unknown as typeof ResizeObserver

  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  Element.prototype.scrollIntoView = vi.fn()
  URL.createObjectURL = vi.fn(() => 'blob:falso')
  URL.revokeObjectURL = vi.fn()
}

beforeEach(() => {
  // Só a data é falsa; os temporizadores continuam reais (a digitação e as esperas funcionam).
  vi.useFakeTimers({ toFake: ['Date'], now: AGORA_DOS_TESTES })
  bancoFalso.reiniciar()
  try {
    window.localStorage.clear()
    window.sessionStorage.clear()
  } catch {
    // armazenamento indisponível: nada a limpar
  }
  if (typeof window !== 'undefined') {
    window.print = vi.fn()
    window.open = vi.fn() as unknown as typeof window.open
    window.confirm = vi.fn(() => true)
    window.prompt = vi.fn(() => null)
  }
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
