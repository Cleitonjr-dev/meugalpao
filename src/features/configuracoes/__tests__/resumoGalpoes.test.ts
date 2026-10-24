import { describe, expect, it } from 'vitest'
import { montarResumo, usuariosPorGalpao } from '@/features/configuracoes/resumoGalpoes'

describe('usuariosPorGalpao', () => {
  const membros = [
    { galpao_id: 'g1', profile_id: 'maria' },
    { galpao_id: 'g1', profile_id: 'joao' },
    { galpao_id: 'g2', profile_id: 'maria' },
  ]

  it('conta os liberados para cada galpão', () => {
    expect(usuariosPorGalpao(['g1', 'g2', 'g3'], membros, [])).toEqual({ g1: 2, g2: 1, g3: 0 })
  })

  it('super usuários têm acesso a todos os galpões', () => {
    expect(usuariosPorGalpao(['g1', 'g2', 'g3'], membros, ['dev'])).toEqual({ g1: 3, g2: 2, g3: 1 })
  })

  it('a mesma pessoa conta uma vez, mesmo sendo super e membro', () => {
    expect(usuariosPorGalpao(['g1'], membros, ['maria'])).toEqual({ g1: 2 })
  })
})

describe('montarResumo', () => {
  it('junta as contagens e usa 0 quando falta alguma', () => {
    expect(montarResumo(['g1', 'g2'], { g1: 5 }, { g1: 2, g2: 1 })).toEqual({
      g1: { clientes: 5, usuarios: 2 },
      g2: { clientes: 0, usuarios: 1 },
    })
  })
})
