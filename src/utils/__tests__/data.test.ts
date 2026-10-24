import { describe, expect, it } from 'vitest'
import { agoraEmFortaleza, dataLocalISO, parseISO } from '@/utils/data'

describe('agoraEmFortaleza', () => {
  it('converte um instante UTC para o horário de Fortaleza (UTC-3)', () => {
    const d = agoraEmFortaleza(new Date('2025-10-11T13:30:15Z'))
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([
      2025, 10, 11, 10, 30, 15,
    ])
  })

  it('passa para o dia anterior quando em UTC já é o dia seguinte (madrugada de Fortaleza)', () => {
    const d = agoraEmFortaleza(new Date('2025-10-12T02:30:00Z'))
    expect(dataLocalISO(d)).toBe('2025-10-11')
    expect(d.getHours()).toBe(23)
  })

  it('meia-noite em Fortaleza já é o dia novo (e a hora é 0, não 24)', () => {
    const d = agoraEmFortaleza(new Date('2025-10-12T03:00:00Z'))
    expect(dataLocalISO(d)).toBe('2025-10-12')
    expect(d.getHours()).toBe(0)
  })

  it('o dia da semana segue Fortaleza: 03:00 UTC de domingo ainda é sábado à noite? não, já é domingo', () => {
    expect(agoraEmFortaleza(new Date('2025-10-12T02:59:59Z')).getDay()).toBe(6) // sábado 23:59:59
    expect(agoraEmFortaleza(new Date('2025-10-12T03:00:00Z')).getDay()).toBe(0) // domingo 00:00
  })

  it('sem argumento usa o relógio atual', () => {
    expect(agoraEmFortaleza().getFullYear()).toBeGreaterThanOrEqual(2025)
  })
})

describe('dataLocalISO e parseISO', () => {
  it('formatam e leem datas sem passar por UTC', () => {
    expect(dataLocalISO(new Date(2025, 0, 5))).toBe('2025-01-05')
    const d = parseISO('2025-10-11')
    expect(d && [d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2025, 9, 11])
  })

  it('texto que não é data devolve null', () => {
    expect(parseISO('')).toBeNull()
    expect(parseISO('abc')).toBeNull()
    expect(parseISO('2025-00-10')).toBeNull()
  })
})
