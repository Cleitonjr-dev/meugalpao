import { useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Search,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'

export interface TableColumn<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  render: (row: T) => ReactNode
}

export interface TableAction<T> {
  icon: LucideIcon
  label: string
  onClick: (item: T) => void
  variant?: 'default' | 'danger' | 'info'
  /** Esconde a ação para linhas específicas */
  hidden?: (item: T) => boolean
}

interface TableProps<T> {
  columns: TableColumn<T>[]
  data: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
  onSearch?: (value: string) => void
  searchPlaceholder?: string
  /** Texto que já aparece na busca ao montar (ex.: vindo da URL) */
  searchDefault?: string
  /** Há uma página nova a caminho: a atual fica na tela, esmaecida */
  busy?: boolean
  /** Menos espaço entre as colunas (tabelas com muitas colunas) */
  compact?: boolean
  onFilter?: () => void
  filterCount?: number
  actions?: TableAction<T>[]
  onRowClick?: (row: T) => void
  pageSize?: number
  serverSide?: boolean
  total?: number
  page?: number
  onPageChange?: (page: number) => void
}

const PAGE_SIZE_PADRAO = 10

function actionVariantClass(variant: 'default' | 'danger' | 'info'): string {
  if (variant === 'danger') {
    return 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400'
  }
  if (variant === 'info') {
    return 'hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400'
  }
  return 'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white'
}

export function Table<T>({
  columns,
  data,
  rowKey,
  emptyMessage = 'Nenhum registro encontrado',
  onSearch,
  searchPlaceholder = 'Buscar...',
  searchDefault = '',
  busy = false,
  compact = false,
  onFilter,
  filterCount,
  actions,
  onRowClick,
  pageSize = PAGE_SIZE_PADRAO,
  serverSide = false,
  total = 0,
  page,
  onPageChange,
}: TableProps<T>) {
  const [searchValue, setSearchValue] = useState(searchDefault)
  const [ultimoSearchDefault, setUltimoSearchDefault] = useState(searchDefault)
  const [currentPage, setCurrentPage] = useState(1)
  const [ultimoTotal, setUltimoTotal] = useState(data.length)

  // O texto de busca pode mudar por fora (ex.: botão Voltar do navegador muda o endereço): o campo acompanha.
  // Diferença só de espaços é ignorada para não apagar o espaço que a pessoa está digitando.
  if (searchDefault !== ultimoSearchDefault) {
    setUltimoSearchDefault(searchDefault)
    if (searchDefault.trim() !== searchValue.trim()) setSearchValue(searchDefault)
  }

  const px = compact ? 'px-3' : 'px-4'
  const hasToolbar = Boolean(onSearch || onFilter)
  const hasActions = Boolean(actions && actions.length > 0)

  // Volta para a primeira página quando a quantidade de resultados muda (busca/filtro),
  // mas não a cada recarga de dados com o mesmo tamanho.
  if (!serverSide && ultimoTotal !== data.length) {
    setUltimoTotal(data.length)
    setCurrentPage(1)
  }

  const effectivePageSize = pageSize
  const totalCount = serverSide ? total : data.length
  const totalPages = Math.max(1, Math.ceil(totalCount / effectivePageSize))
  const safePage = serverSide
    ? Math.max(1, Math.min(page ?? 1, totalPages))
    : Math.min(currentPage, totalPages)

  const startIndex = (safePage - 1) * effectivePageSize
  const paginatedData = serverSide ? data : data.slice(startIndex, startIndex + effectivePageSize)
  const rangeStart = totalCount === 0 ? 0 : startIndex + 1
  const rangeEnd = Math.min(startIndex + effectivePageSize, totalCount)
  const showControls = totalPages > 1

  const goToPage = (nextPage: number) => {
    if (serverSide) {
      onPageChange?.(nextPage)
    } else {
      setCurrentPage(nextPage)
    }
  }

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setSearchValue(value)
    onSearch?.(value)
  }

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    let windowStart = Math.max(2, safePage - 1)
    let windowEnd = Math.min(totalPages - 1, safePage + 1)

    if (safePage <= 3) {
      windowStart = 2
      windowEnd = 5
    } else if (safePage >= totalPages - 2) {
      windowStart = totalPages - 4
      windowEnd = totalPages - 1
    }

    const pages: (number | 'ellipsis')[] = [1]
    if (windowStart > 2) pages.push('ellipsis')
    for (let p = windowStart; p <= windowEnd; p += 1) pages.push(p)
    if (windowEnd < totalPages - 1) pages.push('ellipsis')
    pages.push(totalPages)

    return pages
  }

  return (
    <div
      aria-busy={busy || undefined}
      className={cn(
        'w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-opacity dark:border-slate-700 dark:bg-slate-900',
        busy && 'opacity-60',
      )}
    >
      {hasToolbar && (
        <div
          className="flex items-center gap-2 border-b border-slate-200 p-4 dark:border-slate-700"
        >
          {onSearch && (
            <div className="flex w-full shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-slate-400 transition-colors focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 sm:w-[360px]">
              <Search size={16} strokeWidth={2} />
              <input
                className="flex-1 border-none bg-transparent py-[9px] text-sm text-slate-700 outline-hidden placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={handleSearch}
              />
            </div>
          )}
          {onFilter && (
            <button
              type="button"
              onClick={onFilter}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-[14px] py-[9px] text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ListFilter size={16} strokeWidth={2} />
              Filtros
              {filterCount ? (
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary-600 px-[5px] text-xs font-bold text-white">
                  {filterCount}
                </span>
              ) : null}
            </button>
          )}
        </div>
      )}

      <div className="table-scroll">
        <table className="min-w-full border-separate border-spacing-0">
          <thead
            className="bg-slate-50 dark:bg-slate-950"
          >
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'whitespace-nowrap border-b-2 border-slate-200 py-3 text-xs font-bold uppercase tracking-[0.5px] text-slate-500 transition-colors dark:border-slate-700 dark:text-slate-400',
                    px,
                    column.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  {column.header}
                </th>
              ))}
              {hasActions && (
                <th
                  className={cn(
                    'whitespace-nowrap border-b-2 border-slate-200 py-3 text-left text-xs font-bold uppercase tracking-[0.5px] text-slate-500 transition-colors dark:border-slate-700 dark:text-slate-400',
                    px,
                  )}
                >
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  'transition-colors hover:bg-slate-100 dark:hover:bg-slate-800',
                  onRowClick ? 'cursor-pointer' : 'cursor-default',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'whitespace-nowrap border-b border-slate-200 py-1.5 text-sm text-slate-900 transition-colors dark:border-slate-700 dark:text-slate-100',
                      px,
                      column.align === 'right' ? 'text-right' : 'text-left',
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
                {hasActions && (
                  <td
                    className={cn(
                      'whitespace-nowrap border-b border-slate-200 py-1.5 transition-colors dark:border-slate-700',
                      px,
                    )}
                  >
                    {actions!.filter((acao) => !acao.hidden?.(row)).map(({ icon: Icon, label, onClick, variant }, actionIndex) => (
                      <Tooltip key={actionIndex} texto={label}>
                        <button
                          type="button"
                          aria-label={label}
                          onClick={() => onClick(row)}
                          className={cn(
                            'inline-flex items-center justify-center gap-1 rounded-md bg-transparent p-1.5 text-slate-500 transition-colors dark:text-slate-400',
                            actionVariantClass(variant ?? 'default'),
                          )}
                        >
                          <Icon size={16} strokeWidth={2} />
                        </button>
                      </Tooltip>
                    ))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalCount === 0 && (
        <div className="flex items-center justify-center px-4 py-12">
          <EmptyState title={emptyMessage} />
        </div>
      )}

      {totalCount > 0 && (
        <div
          className="grid grid-cols-[1fr_auto_1fr] items-center border-t border-slate-200 px-4 py-5 dark:border-slate-700"
        >
          <span className="col-start-3 row-start-1 justify-self-end whitespace-nowrap text-[13px] text-slate-500 dark:text-slate-400">
            Mostrando {rangeStart}–{rangeEnd} de {totalCount}
          </span>
          {showControls && (
            <div className="col-start-2 row-start-1 flex items-center justify-self-center gap-1">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => goToPage(1)}
                aria-label="Primeira página"
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-transparent px-2 text-[13px] text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ArrowLeftToLine size={16} strokeWidth={2} />
              </button>

              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => goToPage(safePage - 1)}
                aria-label="Página anterior"
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-transparent px-2 text-[13px] text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={16} strokeWidth={2} />
              </button>

              {getPageNumbers().map((pageNumber, index) =>
                pageNumber === 'ellipsis' ? (
                  <span
                    key={index}
                    className="inline-flex h-8 min-w-8 items-center justify-center text-[13px] text-slate-500 dark:text-slate-400"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={index}
                    type="button"
                    onClick={() => goToPage(pageNumber)}
                    className={cn(
                      'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] transition-colors',
                      pageNumber === safePage
                        ? 'bg-primary-600 font-semibold text-white'
                        : 'bg-transparent font-normal text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
                    )}
                  >
                    {pageNumber}
                  </button>
                ),
              )}

              <button
                type="button"
                disabled={safePage === totalPages}
                onClick={() => goToPage(safePage + 1)}
                aria-label="Próxima página"
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-transparent px-2 text-[13px] text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ChevronRight size={16} strokeWidth={2} />
              </button>

              <button
                type="button"
                disabled={safePage === totalPages}
                onClick={() => goToPage(totalPages)}
                aria-label="Última página"
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-transparent px-2 text-[13px] text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ArrowRightToLine size={16} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
