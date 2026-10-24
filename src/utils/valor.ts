import type { ItemGuardado, PrecoGalpao, TipoItem } from '@/types'

export function precoEfetivo(
  tipoId: string | null,
  precos: PrecoGalpao[],
  tipos: TipoItem[],
): number {
  if (!tipoId) return 0
  const override = precos.find((p) => p.tipo_item_id === tipoId)
  if (override) return Number(override.preco_semanal)
  const tipo = tipos.find((t) => t.id === tipoId)
  return tipo ? Number(tipo.preco_semanal) : 0
}

export function valorSemanal(
  clienteId: string,
  itens: ItemGuardado[],
  precos: PrecoGalpao[],
  tipos: TipoItem[],
): number {
  return itens
    .filter((i) => i.cliente_id === clienteId && i.ativo)
    .reduce((acc, i) => acc + precoEfetivo(i.tipo_item_id, precos, tipos) * i.quantidade, 0)
}

/**
 * Converte texto digitado em reais para número.
 * Aceita "10", "10,5", "10.50", "1.234,56" e "R$ 1.234,56". Retorna null se inválido.
 */
export function parseValorBR(raw: string): number | null {
  let texto = raw.replace(/R\$/gi, '').replace(/\s/g, '')
  if (!texto) return null

  if (texto.includes(',')) {
    texto = texto.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(texto)) {
    texto = texto.replace(/\./g, '')
  }

  if (!/^\d+(\.\d{1,2})?$/.test(texto)) return null
  const valor = Number(texto)
  return Number.isFinite(valor) ? valor : null
}

/** Número -> texto no formato brasileiro para campos de edição (ex.: 12,5 -> "12,50"). */
export function formatarValorInput(valor: number): string {
  return valor.toFixed(2).replace('.', ',')
}

export interface ValorExibido {
  /** Valor mostrado na linha do cliente */
  valor: number
  /** O valor é o que já foi pago na cobrança atual */
  pago: boolean
  /** Preço atual dos itens, quando é diferente do que foi pago (valerá nas próximas cobranças) */
  proximas: number | null
}

/**
 * Cobrança atual já paga: mostra o que foi pago de verdade (mudar os itens depois não altera isso)
 * e, se o preço mudou, o valor que vale daqui para frente. Não paga: mostra o preço atual.
 */
export function valorExibido(precoAtual: number, pagoNaCobrancaAtual: number | null): ValorExibido {
  if (pagoNaCobrancaAtual === null) return { valor: precoAtual, pago: false, proximas: null }
  const mudou = Math.abs(precoAtual - pagoNaCobrancaAtual) >= 0.005
  return { valor: pagoNaCobrancaAtual, pago: true, proximas: mudou ? precoAtual : null }
}
