export interface RetanguloCampo {
  top: number
  bottom: number
  left: number
  width: number
}

export interface TelaTamanho {
  width: number
  height: number
}

export interface PosicaoLista {
  left: number
  width: number
  /** Definido quando a lista abre para baixo */
  top?: number
  /** Definido quando a lista abre para cima (distância até a borda inferior da tela) */
  bottom?: number
  maxHeight: number
}

const GAP = 4
const MARGEM_TELA = 8
const ALTURA_MINIMA = 120

/**
 * Posição da lista de opções de um Select, desenhada fixa na tela (fora do modal/tabela):
 * abre para baixo e, se faltar espaço e houver mais em cima, abre para cima.
 * A altura máxima nunca ultrapassa o espaço disponível, então a lista não gera rolagem na página.
 */
export function calcularPosicaoLista(
  campo: RetanguloCampo,
  tela: TelaTamanho,
  alturaMaxima = 260,
): PosicaoLista {
  const espacoAbaixo = tela.height - campo.bottom - MARGEM_TELA - GAP
  const espacoAcima = campo.top - MARGEM_TELA - GAP
  const abrirAcima = espacoAbaixo < Math.min(alturaMaxima, 180) && espacoAcima > espacoAbaixo
  const espaco = abrirAcima ? espacoAcima : espacoAbaixo

  const largura = Math.min(campo.width, tela.width - MARGEM_TELA * 2)
  const left = Math.min(Math.max(campo.left, MARGEM_TELA), tela.width - largura - MARGEM_TELA)
  const maxHeight = Math.max(ALTURA_MINIMA, Math.min(alturaMaxima, espaco))

  return abrirAcima
    ? { left, width: largura, bottom: tela.height - campo.top + GAP, maxHeight }
    : { left, width: largura, top: campo.bottom + GAP, maxHeight }
}
