import { describe, expect, it } from 'vitest'
import { calcularPainel, listarClientes } from '../painel'
import type { Cliente, ItemGuardado, PagamentoRecente, PrecoGalpao, TipoItem } from '@/types'

// Sábado, 11/10/2025 (o fuso dos testes é o de Fortaleza, ver vite.config.ts)
const HOJE = new Date(2025, 9, 11, 10, 0, 0)

function cliente(id: string, parcial: Partial<Cliente> = {}): Cliente {
  return {
    id,
    galpao_id: 'g1',
    nome: id,
    telefone: null,
    whatsapp: null,
    dia_pagamento: 'sabado',
    observacoes: null,
    ativo: true,
    criado_por: null,
    // criado na véspera: a única cobrança possível é a de hoje
    created_at: '2025-10-10T12:00:00Z',
    ...parcial,
  }
}

const TIPO: TipoItem = {
  id: 't1',
  galpao_id: null,
  nome: 'Carrinho',
  preco_semanal: 100,
  ativo: true,
  created_at: '2025-01-01T12:00:00Z',
}

function item(clienteId: string): ItemGuardado {
  return {
    id: `i-${clienteId}`,
    cliente_id: clienteId,
    galpao_id: 'g1',
    tipo_item_id: 't1',
    identificacao: null,
    quantidade: 1,
    ativo: true,
    created_at: '2025-01-01T12:00:00Z',
  }
}

function pagamento(clienteId: string, semana: string, parcial: Partial<PagamentoRecente> = {}): PagamentoRecente {
  return {
    id: `p-${clienteId}-${semana}`,
    galpao_id: 'g1',
    cliente_id: clienteId,
    valor: 100,
    data_pagamento: semana,
    semana_referencia: semana,
    forma_pagamento: 'dinheiro',
    status: 'pago',
    observacoes: null,
    criado_por: null,
    cancelado_em: null,
    cancelado_por: null,
    motivo_cancelamento: null,
    descricao: null,
    created_at: `${semana}T12:00:00Z`,
    recibo_numero: 1,
    recibo_codigo: null,
    ...parcial,
  }
}

const PRECOS: PrecoGalpao[] = []

function montar(pagamentos: PagamentoRecente[] = []) {
  const clientes = [
    cliente('ana'),
    cliente('bruno'),
    cliente('diego', { dia_pagamento: 'quarta' }),
    cliente('inativo', { ativo: false }),
  ]
  const itens = clientes.map((c) => item(c.id))
  return calcularPainel({ clientes, itens, tipos: [TIPO], precos: PRECOS, pagamentos, hoje: HOJE })
}

describe('calcularPainel', () => {
  it('ignora inativos e separa os clientes de hoje (sábado)', () => {
    const painel = montar()
    expect(painel.diaKey).toBe('sabado')
    expect(painel.ativos.map((c) => c.id)).toEqual(['ana', 'bruno', 'diego'])
    expect(painel.clientesHoje.map((c) => c.id)).toEqual(['ana', 'bruno'])
  })

  it('quem não pagou a cobrança de hoje está em atraso e entra em "a receber"', () => {
    const painel = montar([pagamento('ana', '2025-10-11')])
    expect(painel.emAtrasoHoje.map((c) => c.id)).toEqual(['bruno'])
    expect(painel.aReceberHoje).toBe(100)
  })

  it('"recebido hoje" soma só pagamentos de hoje não cancelados', () => {
    const painel = montar([
      pagamento('ana', '2025-10-11'),
      pagamento('bruno', '2025-10-11', { status: 'cancelado' }),
      pagamento('diego', '2025-10-08', { data_pagamento: '2025-10-08' }),
    ])
    expect(painel.totalHoje).toBe(100)
  })

  it('guarda o pagamento válido de cada semana e o último de cada cliente', () => {
    const painel = montar([
      pagamento('ana', '2025-10-11'),
      pagamento('ana', '2025-10-04', { status: 'cancelado' }),
      pagamento('ana', '2025-09-27'),
    ])
    expect(painel.pagamentoDaSemana.size).toBe(2)
    expect(painel.ultimoPagamento.get('ana')?.semana_referencia).toBe('2025-10-11')
  })

  it('valorSemanalDe devolve 0 para cliente desconhecido', () => {
    expect(montar().valorSemanalDe('ninguem')).toBe(0)
    expect(montar().valorSemanalDe('ana')).toBe(100)
  })
})

describe('listarClientes', () => {
  const painel = montar([pagamento('ana', '2025-10-11')])

  it('aba "hoje" põe quem está em atraso primeiro', () => {
    expect(listarClientes(painel, 'hoje', '').map((c) => c.id)).toEqual(['bruno', 'ana'])
  })

  it('aba "atraso" mostra só quem deve', () => {
    expect(listarClientes(painel, 'atraso', '').map((c) => c.id)).toContain('bruno')
    expect(listarClientes(painel, 'atraso', '').map((c) => c.id)).not.toContain('ana')
  })

  it('aba "todos" respeita a busca', () => {
    expect(listarClientes(painel, 'todos', 'dieg').map((c) => c.id)).toEqual(['diego'])
  })
})
