export type DiaPagamento = 'quarta' | 'sabado'

export type FormaPagamento = 'dinheiro' | 'pix' | 'cartao'

export type StatusPagamento = 'pago' | 'cancelado'

export interface Galpao {
  id: string
  nome: string
  endereco: string | null
  created_at: string
}

export interface Profile {
  id: string
  nome: string
  email: string | null
  is_super: boolean
  avatar_url: string | null
  created_at: string
}

export interface GalpaoMembro {
  id: string
  galpao_id: string
  profile_id: string
  created_at: string
}

export interface TipoItem {
  id: string
  galpao_id: string | null
  nome: string
  preco_semanal: number
  ativo: boolean
  created_at: string
}

export interface PrecoGalpao {
  id: string
  galpao_id: string
  tipo_item_id: string
  preco_semanal: number
  created_at: string
}

export interface Cliente {
  id: string
  galpao_id: string
  nome: string
  telefone: string | null
  whatsapp: string | null
  dia_pagamento: DiaPagamento
  observacoes: string | null
  ativo: boolean
  criado_por: string | null
  created_at: string
}

export interface ItemGuardado {
  id: string
  cliente_id: string
  galpao_id: string
  tipo_item_id: string | null
  identificacao: string | null
  quantidade: number
  ativo: boolean
  created_at: string
}

export interface Pagamento {
  id: string
  galpao_id: string
  cliente_id: string
  valor: number
  data_pagamento: string
  semana_referencia: string | null
  forma_pagamento: FormaPagamento
  status: StatusPagamento
  observacoes: string | null
  criado_por: string | null
  cancelado_em: string | null
  cancelado_por: string | null
  motivo_cancelamento: string | null
  /** Itens do cliente no momento do pagamento (ex.: "Carrinho de roupa"); vazio em pagamentos antigos */
  descricao: string | null
  created_at: string
}

export interface Recibo {
  id: string
  galpao_id: string
  pagamento_id: string
  numero: number
  /** Código de autenticação (16 caracteres hexadecimais, sem traços) */
  codigo: string
  pdf_url: string | null
  enviado_whatsapp: boolean
  created_at: string
}

/** Pagamento da janela recente (Dashboard), já com o recibo emitido para ele. */
export type PagamentoRecente = Pagamento & {
  recibo_numero: number | null
  recibo_codigo: string | null
}

/** Linha das listas paginadas de Pagamentos e Recibos. */
export interface LinhaPagamento {
  id: string
  galpao_id: string
  cliente_id: string
  valor: number
  data_pagamento: string
  semana_referencia: string | null
  forma_pagamento: FormaPagamento
  status: StatusPagamento
  observacoes: string | null
  created_at: string
  cancelado_em: string | null
  motivo_cancelamento: string | null
  descricao: string | null
  recebido_por_nome: string | null
  cancelado_por_nome: string | null
  cliente_nome: string
  cliente_whatsapp: string | null
  recibo_numero: number | null
  recibo_codigo: string | null
}

export interface PaginaPagamentos {
  total: number
  itens: LinhaPagamento[]
}

export interface RelatorioResumo {
  total_geral: number
  total_periodo: number
  quantidade_periodo: number
  total_hoje: number
  por_forma: { forma: FormaPagamento; total: number }[]
  por_dia: { data: string; total: number }[]
}

export interface PagamentoDoDia {
  id: string
  hora: string
  cliente: string
  valor: number
  forma: FormaPagamento
  status: StatusPagamento
  recibo: number | null
  descricao: string | null
  recebido_por: string | null
}

export interface UsuarioDoDia {
  usuario_id: string | null
  nome: string
  total: number
  quantidade: number
  dinheiro: number
  pix: number
  cartao: number
}

/** Fechamento do caixa de um dia (cancelados ficam fora dos totais). */
export interface FechamentoDia {
  data: string
  total: number
  quantidade: number
  cancelados: { quantidade: number; total: number }
  por_forma: { forma: FormaPagamento; total: number; quantidade: number }[]
  por_usuario: UsuarioDoDia[]
  pagamentos: PagamentoDoDia[]
  truncado: boolean
}

/** Resultado da verificação pública de um recibo. */
export interface VerificacaoRecibo {
  numero: number
  codigo: string
  galpao: string
  cliente: string
  valor: number
  data: string
  referente: string | null
  forma: FormaPagamento
  situacao: 'valido' | 'cancelado'
  cancelado_em: string | null
}

/** Uma linha do histórico de alterações do sistema (aba Histórico em Configurações). */
export interface LinhaAuditoria {
  id: string
  created_at: string
  usuario_nome: string | null
  galpao_nome: string | null
  acao: string
  entidade: string
  resumo: string
  detalhes: Record<string, unknown> | null
}

export interface PaginaAuditoria {
  total: number
  itens: LinhaAuditoria[]
}
