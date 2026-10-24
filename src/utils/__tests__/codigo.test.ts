import { describe, expect, it } from 'vitest'
import { formatarCodigo, limparCodigo, normalizarCodigo, resultadoAtual } from '@/utils/codigo'
import { mensagemRecibo } from '@/utils/recibo'

describe('código de autenticação do recibo', () => {
  it('formata em grupos de 4 separados por traço', () => {
    expect(formatarCodigo('A3F927C15DE0B481')).toBe('A3F9-27C1-5DE0-B481')
  })

  it('aceita o código com traços, espaços e minúsculas', () => {
    expect(normalizarCodigo('a3f9-27c1 5de0-b481')).toBe('A3F927C15DE0B481')
  })

  it('rejeita códigos incompletos ou com caracteres que não são hexadecimais', () => {
    expect(normalizarCodigo('A3F9-27C1')).toBeNull()
    expect(normalizarCodigo('')).toBeNull()
    expect(normalizarCodigo('A3F9-27C1-5DE0-B481-FFFF')).toBeNull()
  })

  it('limparCodigo descarta o que não é 0-9 ou A-F', () => {
    expect(limparCodigo('zz-a1 b2!')).toBe('A1B2')
  })

  it('a mensagem do WhatsApp leva o código formatado', () => {
    const texto = mensagemRecibo({
      galpao: 'Galpão Rua 2',
      numero: 7,
      cliente: 'Maria',
      valor: 'R$ 10,00',
      data: '08/10/2025',
      forma: 'Pix',
      codigo: 'A3F927C15DE0B481',
    })
    expect(texto).toContain('Código de autenticação: A3F9-27C1-5DE0-B481')
    expect(texto).toContain('Recibo Nº 0007')
  })
})

describe('resultadoAtual (botão "Verificar outro código")', () => {
  const consultado = 'A3F927C15DE0B481'

  it('mantém o resultado enquanto o campo tem o mesmo código, com ou sem formatação', () => {
    expect(resultadoAtual('A3F9-27C1-5DE0-B481', consultado)).toBe(consultado)
    expect(resultadoAtual('a3f927c15de0b481', consultado)).toBe(consultado)
  })

  it('esconde o resultado quando o código é editado, apagado ou ainda não houve consulta', () => {
    expect(resultadoAtual('A3F9-27C1-5DE0-B482', consultado)).toBeNull()
    expect(resultadoAtual('', consultado)).toBeNull()
    expect(resultadoAtual('A3F9-27C1-5DE0-B481', null)).toBeNull()
  })
})

describe('mensagem do recibo com o item pago', () => {
  const base = {
    galpao: 'Galpão Rua 2',
    numero: 7,
    cliente: 'Maria',
    valor: 'R$ 110,00',
    data: '10/10/2025',
    forma: 'Dinheiro',
    referente: '10/10/2025',
  }

  it('mostra o item e chama a data da semana de "Cobrança de"', () => {
    const texto = mensagemRecibo({ ...base, itens: 'Carrinho de roupa' })
    expect(texto).toContain('Referente a: Carrinho de roupa')
    expect(texto).toContain('Cobrança de: 10/10/2025')
    expect(texto.indexOf('Valor:')).toBeLessThan(texto.indexOf('Referente a:'))
  })

  it('sem item (pagamento antigo), a linha não aparece', () => {
    expect(mensagemRecibo({ ...base, itens: null })).not.toContain('Referente a:')
  })
})
