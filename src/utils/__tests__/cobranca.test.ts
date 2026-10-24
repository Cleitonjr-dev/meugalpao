import { describe, expect, it } from 'vitest'
import { mensagemCobranca } from '@/utils/cobranca'

describe('mensagemCobranca', () => {
  it('uma semana usa o singular', () => {
    const m = mensagemCobranca({
      nomeCliente: 'José da Silva',
      galpao: 'Galpão 1',
      semanas: ['2025-10-04'],
      valorTotal: 110,
    })
    expect(m).toContain('Olá, José!')
    expect(m).toContain('existe 1 cobrança em aberto no Galpão 1')
    expect(m).toMatch(/Total: R\$\s110,00\./)
  })

  it('várias semanas usam o plural e listam as datas', () => {
    const m = mensagemCobranca({
      nomeCliente: 'Ana',
      galpao: 'G2',
      semanas: ['2025-10-04', '2025-10-11', '2025-10-18'],
      valorTotal: 330,
    })
    expect(m).toContain('existem 3 cobranças em aberto')
    expect(m.split('\n')[2].split(', ')).toHaveLength(3)
  })

  it('quando há cobranças ainda mais antigas, diz "pelo menos" e não promete o total', () => {
    const m = mensagemCobranca({
      nomeCliente: 'Ana',
      galpao: 'G2',
      semanas: ['2025-10-04', '2025-10-11'],
      valorTotal: 220,
      truncada: true,
    })
    expect(m).toContain('existem pelo menos 2 cobranças em aberto')
    expect(m).toMatch(/Total das últimas semanas: R\$\s220,00\./)
  })
})
