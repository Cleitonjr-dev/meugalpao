import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CircleCheck, CircleX, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'warning' | 'info' | 'error'

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  /** Botão dentro do aviso (ex.: "Desfazer"). Com ação, o aviso fica mais tempo na tela. */
  action?: ToastAction
}

interface ToastItem {
  id: number
  message: string
  type: ToastType
  action?: ToastAction
}

interface ToastContextValue {
  success: (message: string, options?: ToastOptions) => void
  warning: (message: string, options?: ToastOptions) => void
  info: (message: string, options?: ToastOptions) => void
  error: (message: string, options?: ToastOptions) => void
  remove: (id: number) => void
  position: ToastPosition
  setPosition: (position: ToastPosition) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const TOAST_DURATION = 4000
const TOAST_DURATION_WITH_ACTION = 7000
const DISMISS_ANIMATION_MS = 400

const TOAST_ICONS = {
  success: CircleCheck,
  warning: AlertTriangle,
  info: Info,
  error: CircleX,
} as const

const TOAST_COLOR_CLASSES: Record<ToastType, string> = {
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
  error: 'text-red-500',
}

const TOAST_PROGRESS_CLASSES: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  error: 'bg-red-500',
}

const POSITION_CLASSES: Record<ToastPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
}

function isTopPosition(position: ToastPosition): boolean {
  return position.startsWith('top')
}

function Toast({ toast }: { toast: ToastItem }) {
  const { remove } = useToast()
  const [dismissed, setDismissed] = useState(false)
  const timerRef = useRef<number | null>(null)
  const progressRef = useRef<HTMLDivElement | null>(null)

  const IconComponent = TOAST_ICONS[toast.type]
  const duration = toast.action ? TOAST_DURATION_WITH_ACTION : TOAST_DURATION

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    window.setTimeout(() => remove(toast.id), DISMISS_ANIMATION_MS)
  }, [remove, toast.id])

  useEffect(() => {
    timerRef.current = window.setTimeout(handleDismiss, duration)

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [handleDismiss, duration])

  const handleMouseEnter = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }
    if (progressRef.current) {
      progressRef.current.style.animationPlayState = 'paused'
    }
  }

  const handleMouseLeave = () => {
    const progress = progressRef.current
    const remaining =
      progress && progress.parentElement
        ? (progress.offsetWidth / progress.parentElement.offsetWidth) * duration
        : duration

    if (progress) {
      progress.style.animationPlayState = 'running'
    }
    timerRef.current = window.setTimeout(handleDismiss, remaining)
  }

  return (
    <div
      role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        animation: dismissed
          ? 'toast-out 0.4s ease-in-out forwards'
          : 'toast-in 0.4s ease-in-out forwards',
      }}
      className="relative flex min-w-[320px] max-w-[420px] items-center gap-2 overflow-hidden rounded-lg border border-slate-200 bg-white p-3 pb-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:border-slate-700 dark:bg-slate-900"
    >
      <span className={cn('inline-flex shrink-0', TOAST_COLOR_CLASSES[toast.type])}>
        <IconComponent size={20} />
      </span>
      <p className="m-0 flex-1 text-sm text-slate-900 dark:text-slate-100">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick()
            handleDismiss()
          }}
          className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-primary-600 transition-colors hover:bg-slate-100 dark:text-primary-400 dark:hover:bg-slate-800"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Fechar"
        onClick={handleDismiss}
        className="inline-flex shrink-0 items-center justify-center rounded border-none bg-transparent p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <X size={18} />
      </button>
      <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-100 dark:bg-slate-800">
        <div
          ref={progressRef}
          className={cn('h-full', TOAST_PROGRESS_CLASSES[toast.type])}
          style={{ animation: `toast-progress ${duration}ms linear forwards` }}
        />
      </div>
    </div>
  )
}

function ToastsContainer({ toasts, position }: { toasts: ToastItem[]; position: ToastPosition }) {
  return (
    <div
      className={cn(
        'fixed z-[9999] flex gap-3',
        isTopPosition(position) ? 'flex-col-reverse' : 'flex-col',
        POSITION_CLASSES[position],
      )}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

interface ToastProviderProps {
  children: ReactNode
  defaultPosition?: ToastPosition
}

export function ToastProvider({ children, defaultPosition = 'top-right' }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [position, setPosition] = useState<ToastPosition>(defaultPosition)
  const idRef = useRef(0)

  const addToast = useCallback((type: ToastType, message: string, options?: ToastOptions) => {
    idRef.current += 1
    setToasts((prev) => [...prev, { id: idRef.current, message, type, action: options?.action }])
  }, [])

  const success = useCallback(
    (message: string, options?: ToastOptions) => addToast('success', message, options),
    [addToast],
  )
  const warning = useCallback(
    (message: string, options?: ToastOptions) => addToast('warning', message, options),
    [addToast],
  )
  const info = useCallback(
    (message: string, options?: ToastOptions) => addToast('info', message, options),
    [addToast],
  )
  const error = useCallback(
    (message: string, options?: ToastOptions) => addToast('error', message, options),
    [addToast],
  )
  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({ success, warning, info, error, remove, position, setPosition }),
    [success, warning, info, error, remove, position],
  )

  return (
    <ToastContext.Provider value={value}>
      <ToastsContainer toasts={toasts} position={position} />
      {children}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}
