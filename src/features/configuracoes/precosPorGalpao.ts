import { parseValorBR } from '@/utils/valor'

export interface PrecoExistente {
  id: string
  galpao_id: string
  preco_semanal: number
}

/** O que a pessoa digitou no campo de um galpão (texto vazio = usar o preço padrão). */
export interface PrecoDigitado {
  galpaoId: string
  galpaoNome: string
  texto: string
}

export type PlanoPrecos =
  | {
      ok: true
      inserir: { galpao_id: string; preco_semanal: number }[]
      atualizar: { id: string; preco_semanal: number }[]
      apagar: string[]
    }
  | { ok: false; erro: string }

/**
 * Compara os preços próprios gravados com os campos do modal e diz o que gravar:
 * - campo vazio e havia preço próprio  -> apagar (volta ao padrão)
 * - campo preenchido e não havia       -> inserir
 * - campo preenchido com valor diferente -> atualizar
 * - o resto não precisa de nenhuma gravação.
 * Se algum valor for inválido, devolve o erro (e nada deve ser gravado).
 */
export function planejarPrecos(existentes: PrecoExistente[], digitados: PrecoDigitado[]): PlanoPrecos {
  const inserir: { galpao_id: string; preco_semanal: number }[] = []
  const atualizar: { id: string; preco_semanal: number }[] = []
  const apagar: string[] = []

  for (const d of digitados) {
    const existente = existentes.find((e) => e.galpao_id === d.galpaoId)
    const texto = d.texto.trim()

    if (texto === '') {
      if (existente) apagar.push(existente.id)
      continue
    }

    const valor = parseValorBR(texto)
    if (valor === null) {
      return { ok: false, erro: `Preço inválido em ${d.galpaoNome}. Use um valor como 25,00.` }
    }

    if (!existente) {
      inserir.push({ galpao_id: d.galpaoId, preco_semanal: valor })
    } else if (Math.abs(Number(existente.preco_semanal) - valor) >= 0.005) {
      atualizar.push({ id: existente.id, preco_semanal: valor })
    }
  }

  return { ok: true, inserir, atualizar, apagar }
}
