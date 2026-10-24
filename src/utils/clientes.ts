import type { Cliente } from '@/types'

/** Minúsculas, sem acentos e sem espaços nas pontas: base da busca por texto. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Busca por nome, telefone ou WhatsApp (sem diferenciar acentos, maiúsculas nem máscara). */
export function filtrarClientes(clientes: Cliente[], termo: string): Cliente[] {
  const texto = normalizarTexto(termo)
  if (!texto) return clientes
  const digitos = texto.replace(/\D/g, '')
  return clientes.filter((c) => {
    if (normalizarTexto(c.nome).includes(texto)) return true
    if (digitos.length === 0) return false
    return [c.telefone, c.whatsapp].some((n) => n && n.replace(/\D/g, '').includes(digitos))
  })
}
