import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { normalizarCodigo } from '@/utils/codigo'
import { ResultadoVerificacao } from './ResultadoVerificacao'

interface VerificarReciboModalProps {
  /** Código do recibo a verificar; null mantém o modal fechado */
  codigo: string | null
  onClose: () => void
}

/** Mostra o mesmo resultado da página pública /verificar, sem sair da tela. */
export function VerificarReciboModal({ codigo, onClose }: VerificarReciboModalProps) {
  return (
    <Modal open={codigo !== null} title="Verificar autenticidade" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Resultado da consulta do código, igual ao que qualquer pessoa vê na página de verificação.
        </p>
        <ResultadoVerificacao codigo={codigo ? normalizarCodigo(codigo) : null} />
        <Button variant="text" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Modal>
  )
}
