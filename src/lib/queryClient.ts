import { QueryClient } from '@tanstack/react-query'

/**
 * Cache de dados do servidor (padrão de mercado: TanStack Query).
 * - Dados "frescos" por 30 s: navegar entre telas não refaz as buscas.
 * - Depois disso, a tela mostra o que já tem e atualiza por trás (sem loading).
 * - Ao voltar para a aba, os dados são atualizados em segundo plano.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

export const chaves = {
  galpoes: (userId: string | null) => ['galpoes', userId] as const,
  dados: (galpaoId: string | null) => ['galpao-dados', galpaoId] as const,
  /** Listas paginadas de Pagamentos/Recibos (uma entrada por página e combinação de filtros) */
  lista: (galpaoId: string | null, params: object) =>
    ['pagamentos-lista', galpaoId, params] as const,
  relatorio: (galpaoId: string | null, de: string, ate: string, hoje: string) =>
    ['relatorio', galpaoId, de, ate, hoje] as const,
  fechamento: (galpaoId: string | null, data: string) => ['fechamento', galpaoId, data] as const,
  usuarios: ['usuarios'] as const,
  /** Data do primeiro pagamento: limita o calendário dos filtros de período */
  primeiroPagamento: ['primeiro-pagamento'] as const,
  auditoria: (params: object) => ['auditoria', params] as const,
  resumoGalpoes: ['resumo-galpoes'] as const,
  tipos: ['tipos-item'] as const,
  /** Preços próprios de todos os galpões (tabela da aba Tipos e preços) */
  precosTodos: ['precos-todos'] as const,
}
