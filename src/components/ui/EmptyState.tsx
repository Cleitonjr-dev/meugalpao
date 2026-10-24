import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
}

export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icon size={32} />
      </span>
      <h3 className="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      {description && (
        <p className="m-0 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
      {action}
    </div>
  )
}
