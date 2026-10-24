import { useEffect, useState } from 'react'
import { agoraEmFortaleza, dataLocalISO } from '@/utils/data'

/**
 * Devolve a data/hora de "agora" em Fortaleza (ver `agoraEmFortaleza`), atualizada quando o dia muda
 * (checa a cada minuto e quando a aba volta a ficar visível).
 * A referência só muda na virada do dia, então é segura como dependência.
 */
export function useHoje(): Date {
  const [hoje, setHoje] = useState(() => agoraEmFortaleza())

  useEffect(() => {
    const atualizar = () => {
      const agora = agoraEmFortaleza()
      setHoje((atual) => (dataLocalISO(atual) === dataLocalISO(agora) ? atual : agora))
    }

    const intervalo = window.setInterval(atualizar, 60_000)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [])

  return hoje
}
