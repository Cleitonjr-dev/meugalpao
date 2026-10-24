export interface ResumoGalpao {
  clientes: number
  usuarios: number
}

interface Membro {
  galpao_id: string
  profile_id: string
}

/**
 * Quantas pessoas têm acesso a cada galpão: quem foi liberado para ele mais os super usuários
 * (que enxergam todos os galpões). Cada pessoa conta uma vez por galpão.
 */
export function usuariosPorGalpao(
  galpaoIds: string[],
  membros: Membro[],
  superUsuarios: string[],
): Record<string, number> {
  const resultado: Record<string, number> = {}
  for (const id of galpaoIds) {
    const pessoas = new Set<string>(superUsuarios)
    for (const m of membros) {
      if (m.galpao_id === id) pessoas.add(m.profile_id)
    }
    resultado[id] = pessoas.size
  }
  return resultado
}

export function montarResumo(
  galpaoIds: string[],
  clientes: Record<string, number>,
  usuarios: Record<string, number>,
): Record<string, ResumoGalpao> {
  return Object.fromEntries(
    galpaoIds.map((id) => [id, { clientes: clientes[id] ?? 0, usuarios: usuarios[id] ?? 0 }]),
  )
}
