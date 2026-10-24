const FUSO = 'America/Fortaleza'

const FORMATO = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/**
 * "Agora" no horário de Fortaleza, qualquer que seja o fuso ou o relógio do aparelho.
 *
 * Devolve um `Date` cujos campos locais (dia, hora...) são os de Fortaleza, para o resto do sistema
 * continuar usando `getDay()`, `getDate()` etc. O banco grava a data do pagamento nesse mesmo fuso,
 * então telas e servidor sempre concordam sobre o que é "hoje".
 */
export function agoraEmFortaleza(base: Date = new Date()): Date {
  const partes: Record<string, string> = {}
  for (const parte of FORMATO.formatToParts(base)) partes[parte.type] = parte.value
  return new Date(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
    Number(partes.second),
  )
}

/** "AAAA-MM-DD" a partir dos campos locais da data (sem passar por UTC). */
export function dataLocalISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "AAAA-MM-DD" para Date (meia-noite local), ou null se o texto não for uma data. */
export function parseISO(valor: string): Date | null {
  if (!valor) return null
  const [ano, mes, dia] = valor.split('-').map(Number)
  if (!ano || !mes || !dia) return null
  return new Date(ano, mes - 1, dia)
}

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
