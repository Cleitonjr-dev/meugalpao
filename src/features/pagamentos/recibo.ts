import { formatCurrency } from '@/lib/utils'
import { FORMAS_PAGAMENTO_LABEL } from '@/config/constants'
import { formatarDataBR } from '@/utils/data'
import type { Pagamento } from '@/types'

/** Tudo que um recibo (tela, impressão, PDF e WhatsApp) precisa, já formatado. */
export interface DadosRecibo {
  galpaoNome: string
  numero: number | null
  /** Código de autenticação (16 caracteres, sem traços) */
  codigo: string | null
  clienteNome: string
  clienteWhatsapp: string | null
  valor: string
  data: string
  referente: string
  /** Item(ns) pago(s), como eram na data do pagamento; null em pagamentos antigos */
  itens: string | null
  forma: string
  observacoes: string | null
  cancelado: boolean
}

type ClienteResumo = { nome: string; whatsapp: string | null }
type PagamentoResumo = Pick<
  Pagamento,
  'valor' | 'data_pagamento' | 'semana_referencia' | 'forma_pagamento' | 'observacoes' | 'status' | 'descricao'
>

export function montarDadosRecibo(
  galpaoNome: string,
  cliente: ClienteResumo | null,
  pagamento: PagamentoResumo,
  numero: number | null,
  codigo: string | null,
): DadosRecibo {
  return {
    galpaoNome,
    numero,
    codigo,
    clienteNome: cliente?.nome ?? '—',
    clienteWhatsapp: cliente?.whatsapp ?? null,
    valor: formatCurrency(Number(pagamento.valor)),
    data: formatarDataBR(pagamento.data_pagamento),
    referente: formatarDataBR(pagamento.semana_referencia ?? pagamento.data_pagamento),
    itens: pagamento.descricao,
    forma: FORMAS_PAGAMENTO_LABEL[pagamento.forma_pagamento] ?? pagamento.forma_pagamento,
    observacoes: pagamento.observacoes,
    cancelado: pagamento.status === 'cancelado',
  }
}
