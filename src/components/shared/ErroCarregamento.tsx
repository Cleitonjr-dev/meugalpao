import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ErroCarregamentoProps {
  mensagem: string
  onRetry: () => void
}

export function ErroCarregamento({ mensagem, onRetry }: ErroCarregamentoProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <AlertTriangle size={32} className="text-amber-500" />
      <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">{mensagem}</p>
      <Button variant="secondary" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  )
}
