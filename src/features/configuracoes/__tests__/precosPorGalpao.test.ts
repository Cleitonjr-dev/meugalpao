import { describe, expect, it } from 'vitest'
import { planejarPrecos, type PrecoDigitado } from '@/features/configuracoes/precosPorGalpao'

const existentes = [
  { id: 'p1', galpao_id: 'g1', preco_semanal: 25 },
  { id: 'p2', galpao_id: 'g2', preco_semanal: 30 },
]

function campo(galpaoId: string, texto: string): PrecoDigitado {
  return { galpaoId, galpaoNome: `Galpão ${galpaoId}`, texto }
}

describe('planejarPrecos', () => {
  it('campo vazio com preço próprio gravado apaga o preço (volta ao padrão)', () => {
    const r = planejarPrecos(existentes, [campo('g1', ''), campo('g2', '30,00')])
    expect(r).toEqual({ ok: true, inserir: [], atualizar: [], apagar: ['p1'] })
  })

  it('campo vazio sem preço próprio não faz nada', () => {
    const r = planejarPrecos([], [campo('g1', '   ')])
    expect(r).toEqual({ ok: true, inserir: [], atualizar: [], apagar: [] })
  })

  it('valor novo em galpão sem preço próprio insere', () => {
    const r = planejarPrecos(existentes, [campo('g3', '40')])
    expect(r).toEqual({
      ok: true,
      inserir: [{ galpao_id: 'g3', preco_semanal: 40 }],
      atualizar: [],
      apagar: [],
    })
  })

  it('valor diferente do gravado atualiza; igual não faz nada', () => {
    const r = planejarPrecos(existentes, [campo('g1', '27,50'), campo('g2', '30,00')])
    expect(r).toEqual({
      ok: true,
      inserir: [],
      atualizar: [{ id: 'p1', preco_semanal: 27.5 }],
      apagar: [],
    })
  })

  it('aceita vírgula, ponto e milhar', () => {
    const r = planejarPrecos([], [campo('g1', '1.234,56')])
    expect(r).toMatchObject({ ok: true, inserir: [{ galpao_id: 'g1', preco_semanal: 1234.56 }] })
  })

  it('preço zero é um valor válido (item gratuito naquele galpão)', () => {
    const r = planejarPrecos([], [campo('g1', '0')])
    expect(r).toMatchObject({ ok: true, inserir: [{ galpao_id: 'g1', preco_semanal: 0 }] })
  })

  it('valor inválido devolve o erro com o nome do galpão e nada para gravar', () => {
    const r = planejarPrecos(existentes, [campo('g1', ''), campo('g2', 'abc')])
    expect(r).toEqual({ ok: false, erro: 'Preço inválido em Galpão g2. Use um valor como 25,00.' })
  })

  it('mistura de ações em um único plano', () => {
    const r = planejarPrecos(existentes, [campo('g1', ''), campo('g2', '35'), campo('g3', '10')])
    expect(r).toEqual({
      ok: true,
      inserir: [{ galpao_id: 'g3', preco_semanal: 10 }],
      atualizar: [{ id: 'p2', preco_semanal: 35 }],
      apagar: ['p1'],
    })
  })
})
