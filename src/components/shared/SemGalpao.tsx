import { useGalpao } from '@/context/GalpaoContext'
import { EmptyState } from '@/components/ui/EmptyState'

export function SemGalpao() {
  const { galpoes } = useGalpao()

  if (galpoes.length === 0) {
    return (
      <EmptyState
        title="Nenhum galpão disponível"
        description="Você ainda não tem acesso a nenhum galpão. Peça ao administrador para liberar seu acesso."
      />
    )
  }

  return <EmptyState title="Selecione um galpão" description="Escolha um galpão para começar." />
}
