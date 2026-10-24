import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { calcularPosicaoTooltip, type PosicaoTooltip } from '@/components/ui/tooltipPosicao'

interface TooltipProps {
  /** Texto curto do balão */
  texto: string
  children: ReactNode
  /** Espera (ms) antes de aparecer com o mouse, para não piscar ao passar por cima */
  atraso?: number
}

/**
 * Dica de ferramenta do sistema (substitui o `title` do navegador).
 * Aparece com o mouse (após um instante) e com o foco do teclado; some ao sair, clicar, rolar ou apertar Esc.
 * É desenhada fora da tabela/modal (portal), então nunca é cortada por `overflow`.
 */
export function Tooltip({ texto, children, atraso = 350 }: TooltipProps) {
  const id = useId()
  const alvo = useRef<HTMLSpanElement | null>(null)
  const balao = useRef<HTMLDivElement | null>(null)
  const timer = useRef<number | null>(null)
  const [visivel, setVisivel] = useState(false)
  const [posicao, setPosicao] = useState<PosicaoTooltip | null>(null)

  const cancelar = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  const esconder = useCallback(() => {
    cancelar()
    setVisivel(false)
    setPosicao(null)
  }, [])

  const mostrarComAtraso = () => {
    cancelar()
    timer.current = window.setTimeout(() => setVisivel(true), atraso)
  }

  // Mede o balão já na tela (ainda invisível) e só então o posiciona: sem "pulo" visual.
  useLayoutEffect(() => {
    if (!visivel || !alvo.current || !balao.current) return
    const r = alvo.current.getBoundingClientRect()
    const b = balao.current.getBoundingClientRect()
    setPosicao(
      calcularPosicaoTooltip(
        { top: r.top, bottom: r.bottom, left: r.left, width: r.width },
        { width: b.width, height: b.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    )
  }, [visivel, texto])

  useEffect(() => {
    if (!visivel) return
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') esconder()
    }
    document.addEventListener('keydown', aoTecla)
    window.addEventListener('scroll', esconder, true)
    window.addEventListener('resize', esconder)
    return () => {
      document.removeEventListener('keydown', aoTecla)
      window.removeEventListener('scroll', esconder, true)
      window.removeEventListener('resize', esconder)
    }
  }, [visivel, esconder])

  useEffect(() => cancelar, [])

  return (
    <span
      ref={alvo}
      className="inline-flex"
      onMouseEnter={mostrarComAtraso}
      onMouseLeave={esconder}
      onMouseDown={esconder}
      onFocus={(e) => {
        // só com teclado: clicar com o mouse também dá foco, e aí o balão atrapalharia
        if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) setVisivel(true)
      }}
      onBlur={esconder}
    >
      {children}
      {visivel &&
        createPortal(
          <div
            ref={balao}
            id={id}
            role="tooltip"
            style={
              posicao
                ? { top: posicao.top, left: posicao.left }
                : { top: 0, left: 0, visibility: 'hidden' }
            }
            className="animate-tooltip pointer-events-none fixed z-[10000] w-max max-w-[16rem] rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
          >
            {texto}
            {posicao && (
              <span
                aria-hidden="true"
                style={{ left: posicao.setaEsquerda }}
                className={cn(
                  'absolute h-2 w-2 -translate-x-1/2 rotate-45 rounded-[2px] bg-slate-900 dark:bg-slate-100',
                  posicao.lado === 'acima' ? '-bottom-1' : '-top-1',
                )}
              />
            )}
          </div>,
          document.body,
        )}
    </span>
  )
}
