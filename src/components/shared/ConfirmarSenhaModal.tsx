import { useState, type FormEvent, type ReactNode } from 'react'
import { Eye, EyeOff, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

interface ConfirmarSenhaModalProps {
  open: boolean
  titulo: string
  /** Explica o que vai acontecer (aparece acima dos campos) */
  descricao: ReactNode
  textoBotao: string
  /** Botão vermelho para ações destrutivas */
  perigo?: boolean
  /** Campos extras do formulário (ex.: motivo) que ficam acima da senha */
  children?: ReactNode
  /** Quando false, o botão fica desativado (ex.: motivo ainda não preenchido) */
  podeConfirmar?: boolean
  /**
   * Executada depois que a senha for confirmada. Devolva null se deu certo ou
   * a mensagem de erro para continuar na tela.
   */
  onConfirmar: () => Promise<string | null>
  onClose: () => void
}

type ConteudoProps = Omit<ConfirmarSenhaModalProps, 'open'>

/** Montado só enquanto o modal está aberto: a senha digitada nunca fica guardada entre aberturas. */
function Conteudo({
  titulo,
  descricao,
  textoBotao,
  perigo = false,
  children,
  podeConfirmar = true,
  onConfirmar,
  onClose,
}: ConteudoProps) {
  const { confirmarSenha } = useAuth()
  const [senha, setSenha] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (enviando || !senha || !podeConfirmar) return
    setErro(null)
    setEnviando(true)

    const { error } = await confirmarSenha(senha)
    if (error) {
      setEnviando(false)
      setSenha('')
      setErro(error)
      return
    }

    const falha = await onConfirmar()
    setEnviando(false)
    if (falha) {
      setErro(falha)
      return
    }
    onClose()
  }

  return (
    <Modal
      open
      size="sm"
      title={titulo}
      onClose={() => !enviando && onClose()}
      closeOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={enviando}>
            Voltar
          </Button>
          <Button
            type="submit"
            form="confirmar-senha-form"
            variant={perigo ? 'danger' : 'primary'}
            loading={enviando}
            disabled={!senha || !podeConfirmar}
          >
            {textoBotao}
          </Button>
        </div>
      }
    >
      <form id="confirmar-senha-form" onSubmit={enviar} className="flex flex-col gap-4 pb-6">
        <div className="text-sm text-slate-600 dark:text-slate-300">{descricao}</div>

        {children}

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
            <ShieldAlert size={14} />
            Confirme com a sua senha
          </p>
          <Input
            label="Senha"
            type={mostrar ? 'text' : 'password'}
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value)
              setErro(null)
            }}
            autoComplete="current-password"
            placeholder="Sua senha de acesso"
            error={erro ?? undefined}
            endAdornment={
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
                className="inline-flex items-center justify-center rounded border-none bg-transparent p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                {mostrar ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
        </div>
      </form>
    </Modal>
  )
}

/**
 * Pede a senha de quem está logado antes de uma ação sensível (ex.: cancelar um pagamento).
 * O servidor confere de novo se a senha foi digitada há pouco, então não dá para pular esta etapa.
 */
export function ConfirmarSenhaModal({ open, ...props }: ConfirmarSenhaModalProps) {
  if (!open) return null
  return <Conteudo {...props} />
}
