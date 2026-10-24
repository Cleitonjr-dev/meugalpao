import { supabase } from '@/lib/supabase'
import type { Galpao, GalpaoMembro, Profile } from '@/types'

export async function buscarUsuarios() {
  const [p, g, m] = await Promise.all([
    supabase.from('profiles').select('*').order('nome', { ascending: true }),
    supabase.from('galpoes').select('*').order('nome', { ascending: true }),
    supabase.from('galpao_membros').select('*'),
  ])
  if (p.error || g.error || m.error) throw new Error('Erro ao carregar usuários.')
  return {
    profiles: (p.data as Profile[]) ?? [],
    galpoes: (g.data as Galpao[]) ?? [],
    membros: (m.data as GalpaoMembro[]) ?? [],
  }
}

/** Libera ou retira o acesso de um usuário a um galpão. */
export async function alterarAcessoGalpao(
  profileId: string,
  galpaoId: string,
  liberar: boolean,
): Promise<boolean> {
  const { error } = liberar
    ? await supabase.from('galpao_membros').insert({ profile_id: profileId, galpao_id: galpaoId })
    : await supabase
        .from('galpao_membros')
        .delete()
        .eq('profile_id', profileId)
        .eq('galpao_id', galpaoId)
  return !error
}

/** Devolve a mensagem de erro, ou null se deu certo. */
export async function alterarSuperUsuario(
  profileId: string,
  isSuper: boolean,
): Promise<string | null> {
  const { error } = await supabase.from('profiles').update({ is_super: isSuper }).eq('id', profileId)
  if (!error) return null
  if (error.message.includes('último super')) return 'Não é possível remover o último super usuário.'
  if (error.message.includes('Confirme sua senha')) return error.message
  return 'Erro ao alterar permissão.'
}
