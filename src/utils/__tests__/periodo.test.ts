import { describe, expect, it } from 'vitest'
import { limitesDoPeriodo, periodoDoPreset, presetDoPeriodo } from '@/utils/periodo'
import { inicioJanelaRecente } from '@/utils/pagamentos'

// 2025-10-08 é uma quarta-feira.
const HOJE = new Date(2025, 9, 8, 15, 30)

describe('periodoDoPreset', () => {
  it('hoje', () => {
    expect(periodoDoPreset('hoje', HOJE)).toEqual({ de: '2025-10-08', ate: '2025-10-08' })
  })

  it('últimos 7 dias contam hoje e os 6 anteriores', () => {
    expect(periodoDoPreset('7dias', HOJE)).toEqual({ de: '2025-10-02', ate: '2025-10-08' })
  })

  it('este mês vai do dia 1 até hoje', () => {
    expect(periodoDoPreset('mes', HOJE)).toEqual({ de: '2025-10-01', ate: '2025-10-08' })
  })

  it('mês passado vai do dia 1 ao último dia', () => {
    expect(periodoDoPreset('mes-passado', HOJE)).toEqual({ de: '2025-09-01', ate: '2025-09-30' })
  })

  it('mês passado em janeiro volta para dezembro do ano anterior', () => {
    expect(periodoDoPreset('mes-passado', new Date(2026, 0, 15))).toEqual({
      de: '2025-12-01',
      ate: '2025-12-31',
    })
  })

  it('reconhece qual atalho corresponde ao período', () => {
    expect(presetDoPeriodo({ de: '2025-10-01', ate: '2025-10-08' }, HOJE)).toBe('mes')
    expect(presetDoPeriodo({ de: '2025-10-03', ate: '2025-10-08' }, HOJE)).toBeNull()
  })
})

describe('inicioJanelaRecente', () => {
  it('cobre 27 semanas para trás (as 26 conferidas mais uma de folga)', () => {
    expect(inicioJanelaRecente(HOJE)).toBe('2025-04-02')
  })
})

describe('limitesDoPeriodo (alcance dos calendários)', () => {
  it('vai do primeiro pagamento até hoje', () => {
    expect(limitesDoPeriodo('2025-09-26', HOJE)).toEqual({ min: '2025-09-26', max: '2025-10-08' })
  })

  it('sem nenhum pagamento ainda, permite 1 ano para trás', () => {
    expect(limitesDoPeriodo(null, HOJE)).toEqual({ min: '2024-10-08', max: '2025-10-08' })
  })

  it('um primeiro pagamento "no futuro" (relógio do computador atrasado) nunca passa de hoje', () => {
    expect(limitesDoPeriodo('2026-01-01', HOJE)).toEqual({ min: '2025-10-08', max: '2025-10-08' })
  })
})
