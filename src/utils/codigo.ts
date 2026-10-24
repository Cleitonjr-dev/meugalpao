const TAMANHO_CODIGO = 16

/** Tira tudo que não é hexadecimal e deixa em maiúsculas: "a3f9-27c1" vira "A3F927C1". */
export function limparCodigo(entrada: string): string {
  return entrada.toUpperCase().replace(/[^0-9A-F]/g, '')
}

/** Código completo (16 caracteres) ou null se o texto não for um código válido. */
export function normalizarCodigo(entrada: string): string | null {
  const limpo = limparCodigo(entrada)
  return limpo.length === TAMANHO_CODIGO ? limpo : null
}

/** "A3F927C15DE0B481" vira "A3F9-27C1-5DE0-B481" (o formato impresso no recibo). */
export function formatarCodigo(codigo: string): string {
  const limpo = limparCodigo(codigo)
  return limpo.match(/.{1,4}/g)?.join('-') ?? limpo
}

/**
 * O resultado mostrado na tela só vale enquanto o campo ainda contém aquele mesmo código:
 * devolve o código consultado se ele corresponde ao texto digitado, senão null.
 */
export function resultadoAtual(digitado: string, consultado: string | null): string | null {
  return consultado !== null && normalizarCodigo(digitado) === consultado ? consultado : null
}
