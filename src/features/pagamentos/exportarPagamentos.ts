import { FORMAS_PAGAMENTO_LABEL, STATUS_PAGAMENTO_LABEL } from '@/config/constants'
import { formatDateTime } from '@/lib/utils'
import { baixarCsv, gerarCsv, reaisCsv } from '@/utils/csv'
import { formatarCodigo } from '@/utils/codigo'
import { formatarDataBR } from '@/utils/data'
import { formatarNumeroRecibo } from '@/utils/recibo'
import type { LinhaPagamento } from '@/types'
import { listarPagamentos, type ParametrosLista } from './pagamentos.queries'

const LOTE = 100
/** Limite de segurança: acima disso o arquivo fica pesado demais para abrir em planilha. */
export const LIMITE_EXPORTACAO = 20000

const COLUNAS = [
  'Recibo',
  'Código de autenticação',
  'Cliente',
  'Cobrança de',
  'Pago em',
  'Forma',
  'Situação',
  'Valor',
  'Item',
  'Recebido por',
  'Cancelado por',
  'Motivo do cancelamento',
]

export function linhaCsv(l: LinhaPagamento): (string | null)[] {
  return [
    l.recibo_numero !== null ? formatarNumeroRecibo(l.recibo_numero) : null,
    l.recibo_codigo ? formatarCodigo(l.recibo_codigo) : null,
    l.cliente_nome,
    formatarDataBR(l.semana_referencia ?? l.data_pagamento),
    formatDateTime(l.created_at),
    FORMAS_PAGAMENTO_LABEL[l.forma_pagamento],
    STATUS_PAGAMENTO_LABEL[l.status] ?? l.status,
    reaisCsv(Number(l.valor)),
    l.descricao,
    l.recebido_por_nome,
    l.cancelado_por_nome,
    l.motivo_cancelamento,
  ]
}

/**
 * Baixa tudo o que está no filtro atual (todas as páginas) em CSV.
 * Devolve `truncado: true` quando passou do limite de segurança.
 */
export async function exportarPagamentosCsv(
  galpaoId: string,
  filtros: Omit<ParametrosLista, 'pagina' | 'tamanho'>,
  nomeArquivo: string,
): Promise<{ linhas: number; truncado: boolean }> {
  // Por id: se alguém registrar um pagamento enquanto as páginas são baixadas, as linhas deslocam e uma
  // poderia vir duas vezes. O mapa garante cada pagamento uma única vez.
  const porId = new Map<string, LinhaPagamento>()
  let total = Infinity
  let ultimaPagina = 1
  for (let pagina = 1; pagina <= ultimaPagina && porId.size < LIMITE_EXPORTACAO; pagina++) {
    const resposta = await listarPagamentos(galpaoId, { ...filtros, pagina, tamanho: LOTE })
    total = resposta.total
    // margem de 2 páginas para absorver as linhas que deslocaram durante a exportação
    ultimaPagina = Math.ceil(total / LOTE) + 2
    for (const linha of resposta.itens) porId.set(linha.id, linha)
    // página incompleta = chegou ao fim
    if (resposta.itens.length < LOTE) break
  }
  const linhas = [...porId.values()]
  const truncado = total > LIMITE_EXPORTACAO
  const usadas = linhas.slice(0, LIMITE_EXPORTACAO)
  baixarCsv(nomeArquivo, gerarCsv(COLUNAS, usadas.map(linhaCsv)))
  return { linhas: usadas.length, truncado }
}
