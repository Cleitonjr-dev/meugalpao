import { describe, expect, it } from 'vitest'
import {
  chavePagamento,
  clienteEmAtraso,
  indexarPagos,
  pendenciasCliente,
  pendenciasTruncadas,
  referenciasDisponiveis,
  SEMANAS_RETROATIVAS_MAX,
  situacaoCliente,
  ultimaReferencia,
} from '@/utils/pagamentos'
import type { Cliente, Pagamento } from '@/types'

function cliente(parcial: Partial<Cliente> = {}): Cliente {
  return {
    id: 'c1',
    galpao_id: 'g1',
    nome: 'Maria',
    telefone: null,
    whatsapp: null,
    dia_pagamento: 'quarta',
    observacoes: null,
    ativo: true,
    criado_por: null,
    created_at: '2025-01-01T12:00:00',
    ...parcial,
  }
}

function pagamento(semana: string, parcial: Partial<Pagamento> = {}): Pagamento {
  return {
    id: `p-${semana}`,
    galpao_id: 'g1',
    cliente_id: 'c1',
    valor: 10,
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
    created_at: `${semana}T12:00:00`,
    ...parcial,
  }
}

// 2025-10-08 é uma quarta-feira; 2025-10-11 é sábado; 2025-10-09 é quinta.
const QUARTA = new Date(2025, 9, 8, 10, 0)
const QUINTA = new Date(2025, 9, 9, 10, 0)
const SABADO = new Date(2025, 9, 11, 10, 0)

describe('ultimaReferencia', () => {
  it('no próprio dia de pagamento a cobrança é a de hoje', () => {
    expect(ultimaReferencia('quarta', QUARTA)).toBe('2025-10-08')
  })

  it('depois do dia, continua sendo a última quarta', () => {
    expect(ultimaReferencia('quarta', QUINTA)).toBe('2025-10-08')
    expect(ultimaReferencia('sabado', QUINTA)).toBe('2025-10-04')
  })
})

describe('pendências e situação', () => {
  it('cliente que pagou todas as semanas está em dia', () => {
    const pagos = indexarPagos([
      pagamento('2025-09-24'),
      pagamento('2025-10-01'),
      pagamento('2025-10-08'),
    ])
    const cli = cliente({ created_at: '2025-09-24T12:00:00' })
    expect(pendenciasCliente(cli, pagos, QUARTA)).toEqual([])
    expect(situacaoCliente(cli, pagos, QUARTA).status).toBe('em_dia')
  })

  it('detecta semanas antigas em aberto mesmo com a última paga', () => {
    const pagos = indexarPagos([pagamento('2025-10-08')])
    const cli = cliente({ created_at: '2025-09-17T12:00:00' })
    expect(pendenciasCliente(cli, pagos, QUARTA)).toEqual([
      '2025-09-17',
      '2025-09-24',
      '2025-10-01',
    ])
    expect(situacaoCliente(cli, pagos, QUARTA).status).toBe('em_atraso')
  })

  it('pagamento cancelado não conta como pago', () => {
    const pagos = indexarPagos([pagamento('2025-10-08', { status: 'cancelado' })])
    expect(pagos.has(chavePagamento('c1', '2025-10-08'))).toBe(false)
    expect(clienteEmAtraso(cliente({ created_at: '2025-10-08T08:00:00' }), pagos, QUARTA)).toBe(
      true,
    )
  })

  it('cliente cadastrado depois do dia de pagamento não nasce em atraso', () => {
    const novo = cliente({ created_at: '2025-10-09T09:00:00' }) // quinta
    expect(clienteEmAtraso(novo, new Set(), SABADO)).toBe(false)
    expect(situacaoCliente(novo, new Set(), SABADO).status).toBe('em_dia')
  })

  it('cliente inativo nunca fica em atraso', () => {
    expect(clienteEmAtraso(cliente({ ativo: false }), new Set(), QUARTA)).toBe(false)
  })

  it('semana paga adiantada aparece como adiantado', () => {
    const pagos = indexarPagos([
      pagamento('2025-10-01'),
      pagamento('2025-10-08'),
      pagamento('2025-10-15'),
    ])
    const cli = cliente({ created_at: '2025-10-01T08:00:00' })
    const situacao = situacaoCliente(cli, pagos, QUARTA)
    expect(situacao.status).toBe('adiantado')
    expect(situacao.pagoAte).toBe('2025-10-15')
  })

  it('confere as últimas 26 semanas e avisa quando o cliente é mais antigo que isso (AUD-014)', () => {
    const antigo = cliente({ created_at: '2020-01-01T12:00:00' })
    expect(pendenciasCliente(antigo, new Set(), QUARTA)).toHaveLength(SEMANAS_RETROATIVAS_MAX)
    expect(SEMANAS_RETROATIVAS_MAX).toBe(26)
    expect(pendenciasTruncadas(antigo, QUARTA)).toBe(true)
    expect(situacaoCliente(antigo, new Set(), QUARTA).truncada).toBe(true)
  })

  it('cliente dentro da janela não é marcado como cortado', () => {
    const recente = cliente({ created_at: '2025-09-24T12:00:00' })
    expect(pendenciasTruncadas(recente, QUARTA)).toBe(false)
    expect(situacaoCliente(recente, new Set(), QUARTA).truncada).toBe(false)
  })

  it('cliente inativo nunca é marcado como cortado', () => {
    expect(pendenciasTruncadas(cliente({ created_at: '2020-01-01T12:00:00', ativo: false }), QUARTA)).toBe(false)
  })

  it('exatamente no limite da janela (26 cobranças) ainda não é corte', () => {
    // quarta 08/10/2025 menos 25 semanas = quarta 16/04/2025: a primeira cobrança é a primeira da janela
    const limite = cliente({ created_at: '2025-04-16T12:00:00' })
    expect(pendenciasCliente(limite, new Set(), QUARTA)).toHaveLength(26)
    expect(pendenciasTruncadas(limite, QUARTA)).toBe(false)
    const umAntes = cliente({ created_at: '2025-04-09T12:00:00' })
    expect(pendenciasTruncadas(umAntes, QUARTA)).toBe(true)
  })
})

describe('referenciasDisponiveis', () => {
  it('lista atrasadas primeiro e depois a atual e as próximas, sem as já pagas', () => {
    const cli = cliente({ created_at: '2025-09-24T12:00:00' })
    const pagos = indexarPagos([pagamento('2025-10-08')])
    const refs = referenciasDisponiveis(cli, pagos, QUARTA)
    expect(refs.map((r) => r.iso)).toEqual([
      '2025-09-24',
      '2025-10-01',
      '2025-10-15',
      '2025-10-22',
      '2025-10-29',
      '2025-11-05',
    ])
    expect(refs[0].atrasada).toBe(true)
    expect(refs.find((r) => r.iso === '2025-10-15')?.atrasada).toBeUndefined()
  })
})
