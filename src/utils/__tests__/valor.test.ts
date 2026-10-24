import { describe, expect, it } from 'vitest'
import { formatarValorInput, parseValorBR, valorExibido } from '@/utils/valor'
import { formatarDataBR, normalizarWhatsapp, whatsappLink } from '@/utils/recibo'

describe('parseValorBR', () => {
  it.each([
    ['10', 10],
    ['10,5', 10.5],
    ['10.50', 10.5],
    ['1.234,56', 1234.56],
    ['R$ 25,00', 25],
    ['1.000', 1000],
  ])('aceita %s', (entrada, esperado) => {
    expect(parseValorBR(entrada)).toBe(esperado)
  })

  it.each(['', 'abc', '1e3', '-5', '10,555', '1,2,3'])('rejeita %j', (entrada) => {
    expect(parseValorBR(entrada)).toBeNull()
  })

  it('formatarValorInput usa vírgula e duas casas', () => {
    expect(formatarValorInput(12.5)).toBe('12,50')
  })
})

describe('whatsapp', () => {
  it('acrescenta o código do país (55) em números nacionais', () => {
    expect(normalizarWhatsapp('(85) 99999-9999')).toBe('5585999999999')
    expect(normalizarWhatsapp('85 3333-4444')).toBe('558533334444')
    expect(normalizarWhatsapp('085 99999-9999')).toBe('5585999999999')
  })

  it('mantém números que já têm 55', () => {
    expect(normalizarWhatsapp('+55 85 99999-9999')).toBe('5585999999999')
  })

  it('rejeita números inválidos', () => {
    expect(normalizarWhatsapp('1234')).toBeNull()
    expect(whatsappLink('abc', 'oi')).toBeNull()
  })

  it('monta o link com a mensagem codificada', () => {
    expect(whatsappLink('85999999999', 'olá mundo')).toBe(
      'https://wa.me/5585999999999?text=ol%C3%A1%20mundo',
    )
  })
})

describe('formatarDataBR', () => {
  it('não muda o dia por causa do fuso horário', () => {
    expect(formatarDataBR('2025-10-08')).toBe('08/10/2025')
  })
})

describe('valorExibido (linha do cliente no Dashboard)', () => {
  it('cobrança atual não paga: mostra o preço atual dos itens', () => {
    expect(valorExibido(50, null)).toEqual({ valor: 50, pago: false, proximas: null })
  })

  it('cobrança atual paga e preço igual: mostra o valor pago, sem aviso de preço novo', () => {
    expect(valorExibido(110, 110)).toEqual({ valor: 110, pago: true, proximas: null })
  })

  it('pagou 110 e depois o item mudou para 50: continua 110 pago, e 50 vale daqui para frente', () => {
    expect(valorExibido(50, 110)).toEqual({ valor: 110, pago: true, proximas: 50 })
  })

  it('diferença de centavos de arredondamento não conta como mudança', () => {
    expect(valorExibido(25.001, 25)).toEqual({ valor: 25, pago: true, proximas: null })
  })
})
