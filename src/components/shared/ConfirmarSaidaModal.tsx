import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface ConfirmarSaidaModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmarSaidaModal({ open, onClose, onConfirm }: ConfirmarSaidaModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Atenção">
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
          <AlertTriangle size={22} />
        </span>
        <p className="text-sm text-slate-700 dark:text-slate-200">
          Tem certeza que deseja sair do sistema? Sua sessão será encerrada.
        </p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="text" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Sair
        </Button>
      </div>
    </Modal>
  )
}
