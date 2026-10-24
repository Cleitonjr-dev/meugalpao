import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { mensagemRecibo, whatsappLink } from '@/utils/recibo'
import { baixarReciboPdf } from '@/utils/reciboPdf'
import { useToast } from '@/components/ui/Toast'
import { ReciboConteudo } from './ReciboConteudo'
import type { DadosRecibo } from './recibo'

interface ReceiptModalProps {
  /** Recibo a exibir; null mantém o modal fechado. */
  dados: DadosRecibo | null
  onClose: () => void
  somenteWhatsApp?: boolean
}

export function ReceiptModal({ dados, onClose, somenteWhatsApp = false }: ReceiptModalProps) {
  const toast = useToast()

  if (!dados) return null

  const mensagem = mensagemRecibo({
    galpao: dados.galpaoNome,
    numero: dados.numero,
    cliente: dados.clienteNome,
    valor: dados.valor,
    data: dados.data,
    forma: dados.forma,
    referente: dados.referente,
    itens: dados.itens,
    codigo: dados.codigo,
  })
  const link = dados.clienteWhatsapp ? whatsappLink(dados.clienteWhatsapp, mensagem) : null

  const handleBaixar = () => {
    baixarReciboPdf(dados).catch(() => toast.error('Não foi possível gerar o PDF.'))
  }

  return (
    <Modal open title="Recibo" onClose={onClose}>
      <ReciboConteudo dados={dados} />

      <div className="mt-4 flex flex-col gap-2">
        {!somenteWhatsApp && (
          <div className="flex gap-2">
            <Button onClick={() => window.print()} className="flex-1">
              Imprimir
            </Button>
            <Button variant="secondary" onClick={handleBaixar} className="flex-1">
              Baixar PDF
            </Button>
          </div>
        )}
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center rounded border border-slate-200 bg-white p-3 font-medium text-slate-900 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Enviar WhatsApp
          </a>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {dados.clienteWhatsapp
              ? 'O WhatsApp cadastrado não parece válido (use DDD + número).'
              : 'Cliente sem WhatsApp cadastrado.'}
          </p>
        )}
        <Button variant="text" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Modal>
  )
}
