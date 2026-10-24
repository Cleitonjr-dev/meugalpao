import { dataLocalISO, parseISO as parseISOData } from '@/utils/data'
import type { Cliente, DiaPagamento, Pagamento } from '@/types'

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** Quantas semanas para trás procuramos cobranças em aberto. */
/**
 * Quantas cobranças para trás o sistema confere (e baixa os pagamentos para conferir). Além disso o sistema
 * não sabe se estava pago; por isso, quando o cliente é mais antigo que isso, a tela avisa com "26+" (ver `pendenciasTruncadas`).
 */
export const SEMANAS_RETROATIVAS_MAX = 26

function weekdayDe(diaPagamento: DiaPagamento): number {
  return diaPagamento === 'quarta' ? 3 : 6
}

function inicioDoDia(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function somarDias(date: Date, dias: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + dias)
}

function parseISO(iso: string): Date {
  const data = parseISOData(iso)
  if (!data) throw new Error(`Data inválida: ${iso}`)
  return data
}

function rotulo(date: Date): string {
  const dia = String(date.getDate()).padStart(2, '0')
  const mes = String(date.getMonth() + 1).padStart(2, '0')
  return `${DIAS_CURTOS[date.getDay()]} ${dia}/${mes}`
}

/** Chave usada no conjunto de pagamentos válidos (ver indexarPagos). */
export function chavePagamento(clienteId: string, semanaISO: string): string {
  return `${clienteId}|${semanaISO}`
}

/** Conjunto das semanas pagas (pagamentos cancelados não contam). */
export function indexarPagos(pagamentos: Pagamento[]): Set<string> {
  const set = new Set<string>()
  for (const p of pagamentos) {
    if (p.status === 'cancelado' || !p.semana_referencia) continue
    set.add(chavePagamento(p.cliente_id, p.semana_referencia))
  }
  return set
}

/** Data de cobrança mais recente que já venceu (hoje conta, se for o dia). */
function ultimaData(diaPagamento: DiaPagamento, hoje: Date): Date {
  const h = inicioDoDia(hoje)
  const diff = (h.getDay() - weekdayDe(diaPagamento) + 7) % 7
  return somarDias(h, -diff)
}

export function ultimaReferencia(diaPagamento: DiaPagamento, hoje: Date): string {
  return dataLocalISO(ultimaData(diaPagamento, hoje))
}

/** Primeira cobrança devida: o primeiro dia de pagamento a partir do cadastro. */
function primeiraData(cliente: Cliente): Date {
  const criado = inicioDoDia(new Date(cliente.created_at))
  const diff = (weekdayDe(cliente.dia_pagamento) - criado.getDay() + 7) % 7
  return somarDias(criado, diff)
}

export interface Referencia {
  iso: string
  label: string
  atrasada?: boolean
}

/** Cobrança atual + as próximas `futuras` semanas (para exibir o calendário do cliente). */
function referenciasCliente(
  diaPagamento: DiaPagamento,
  hoje: Date,
  futuras: number,
): Referencia[] {
  const ultima = ultimaData(diaPagamento, hoje)
  const lista: Referencia[] = []
  for (let i = 0; i <= futuras; i++) {
    const d = somarDias(ultima, i * 7)
    lista.push({ iso: dataLocalISO(d), label: `${rotulo(d)}${i === 0 ? ' (atual)' : ''}` })
  }
  return lista
}

/** Cobranças vencidas e não pagas, da mais antiga para a mais recente. */
export function pendenciasCliente(cliente: Cliente, pagos: Set<string>, hoje: Date): string[] {
  if (!cliente.ativo) return []

  const ultima = ultimaData(cliente.dia_pagamento, hoje)
  const limite = somarDias(ultima, -7 * (SEMANAS_RETROATIVAS_MAX - 1))
  const primeira = primeiraData(cliente)
  let atual = primeira.getTime() > limite.getTime() ? primeira : limite

  const pendentes: string[] = []
  while (atual.getTime() <= ultima.getTime()) {
    const iso = dataLocalISO(atual)
    if (!pagos.has(chavePagamento(cliente.id, iso))) pendentes.push(iso)
    atual = somarDias(atual, 7)
  }
  return pendentes
}

/**
 * O cliente tem cobranças anteriores à janela conferida? Se tiver, a lista de atrasos pode estar incompleta
 * (a tela mostra "26+ semanas" em vez de um número exato, para nunca esconder dívida).
 */
export function pendenciasTruncadas(cliente: Cliente, hoje: Date): boolean {
  if (!cliente.ativo) return false
  const ultima = ultimaData(cliente.dia_pagamento, hoje)
  const limite = somarDias(ultima, -7 * (SEMANAS_RETROATIVAS_MAX - 1))
  return primeiraData(cliente).getTime() < limite.getTime()
}

export function clienteEmAtraso(cliente: Cliente, pagos: Set<string>, hoje: Date): boolean {
  return pendenciasCliente(cliente, pagos, hoje).length > 0
}

/** Semanas que ainda podem ser cobradas: as em atraso e a atual/futuras sem pagamento. */
export function referenciasDisponiveis(
  cliente: Cliente,
  pagos: Set<string>,
  hoje: Date,
  futuras = 4,
): Referencia[] {
  const mapa = new Map<string, Referencia>()

  for (const iso of pendenciasCliente(cliente, pagos, hoje)) {
    mapa.set(iso, { iso, label: `${rotulo(parseISO(iso))} (atrasada)`, atrasada: true })
  }
  for (const ref of referenciasCliente(cliente.dia_pagamento, hoje, futuras)) {
    if (!mapa.has(ref.iso) && !pagos.has(chavePagamento(cliente.id, ref.iso))) {
      mapa.set(ref.iso, ref)
    }
  }
  return [...mapa.values()]
}

export function formatarDataCurta(iso: string): string {
  return rotulo(parseISO(iso))
}

export interface SemanaStatus {
  iso: string
  pago: boolean
}

export type SituacaoStatus = 'em_atraso' | 'em_dia' | 'adiantado'

export interface SituacaoCliente {
  status: SituacaoStatus
  pagoAte: string | null
  semanas: SemanaStatus[]
  pendentes: string[]
  /** Há cobranças mais antigas que a janela conferida: a lista de atrasos pode estar incompleta */
  truncada: boolean
}

export function situacaoCliente(
  cliente: Cliente,
  pagos: Set<string>,
  hoje: Date,
  futuras = 4,
): SituacaoCliente {
  const semanas: SemanaStatus[] = referenciasCliente(cliente.dia_pagamento, hoje, futuras).map(
    (r) => ({ iso: r.iso, pago: pagos.has(chavePagamento(cliente.id, r.iso)) }),
  )
  const pendentes = pendenciasCliente(cliente, pagos, hoje)

  if (pendentes.length > 0) {
    return { status: 'em_atraso', pagoAte: null, semanas, pendentes, truncada: pendenciasTruncadas(cliente, hoje) }
  }

  let status: SituacaoStatus = 'em_dia'
  let pagoAte: string | null = null

  if (semanas[0]?.pago) {
    pagoAte = semanas[0].iso
    for (let i = 1; i < semanas.length; i++) {
      if (!semanas[i].pago) break
      status = 'adiantado'
      pagoAte = semanas[i].iso
    }
  }

  return { status, pagoAte, semanas, pendentes, truncada: false }
}

/**
 * Início da janela de pagamentos que o Dashboard precisa carregar:
 * as semanas retroativas verificadas + uma de folga. Pagamentos mais antigos
 * ficam nas telas paginadas (Pagamentos e Recibos).
 */
export function inicioJanelaRecente(hoje: Date): string {
  const inicio = somarDias(inicioDoDia(hoje), -7 * (SEMANAS_RETROATIVAS_MAX + 1))
  return dataLocalISO(inicio)
}
