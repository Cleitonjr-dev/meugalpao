import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/queryClient'
import { limitesDoPeriodo } from '@/utils/periodo'
import { useHoje } from '@/hooks/useHoje'

async function buscarPrimeiraData(): Promise<string | null> {
  const { data, error } = await supabase
    .from('pagamentos')
    .select('data_pagamento')
    .order('data_pagamento', { ascending: true })
    .limit(1)
  if (error) throw new Error(error.message)
  return (data as { data_pagamento: string }[] | null)?.[0]?.data_pagamento ?? null
}

/** Datas mínima e máxima que os calendários dos filtros de período aceitam. */
export function useLimitesPeriodo(): { min: string; max: string } {
  const hoje = useHoje()
  const consulta = useQuery({
    queryKey: chaves.primeiroPagamento,
    queryFn: buscarPrimeiraData,
    staleTime: 10 * 60_000,
  })
  return limitesDoPeriodo(consulta.data ?? null, hoje)
}
