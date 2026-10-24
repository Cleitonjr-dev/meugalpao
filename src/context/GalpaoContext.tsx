import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/queryClient'
import type { Galpao } from '@/types'
import { useAuth } from '@/context/AuthContext'

interface GalpaoContextValue {
  galpoes: Galpao[]
  galpaoSelecionado: Galpao | null
  /**
   * Galpão que deve ser carregado já: o escolhido ou o último usado. Permite buscar os dados
   * enquanto a lista de galpões ainda carrega (o acesso continua protegido pelo banco).
   */
  galpaoIdPreferido: string | null
  setGalpaoSelecionado: (galpao: Galpao | null) => void
  recarregar: () => Promise<void>
  loading: boolean
  erro: string | null
}

const GalpaoContext = createContext<GalpaoContextValue | undefined>(undefined)

const STORAGE_KEY = 'meugalpao.galpao_id'

function lerGalpaoSalvo(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function salvarGalpao(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // armazenamento indisponível (modo privado): a seleção só não é lembrada
  }
}

async function buscarGalpoes(): Promise<Galpao[]> {
  const { data, error } = await supabase
    .from('galpoes')
    .select('*')
    .order('nome', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as Galpao[]) ?? []
}

export function GalpaoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [escolhidoId, setEscolhidoId] = useState<string | null>(lerGalpaoSalvo)

  const consulta = useQuery({
    queryKey: chaves.galpoes(userId),
    queryFn: buscarGalpoes,
    enabled: userId !== null,
  })

  const galpoes = useMemo(() => consulta.data ?? [], [consulta.data])

  // Derivado, sem efeitos: o escolhido se ainda existir; senão o primeiro da lista.
  const galpaoSelecionado = useMemo(
    () => galpoes.find((g) => g.id === escolhidoId) ?? galpoes[0] ?? null,
    [galpoes, escolhidoId],
  )

  const galpaoIdPreferido = userId ? (galpaoSelecionado?.id ?? escolhidoId) : null

  const setGalpaoSelecionado = useCallback((galpao: Galpao | null) => {
    setEscolhidoId(galpao?.id ?? null)
    salvarGalpao(galpao?.id ?? null)
  }, [])

  const refetch = consulta.refetch
  const recarregar = useCallback(async () => {
    await refetch()
  }, [refetch])

  const value = useMemo<GalpaoContextValue>(
    () => ({
      galpoes,
      galpaoSelecionado,
      galpaoIdPreferido,
      setGalpaoSelecionado,
      recarregar,
      loading: userId !== null && consulta.isPending,
      erro:
        consulta.isError && !consulta.data
          ? 'Não foi possível carregar os galpões. Verifique a conexão e tente novamente.'
          : null,
    }),
    [
      galpoes,
      galpaoSelecionado,
      galpaoIdPreferido,
      setGalpaoSelecionado,
      recarregar,
      userId,
      consulta.isPending,
      consulta.isError,
      consulta.data,
    ],
  )

  return <GalpaoContext.Provider value={value}>{children}</GalpaoContext.Provider>
}

export function useGalpao(): GalpaoContextValue {
  const ctx = useContext(GalpaoContext)
  if (!ctx) throw new Error('useGalpao deve ser usado dentro de GalpaoProvider')
  return ctx
}
