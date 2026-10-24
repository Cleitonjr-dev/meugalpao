import { supabase } from '@/lib/supabase'
import type { PrecoGalpao, TipoItem } from '@/types'
import type { PlanoPrecos } from './precosPorGalpao'

export interface DadosTipo {
  nome: string
  preco_semanal: number
}

export async function buscarTipos(): Promise<TipoItem[]> {
  const { data, error } = await supabase
    .from('tipos_item')
    .select('*')
    .order('nome', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as TipoItem[]) ?? []
}

export async function buscarTodosOsPrecos(): Promise<PrecoGalpao[]> {
  const { data, error } = await supabase.from('precos_galpao').select('*')
  if (error) throw new Error(error.message)
  return (data as PrecoGalpao[]) ?? []
}

export async function atualizarTipo(id: string, dados: DadosTipo): Promise<boolean> {
  const { error } = await supabase.from('tipos_item').update(dados).eq('id', id)
  return !error
}

/** Devolve o id do tipo criado, ou null se o banco recusou. */
export async function criarTipo(dados: DadosTipo): Promise<string | null> {
  const { data, error } = await supabase
    .from('tipos_item')
    .insert({ ...dados, galpao_id: null })
    .select('id')
    .single()
  if (error || !data) return null
  return (data as { id: string }).id
}

export async function alterarAtivoTipo(id: string, ativo: boolean): Promise<boolean> {
  const { error } = await supabase.from('tipos_item').update({ ativo }).eq('id', id)
  return !error
}

/** Devolve a mensagem de erro, ou null se deu certo. O banco recusa tipo em uso e explica em português. */
export async function excluirTipo(id: string): Promise<string | null> {
  const { error } = await supabase.from('tipos_item').delete().eq('id', id)
  if (!error) return null
  return error.code === 'P0001' ? error.message : 'Erro ao excluir tipo.'
}

/** Grava os preços próprios dos galpões de um tipo, conforme o plano de `planejarPrecos`. */
export async function gravarPrecos(
  plano: Extract<PlanoPrecos, { ok: true }>,
  tipoId: string,
): Promise<boolean> {
  const resultados = await Promise.all([
    plano.apagar.length > 0
      ? supabase.from('precos_galpao').delete().in('id', plano.apagar)
      : Promise.resolve({ error: null }),
    ...plano.atualizar.map((p) =>
      supabase.from('precos_galpao').update({ preco_semanal: p.preco_semanal }).eq('id', p.id),
    ),
    plano.inserir.length > 0
      ? supabase
          .from('precos_galpao')
          .insert(plano.inserir.map((p) => ({ ...p, tipo_item_id: tipoId })))
      : Promise.resolve({ error: null }),
  ])
  return resultados.every((r) => !r.error)
}
