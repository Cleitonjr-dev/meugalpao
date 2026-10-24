import { useId, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useHoje } from '@/hooks/useHoje'
import { parseISO } from '@/utils/data'
import { cn } from '@/lib/utils'

export interface DatePickerProps {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  hint?: string
  disabled?: boolean
  id?: string
  /** Menor data permitida (AAAA-MM-DD); dias anteriores ficam desativados */
  min?: string
  /** Maior data permitida (AAAA-MM-DD); dias posteriores ficam desativados */
  max?: string
}

type CalendarView = 'days' | 'months' | 'years'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const MONTHS_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatBR(value: string): string {
  const date = parseISO(value)
  if (!date) return ''
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

interface CalendarDay {
  day: number | null
  iso: string | null
}

function buildMonthGrid(year: number, month: number): CalendarDay[] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: CalendarDay[] = []

  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ day: null, iso: null })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, iso: toISO(new Date(year, month, day)) })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: null, iso: null })
  }

  return cells
}

const NAV_BUTTON_CLASS =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent'

const GRID_CELL_BASE =
  'inline-flex h-10 items-center justify-center rounded-md border border-transparent text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent'

export function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'Selecione a data',
  error,
  hint,
  disabled = false,
  id,
  min,
  max,
}: DatePickerProps) {
  const autoId = useId()
  const campoId = id ?? autoId
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<CalendarView>('days')
  const [viewDate, setViewDate] = useState<Date>(() => parseISO(value) ?? new Date())
  const [yearPage, setYearPage] = useState(() => {
    const base = parseISO(value) ?? new Date()
    return Math.floor(base.getFullYear() / 12) * 12
  })

  const today = useHoje()
  const todayISO = toISO(today)
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()

  // Limites (min/max): meses, anos e as setas de navegação também respeitam o intervalo.
  const minData = min ? parseISO(min) : null
  const maxData = max ? parseISO(max) : null
  const mesIndice = (ano: number, mes: number) => ano * 12 + mes
  const mesFora = (ano: number, mes: number) =>
    (minData !== null && mesIndice(ano, mes) < mesIndice(minData.getFullYear(), minData.getMonth())) ||
    (maxData !== null && mesIndice(ano, mes) > mesIndice(maxData.getFullYear(), maxData.getMonth()))
  const anoFora = (ano: number) =>
    (minData !== null && ano < minData.getFullYear()) ||
    (maxData !== null && ano > maxData.getFullYear())
  const dentroDoLimite = (data: Date): Date => {
    if (minData && data < minData) return minData
    if (maxData && data > maxData) return maxData
    return data
  }

  const cells = buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth())
  // Na página de anos aparecem só os anos que dá para escolher (os fora do limite somem).
  const anosDaPagina = Array.from({ length: 12 }, (_, index) => yearPage + index)
  const anosPermitidos = anosDaPagina.filter((ano) => !anoFora(ano))
  const years = anosPermitidos.length > 0 ? anosPermitidos : anosDaPagina

  const openCalendar = () => {
    if (disabled) return
    const base = dentroDoLimite(parseISO(value) ?? today)
    setViewDate(base)
    setView('days')
    setYearPage(Math.floor(base.getFullYear() / 12) * 12)
    setOpen(true)
  }

  const changeMonth = (delta: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  const changeYear = (delta: number) => {
    setViewDate((prev) => new Date(prev.getFullYear() + delta, prev.getMonth(), 1))
  }

  const goToYears = () => {
    setYearPage(Math.floor(viewDate.getFullYear() / 12) * 12)
    setView('years')
  }

  const selectYear = (year: number) => {
    setViewDate((prev) => new Date(year, prev.getMonth(), 1))
    setView('months')
  }

  const selectMonth = (month: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), month, 1))
    setView('days')
  }

  const selectDay = (iso: string) => {
    onChange(iso)
    setOpen(false)
  }

  const foraDoLimite = (iso: string) => Boolean((min && iso < min) || (max && iso > max))

  const selectToday = () => {
    if (foraDoLimite(todayISO)) return
    onChange(todayISO)
    setOpen(false)
  }

  const clear = () => {
    onChange('')
    setOpen(false)
  }

  const renderHeader = () => {
    if (view === 'days') {
      return (
        <>
          <button type="button" aria-label="Mês anterior" className={NAV_BUTTON_CLASS} disabled={mesFora(viewDate.getFullYear(), viewDate.getMonth() - 1)} onClick={() => changeMonth(-1)}>
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={goToYears}
            className="flex-1 rounded border-none bg-transparent px-1 py-0.5 text-center text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
          </button>
          <button type="button" aria-label="Próximo mês" className={NAV_BUTTON_CLASS} disabled={mesFora(viewDate.getFullYear(), viewDate.getMonth() + 1)} onClick={() => changeMonth(1)}>
            <ChevronRight size={16} />
          </button>
        </>
      )
    }

    if (view === 'months') {
      return (
        <>
          <button type="button" aria-label="Ano anterior" className={NAV_BUTTON_CLASS} disabled={anoFora(viewDate.getFullYear() - 1)} onClick={() => changeYear(-1)}>
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={goToYears}
            className="flex-1 rounded border-none bg-transparent px-1 py-0.5 text-center text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {viewDate.getFullYear()}
          </button>
          <button type="button" aria-label="Próximo ano" className={NAV_BUTTON_CLASS} disabled={anoFora(viewDate.getFullYear() + 1)} onClick={() => changeYear(1)}>
            <ChevronRight size={16} />
          </button>
        </>
      )
    }

    return (
      <>
        <button
          type="button"
          aria-label="Década anterior"
          className={NAV_BUTTON_CLASS}
          disabled={anoFora(yearPage - 1)}
          onClick={() => setYearPage((prev) => prev - 12)}
        >
          <ChevronsLeft size={16} />
        </button>
        <span className="flex-1 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
          {years.length === 1 ? years[0] : `${years[0]} – ${years[years.length - 1]}`}
        </span>
        <button
          type="button"
          aria-label="Próxima década"
          className={NAV_BUTTON_CLASS}
          disabled={anoFora(yearPage + 12)}
          onClick={() => setYearPage((prev) => prev + 12)}
        >
          <ChevronsRight size={16} />
        </button>
      </>
    )
  }

  const renderBody = () => {
    if (view === 'months') {
      return (
        <div className="grid grid-cols-3 gap-0.5">
          {MONTHS_SHORT.map((month, index) => (
            <button
              key={month}
              type="button"
              disabled={mesFora(viewDate.getFullYear(), index)}
              onClick={() => selectMonth(index)}
              className={cn(
                GRID_CELL_BASE,
                index === viewDate.getMonth()
                  ? 'bg-primary-600 text-white'
                  : index === todayMonth && viewDate.getFullYear() === todayYear
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'bg-transparent text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800',
              )}
            >
              {month}
            </button>
          ))}
        </div>
      )
    }

    if (view === 'years') {
      return (
        <div className="grid grid-cols-3 gap-0.5">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              disabled={anoFora(year)}
              onClick={() => selectYear(year)}
              className={cn(
                GRID_CELL_BASE,
                year === viewDate.getFullYear()
                  ? 'bg-primary-600 text-white'
                  : year === todayYear
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'bg-transparent text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800',
              )}
            >
              {year}
            </button>
          ))}
        </div>
      )
    }

    return (
      <>
        <div className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((weekday) => (
            <span
              key={weekday}
              className="inline-flex h-7 items-center justify-center text-xs font-semibold text-slate-500 dark:text-slate-400"
            >
              {weekday}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell, index) =>
            cell.day === null ? (
              <span key={`empty-${index}`} className="h-10" />
            ) : (
              <button
                key={cell.iso}
                type="button"
                disabled={cell.iso !== null && foraDoLimite(cell.iso)}
                onClick={() => cell.iso && selectDay(cell.iso)}
                className={cn(
                  GRID_CELL_BASE,
                  'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent',
                  cell.iso === value
                    ? 'bg-primary-600 text-white'
                    : cell.iso === todayISO
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'bg-transparent text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800',
                )}
              >
                {cell.day}
              </button>
            ),
          )}
        </div>
      </>
    )
  }

  return (
    <div className="flex w-full flex-col gap-[5px]">
      {label && (
        <label htmlFor={campoId} className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {label}
        </label>
      )}
      <button
        id={campoId}
        type="button"
        disabled={disabled}
        onClick={openCalendar}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex min-h-[40px] w-full items-center gap-2 rounded-md border bg-slate-50 px-3 text-left text-sm text-slate-700 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900 dark:text-slate-200',
          error
            ? 'border-red-500'
            : open
              ? 'border-primary-500'
              : 'border-slate-200 dark:border-slate-700',
        )}
      >
        <span className={cn('flex-1 truncate', !value && 'text-slate-400 dark:text-slate-500')}>
          {formatBR(value) || placeholder}
        </span>
        <span className="inline-flex text-slate-400 dark:text-slate-500">
          <CalendarDays size={16} />
        </span>
      </button>

      <Modal open={open && !disabled} onClose={() => setOpen(false)} title="Selecionar data" size="sm">
        <div className="mb-2 flex items-center justify-between gap-2">{renderHeader()}</div>
        {renderBody()}
        {view === 'days' && (
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
            <button
              type="button"
              onClick={selectToday}
              disabled={foraDoLimite(todayISO)}
              className="rounded border-none bg-transparent px-1.5 py-1 text-sm font-medium text-primary-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-400 dark:hover:bg-slate-800"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={clear}
              className="rounded border-none bg-transparent px-1.5 py-1 text-sm font-medium text-primary-600 transition-colors hover:bg-slate-100 dark:text-primary-400 dark:hover:bg-slate-800"
            >
              Limpar
            </button>
          </div>
        )}
      </Modal>

      {error && <span className="text-[13px] text-red-500">{error}</span>}
      {!error && hint && (
        <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      )}
    </div>
  )
}
