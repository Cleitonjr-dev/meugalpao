import { Monitor, Moon, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme, type Theme } from '@/context/ThemeContext'
import { cn } from '@/lib/cn'

const THEME_OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'Sistema', icon: Monitor },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
]

/** Escolha entre tema do sistema, claro e escuro (usada dentro do menu do perfil). */
export function SeletorTema() {
  const { theme, setTheme } = useTheme()

  return (
    <div role="group" aria-label="Tema" className="flex flex-col gap-1 px-2 py-1">
      <span className="px-1 text-xs font-semibold text-slate-400 dark:text-slate-500">
        Tema do sistema
      </span>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={() => setTheme(value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-md px-1 py-1.5 text-xs font-semibold transition-colors',
              theme === value
                ? 'bg-white text-primary-600 dark:bg-slate-900 dark:text-primary-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
