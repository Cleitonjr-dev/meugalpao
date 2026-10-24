import { cn } from '@/lib/utils'

interface LoadingProps {
  size?: number
  label?: string
  className?: string
}

/** Loading padrão do sistema: quadrado, spinner e texto. */
export function Loading({ size = 32, label, className }: LoadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-900',
        className,
      )}
    >
      <span
        role="status"
        aria-label="Carregando"
        className="inline-block animate-spin rounded-full border-solid border-slate-200 border-t-primary-600 dark:border-slate-700 dark:border-t-primary-400"
        style={{ width: size, height: size, borderWidth: 3 }}
      />
      {label && <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>}
    </div>
  )
}
