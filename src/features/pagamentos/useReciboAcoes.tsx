import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { FileDown, MessageCircle, Printer } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { TableAction } from '@/components/ui/Table'
import { baixarReciboPdf } from '@/utils/reciboPdf'
import { ReceiptModal } from './ReceiptModal'
import { ReciboConteudo } from './ReciboConteudo'
import type { DadosRecibo } from './recibo'

interface UseReciboAcoes {
  /** Ações (imprimir, PDF, WhatsApp) para uma Table cujas linhas viram um DadosRecibo. */
  criarAcoes: <T>(resolver: (linha: T) => DadosRecibo | null) => TableAction<T>[]
  /** Elementos auxiliares (área de impressão e modal) que a página precisa renderizar. */
  overlay: ReactNode
}

/** Compartilha as ações de recibo entre as páginas de Pagamentos e Recibos. */
export function useReciboAcoes(): UseReciboAcoes {
  const toast = useToast()
  const [impressao, setImpressao] = useState<DadosRecibo | null>(null)
  const [whatsapp, setWhatsapp] = useState<DadosRecibo | null>(null)

  useEffect(() => {
    if (!impressao) return
    // espera a área de impressão ser pintada antes de abrir o diálogo
    const frame = window.requestAnimationFrame(() => {
      window.print()
      setImpressao(null)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [impressao])

  const criarAcoes = useCallback(
    <T,>(resolver: (linha: T) => DadosRecibo | null): TableAction<T>[] => [
      {
        icon: Printer,
        label: 'Imprimir',
        onClick: (linha) => {
          const dados = resolver(linha)
          if (dados) setImpressao(dados)
        },
      },
      {
        icon: FileDown,
        label: 'Baixar PDF',
        onClick: (linha) => {
          const dados = resolver(linha)
          if (dados) {
            baixarReciboPdf(dados).catch(() => toast.error('Não foi possível gerar o PDF.'))
          }
        },
      },
      {
        icon: MessageCircle,
        label: 'Enviar WhatsApp',
        variant: 'info',
        onClick: (linha) => {
          const dados = resolver(linha)
          if (dados) setWhatsapp(dados)
        },
      },
    ],
    [toast],
  )

  const overlay = (
    <>
      {impressao && (
        <ReciboConteudo dados={impressao} className="invisible fixed left-0 top-0 z-50" />
      )}
      <ReceiptModal dados={whatsapp} onClose={() => setWhatsapp(null)} somenteWhatsApp />
    </>
  )

  return { criarAcoes, overlay }
}
