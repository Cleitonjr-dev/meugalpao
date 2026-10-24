import { describe, expect, it } from 'vitest'
import { filtrarClientes, normalizarTexto } from '@/utils/clientes'
import type { Cliente } from '@/types'

const base = { galpao_id: 'g', dia_pagamento: 'sabado', observacoes: null, ativo: true, criado_por: null, created_at: '' } as const
const c = (id: string, nome: string, telefone: string | null, whatsapp: string | null = null): Cliente =>
  ({ ...base, id, nome, telefone, whatsapp }) as Cliente

const lista = [
  c('1', 'José da Silva', '(85) 99999-1234'),
  c('2', 'Maria Souza', null, '85 98888-0000'),
  c('3', 'ANA LÚCIA', '8532221111'),
]

describe('normalizarTexto', () => {
  it('tira acentos, maiúsculas e espaços das pontas', () => {
    expect(normalizarTexto('  JOSÉ  ')).toBe('jose')
  })
})

describe('filtrarClientes', () => {
  it('ignora acento e maiúscula', () => {
    expect(filtrarClientes(lista, 'jose').map((x) => x.id)).toEqual(['1'])
    expect(filtrarClientes(lista, 'lucia').map((x) => x.id)).toEqual(['3'])
  })
  it('acha por telefone com ou sem máscara', () => {
    expect(filtrarClientes(lista, '99999').map((x) => x.id)).toEqual(['1'])
    expect(filtrarClientes(lista, '(85) 99999-1234').map((x) => x.id)).toEqual(['1'])
    expect(filtrarClientes(lista, '98888').map((x) => x.id)).toEqual(['2'])
  })
  it('termo vazio devolve tudo', () => {
    expect(filtrarClientes(lista, '  ')).toHaveLength(3)
  })
  it('sem resultado devolve lista vazia; cliente sem telefone não quebra', () => {
    expect(filtrarClientes(lista, 'zzz')).toEqual([])
    expect(filtrarClientes(lista, '000000000')).toEqual([])
  })
})
