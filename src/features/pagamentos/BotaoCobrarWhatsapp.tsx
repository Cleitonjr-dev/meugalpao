import { MessageCircle } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'
import { mensagemCobranca } from '@/utils/cobranca'
import { whatsappLink } from '@/utils/recibo'
import type { Cliente } from '@/types'

const CLASSE =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'

interface Props {
  cliente: Cliente
  galpao: string
  /** Datas ISO das cobranças em aberto */
  semanas: string[]
  /** Valor semanal atual do cliente */
  valorSemanal: number
  /** Há cobranças ainda mais antigas que as listadas */
  truncada?: boolean
}

/** Abre o WhatsApp do cliente com a mensagem de cobrança pronta. */
export function BotaoCobrarWhatsapp({ cliente, galpao, semanas, valorSemanal, truncada = false }: Props) {
  const mensagem = mensagemCobranca({
    nomeCliente: cliente.nome,
    galpao,
    semanas,
    valorTotal: valorSemanal * semanas.length,
    truncada,
  })
  const link = whatsappLink(cliente.whatsapp ?? cliente.telefone ?? '', mensagem)

  if (!link) {
    return (
      <Tooltip texto="Cliente sem WhatsApp válido">
        <button
          type="button"
          disabled
          aria-label="Cobrar pelo WhatsApp (cliente sem WhatsApp válido)"
          className={`${CLASSE} cursor-not-allowed opacity-50`}
        >
          <MessageCircle size={18} />
        </button>
      </Tooltip>
    )
  }

  return (
    <Tooltip texto="Cobrar pelo WhatsApp">
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        aria-label="Cobrar pelo WhatsApp"
        className={CLASSE}
      >
        <MessageCircle size={18} />
      </a>
    </Tooltip>
  )
}
