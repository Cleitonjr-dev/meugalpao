import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'

export type StatTone = 'primary' | 'success' | 'warning' | 'neutral'

const TONES: Record<StatTone, { icon: string; value: string }> = {
  primary: {
    icon: 'bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-300',
    value: 'text-primary-600 dark:text-primary-300',
  },
  success: {
    icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    value: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    icon: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    value: 'text-amber-600 dark:text-amber-400',
  },
  neutral: {
    icon: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    value: 'text-slate-900 dark:text-white',
  },
}

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  sub?: string
  tone?: StatTone
}

export function StatCard({ icon: Icon, label, value, sub, tone = 'neutral' }: StatCardProps) {
  const toneClasses = TONES[tone]
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            toneClasses.icon,
          )}
        >
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className={cn('truncate text-2xl font-semibold', toneClasses.value)}>{value}</p>
          {sub && (
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{sub}</p>
          )}
        </div>
      </div>
    </Card>
  )
}
