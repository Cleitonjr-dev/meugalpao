import type { DiaPagamento } from '@/types'
import { dataLocalISO } from '@/utils/data'

export type PresetPeriodo = 'hoje' | '7dias' | 'mes' | 'mes-passado'

export interface Periodo {
  de: string
  ate: string
}

export const PRESETS_PERIODO: { valor: PresetPeriodo; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7dias', rotulo: 'Últimos 7 dias' },
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'mes-passado', rotulo: 'Mês passado' },
]

/** Datas (AAAA-MM-DD) de cada atalho de período, a partir de "hoje". */
export function periodoDoPreset(preset: PresetPeriodo, hoje: Date): Periodo {
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth()
  const dia = hoje.getDate()

  switch (preset) {
    case 'hoje':
      return { de: dataLocalISO(hoje), ate: dataLocalISO(hoje) }
    case '7dias':
      // hoje + os 6 dias anteriores
      return { de: dataLocalISO(new Date(ano, mes, dia - 6)), ate: dataLocalISO(hoje) }
    case 'mes':
      return { de: dataLocalISO(new Date(ano, mes, 1)), ate: dataLocalISO(hoje) }
    case 'mes-passado':
      return {
        de: dataLocalISO(new Date(ano, mes - 1, 1)),
        ate: dataLocalISO(new Date(ano, mes, 0)),
      }
  }
}

/** Qual atalho corresponde ao período atual (ou null se for personalizado). */
export function presetDoPeriodo(periodo: Periodo, hoje: Date): PresetPeriodo | null {
  return (
    PRESETS_PERIODO.find((p) => {
      const esperado = periodoDoPreset(p.valor, hoje)
      return esperado.de === periodo.de && esperado.ate === periodo.ate
    })?.valor ?? null
  )
}

/**
 * Intervalo que os calendários de período aceitam: do primeiro pagamento registrado até hoje
 * (antes disso não há dado, e datas futuras não têm pagamento). Sem nenhum pagamento ainda, 1 ano atrás.
 */
export function limitesDoPeriodo(
  primeiroPagamento: string | null,
  hoje: Date,
): { min: string; max: string } {
  const max = dataLocalISO(hoje)
  const umAnoAtras = dataLocalISO(new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate()))
  const min = primeiroPagamento ?? umAnoAtras
  return { min: min > max ? max : min, max }
}

export function diaSemanaKey(date: Date): DiaPagamento | null {
  const d = date.getDay()
  if (d === 3) return 'quarta'
  if (d === 6) return 'sabado'
  return null
}
