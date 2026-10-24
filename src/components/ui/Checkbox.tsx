import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps {
  label?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  error?: string
  hint?: string
  id?: string
}

export function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
  error,
  hint,
  id,
}: CheckboxProps) {
  return (
    <div className="flex w-full flex-col gap-[5px]">
      <label
        className={cn(
          'relative inline-flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-900 dark:text-slate-100',
          disabled && 'cursor-not-allowed',
        )}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer absolute h-0 w-0 opacity-0"
        />
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border text-white transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-500',
            checked
              ? 'border-primary-600 bg-primary-600'
              : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900',
            disabled && 'opacity-60',
          )}
        >
          {checked && <Check size={12} />}
        </span>
        {label && <span>{label}</span>}
      </label>
      {error && <span className="text-[13px] text-red-500">{error}</span>}
      {!error && hint && (
        <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      )}
    </div>
  )
}
