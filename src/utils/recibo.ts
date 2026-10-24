import type { DiaPagamento } from '@/types'
import { formatarCodigo } from '@/utils/codigo'
import { APP_NAME } from '@/config/constants'

export function formatarNumeroRecibo(numero: number | null): string {
  return numero === null ? '----' : String(numero).padStart(4, '0')
}

export { dataLocalISO } from '@/utils/data'

const SOMENTE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/

/** Formata "YYYY-MM-DD" sem passar por fuso horário; timestamps usam o horário local. */
export function formatarDataBR(value: string | Date): string {
  if (typeof value === 'string') {
    const m = SOMENTE_DATA.exec(value)
    if (m) return `${m[3]}/${m[2]}/${m[1]}`
  }
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
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

export function mensagemRecibo(params: {
  galpao: string
  numero: number | null
  cliente: string
  valor: string
  data: string
  forma: string
  referente?: string
  itens?: string | null
  codigo?: string | null
}): string {
  const linhas = [
    APP_NAME,
    params.galpao,
    `Recibo Nº ${formatarNumeroRecibo(params.numero)}`,
    `Data: ${params.data}`,
    `Cliente: ${params.cliente}`,
    `Valor: ${params.valor}`,
  ]
  if (params.itens) {
    linhas.push(`Referente a: ${params.itens}`)
  }
  linhas.push(`Forma: ${params.forma}`)
  if (params.referente) {
    linhas.push(`Cobrança de: ${params.referente}`)
  }
  if (params.codigo) {
    linhas.push(`Código de autenticação: ${formatarCodigo(params.codigo)}`)
  }
  linhas.push('Obrigado!')
  return linhas.join('\n')
}

export function diaSemanaKey(date: Date): DiaPagamento | null {
  const d = date.getDay()
  if (d === 3) return 'quarta'
  if (d === 6) return 'sabado'
  return null
}
