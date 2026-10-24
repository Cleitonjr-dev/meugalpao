import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

/**
 * Comportamento de um menu suspenso acessível: abre pelo botão ou pelas setas, foca o primeiro
 * (ou último) item, percorre os itens (`role="menuitem"`) com as setas/Home/End e fecha com
 * Esc, Tab ou clique fora.
 */
export function useMenuTeclado() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const initialFocusRef = useRef<number | null>(null)

  const getItems = useCallback(
    () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
    [],
  )

  const openMenu = (focusIndex: number) => {
    setOpen(true)
    initialFocusRef.current = focusIndex
  }

  useEffect(() => {
    if (!open) return
    const items = getItems()
    items[initialFocusRef.current ?? 0]?.focus()
    initialFocusRef.current = null
  }, [open, getItems])

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const items = getItems()
      const current = items.indexOf(document.activeElement as HTMLElement)

      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
        return
      }

      if (event.key === 'Tab') {
        setOpen(false)
        return
      }

      let next: number
      if (event.key === 'ArrowDown') {
        next = current < 0 ? 0 : (current + 1) % items.length
      } else if (event.key === 'ArrowUp') {
        next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length
      } else if (event.key === 'Home') {
        next = 0
      } else if (event.key === 'End') {
        next = items.length - 1
      } else {
        return
      }

      event.preventDefault()
      items[next]?.focus()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, getItems])

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu(event.key === 'ArrowDown' ? 0 : -1)
    }
  }

  return { open, setOpen, rootRef, triggerRef, openMenu, handleTriggerKeyDown }
}
