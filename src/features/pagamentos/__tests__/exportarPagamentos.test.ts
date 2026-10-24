import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportarPagamentosCsv, LIMITE_EXPORTACAO, linhaCsv } from '@/features/pagamentos/exportarPagamentos'
import { listarPagamentos } from '@/features/pagamentos/pagamentos.queries'
import { baixarCsv } from '@/utils/csv'
import type { LinhaPagamento } from '@/types'

vi.mock('@/features/pagamentos/pagamentos.queries', () => ({ listarPagamentos: vi.fn() }))
vi.mock('@/utils/csv', async (original) => ({
  ...(await original<typeof import('@/utils/csv')>()),
  baixarCsv: vi.fn(),
}))

const FILTROS = { busca: '', formas: [], status: [], de: null, ate: null, porRecibo: false }

function linha(n: number, extra: Partial<LinhaPagamento> = {}): LinhaPagamento {
  return {
    id: `p${n}`,
    galpao_id: 'g1',
    cliente_id: 'c1',
    valor: 110,
    data_pagamento: '2025-10-08',
    semana_referencia: '2025-10-08',
    forma_pagamento: 'pix',
    status: 'pago',
    observacoes: null,
    created_at: '2025-10-08T14:00:00Z',
    cancelado_em: null,
    motivo_cancelamento: null,
    descricao: 'Carrinho de roupa',
    recebido_por_nome: 'Maria',
    cancelado_por_nome: null,
    cliente_nome: `Cliente ${n}`,
    cliente_whatsapp: null,
    recibo_numero: n,
    recibo_codigo: 'A3F927C15DE00001',
    criado_por: null,
    cancelado_por: null,
    ...extra,
  } as unknown as LinhaPagamento
}

beforeEach(() => {
  vi.mocked(listarPagamentos).mockReset()
  vi.mocked(baixarCsv).mockReset()
})

describe('exportarPagamentosCsv', () => {
  it('busca página por página até acabar, em lotes de 100, e baixa um único arquivo', async () => {
    vi.mocked(listarPagamentos).mockImplementation(async (_g, p) => {
      const todas = Array.from({ length: 230 }, (_, i) => linha(i + 1))
      const de = (p.pagina - 1) * p.tamanho
      return { total: 230, itens: todas.slice(de, de + p.tamanho) }
    })
    const r = await exportarPagamentosCsv('g1', FILTROS, 'x.csv')
    expect(r).toEqual({ linhas: 230, truncado: false })
    expect(vi.mocked(listarPagamentos).mock.calls.map((c) => [c[1].pagina, c[1].tamanho])).toEqual([
      [1, 100],
      [2, 100],
      [3, 100],
    ])
    expect(baixarCsv).toHaveBeenCalledTimes(1)
    expect(vi.mocked(baixarCsv).mock.calls[0][0]).toBe('x.csv')
  })

  it('manda os filtros recebidos para a busca (sem a página que o chamador não controla)', async () => {
    vi.mocked(listarPagamentos).mockResolvedValue({ total: 0, itens: [] })
    await exportarPagamentosCsv('g1', { ...FILTROS, busca: 'ana', formas: ['pix'], porRecibo: true }, 'x.csv')
    expect(listarPagamentos).toHaveBeenCalledWith('g1', {
      busca: 'ana',
      formas: ['pix'],
      status: [],
      de: null,
      ate: null,
      porRecibo: true,
      pagina: 1,
      tamanho: 100,
    })
  })

  it('pagamento repetido por causa de linhas que deslocaram durante a exportação sai uma única vez (AUD-019)', async () => {
    vi.mocked(listarPagamentos)
      .mockResolvedValueOnce({ total: 150, itens: Array.from({ length: 100 }, (_, i) => linha(i + 1)) })
      // entrou um pagamento novo: a página 2 repete a última linha da página 1
      .mockResolvedValueOnce({ total: 151, itens: Array.from({ length: 51 }, (_, i) => linha(i + 100)) })
      .mockResolvedValue({ total: 151, itens: [] })
    const r = await exportarPagamentosCsv('g1', FILTROS, 'x.csv')
    expect(r.linhas).toBe(150)
    const csv = vi.mocked(baixarCsv).mock.calls[0][1]
    expect(csv.split('\r\n').filter((l) => l.includes('Cliente 100;'))).toHaveLength(1)
  })

  it('nunca entra em repetição infinita se o servidor só devolver linhas repetidas', async () => {
    vi.mocked(listarPagamentos).mockResolvedValue({ total: 300, itens: Array.from({ length: 100 }, (_, i) => linha(i + 1)) })
    const r = await exportarPagamentosCsv('g1', FILTROS, 'x.csv')
    expect(r.linhas).toBe(100)
    expect(vi.mocked(listarPagamentos).mock.calls.length).toBeLessThanOrEqual(5)
  })

  it(`acima de ${LIMITE_EXPORTACAO} linhas o arquivo é cortado e o aviso de corte vem ligado`, async () => {
    vi.mocked(listarPagamentos).mockImplementation(async (_g, p) => ({
      total: 25000,
      itens: Array.from({ length: p.tamanho }, (_, i) => linha((p.pagina - 1) * p.tamanho + i + 1)),
    }))
    const r = await exportarPagamentosCsv('g1', FILTROS, 'x.csv')
    expect(r).toEqual({ linhas: LIMITE_EXPORTACAO, truncado: true })
  })

  it('sem nenhum pagamento baixa só o cabeçalho', async () => {
    vi.mocked(listarPagamentos).mockResolvedValue({ total: 0, itens: [] })
    const r = await exportarPagamentosCsv('g1', FILTROS, 'x.csv')
    expect(r.linhas).toBe(0)
    expect(vi.mocked(baixarCsv).mock.calls[0][1].trim().split('\r\n')).toHaveLength(1)
  })

  it('se a busca falhar o erro sobe e nada é baixado', async () => {
    vi.mocked(listarPagamentos).mockRejectedValue(new Error('sem rede'))
    await expect(exportarPagamentosCsv('g1', FILTROS, 'x.csv')).rejects.toThrow('sem rede')
    expect(baixarCsv).not.toHaveBeenCalled()
  })
})

describe('linhaCsv', () => {
  it('formata recibo com zeros, código com traços, datas brasileiras e valor com vírgula', () => {
    const l = linhaCsv(linha(7))
    expect(l[0]).toBe('0007')
    expect(l[1]).toBe('A3F9-27C1-5DE0-0001')
    expect(l[3]).toBe('08/10/2025')
    expect(l[5]).toBe('Pix')
    expect(l[6]).toBe('Pago')
    expect(l[7]).toBe('110,00')
    expect(l[8]).toBe('Carrinho de roupa')
    expect(l[9]).toBe('Maria')
  })

  it('pagamento sem recibo ou sem código deixa os campos vazios', () => {
    const l = linhaCsv(linha(1, { recibo_numero: null, recibo_codigo: null }))
    expect(l[0]).toBeNull()
    expect(l[1]).toBeNull()
  })

  it('usa a data do pagamento quando não há semana de referência', () => {
    expect(linhaCsv(linha(1, { semana_referencia: null, data_pagamento: '2025-09-03' }))[3]).toBe('03/09/2025')
  })

  it('cancelado leva quem cancelou e o motivo', () => {
    const l = linhaCsv(linha(1, { status: 'cancelado', cancelado_por_nome: 'João', motivo_cancelamento: 'erro' }))
    expect(l[6]).toBe('Cancelado')
    expect(l[10]).toBe('João')
    expect(l[11]).toBe('erro')
  })
})
