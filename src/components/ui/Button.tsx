import { useRef, useState } from 'react'
import type { ButtonHTMLAttributes, MouseEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'text'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'p-3 text-base',
  lg: 'p-4 text-base',
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700',
  secondary:
    'border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  ghost:
    'bg-transparent text-primary-600 hover:bg-slate-100 dark:text-primary-400 dark:hover:bg-slate-800',
  text: 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

interface RippleState {
  id: number
  x: number
  y: number
  size: number
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  type = 'button',
  onClick,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const [ripples, setRipples] = useState<RippleState[]>([])
  const rippleId = useRef(0)

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const rippleSize = Math.max(rect.width, rect.height)

    rippleId.current += 1
    setRipples((prev) => [
      ...prev,
      {
        id: rippleId.current,
        x: event.clientX - rect.left - rippleSize / 2,
        y: event.clientY - rect.top - rippleSize / 2,
        size: rippleSize,
      },
    ])

    onClick?.(event)
  }

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative flex items-center justify-center gap-2 overflow-hidden rounded border border-transparent font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-60',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 size={18} className="shrink-0 animate-spin" />}
      {children}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="btn-ripple pointer-events-none absolute rounded-full bg-current"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
          onAnimationEnd={() =>
            setRipples((prev) => prev.filter((r) => r.id !== ripple.id))
          }
        />
      ))}
    </button>
  )
}
