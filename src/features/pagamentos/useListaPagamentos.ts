import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { chaves } from '@/lib/queryClient'
import { useDebounce } from '@/hooks/useDebounce'
import { FORMAS_PAGAMENTO } from '@/config/constants'
import type { FormaPagamento, StatusPagamento } from '@/types'
import { listarPagamentos, TAMANHO_PAGINA, type ParametrosLista } from './pagamentos.queries'

const STATUS_VALIDOS: StatusPagamento[] = ['pago', 'cancelado']
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

export interface FiltrosLista {
  pagina: number
  busca: string
  formas: FormaPagamento[]
  status: StatusPagamento[]
  de: string | null
  ate: string | null
}

function lerLista<T extends string>(valor: string | null, validos: readonly T[]): T[] {
  if (!valor) return []
  return valor.split(',').filter((v): v is T => (validos as readonly string[]).includes(v))
}

function lerData(valor: string | null): string | null {
  return valor && DATA_ISO.test(valor) ? valor : null
}

/**
 * Estado da lista (página, busca, filtros e período) guardado na URL:
 * F5, botão "voltar" e link compartilhado mantêm exatamente a mesma tela.
 */
export function useFiltrosLista() {
  const [params, setParams] = useSearchParams()

  const filtros = useMemo<FiltrosLista>(() => {
    const pagina = Number.parseInt(params.get('pagina') ?? '1', 10)
    return {
      pagina: Number.isFinite(pagina) && pagina >= 1 ? pagina : 1,
      busca: params.get('q') ?? '',
      formas: lerLista(params.get('forma'), FORMAS_PAGAMENTO),
      status: lerLista(params.get('status'), STATUS_VALIDOS),
      de: lerData(params.get('de')),
      ate: lerData(params.get('ate')),
    }
  }, [params])

  const atualizar = useCallback(
    (alteracoes: Partial<FiltrosLista>) => {
      setParams(
        (atual) => {
          const novo = new URLSearchParams(atual)
          const definir = (chave: string, valor: string | null) => {
            if (valor) novo.set(chave, valor)
            else novo.delete(chave)
          }
          if ('busca' in alteracoes) definir('q', alteracoes.busca?.trim() || null)
          if ('formas' in alteracoes) definir('forma', alteracoes.formas?.join(',') || null)
          if ('status' in alteracoes) definir('status', alteracoes.status?.join(',') || null)
          if ('de' in alteracoes) definir('de', alteracoes.de ?? null)
          if ('ate' in alteracoes) definir('ate', alteracoes.ate ?? null)
          // qualquer mudança de busca/filtro volta para a primeira página
          const soPagina = Object.keys(alteracoes).every((k) => k === 'pagina')
          definir('pagina', soPagina && (alteracoes.pagina ?? 1) > 1 ? String(alteracoes.pagina) : null)
          return novo
        },
        // trocar de página entra no histórico (voltar funciona); filtros e busca apenas substituem
        { replace: !Object.keys(alteracoes).every((k) => k === 'pagina') },
      )
    },
    [setParams],
  )

  return { filtros, atualizar }
}

/** Busca com atraso: só vai para a URL (e para o servidor) quando a pessoa para de digitar. */
export function useBuscaNaUrl(atualizar: (alteracoes: Partial<FiltrosLista>) => void) {
  const [texto, setTexto] = useState('')
  const digitou = useRef(false)
  const atrasado = useDebounce(texto, 300)

  useEffect(() => {
    if (!digitou.current || atrasado !== texto) return
    digitou.current = false
    atualizar({ busca: atrasado })
  }, [atrasado, texto, atualizar])

  return useCallback((valor: string) => {
    digitou.current = true
    setTexto(valor)
  }, [])
}

/** Uma página de pagamentos buscada no servidor, com a página anterior na tela enquanto a nova chega. */
export function usePagamentosPaginados(
  galpaoId: string | null,
  filtros: FiltrosLista,
  porRecibo: boolean,
  aoCorrigirPagina: (pagina: number) => void,
) {
  const queryClient = useQueryClient()

  const params = useMemo<ParametrosLista>(
    () => ({
      busca: filtros.busca,
      formas: filtros.formas,
      status: filtros.status,
      de: filtros.de,
      ate: filtros.ate,
      porRecibo,
      pagina: filtros.pagina,
      tamanho: TAMANHO_PAGINA,
    }),
    [filtros, porRecibo],
  )

  const consulta = useQuery({
    queryKey: chaves.lista(galpaoId, params),
    queryFn: () => listarPagamentos(galpaoId as string, params),
    enabled: galpaoId !== null,
    // Mantém a página anterior só dentro do mesmo galpão: nunca mostra dados de outro.
    placeholderData: (anterior, consultaAnterior) =>
      consultaAnterior?.queryKey[1] === galpaoId ? keepPreviousData(anterior) : undefined,
  })

  const total = consulta.data?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA))

  // Página fora do limite (ex.: link antigo ou registros apagados): volta para a última.
  useEffect(() => {
    if (consulta.data && !consulta.isPlaceholderData && filtros.pagina > totalPaginas) {
      aoCorrigirPagina(totalPaginas)
    }
  }, [consulta.data, consulta.isPlaceholderData, filtros.pagina, totalPaginas, aoCorrigirPagina])

  // Busca a próxima página antes de a pessoa clicar nela.
  useEffect(() => {
    if (!galpaoId || !consulta.data || consulta.isPlaceholderData) return
    if (params.pagina >= totalPaginas) return
    const proxima = { ...params, pagina: params.pagina + 1 }
    void queryClient.prefetchQuery({
      queryKey: chaves.lista(galpaoId, proxima),
      queryFn: () => listarPagamentos(galpaoId, proxima),
    })
  }, [galpaoId, consulta.data, consulta.isPlaceholderData, params, totalPaginas, queryClient])

  return {
    itens: consulta.data?.itens ?? [],
    total,
    /** primeira carga desta tela (ainda não há nada para mostrar) */
    carregando: consulta.isPending,
    /** buscando uma página nova enquanto a anterior continua na tela */
    atualizando: consulta.isFetching && consulta.isPlaceholderData,
    erro: consulta.isError && !consulta.data,
    tentarNovamente: () => void consulta.refetch(),
  }
}
