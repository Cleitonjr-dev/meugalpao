import { formatCurrency } from '@/lib/utils'
import { formatarDataCurta } from '@/utils/pagamentos'

/** Mensagem de cobrança para o WhatsApp. `semanas` são datas ISO (saída de pendenciasCliente). */
export function mensagemCobranca(p: {
  nomeCliente: string
  galpao: string
  semanas: string[]
  valorTotal: number
  /** Há cobranças ainda mais antigas que as listadas: a mensagem diz "pelo menos" */
  truncada?: boolean
}): string {
  const primeiroNome = p.nomeCliente.trim().split(/\s+/)[0] ?? ''
  const n = p.semanas.length
  const abertura = p.truncada
    ? `Passando para lembrar que existem pelo menos ${n} cobranças em aberto no ${p.galpao}:`
    : n === 1
      ? `Passando para lembrar que existe 1 cobrança em aberto no ${p.galpao}:`
      : `Passando para lembrar que existem ${n} cobranças em aberto no ${p.galpao}:`
  return [
    `Olá, ${primeiroNome}! Tudo bem?`,
    abertura,
    p.semanas.map(formatarDataCurta).join(', '),
    p.truncada ? `Total das últimas semanas: ${formatCurrency(p.valorTotal)}.` : `Total: ${formatCurrency(p.valorTotal)}.`,
    'Qualquer dúvida, é só falar. Obrigado!',
  ].join('\n')
}

/**
 * Converte um telefone brasileiro para o formato internacional exigido pelo wa.me
 * (55 + DDD + número). Retorna null se o número não parecer válido.
 */
export function normalizarWhatsapp(telefone: string): string | null {
  let digitos = telefone.replace(/\D/g, '')
  if (digitos.startsWith('00')) digitos = digitos.slice(2)
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) {
    return digitos
  }
  digitos = digitos.replace(/^0+/, '')
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`
  return null
}

export function whatsappLink(telefone: string, mensagem: string): string | null {
  const numero = normalizarWhatsapp(telefone)
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
}
