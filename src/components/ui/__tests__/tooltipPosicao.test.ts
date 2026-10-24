import { describe, expect, it } from 'vitest'
import { calcularPosicaoTooltip } from '@/components/ui/tooltipPosicao'

const TELA = { width: 1000, height: 700 }
const BALAO = { width: 100, height: 30 }

describe('calcularPosicaoTooltip', () => {
  it('fica acima do elemento e centralizado', () => {
    const p = calcularPosicaoTooltip({ top: 300, bottom: 330, left: 450, width: 100 }, BALAO, TELA)
    expect(p.lado).toBe('acima')
    expect(p.top).toBe(300 - 30 - 8)
    expect(p.left).toBe(500 - 50) // centro do elemento (500) menos metade do balão
    expect(p.setaEsquerda).toBe(50)
  })

  it('vai para baixo quando não cabe em cima', () => {
    const p = calcularPosicaoTooltip({ top: 10, bottom: 40, left: 450, width: 100 }, BALAO, TELA)
    expect(p.lado).toBe('abaixo')
    expect(p.top).toBe(40 + 8)
  })

  it('não passa da borda esquerda e a seta continua apontando para o elemento', () => {
    const p = calcularPosicaoTooltip({ top: 300, bottom: 330, left: 0, width: 20 }, BALAO, TELA)
    expect(p.left).toBe(8)
    expect(p.setaEsquerda).toBe(12) // centro (10) - 8 = 2, limitado ao mínimo de 12
  })

  it('não passa da borda direita', () => {
    const p = calcularPosicaoTooltip({ top: 300, bottom: 330, left: 980, width: 20 }, BALAO, TELA)
    expect(p.left).toBe(1000 - 100 - 8)
    expect(p.left + BALAO.width).toBeLessThanOrEqual(TELA.width - 8)
  })

  it('balão mais largo que a tela fica encostado na margem esquerda', () => {
    const p = calcularPosicaoTooltip(
      { top: 300, bottom: 330, left: 100, width: 20 },
      { width: 2000, height: 30 },
      TELA,
    )
    expect(p.left).toBe(8)
  })
})
