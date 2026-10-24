import { formatarCodigo } from '@/utils/codigo'
import { APP_NAME } from '@/config/constants'

export function formatarNumeroRecibo(numero: number | null): string {
  return numero === null ? '----' : String(numero).padStart(4, '0')
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
