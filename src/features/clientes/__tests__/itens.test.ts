import { describe, expect, it } from 'vitest'
import type { ItemGuardado } from '@/types'
import {
  RASCUNHO_VAZIO,
  ajustarQuantidadeNovo,
  ajustarQuantidadeSalvo,
  chaveDoItem,
  incluirItem,
  novaChave,
  quantidadeFinal,
  rascunhoPreenchido,
  resumoAlteracoes,
  validarRascunho,
} from '@/features/clientes/itens'

describe('rascunhoPreenchido', () => {
  it('o formulário vazio não conta como preenchido', () => {
    expect(rascunhoPreenchido(RASCUNHO_VAZIO)).toBe(false)
  })

  it('tipo escolhido ou identificação digitada contam; só mudar a quantidade não', () => {
    expect(rascunhoPreenchido({ ...RASCUNHO_VAZIO, tipoId: 't1' })).toBe(true)
    expect(rascunhoPreenchido({ ...RASCUNHO_VAZIO, identificacao: ' ABC ' })).toBe(true)
    expect(rascunhoPreenchido({ ...RASCUNHO_VAZIO, identificacao: '   ' })).toBe(false)
    expect(rascunhoPreenchido({ ...RASCUNHO_VAZIO, quantidade: '3' })).toBe(false)
  })
})

describe('validarRascunho', () => {
  it('exige o tipo do item', () => {
    expect(validarRascunho(RASCUNHO_VAZIO)).toEqual({ ok: false, erro: 'Escolha o tipo do item.' })
  })

  it('exige quantidade inteira a partir de 1', () => {
    for (const quantidade of ['0', '-1', '1.5', '', 'abc']) {
      const r = validarRascunho({ tipoId: 't1', identificacao: '', quantidade })
      expect(r.ok).toBe(false)
    }
  })

  it('devolve o item pronto, com identificação aparada ou nula', () => {
    expect(validarRascunho({ tipoId: 't1', identificacao: '  ABC1D23 ', quantidade: '2' })).toEqual({
      ok: true,
      item: { tipo_item_id: 't1', identificacao: 'ABC1D23', quantidade: 2 },
    })
    expect(validarRascunho({ tipoId: 't1', identificacao: '  ', quantidade: '1' })).toEqual({
      ok: true,
      item: { tipo_item_id: 't1', identificacao: null, quantidade: 1 },
    })
  })
})

describe('resumoAlteracoes', () => {
  it('descreve o que mudou, no singular e no plural', () => {
    expect(resumoAlteracoes(0, 0)).toBe('')
    expect(resumoAlteracoes(1, 0)).toBe('1 item adicionado')
    expect(resumoAlteracoes(3, 0)).toBe('3 itens adicionados')
    expect(resumoAlteracoes(0, 1)).toBe('1 item removido')
    expect(resumoAlteracoes(2, 4)).toBe('2 itens adicionados e 4 itens removidos')
  })
})

describe('novaChave', () => {
  it('gera chaves diferentes', () => {
    expect(novaChave()).not.toBe(novaChave())
  })
})

function salvo(id: string, tipo: string, identificacao: string | null, quantidade: number): ItemGuardado {
  return {
    id,
    cliente_id: 'c1',
    galpao_id: 'g1',
    tipo_item_id: tipo,
    identificacao,
    quantidade,
    ativo: true,
    created_at: '2025-10-01T12:00:00',
  }
}

function novo(chave: string, tipo: string, identificacao: string | null, quantidade: number) {
  return { chave, tipo_item_id: tipo, identificacao, quantidade }
}

describe('chaveDoItem', () => {
  it('ignora maiúsculas, espaços nas pontas e identificação vazia', () => {
    expect(chaveDoItem('t1', ' abc1d23 ')).toBe(chaveDoItem('t1', 'ABC1D23'))
    expect(chaveDoItem('t1', null)).toBe(chaveDoItem('t1', '   '))
    expect(chaveDoItem('t1', 'A')).not.toBe(chaveDoItem('t2', 'A'))
  })
})

describe('incluirItem (juntar itens iguais)', () => {
  const vazio = { novos: [], ajustes: {} }

  it('item diferente entra como uma nova linha', () => {
    const r = incluirItem(vazio, novo('a', 't1', 'X', 1), [], [])
    expect(r.novos).toHaveLength(1)
    const r2 = incluirItem(r, novo('b', 't1', 'Y', 1), [], [])
    expect(r2.novos).toHaveLength(2)
  })

  it('item igual a outro novo só soma a quantidade', () => {
    let r = incluirItem(vazio, novo('a', 't1', null, 1), [], [])
    r = incluirItem(r, novo('b', 't1', null, 2), [], [])
    expect(r.novos).toEqual([novo('a', 't1', null, 3)])
  })

  it('item igual a um já gravado aumenta a quantidade dele, sem criar linha', () => {
    const r = incluirItem(vazio, novo('a', 't1', 'ABC', 2), [salvo('s1', 't1', 'abc', 1)], [])
    expect(r.novos).toEqual([])
    expect(r.ajustes).toEqual({ s1: 2 })
    const r2 = incluirItem(r, novo('b', 't1', 'ABC', 3), [salvo('s1', 't1', 'abc', 1)], [])
    expect(r2.ajustes).toEqual({ s1: 5 })
  })

  it('item gravado marcado para remover não conta: entra como novo', () => {
    const r = incluirItem(vazio, novo('a', 't1', null, 1), [salvo('s1', 't1', null, 1)], ['s1'])
    expect(r.novos).toHaveLength(1)
    expect(r.ajustes).toEqual({})
  })

  it('não altera o estado recebido', () => {
    const base = { novos: [novo('a', 't1', null, 1)], ajustes: {} }
    incluirItem(base, novo('b', 't1', null, 4), [], [])
    expect(base.novos[0].quantidade).toBe(1)
  })
})

describe('ajustarQuantidadeSalvo (− / + em item gravado)', () => {
  const item = salvo('s1', 't1', null, 4)

  it('diminui e aumenta a quantidade final', () => {
    let r = ajustarQuantidadeSalvo({}, [], item, -1)
    r = ajustarQuantidadeSalvo(r.ajustes, r.removidos, item, -1)
    expect(r.ajustes).toEqual({ s1: -2 })
    expect(quantidadeFinal(item, r.ajustes)).toBe(2)
    expect(r.removidos).toEqual([])
    r = ajustarQuantidadeSalvo(r.ajustes, r.removidos, item, 1)
    expect(quantidadeFinal(item, r.ajustes)).toBe(3)
  })

  it('voltar à quantidade original apaga o ajuste', () => {
    let r = ajustarQuantidadeSalvo({}, [], item, -1)
    r = ajustarQuantidadeSalvo(r.ajustes, r.removidos, item, 1)
    expect(r.ajustes).toEqual({})
  })

  it('chegar a zero marca o item para remover e descarta o ajuste', () => {
    const um = salvo('s2', 't1', null, 1)
    const r = ajustarQuantidadeSalvo({}, [], um, -1)
    expect(r.removidos).toEqual(['s2'])
    expect(r.ajustes).toEqual({})

    let r2 = ajustarQuantidadeSalvo({}, [], item, -1)
    for (let i = 0; i < 3; i++) r2 = ajustarQuantidadeSalvo(r2.ajustes, r2.removidos, item, -1)
    expect(r2.removidos).toEqual(['s1'])
    expect(r2.ajustes).toEqual({})
  })

  it('adicionar item igual depois de diminuir soma sobre o ajuste', () => {
    const r = incluirItem(
      { novos: [], ajustes: { s1: -2 } },
      novo('a', 't1', null, 1),
      [item],
      [],
    )
    expect(r.ajustes).toEqual({ s1: -1 })
    const zerou = incluirItem({ novos: [], ajustes: { s1: -1 } }, novo('b', 't1', null, 1), [item], [])
    expect(zerou.ajustes).toEqual({})
  })
})

describe('ajustarQuantidadeNovo', () => {
  it('aumenta e diminui, sem passar de 1 para baixo', () => {
    const lista = [novo('a', 't1', null, 2), novo('b', 't2', null, 1)]
    expect(ajustarQuantidadeNovo(lista, 'a', 1)[0].quantidade).toBe(3)
    expect(ajustarQuantidadeNovo(lista, 'a', -1)[0].quantidade).toBe(1)
    expect(ajustarQuantidadeNovo(lista, 'b', -1)[1].quantidade).toBe(1)
    expect(lista[0].quantidade).toBe(2) // não altera a lista original
  })
})
