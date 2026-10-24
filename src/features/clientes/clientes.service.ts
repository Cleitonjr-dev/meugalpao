import { supabase } from '@/lib/supabase'
import type { Cliente, DiaPagamento, ItemGuardado } from '@/types'

export interface DadosCliente {
  nome: string
  telefone: string | null
  whatsapp: string | null
  dia_pagamento: DiaPagamento
  observacoes: string | null
  ativo: boolean
}

export type ItemNovo = Pick<ItemGuardado, 'tipo_item_id' | 'identificacao' | 'quantidade'>

export async function atualizarCliente(id: string, dados: DadosCliente): Promise<boolean> {
  const { error } = await supabase.from('clientes').update(dados).eq('id', id)
  return !error
}

/** Devolve o cliente criado, ou null se o banco recusou. */
export async function criarCliente(
  dados: DadosCliente,
  galpaoId: string,
  criadoPor: string | null,
): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from('clientes')
    .insert({ ...dados, galpao_id: galpaoId, criado_por: criadoPor })
    .select()
    .single()
  if (error || !data) return null
  return data as Cliente
}

export type ResultadoExclusao = 'ok' | 'com-pagamentos' | 'erro'

export async function excluirCliente(id: string): Promise<ResultadoExclusao> {
  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (!error) return 'ok'
  // 23503 = violação de chave estrangeira (existem pagamentos)
  return error.code === '23503' ? 'com-pagamentos' : 'erro'
}

export async function removerItens(ids: string[]): Promise<boolean> {
  const { error } = await supabase.from('itens_guardados').delete().in('id', ids)
  return !error
}

export async function ajustarQuantidades(
  ajustes: { id: string; quantidade: number }[],
): Promise<boolean> {
  const resultados = await Promise.all(
    ajustes.map(({ id, quantidade }) =>
      supabase.from('itens_guardados').update({ quantidade }).eq('id', id),
    ),
  )
  return resultados.every((r) => !r.error)
}

export async function adicionarItens(
  cliente: Pick<Cliente, 'id' | 'galpao_id'>,
  itens: ItemNovo[],
): Promise<boolean> {
  const { error } = await supabase.from('itens_guardados').insert(
    itens.map((item) => ({
      cliente_id: cliente.id,
      galpao_id: cliente.galpao_id,
      tipo_item_id: item.tipo_item_id,
      identificacao: item.identificacao,
      quantidade: item.quantidade,
    })),
  )
  return !error
}
