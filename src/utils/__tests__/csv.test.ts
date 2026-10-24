import { describe, expect, it } from 'vitest'
import { escaparCelula, gerarCsv, reaisCsv } from '@/utils/csv'

describe('escaparCelula', () => {
  it('texto simples e vazios', () => {
    expect(escaparCelula('José')).toBe('José')
    expect(escaparCelula(null)).toBe('')
    expect(escaparCelula(undefined)).toBe('')
  })
  it('aspas, ponto e vírgula e quebra de linha', () => {
    expect(escaparCelula('a;b')).toBe('"a;b"')
    expect(escaparCelula('diz "oi"')).toBe('"diz ""oi"""')
    expect(escaparCelula('a\nb')).toBe('"a\nb"')
  })
  it('bloqueia injeção de fórmula', () => {
    expect(escaparCelula('=1+1')).toBe("'=1+1")
    expect(escaparCelula('@soma')).toBe("'@soma")
    expect(escaparCelula('-5')).toBe("'-5")
  })
  it('número usa vírgula', () => {
    expect(escaparCelula(110.5)).toBe('110,5')
  })
})

describe('gerarCsv', () => {
  it('começa com BOM, usa ; e CRLF', () => {
    const csv = gerarCsv(['Nome', 'Valor'], [['Ana', '10,00']])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toBe('\uFEFFNome;Valor\r\nAna;10,00\r\n')
  })
})

describe('reaisCsv', () => {
  it('formata com duas casas e vírgula', () => {
    expect(reaisCsv(110)).toBe('110,00')
    expect(reaisCsv(7.5)).toBe('7,50')
  })
})
