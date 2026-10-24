import { describe, expect, it } from 'vitest'
import { ACOES, opcoesDeAcao, rotuloAcao, tomAcao } from '@/features/configuracoes/auditoria'

describe('rótulos do histórico', () => {
  it('traduz o código da ação para um nome legível', () => {
    expect(rotuloAcao('pagamento.cancelado')).toBe('Pagamento cancelado')
    expect(rotuloAcao('usuario.super_alterado')).toBe('Permissão alterada')
  })

  it('ação desconhecida mostra o próprio código em vez de quebrar', () => {
    expect(rotuloAcao('algo.novo')).toBe('algo.novo')
    expect(tomAcao('algo.novo')).toBe('neutro')
  })

  it('cancelamentos e exclusões chamam atenção', () => {
    expect(tomAcao('pagamento.cancelado')).toBe('perigo')
    expect(tomAcao('cliente.excluido')).toBe('perigo')
    expect(tomAcao('pagamento.registrado')).toBe('sucesso')
  })

  it('o filtro lista todas as ações, em ordem alfabética', () => {
    const opcoes = opcoesDeAcao()
    expect(opcoes).toHaveLength(Object.keys(ACOES).length)
    const nomes = opcoes.map((o) => o.label)
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  })
})
