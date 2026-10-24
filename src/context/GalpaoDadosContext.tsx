import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { buscarTudo } from '@/lib/buscarTudo'
import { chaves } from '@/lib/queryClient'
import { buscarPagamentosRecentes } from '@/features/pagamentos/pagamentos.queries'
import { inicioJanelaRecente } from '@/utils/pagamentos'
import { agoraEmFortaleza } from '@/utils/data'
import { useGalpao } from '@/context/GalpaoContext'
import type { Cliente, ItemGuardado, PagamentoRecente, PrecoGalpao, TipoItem } from '@/types'

interface Dados {
  clientes: Cliente[]
  itens: ItemGuardado[]
  tipos: TipoItem[]
  precos: PrecoGalpao[]
  /** Só a janela recente (últimas semanas): o histórico completo fica nas telas paginadas */
  pagamentos: PagamentoRecente[]
}

interface GalpaoDadosContextValue extends Dados {
  loading: boolean
  erro: string | null
  recarregar: () => Promise<void>
}

const VAZIO: Dados = {
  clientes: [],
  itens: [],
  tipos: [],
  precos: [],
  pagamentos: [],
}

async function buscarDadosDoGalpao(galpaoId: string): Promise<Dados> {
  const [clientes, itens, tipos, precos, pagamentos] = await Promise.all([
    buscarTudo<Cliente>((de, ate) =>
      supabase
        .from('clientes')
        .select('*')
        .eq('galpao_id', galpaoId)
        .order('nome', { ascending: true })
        .order('id')
        .range(de, ate),
    ),
    buscarTudo<ItemGuardado>((de, ate) =>
      supabase.from('itens_guardados').select('*').eq('galpao_id', galpaoId).order('id').range(de, ate),
    ),
    buscarTudo<TipoItem>((de, ate) =>
      supabase
        .from('tipos_item')
        .select('*')
        .or(`galpao_id.is.null,galpao_id.eq.${galpaoId}`)
        .order('nome', { ascending: true })
        .order('id')
        .range(de, ate),
    ),
    buscarTudo<PrecoGalpao>((de, ate) =>
      supabase.from('precos_galpao').select('*').eq('galpao_id', galpaoId).order('id').range(de, ate),
    ),
    buscarPagamentosRecentes(galpaoId, inicioJanelaRecente(agoraEmFortaleza())),
  ])
  return { clientes, itens, tipos, precos, pagamentos }
}

const GalpaoDadosContext = createContext<GalpaoDadosContextValue | undefined>(undefined)

export function GalpaoDadosProvider({ children }: { children: ReactNode }) {
  const { galpaoIdPreferido, loading: galpoesLoading } = useGalpao()

  // A chave inclui o galpão: cada galpão tem o seu cache e trocar de galpão nunca mostra
  // dados de outro. Voltar a um galpão já visitado é instantâneo (atualiza por trás).
  const consulta = useQuery({
    queryKey: chaves.dados(galpaoIdPreferido),
    queryFn: () => buscarDadosDoGalpao(galpaoIdPreferido as string),
    enabled: galpaoIdPreferido !== null,
  })

  const queryClient = useQueryClient()
  const refetch = consulta.refetch
  // Depois de registrar/cancelar um pagamento: atualiza o Dashboard e também as listas
  // paginadas e os relatórios (que têm cache próprio).
  const recarregar = useCallback(async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['pagamentos-lista'] }),
      queryClient.invalidateQueries({ queryKey: ['relatorio'] }),
      queryClient.invalidateQueries({ queryKey: ['fechamento'] }),
      queryClient.invalidateQueries({ queryKey: chaves.resumoGalpoes }),
    ])
  }, [refetch, queryClient])

  const value = useMemo<GalpaoDadosContextValue>(
    () => ({
      ...(consulta.data ?? VAZIO),
      loading: galpoesLoading || (galpaoIdPreferido !== null && consulta.isPending),
      erro:
        consulta.isError && !consulta.data
          ? 'Não foi possível carregar os dados do galpão. Verifique a conexão e tente novamente.'
          : null,
      recarregar,
    }),
    [
      consulta.data,
      consulta.isPending,
      consulta.isError,
      galpoesLoading,
      galpaoIdPreferido,
      recarregar,
    ],
  )

  return <GalpaoDadosContext.Provider value={value}>{children}</GalpaoDadosContext.Provider>
}

export function useGalpaoDados(): GalpaoDadosContextValue {
  const ctx = useContext(GalpaoDadosContext)
  if (!ctx) throw new Error('useGalpaoDados deve ser usado dentro de GalpaoDadosProvider')
  return ctx
}
