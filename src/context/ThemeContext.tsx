import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'meugalpao.theme'

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

let trocaAtual = 0

/**
 * Aplica o tema na página. Em uma troca (não na primeira carga) desliga as transições por dois
 * quadros: sem isso, fundos mudam na hora e bordas/campos "deslizam" depois, o que aparece como piscada.
 */
function aplicarTema(tema: ResolvedTheme, comTransicaoDesligada: boolean) {
  const root = document.documentElement
  if (comTransicaoDesligada) root.classList.add('sem-transicao')

  root.classList.toggle('dark', tema === 'dark')
  root.style.colorScheme = tema

  if (!comTransicaoDesligada) return

  void root.offsetHeight // recalcula os estilos já com as transições desligadas
  const id = ++trocaAtual
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (id === trocaAtual) root.classList.remove('sem-transicao')
    })
  })
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(STORAGE_KEY)
    } catch {
      // armazenamento indisponível: usa o tema do sistema
    }
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  })
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemTheme(getSystemTheme())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme

  // useLayoutEffect: a classe muda antes da tela ser pintada, sem um quadro com o tema antigo.
  const temaAplicado = useRef<ResolvedTheme | null>(null)
  useLayoutEffect(() => {
    const mudou = temaAplicado.current !== null && temaAplicado.current !== resolvedTheme
    temaAplicado.current = resolvedTheme
    aplicarTema(resolvedTheme, mudou)
  }, [resolvedTheme])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // sem armazenamento: a escolha vale só até recarregar
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider')
  return ctx
}
