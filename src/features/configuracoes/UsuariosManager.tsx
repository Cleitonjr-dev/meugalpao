import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { chaves } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageLoader } from '@/components/ui/PageLoader'
import { ErroCarregamento } from '@/components/shared/ErroCarregamento'
import { Checkbox } from '@/components/ui/Checkbox'
import { Badge } from '@/components/ui/Badge'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { ConfirmarSenhaModal } from '@/components/shared/ConfirmarSenhaModal'
import type { Galpao, GalpaoMembro, Profile } from '@/types'

async function buscarUsuarios() {
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

export function UsuariosManager() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState(false)

  const consulta = useQuery({ queryKey: chaves.usuarios, queryFn: buscarUsuarios })
  const profiles = consulta.data?.profiles ?? []
  const galpoes = consulta.data?.galpoes ?? []
  const membros = consulta.data?.membros ?? []

  // Atualiza a lista por trás: a tela não volta ao "Carregando..." a cada clique.
  const carregar = () => queryClient.invalidateQueries({ queryKey: chaves.usuarios })

  const acessosDe = (profileId: string) =>
    new Set(membros.filter((m) => m.profile_id === profileId).map((m) => m.galpao_id))

  const alternarAcesso = async (profileId: string, galpaoId: string, liberar: boolean) => {
    setMensagem(null)
    const { error } = liberar
      ? await supabase
          .from('galpao_membros')
          .insert({ profile_id: profileId, galpao_id: galpaoId })
      : await supabase
          .from('galpao_membros')
          .delete()
          .eq('profile_id', profileId)
          .eq('galpao_id', galpaoId)

    if (error) {
      setMensagem('Erro ao alterar acesso.')
      setErro(true)
      return
    }
    setMensagem('Acesso atualizado.')
    setErro(false)
    await carregar()
  }

  // Mudar quem é super usuário pede a senha de novo (o banco confere a mesma coisa).
  const [alterandoSuper, setAlterandoSuper] = useState<{ profile: Profile; isSuper: boolean } | null>(null)

  /** Chamada depois que a senha foi confirmada. Devolve a mensagem de erro, ou null se deu certo. */
  const confirmarSuper = async (): Promise<string | null> => {
    if (!alterandoSuper) return null
    setMensagem(null)
    const { error } = await supabase
      .from('profiles')
      .update({ is_super: alterandoSuper.isSuper })
      .eq('id', alterandoSuper.profile.id)
    if (error) {
      if (error.message.includes('último super')) return 'Não é possível remover o último super usuário.'
      if (error.message.includes('Confirme sua senha')) return error.message
      return 'Erro ao alterar permissão.'
    }
    setMensagem('Permissão atualizada.')
    setErro(false)
    await carregar()
    return null
  }

  if (consulta.isPending) return <PageLoader />

  if (consulta.isError && !consulta.data) {
    return (
      <ErroCarregamento
        mensagem="Erro ao carregar usuários."
        onRetry={() => void consulta.refetch()}
      />
    )
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Usuários</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Defina quais galpões cada usuário pode acessar e quem é super usuário.
      </p>

      {mensagem && (
        <p
          className={`mt-3 text-sm ${erro ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}
        >
          {mensagem}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {profiles.map((p) => {
          const acessos = acessosDe(p.id)
          const isSelf = p.id === user?.id
          return (
            <div
              key={p.id}
              className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <UserAvatar name={p.nome || ''} avatar={p.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-white">
                    {p.nome || 'Sem nome'}
                  </p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                    {p.email ?? 'Sem e-mail'}
                  </p>
                </div>
                {p.is_super && <Badge variant="primary">Super Usuário</Badge>}
              </div>

              <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                <Checkbox
                  label="Super Usuário"
                  checked={p.is_super}
                  disabled={isSelf}
                  onChange={(checked) => setAlterandoSuper({ profile: p, isSuper: checked })}
                />
                {p.is_super ? (
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    Super usuário tem acesso a todos os galpões.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Acesso aos galpões
                    </span>
                    {galpoes.map((g) => (
                      <div key={g.id}>
                        <Checkbox
                          label={g.nome}
                          checked={acessos.has(g.id)}
                          onChange={(checked) => alternarAcesso(p.id, g.id, checked)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isSelf && (
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  Você não pode remover seu próprio acesso de super usuário.
                </p>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
        As contas são criadas pelo painel do Supabase (Authentication → Users); depois de criadas, aparecem aqui e é só liberar o acesso aos galpões.
      </p>

      <ConfirmarSenhaModal
        open={alterandoSuper !== null}
        titulo={alterandoSuper?.isSuper ? 'Tornar super usuário' : 'Remover super usuário'}
        textoBotao={alterandoSuper?.isSuper ? 'Tornar super usuário' : 'Remover permissão'}
        perigo={alterandoSuper?.isSuper === true}
        descricao={
          alterandoSuper?.isSuper ? (
            <>
              <strong>{alterandoSuper.profile.nome || 'Esta pessoa'}</strong> passará a ver todos os galpões, gerenciar
              usuários, preços e o histórico, e a dar permissões a outras pessoas.
            </>
          ) : (
            <>
              <strong>{alterandoSuper?.profile.nome || 'Esta pessoa'}</strong> deixará de ser super usuário e só verá os
              galpões liberados para ela.
            </>
          )
        }
        onConfirmar={confirmarSuper}
        onClose={() => setAlterandoSuper(null)}
      />
    </Card>
  )
}
