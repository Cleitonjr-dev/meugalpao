import { filtrarClientes } from '@/utils/clientes'
import { dataLocalISO } from '@/utils/data'
import { chavePagamento, indexarPagos, situacaoCliente, type SituacaoCliente } from '@/utils/pagamentos'
import { diaSemanaKey } from '@/utils/periodo'
import { valorSemanal } from '@/utils/valor'
import type { Cliente, ItemGuardado, PagamentoRecente, PrecoGalpao, TipoItem } from '@/types'

export type FiltroPainel = 'hoje' | 'atraso' | 'todos'

export interface EntradaPainel {
  clientes: Cliente[]
  itens: ItemGuardado[]
  tipos: TipoItem[]
  precos: PrecoGalpao[]
  /** Do mais novo ao mais antigo */
  pagamentos: PagamentoRecente[]
  hoje: Date
}

/** Tudo que o painel de cobranças deriva dos dados do galpão, sem depender de filtro ou busca. */
export interface Painel {
  /** Dia de cobrança de hoje (quarta ou sábado), ou null */
  diaKey: ReturnType<typeof diaSemanaKey>
  pagos: Set<string>
  ativos: Cliente[]
  situacoes: Map<string, SituacaoCliente>
  clientesHoje: Cliente[]
  clientesEmAtraso: Cliente[]
  emAtrasoHoje: Cliente[]
  /** Pagamento válido de cada semana de cada cliente */
  pagamentoDaSemana: Map<string, PagamentoRecente>
  /** Pagamento válido mais recente de cada cliente */
  ultimoPagamento: Map<string, PagamentoRecente>
  valorSemanalDe: (clienteId: string) => number
  totalHoje: number
  aReceberHoje: number
}

export function calcularPainel({
  clientes,
  itens,
  tipos,
  precos,
  pagamentos,
  hoje,
}: EntradaPainel): Painel {
  const hojeStr = dataLocalISO(hoje)
  const diaKey = diaSemanaKey(hoje)
  const pagos = indexarPagos(pagamentos)

  const valoresSemanais = new Map<string, number>()
  for (const c of clientes) valoresSemanais.set(c.id, valorSemanal(c.id, itens, precos, tipos))
  const valorSemanalDe = (clienteId: string) => valoresSemanais.get(clienteId) ?? 0

  const pagamentoDaSemana = new Map<string, PagamentoRecente>()
  const ultimoPagamento = new Map<string, PagamentoRecente>()
  for (const p of pagamentos) {
    if (p.status === 'cancelado') continue
    if (p.semana_referencia) {
      pagamentoDaSemana.set(chavePagamento(p.cliente_id, p.semana_referencia), p)
    }
    if (!ultimoPagamento.has(p.cliente_id)) ultimoPagamento.set(p.cliente_id, p)
  }

  const ativos = clientes.filter((c) => c.ativo)
  const situacoes = new Map<string, SituacaoCliente>()
  for (const c of ativos) situacoes.set(c.id, situacaoCliente(c, pagos, hoje))

  const emAtraso = (c: Cliente) => situacoes.get(c.id)?.status === 'em_atraso'
  const clientesHoje = diaKey ? ativos.filter((c) => c.dia_pagamento === diaKey) : []
  const clientesEmAtraso = ativos.filter(emAtraso)
  const emAtrasoHoje = clientesHoje.filter(emAtraso)

  const totalHoje = pagamentos
    .filter((p) => p.data_pagamento === hojeStr && p.status !== 'cancelado')
    .reduce((acc, p) => acc + Number(p.valor), 0)

  const aReceberHoje = emAtrasoHoje.reduce(
    (acc, c) => acc + valorSemanalDe(c.id) * (situacoes.get(c.id)?.pendentes.length ?? 1),
    0,
  )

  return {
    diaKey,
    pagos,
    ativos,
    situacoes,
    clientesHoje,
    clientesEmAtraso,
    emAtrasoHoje,
    pagamentoDaSemana,
    ultimoPagamento,
    valorSemanalDe,
    totalHoje,
    aReceberHoje,
  }
}

/** Clientes da aba escolhida, filtrados pela busca, com os que estão em atraso primeiro. */
export function listarClientes(painel: Painel, filtro: FiltroPainel, busca: string): Cliente[] {
  const porFiltro =
    filtro === 'hoje' ? painel.clientesHoje : filtro === 'atraso' ? painel.clientesEmAtraso : painel.ativos
  const base = filtrarClientes(porFiltro, busca)
  // em atraso primeiro, mantendo a ordem por nome dentro de cada grupo
  const peso = (c: Cliente) => (painel.situacoes.get(c.id)?.status === 'em_atraso' ? 0 : 1)
  return [...base].sort((a, b) => peso(a) - peso(b))
}
