import type { ItemGuardado } from '@/types'

/** Campos do formulário "Adicionar item" (texto, como digitado). */
export interface RascunhoItem {
  tipoId: string
  identificacao: string
  quantidade: string
}

export const RASCUNHO_VAZIO: RascunhoItem = { tipoId: '', identificacao: '', quantidade: '1' }

/** Item incluído na tela que só será gravado no banco quando o cliente for salvo. */
export interface ItemNovo {
  chave: string
  tipo_item_id: string
  identificacao: string | null
  quantidade: number
}

export type ResultadoRascunho = { ok: true; item: Omit<ItemNovo, 'chave'> } | { ok: false; erro: string }

/** O formulário tem algo que a pessoa escolheu ou digitou (tipo ou identificação)? */
export function rascunhoPreenchido(r: RascunhoItem): boolean {
  return r.tipoId !== '' || r.identificacao.trim() !== ''
}

/** Valida o formulário e devolve o item pronto ou a mensagem de erro. */
export function validarRascunho(r: RascunhoItem): ResultadoRascunho {
  if (!r.tipoId) return { ok: false, erro: 'Escolha o tipo do item.' }
  const quantidade = Number(r.quantidade)
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    return { ok: false, erro: 'Quantidade inválida: use um número inteiro a partir de 1.' }
  }
  return {
    ok: true,
    item: {
      tipo_item_id: r.tipoId,
      identificacao: r.identificacao.trim() || null,
      quantidade,
    },
  }
}

export function novaChave(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Texto curto para o aviso depois de salvar: "2 itens adicionados e 1 removido". */
export function resumoAlteracoes(adicionados: number, removidos: number): string {
  const partes: string[] = []
  if (adicionados > 0) {
    partes.push(`${adicionados} ${adicionados === 1 ? 'item adicionado' : 'itens adicionados'}`)
  }
  if (removidos > 0) {
    partes.push(`${removidos} ${removidos === 1 ? 'item removido' : 'itens removidos'}`)
  }
  return partes.join(' e ')
}

/** Dois itens são "o mesmo" quando têm o mesmo tipo e a mesma identificação (sem diferenciar maiúsculas). */
export function chaveDoItem(tipoId: string | null, identificacao: string | null): string {
  return `${tipoId ?? ''}|${(identificacao ?? '').trim().toLowerCase()}`
}

export interface EstadoItens {
  /** Itens incluídos agora, ainda não gravados */
  novos: ItemNovo[]
  /** Mudança de quantidade em itens já gravados (id -> diferença; negativa = diminuiu) */
  ajustes: Record<string, number>
}

function semChave<T>(objeto: Record<string, T>, chave: string): Record<string, T> {
  return Object.fromEntries(Object.entries(objeto).filter(([k]) => k !== chave))
}

/**
 * Inclui um item na lista sem duplicar: se já existe um igual (gravado ou novo), só soma a quantidade.
 * Um item gravado que está marcado para remoção não conta como existente.
 */
export function incluirItem(
  estado: EstadoItens,
  item: ItemNovo,
  salvos: ItemGuardado[],
  removidos: string[],
): EstadoItens {
  const chave = chaveDoItem(item.tipo_item_id, item.identificacao)

  const salvo = salvos.find(
    (s) =>
      s.ativo && !removidos.includes(s.id) && chaveDoItem(s.tipo_item_id, s.identificacao) === chave,
  )
  if (salvo) {
    const diferenca = (estado.ajustes[salvo.id] ?? 0) + item.quantidade
    return {
      novos: estado.novos,
      ajustes:
        diferenca === 0
          ? semChave(estado.ajustes, salvo.id)
          : { ...estado.ajustes, [salvo.id]: diferenca },
    }
  }

  const indice = estado.novos.findIndex(
    (n) => chaveDoItem(n.tipo_item_id, n.identificacao) === chave,
  )
  if (indice >= 0) {
    return {
      novos: estado.novos.map((n, i) =>
        i === indice ? { ...n, quantidade: n.quantidade + item.quantidade } : n,
      ),
      ajustes: estado.ajustes,
    }
  }

  return { novos: [...estado.novos, item], ajustes: estado.ajustes }
}

/** Quantidade que um item gravado terá depois de salvar (a gravada mais o ajuste feito na tela). */
export function quantidadeFinal(item: ItemGuardado, ajustes: Record<string, number>): number {
  return item.quantidade + (ajustes[item.id] ?? 0)
}

/**
 * Soma `passo` (+1 ou -1) à quantidade de um item gravado. Chegando a zero, o item é marcado
 * para remoção; voltando à quantidade original, o ajuste some.
 */
export function ajustarQuantidadeSalvo(
  ajustes: Record<string, number>,
  removidos: string[],
  item: ItemGuardado,
  passo: number,
): { ajustes: Record<string, number>; removidos: string[] } {
  const total = quantidadeFinal(item, ajustes) + passo
  const resto = semChave(ajustes, item.id)

  if (total <= 0) {
    return {
      ajustes: resto,
      removidos: removidos.includes(item.id) ? removidos : [...removidos, item.id],
    }
  }
  const diferenca = total - item.quantidade
  return { ajustes: diferenca === 0 ? resto : { ...resto, [item.id]: diferenca }, removidos }
}

/** Soma `passo` à quantidade de um item novo (mínimo 1: para tirar o item use a lixeira). */
export function ajustarQuantidadeNovo(novos: ItemNovo[], chave: string, passo: number): ItemNovo[] {
  return novos.map((n) =>
    n.chave === chave ? { ...n, quantidade: Math.max(1, n.quantidade + passo) } : n,
  )
}
