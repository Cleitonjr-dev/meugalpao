import { useRef, useState } from 'react'
import { Check, Monitor, Moon, Smartphone, Sun } from 'lucide-react'
import { useTheme, type Theme } from '@/context/ThemeContext'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isDesktop = useMediaQuery('(min-width: 768px)')

  useClickOutside(ref, () => setOpen(false))

  const AutoIcon = isDesktop ? Monitor : Smartphone
  const IconAtual = theme === 'light' ? Sun : theme === 'dark' ? Moon : AutoIcon

  const opcoes: { value: Theme; label: string; Icon: typeof Sun }[] = [
    { value: 'system', label: 'Auto', Icon: AutoIcon },
    { value: 'light', label: 'Claro', Icon: Sun },
    { value: 'dark', label: 'Escuro', Icon: Moon },
  ]

  return (
    <div className="relative" ref={ref}>
      <Tooltip texto="Tema do sistema">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Tema do sistema"
        >
          <IconAtual size={18} />
        </button>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {opcoes.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTheme(value)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-sm',
                theme === value
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
              )}
            >
              <Icon size={16} />
              <span className="flex-1 text-left">{label}</span>
              {theme === value && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
