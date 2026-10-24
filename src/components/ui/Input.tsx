import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  success?: boolean
  endAdornment?: ReactNode
  ref?: Ref<HTMLInputElement>
}

export function Input({
  label,
  error,
  hint,
  success = false,
  endAdornment,
  id,
  className,
  ref,
  ...rest
}: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="flex w-full flex-col gap-[5px]">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex min-h-[40px] w-full items-center rounded-md border bg-slate-50 transition-[background-color,border-color,box-shadow] duration-200 focus-within:ring-[3px] focus-within:ring-primary-500/10 dark:bg-slate-900',
          error
            ? 'border-red-500 focus-within:border-red-500'
            : success
              ? 'border-emerald-500 focus-within:border-emerald-500'
              : 'border-slate-200 focus-within:border-primary-500 dark:border-slate-700',
        )}
      >
        <input
          id={inputId}
          ref={ref}
          aria-invalid={Boolean(error)}
          className={cn(
            'flex h-full min-w-0 flex-[1_0_0] border-none bg-transparent px-3 text-sm font-normal text-slate-700 outline-hidden placeholder:text-[13px] placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500',
            className,
          )}
          {...rest}
        />
        {endAdornment && <div className="flex items-center pr-3">{endAdornment}</div>}
      </div>
      {error && <span className="text-[13px] text-red-500">{error}</span>}
      {!error && hint && (
        <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      )}
    </div>
  )
}
