import type { jsPDF } from 'jspdf'
import { APP_NAME } from '@/config/constants'
import { formatarNumeroRecibo } from '@/utils/recibo'
import { formatarCodigo } from '@/utils/codigo'
import type { DadosRecibo } from '@/features/pagamentos/recibo'

const LARGURA = 80
const MARGEM = 8
const LARGURA_TEXTO = LARGURA - MARGEM * 2

/** Fontes padrão do PDF só suportam Latin-1: troca o resto por "?" em vez de corromper o texto. */
function limpar(texto: string): string {
  return texto.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?')
}

/** Desenha o recibo e devolve a posição vertical final (usado para medir a altura da página). */
function desenhar(doc: jsPDF, dados: DadosRecibo): number {
  const cx = LARGURA / 2
  let y = 12

  const linhas = (texto: string): string[] => doc.splitTextToSize(limpar(texto), LARGURA_TEXTO)
  const bloco = (texto: string, passo = 5) => {
    for (const linha of linhas(texto)) {
      doc.text(linha, MARGEM, y)
      y += passo
    }
  }
  const separador = () => {
    doc.setDrawColor(0)
    doc.setLineWidth(0.2)
    doc.line(5, y - 3, LARGURA - 5, y - 3)
    y += 3
  }

  doc.setFont('courier', 'normal')
  doc.setFontSize(12)
  doc.text(APP_NAME, cx, y, { align: 'center' })
  y += 5
  doc.setFontSize(9)
  for (const linha of linhas(dados.galpaoNome)) {
    doc.text(linha, cx, y, { align: 'center' })
    y += 5
  }
  doc.text(`RECIBO Nº ${formatarNumeroRecibo(dados.numero)}`, cx, y + 1, { align: 'center' })
  y += 7
  if (dados.cancelado) {
    doc.text('*** CANCELADO ***', cx, y, { align: 'center' })
    y += 5
  }

  y += 3
  separador()

  bloco(`Data: ${dados.data}`)
  bloco(`Cobrança de: ${dados.referente}`)
  bloco(`Cliente: ${dados.clienteNome}`)

  y += 3
  separador()

  bloco('Recebemos o valor de:')
  doc.setFontSize(14)
  doc.text(limpar(dados.valor), MARGEM, y + 1)
  y += 8
  doc.setFontSize(9)
  if (dados.itens) bloco(`Referente a: ${dados.itens}`)
  bloco(`Forma de pagamento: ${dados.forma}`)
  if (dados.observacoes) bloco(`Obs: ${dados.observacoes}`)

  y += 3
  separador()
  y += 4
  if (dados.codigo) {
    doc.text('Autenticação:', cx, y, { align: 'center' })
    y += 5
    doc.setFontSize(10)
    doc.setFont('courier', 'bold')
    doc.text(formatarCodigo(dados.codigo), cx, y, { align: 'center' })
    doc.setFont('courier', 'normal')
    doc.setFontSize(7)
    y += 4
    for (const linha of linhas('Confirme a validade deste recibo informando o código no sistema.')) {
      doc.text(linha, cx, y, { align: 'center' })
      y += 3
    }
    doc.setFontSize(9)
  } else {
    doc.text('Assinatura: ____________________', cx, y, { align: 'center' })
  }

  return y + 10
}

/** Gera e baixa o PDF. O jsPDF é carregado só quando alguém pede o PDF (fica fora do bundle inicial). */
export async function baixarReciboPdf(dados: DadosRecibo): Promise<void> {
  const { jsPDF: JsPDF } = await import('jspdf')

  // 1ª passada em um documento descartável só para descobrir a altura necessária.
  const medidor = new JsPDF({ unit: 'mm', format: [LARGURA, 400] })
  const altura = Math.max(120, Math.ceil(desenhar(medidor, dados)))

  const doc = new JsPDF({ unit: 'mm', format: [LARGURA, altura] })
  desenhar(doc, dados)
  doc.save(`recibo-${formatarNumeroRecibo(dados.numero)}.pdf`)
}
