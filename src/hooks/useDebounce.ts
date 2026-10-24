import { useEffect, useState } from 'react'

/** Devolve o valor só depois que ele parar de mudar por `atrasoMs` (ex.: busca enquanto digita). */
export function useDebounce<T>(valor: T, atrasoMs = 300): T {
  const [atrasado, setAtrasado] = useState(valor)

  useEffect(() => {
    const timer = window.setTimeout(() => setAtrasado(valor), atrasoMs)
    return () => window.clearTimeout(timer)
  }, [valor, atrasoMs])

  return atrasado
}
