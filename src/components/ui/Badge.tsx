import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'primary'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  danger: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
  neutral: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300',
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        VARIANT_CLASSES[variant],
      )}
    >
      {children}
    </span>
  )
}
