import type { ReactNode } from 'react'
import { useGalpao } from '@/context/GalpaoContext'
import { useGalpaoDados } from '@/context/GalpaoDadosContext'
import { PageLoader } from '@/components/ui/PageLoader'
import { ErroCarregamento } from '@/components/shared/ErroCarregamento'
import { SemGalpao } from '@/components/shared/SemGalpao'

/**
 * Devolve o que a página deve mostrar no lugar do conteúdo enquanto carrega,
 * quando não há galpão ou quando a busca falhou. Devolve null quando está tudo pronto.
 */
export function useGuardaPagina(): ReactNode | null {
  const galpao = useGalpao()
  const dados = useGalpaoDados()

  if (galpao.erro && galpao.galpoes.length === 0) {
    return <ErroCarregamento mensagem={galpao.erro} onRetry={() => void galpao.recarregar()} />
  }
  if (dados.loading) return <PageLoader />
  if (!galpao.galpaoSelecionado) return <SemGalpao />
  if (dados.erro) {
    return <ErroCarregamento mensagem={dados.erro} onRetry={() => void dados.recarregar()} />
  }
  return null
}
