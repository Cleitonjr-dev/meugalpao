import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { limparCodigo, normalizarCodigo, resultadoAtual } from '@/utils/codigo'
import { CampoCodigo } from './CampoCodigo'
import { ResultadoVerificacao } from './ResultadoVerificacao'

interface VerificarCodigoModalProps {
  open: boolean
  onClose: () => void
}

/** Montado só enquanto o modal está aberto: cada abertura começa com o campo vazio. */
function Conteudo({ onClose }: { onClose: () => void }) {
  const [digitado, setDigitado] = useState('')
  const [consultado, setConsultado] = useState<string | null>(null)
  const [incompleto, setIncompleto] = useState(false)

  const verificar = () => {
    const codigo = normalizarCodigo(digitado)
    setConsultado(codigo)
    setIncompleto(limparCodigo(digitado).length > 0 && codigo === null)
  }

  const nova = () => {
    setDigitado('')
    setConsultado(null)
    setIncompleto(false)
  }

  // Editar o código depois de um resultado esconde o resultado antigo.
  const codigoNaTela = resultadoAtual(digitado, consultado)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Digite o código de autenticação impresso no recibo para confirmar se ele é verdadeiro.
      </p>

      <CampoCodigo
        valor={digitado}
        onChange={(valor) => {
          setDigitado(valor)
          setIncompleto(false)
        }}
        consultado={consultado}
        onVerificar={verificar}
        onNova={nova}
      />

      <ResultadoVerificacao codigo={codigoNaTela} incompleto={incompleto} />

      {/* Antes de consultar basta o X do modal (ou Esc); "Fechar" aparece junto do resultado. */}
      {codigoNaTela !== null && (
        <Button variant="text" onClick={onClose}>
          Fechar
        </Button>
      )}
    </div>
  )
}

/** Verificação digitando o código, sem sair da tela (mesmo resultado da página /verificar). */
export function VerificarCodigoModal({ open, onClose }: VerificarCodigoModalProps) {
  return (
    <Modal open={open} title="Verificar código" onClose={onClose} size="sm">
      <Conteudo onClose={onClose} />
    </Modal>
  )
}
