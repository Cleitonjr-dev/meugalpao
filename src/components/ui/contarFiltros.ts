import type { FilterValues } from '@/components/ui/FilterModal'

export function contarFiltros(values: FilterValues): number {
  return Object.values(values).reduce((acc, arr) => acc + arr.length, 0)
}
