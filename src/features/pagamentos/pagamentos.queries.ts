import { supabase } from '@/lib/supabase'
import { buscarTudo } from '@/lib/buscarTudo'
import type {
  FechamentoDia,
  FormaPagamento,
  PaginaPagamentos,
  PagamentoRecente,
  RelatorioResumo,
  StatusPagamento,
  VerificacaoRecibo,
} from '@/types'

export const TAMANHO_PAGINA = 25

export interface ParametrosLista {
  busca: string
  formas: FormaPagamento[]
  status: StatusPagamento[]
  /** Datas no formato AAAA-MM-DD (data do pagamento) */
  de: string | null
  ate: string | null
  /** true = ordena pelo número do recibo (tela Recibos) */
  porRecibo: boolean
  pagina: number
  tamanho: number
}

/** Uma página de pagamentos (com cliente e recibo), filtrada e ordenada no banco. */
export async function listarPagamentos(
  galpaoId: string,
  p: ParametrosLista,
): Promise<PaginaPagamentos> {
  const { data, error } = await supabase.rpc('listar_pagamentos', {
    p_galpao: galpaoId,
    p_busca: p.busca || null,
    p_formas: p.formas.length > 0 ? p.formas : null,
    p_status: p.status.length > 0 ? p.status : null,
    p_de: p.de,
    p_ate: p.ate,
    p_por_recibo: p.porRecibo,
    p_limite: p.tamanho,
    p_deslocamento: (p.pagina - 1) * p.tamanho,
  })
  if (error) throw new Error(error.message)
  return data as PaginaPagamentos
}

/** Pagamentos a partir de uma data (usado pelo Dashboard para saber quem está em atraso). */
export function buscarPagamentosRecentes(
  galpaoId: string,
  desde: string,
): Promise<PagamentoRecente[]> {
  return buscarTudo<PagamentoRecente>((de, ate) =>
    supabase.rpc('pagamentos_recentes', { p_galpao: galpaoId, p_desde: desde }).range(de, ate),
  )
}

/** Totais do período calculados no banco. */
export async function buscarRelatorioResumo(
  galpaoId: string,
  de: string,
  ate: string,
  hoje: string,
): Promise<RelatorioResumo> {
  const { data, error } = await supabase.rpc('relatorio_resumo', {
    p_galpao: galpaoId,
    p_de: de,
    p_ate: ate,
    p_hoje: hoje,
  })
  if (error) throw new Error(error.message)
  return data as RelatorioResumo
}

/** Fechamento do caixa de um dia (totais, por forma, por pessoa e lista), calculado no banco. */
export async function buscarFechamentoDia(galpaoId: string, data: string): Promise<FechamentoDia> {
  const { data: resposta, error } = await supabase.rpc('fechamento_dia', {
    p_galpao: galpaoId,
    p_data: data,
  })
  if (error) throw new Error(error.message)
  return resposta as FechamentoDia
}

/** Verificação pública: devolve null quando o código não existe. */
export async function verificarRecibo(codigo: string): Promise<VerificacaoRecibo | null> {
  const { data, error } = await supabase.rpc('verificar_recibo', { p_codigo: codigo })
  if (error) throw new Error(error.message)
  return (data as VerificacaoRecibo | null) ?? null
}
