import { describe, expect, it } from 'vitest'
import { calcularPosicaoLista } from '@/components/ui/posicaoLista'

const TELA = { width: 1000, height: 700 }

describe('calcularPosicaoLista', () => {
  it('abre para baixo quando há espaço', () => {
    const p = calcularPosicaoLista({ top: 100, bottom: 140, left: 200, width: 300 }, TELA)
    expect(p.top).toBe(144)
    expect(p.bottom).toBeUndefined()
    expect(p.left).toBe(200)
    expect(p.width).toBe(300)
    expect(p.maxHeight).toBe(260)
  })

  it('abre para cima quando falta espaço embaixo e sobra em cima', () => {
    const p = calcularPosicaoLista({ top: 600, bottom: 640, left: 200, width: 300 }, TELA)
    expect(p.top).toBeUndefined()
    expect(p.bottom).toBe(700 - 600 + 4)
    expect(p.maxHeight).toBe(260)
  })

  it('nunca passa do espaço disponível (não cria rolagem na página)', () => {
    // pouco espaço embaixo (110) e menos ainda em cima: fica embaixo com a altura mínima
    const p = calcularPosicaoLista({ top: 40, bottom: 80, left: 0, width: 300 }, { width: 1000, height: 200 })
    expect(p.top).toBe(84)
    expect(p.maxHeight).toBe(120)
  })

  it('encosta na margem quando o campo está colado na borda da tela', () => {
    const p = calcularPosicaoLista({ top: 100, bottom: 140, left: 900, width: 300 }, TELA)
    expect(p.left + p.width).toBeLessThanOrEqual(1000 - 8)
  })
})
