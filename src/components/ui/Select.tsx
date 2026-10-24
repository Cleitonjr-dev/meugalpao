import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { calcularPosicaoLista, type PosicaoLista } from '@/components/ui/posicaoLista'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  label?: string
  placeholder?: string
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  error?: string
  hint?: string
  searchable?: boolean
  disabled?: boolean
  emptyMessage?: string
  startAdornment?: ReactNode
  id?: string
}

export function Select({
  label,
  placeholder = 'Selecione...',
  options,
  value,
  onChange,
  error,
  hint,
  searchable = false,
  disabled = false,
  emptyMessage = 'Nenhuma opção encontrada',
  startAdornment,
  id,
}: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const [open, setOpen] = useState(false)
  const [posicao, setPosicao] = useState<PosicaoLista | null>(null)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const gatilhoRef = useRef<HTMLButtonElement | null>(null)
  const listaRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  const filteredOptions = useMemo(() => {
    if (!searchable || !search.trim()) return options
    const term = search.trim().toLowerCase()
    return options.filter((option) => option.label.toLowerCase().includes(term))
  }, [options, searchable, search])

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  )

  const medir = useCallback(() => {
    const campo = gatilhoRef.current?.getBoundingClientRect()
    if (!campo) return
    setPosicao(
      calcularPosicaoLista(
        { top: campo.top, bottom: campo.bottom, left: campo.left, width: campo.width },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    )
  }, [])

  const abrir = useCallback(() => {
    medir()
    setActiveIndex(0)
    setOpen(true)
  }, [medir])

  const fechar = useCallback(() => {
    setOpen(false)
    setSearch('')
  }, [])

  // A lista é desenhada fora do modal (portal): precisa acompanhar o campo e fechar ao clicar fora.
  useEffect(() => {
    if (!open) return

    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target as Node
      if (gatilhoRef.current?.contains(alvo) || listaRef.current?.contains(alvo)) return
      fechar()
    }

    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    document.addEventListener('mousedown', aoClicar)
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
      document.removeEventListener('mousedown', aoClicar)
    }
  }, [open, medir, fechar])

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus()
  }, [open, searchable])

  // Mantém a opção destacada pelo teclado visível dentro da lista.
  useEffect(() => {
    if (!open) return
    listaRef.current
      ?.querySelector<HTMLElement>(`[data-indice="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  const selectOption = (optionValue: string) => {
    onChange?.(optionValue)
    fechar()
    gatilhoRef.current?.focus()
  }

  const alternar = () => {
    if (disabled) return
    if (open) fechar()
    else abrir()
  }

  const handleSearch = (texto: string) => {
    setSearch(texto)
    setActiveIndex(0)
  }

  // Esc fecha só a lista; sem isso o modal em volta também fecharia.
  const aoApertarEsc = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      fechar()
      gatilhoRef.current?.focus()
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        abrir()
        return
      }
      setActiveIndex((prev) => {
        if (filteredOptions.length === 0) return prev
        if (event.key === 'ArrowDown') {
          return (prev + 1) % filteredOptions.length
        }
        return (prev - 1 + filteredOptions.length) % filteredOptions.length
      })
    }

    if (event.key === 'Enter' && open) {
      event.preventDefault()
      const option = filteredOptions[activeIndex]
      if (option) selectOption(option.value)
    }

    aoApertarEsc(event)
  }

  return (
    <div className="flex w-full flex-col gap-[5px]">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {label}
        </label>
      )}
      <div className="relative w-full">
        <button
          ref={gatilhoRef}
          id={selectId}
          type="button"
          disabled={disabled}
          onClick={alternar}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'flex min-h-[40px] w-full items-center justify-between gap-2 rounded-md border bg-slate-50 px-3 text-left text-sm text-slate-700 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900 dark:text-slate-200',
            error
              ? 'border-red-500'
              : open
                ? 'border-primary-500'
                : 'border-slate-200 dark:border-slate-700',
          )}
        >
          {startAdornment && (
            <span className="inline-flex items-center text-slate-400 dark:text-slate-500">
              {startAdornment}
            </span>
          )}
          <span
            className={cn(
              'flex-1 truncate',
              !selectedOption ? 'text-slate-400 dark:text-slate-500' : undefined,
            )}
          >
            {selectedOption?.label ?? placeholder}
          </span>
          <span className="inline-flex text-slate-400 dark:text-slate-500">
            <ChevronDown size={16} />
          </span>
        </button>

        {open &&
          !disabled &&
          posicao &&
          createPortal(
            <div
              ref={listaRef}
              role="listbox"
              onKeyDown={aoApertarEsc}
              style={{
                position: 'fixed',
                left: posicao.left,
                width: posicao.width,
                top: posicao.top,
                bottom: posicao.bottom,
                maxHeight: posicao.maxHeight,
              }}
              className="z-[100] flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.2)] dark:border-slate-700 dark:bg-slate-900"
            >
              {searchable && (
                <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 text-slate-400 dark:border-slate-700">
                  <Search size={16} />
                  <input
                    ref={searchRef}
                    value={search}
                    placeholder="Buscar..."
                    onChange={(event) => handleSearch(event.target.value)}
                    className="flex-1 border-none bg-transparent py-2.5 text-sm text-slate-700 outline-hidden placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
                  />
                </div>
              )}
              {filteredOptions.length > 0 ? (
                <ul className="thin-scroll m-0 min-h-0 list-none overflow-y-auto p-1">
                  {filteredOptions.map((option, index) => (
                    <li
                      key={option.value}
                      role="option"
                      data-indice={index}
                      aria-selected={option.value === value}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectOption(option.value)}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-2 rounded px-2.5 py-2 text-sm text-slate-900 dark:text-slate-100',
                        index === activeIndex || option.value === value
                          ? 'bg-slate-100 dark:bg-slate-800'
                          : 'bg-transparent',
                      )}
                    >
                      <span>{option.label}</span>
                      {option.value === value && <Check size={16} />}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-3 text-center text-[13px] text-slate-500 dark:text-slate-400">
                  {emptyMessage}
                </div>
              )}
            </div>,
            document.body,
          )}
      </div>
      {error && <span className="text-[13px] text-red-500">{error}</span>}
      {!error && hint && (
        <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      )}
    </div>
  )
}
