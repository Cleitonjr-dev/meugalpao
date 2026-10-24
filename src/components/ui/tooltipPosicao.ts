export interface Retangulo {
  top: number
  bottom: number
  left: number
  width: number
}

export interface Tamanho {
  width: number
  height: number
}

export interface PosicaoTooltip {
  top: number
  left: number
  /** "acima": a seta fica embaixo do balão; "abaixo": a seta fica em cima */
  lado: 'acima' | 'abaixo'
  /** Distância da seta até a borda esquerda do balão */
  setaEsquerda: number
}

const DISTANCIA = 8
const MARGEM_TELA = 8
const MARGEM_SETA = 12

/**
 * Calcula onde desenhar o balão: centralizado no elemento, acima dele; se não couber em cima,
 * vai para baixo; nas laterais nunca passa da borda da tela (a seta continua apontando para o elemento).
 */
export function calcularPosicaoTooltip(
  alvo: Retangulo,
  balao: Tamanho,
  tela: Tamanho,
): PosicaoTooltip {
  const cabeEmCima = alvo.top - balao.height - DISTANCIA >= MARGEM_TELA
  const lado = cabeEmCima ? 'acima' : 'abaixo'
  const top = cabeEmCima ? alvo.top - balao.height - DISTANCIA : alvo.bottom + DISTANCIA

  const centro = alvo.left + alvo.width / 2
  const maxEsquerda = Math.max(MARGEM_TELA, tela.width - balao.width - MARGEM_TELA)
  const left = Math.min(Math.max(centro - balao.width / 2, MARGEM_TELA), maxEsquerda)

  const setaEsquerda = Math.min(
    Math.max(centro - left, MARGEM_SETA),
    Math.max(MARGEM_SETA, balao.width - MARGEM_SETA),
  )

  return { top, left, lado, setaEsquerda }
}
