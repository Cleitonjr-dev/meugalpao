import { supabase } from '@/lib/supabase'
import type { FormaPagamento, Pagamento, Recibo } from '@/types'

interface RegistrarPagamentoInput {
  galpaoId: string
  clienteId: string
  valor: number
  forma: FormaPagamento
  semanaReferencia: string
  observacoes?: string | null
}

type Resultado<T> = T | { error: string }

/** Mensagens levantadas pelas funções do banco (raise exception) chegam em `message`. */
function mensagemDeErro(error: { message?: string; code?: string }, padrao: string): string {
  if (error.code === 'P0001' && error.message) return error.message
  return padrao
}

/**
 * Registra o pagamento e gera o recibo em uma única transação no banco
 * (função `registrar_pagamento`): sem pagamento órfão e sem número de recibo repetido.
 */
export async function registrarPagamento(
  input: RegistrarPagamentoInput,
): Promise<Resultado<{ pagamento: Pagamento; recibo: Recibo }>> {
  const { data, error } = await supabase.rpc('registrar_pagamento', {
    p_galpao_id: input.galpaoId,
    p_cliente_id: input.clienteId,
    p_valor: input.valor,
    p_forma: input.forma,
    p_semana: input.semanaReferencia,
    p_observacoes: input.observacoes ?? null,
  })

  if (error || !data) {
    return { error: error ? mensagemDeErro(error, 'Erro ao registrar pagamento.') : 'Erro ao registrar pagamento.' }
  }

  const resultado = data as { pagamento: Pagamento; recibo: Recibo }
  return { pagamento: resultado.pagamento, recibo: resultado.recibo }
}

export async function cancelarPagamento(
  pagamentoId: string,
  motivo?: string | null,
): Promise<Resultado<{ pagamento: Pagamento }>> {
  const { data, error } = await supabase.rpc('cancelar_pagamento', {
    p_pagamento_id: pagamentoId,
    p_motivo: motivo ?? null,
  })

  if (error || !data) {
    return { error: error ? mensagemDeErro(error, 'Erro ao cancelar pagamento.') : 'Erro ao cancelar pagamento.' }
  }
  return { pagamento: data as Pagamento }
}
