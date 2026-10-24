import { useRef, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { resultadoAtual } from '@/utils/codigo'

interface CampoCodigoProps {
  valor: string
  onChange: (valor: string) => void
  /** Código (já normalizado) cujo resultado está na tela, ou null */
  consultado: string | null
  onVerificar: () => void
  /** Limpa o resultado e o campo para consultar outro recibo */
  onNova: () => void
}

/**
 * Campo do código + botão que muda conforme o estado:
 * "Verificar" antes de consultar (ou depois de editar) e "Verificar outro código" com o resultado na tela.
 */
export function CampoCodigo({ valor, onChange, consultado, onVerificar, onNova }: CampoCodigoProps) {
  const campo = useRef<HTMLInputElement | null>(null)
  const comResultado = resultadoAtual(valor, consultado) !== null

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (comResultado) {
      onNova()
      campo.current?.focus()
    } else {
      onVerificar()
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <Input
        ref={campo}
        label="Código de autenticação"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="A3F9-27C1-5DE0-B481"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className="font-mono"
      />
      <Button type="submit" variant={comResultado ? 'secondary' : 'primary'}>
        {comResultado ? 'Verificar outro código' : 'Verificar'}
      </Button>
    </form>
  )
}
