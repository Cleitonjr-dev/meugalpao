import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/queryClient'
import type { Galpao } from '@/types'
import { montarResumo, usuariosPorGalpao, type ResumoGalpao } from './resumoGalpoes'

async function buscarResumo(galpaoIds: string[]): Promise<Record<string, ResumoGalpao>> {
  const [contagens, membros, supers] = await Promise.all([
    // uma contagem por galpão: o banco só devolve o número, não as linhas
    Promise.all(
      galpaoIds.map(async (id) => {
        const { count, error } = await supabase
          .from('clientes')
          .select('id', { count: 'exact', head: true })
          .eq('galpao_id', id)
          .eq('ativo', true)
        if (error) throw new Error(error.message)
        return [id, count ?? 0] as const
      }),
    ),
    supabase.from('galpao_membros').select('galpao_id, profile_id'),
    supabase.from('profiles').select('id').eq('is_super', true),
  ])
  if (membros.error) throw new Error(membros.error.message)
  if (supers.error) throw new Error(supers.error.message)

  return montarResumo(
    galpaoIds,
    Object.fromEntries(contagens),
    usuariosPorGalpao(
      galpaoIds,
      (membros.data as { galpao_id: string; profile_id: string }[]) ?? [],
      ((supers.data as { id: string }[]) ?? []).map((p) => p.id),
    ),
  )
}

/** Clientes ativos e usuários com acesso de cada galpão (para os cartões da aba Galpões). */
export function useResumoGalpoes(galpoes: Galpao[]) {
  const ids = galpoes.map((g) => g.id)
  return useQuery({
    queryKey: [...chaves.resumoGalpoes, ids.join(',')],
    queryFn: () => buscarResumo(ids),
    enabled: ids.length > 0,
  })
}
