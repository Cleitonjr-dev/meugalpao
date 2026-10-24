import type { DiaPagamento, FormaPagamento, StatusPagamento } from '@/types'

export const DIAS_PAGAMENTO: DiaPagamento[] = ['quarta', 'sabado']

export const DIAS_PAGAMENTO_LABEL: Record<DiaPagamento, string> = {
  quarta: 'Quarta-feira',
  sabado: 'Sábado',
}

export const FORMAS_PAGAMENTO: FormaPagamento[] = ['dinheiro', 'pix', 'cartao']

export const FORMAS_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao: 'Cartão',
}

export const STATUS_PAGAMENTO_LABEL: Record<StatusPagamento, string> = {
  pago: 'Pago',
  cancelado: 'Cancelado',
}

export const APP_NAME = 'MeuGalpão'

/** Depois deste tempo sem usar o sistema a sessão é encerrada (aparelhos compartilhados na feira). */
export const MINUTOS_INATIVIDADE = 30
