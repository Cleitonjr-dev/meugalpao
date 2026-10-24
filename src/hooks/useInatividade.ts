import { useEffect, useRef } from 'react'

const EVENTOS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const
/** De quanto em quanto tempo conferimos se a pessoa sumiu (e ao voltar para a aba). */
const CONFERIR_A_CADA_MS = 15_000

/**
 * Chama `aoExpirar` quando passam `minutos` sem nenhuma atividade (toque, clique, tecla ou rolagem).
 * Serve para encerrar a sessão de computadores e celulares compartilhados.
 */
export function useInatividade(minutos: number, aoExpirar: () => void): void {
  const aoExpirarRef = useRef(aoExpirar)
  useEffect(() => {
    aoExpirarRef.current = aoExpirar
  })

  useEffect(() => {
    const limiteMs = minutos * 60_000
    let ultimaAtividade = Date.now()
    let expirou = false

    const registrar = () => {
      ultimaAtividade = Date.now()
    }
    const conferir = () => {
      if (expirou) return
      if (Date.now() - ultimaAtividade >= limiteMs) {
        expirou = true
        aoExpirarRef.current()
      }
    }

    for (const evento of EVENTOS) window.addEventListener(evento, registrar, { passive: true })
    document.addEventListener('visibilitychange', conferir)
    const intervalo = window.setInterval(conferir, CONFERIR_A_CADA_MS)
    return () => {
      for (const evento of EVENTOS) window.removeEventListener(evento, registrar)
      document.removeEventListener('visibilitychange', conferir)
      window.clearInterval(intervalo)
    }
  }, [minutos])
}
