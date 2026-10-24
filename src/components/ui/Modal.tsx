import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  size?: ModalSize
  /** Botões de ação fixos na parte de baixo (não rolam junto com o conteúdo) */
  footer?: ReactNode
  /** Desative em formulários para não perder o que foi digitado ao clicar fora. */
  closeOnBackdrop?: boolean
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function ModalAberto({
  title,
  onClose,
  children,
  size = 'md',
  footer,
  closeOnBackdrop = true,
}: Omit<ModalProps, 'open'>) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const onCloseRef = useRef(onClose)
  const mousedownNoFundo = useRef(false)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const dialog = dialogRef.current
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return

      const itens = Array.from(dialog.querySelectorAll<HTMLElement>(FOCAVEIS))
      if (itens.length === 0) {
        event.preventDefault()
        return
      }
      const primeiro = itens[0]
      const ultimo = itens[itens.length - 1]
      if (event.shiftKey && (document.activeElement === primeiro || document.activeElement === dialog)) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflowAnterior
      anterior?.focus?.()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        mousedownNoFundo.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        // só fecha se o clique começou e terminou no fundo (evita fechar ao arrastar seleção de texto)
        if (closeOnBackdrop && mousedownNoFundo.current && e.target === e.currentTarget) onClose()
        mousedownNoFundo.current = false
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl outline-hidden dark:bg-slate-900 sm:rounded-2xl',
          SIZE_CLASSES[size],
        )}
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-4 pt-6">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-6', !footer && 'pb-6')}>
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function Modal({ open, ...resto }: ModalProps) {
  if (!open) return null
  return <ModalAberto {...resto} />
}
