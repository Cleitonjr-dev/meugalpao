// O PostgREST devolve no máximo 1000 linhas por resposta: buscamos em lotes.
export const TAMANHO_LOTE = 1000

type Lote<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/** Busca todas as linhas de uma consulta paginando em lotes de 1000. A consulta precisa ter ordem fixa. */
export async function buscarTudo<T>(montar: (de: number, ate: number) => Lote<T>): Promise<T[]> {
  const todos: T[] = []
  for (let de = 0; ; de += TAMANHO_LOTE) {
    const { data, error } = await montar(de, de + TAMANHO_LOTE - 1)
    if (error) throw new Error(error.message)
    const lote = data ?? []
    todos.push(...lote)
    if (lote.length < TAMANHO_LOTE) break
  }
  return todos
}
