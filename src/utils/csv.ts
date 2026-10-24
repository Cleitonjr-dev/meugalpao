export type CelulaCsv = string | number | null | undefined

/** Texto de uma célula: aspas dobradas, proteção contra fórmula e aspas em volta quando preciso. */
export function escaparCelula(valor: CelulaCsv): string {
  if (valor === null || valor === undefined) return ''
  let texto = typeof valor === 'number' ? String(valor).replace('.', ',') : valor
  // Excel/Planilhas executam texto que começa com = + - @ como fórmula
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/** CSV para o Excel brasileiro: separador ";", fim de linha CRLF e BOM no início (acentos corretos). */
export function gerarCsv(colunas: string[], linhas: CelulaCsv[][]): string {
  const todas = [colunas, ...linhas]
  return '\uFEFF' + todas.map((l) => l.map(escaparCelula).join(';')).join('\r\n') + '\r\n'
}

/** Valor em reais como texto ("110,00"), para a planilha não tratar como fórmula. */
export function reaisCsv(valor: number): string {
  return valor.toFixed(2).replace('.', ',')
}

export function baixarCsv(nomeArquivo: string, conteudo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
