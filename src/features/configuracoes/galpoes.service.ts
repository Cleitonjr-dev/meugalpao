import { supabase } from '@/lib/supabase'

export interface DadosGalpao {
  nome: string
  endereco: string | null
}

/** Cria o galpão, ou atualiza quando `id` é informado. */
export async function salvarGalpao(dados: DadosGalpao, id?: string): Promise<boolean> {
  const { error } = id
    ? await supabase.from('galpoes').update(dados).eq('id', id)
    : await supabase.from('galpoes').insert(dados)
  return !error
}

/** Devolve a mensagem de erro, ou null se deu certo. As mensagens do banco já vêm em português. */
export async function excluirGalpao(id: string): Promise<string | null> {
  const { error } = await supabase.from('galpoes').delete().eq('id', id)
  if (!error) return null
  return error.code === 'P0001' ? error.message : 'Erro ao excluir o galpão.'
}
