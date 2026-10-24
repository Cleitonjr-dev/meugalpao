import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  /** true enquanto a sessão inicial (e o perfil) ainda estão sendo carregados */
  loading: boolean
  /** true enquanto o perfil do usuário logado ainda está sendo buscado */
  profileLoading: boolean
  /** true quando o usuário chegou pelo link de "esqueci a senha" e precisa definir uma nova */
  recovering: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  /** Confere a senha de quem está logado (refaz o login em silêncio, mesmo usuário) */
  confirmarSenha: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function mensagemLogin(message: string): string {
  const texto = message.toLowerCase()
  if (texto.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (texto.includes('invalid login credentials')) return 'E-mail ou senha inválidos.'
  return 'Não foi possível entrar. Tente novamente.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const perfilDoUsuario = useRef<string | null>(null)
  const queryClient = useQueryClient()

  const carregarPerfil = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (perfilDoUsuario.current !== userId) return
    setProfile(error ? null : ((data as Profile | null) ?? null))
    setProfileLoading(false)
  }, [])

  const aplicarSessao = useCallback(
    (nova: Session | null) => {
      setSession(nova)
      // Mantém a mesma referência de `user` enquanto for a mesma pessoa
      // (renovação de token não deve disparar recarga de dados).
      setUser((anterior) => (anterior?.id === nova?.user.id ? anterior : (nova?.user ?? null)))

      const userId = nova?.user.id ?? null
      if (userId === perfilDoUsuario.current) return

      perfilDoUsuario.current = userId
      // Outra pessoa (ou ninguém): descarta todo o cache para nunca vazar dados entre contas.
      queryClient.clear()
      if (!userId) {
        setProfile(null)
        return
      }
      setProfile(null)
      setProfileLoading(true)
      // Fora do callback do Supabase para evitar deadlock nas chamadas ao cliente.
      window.setTimeout(() => void carregarPerfil(userId), 0)
    },
    [carregarPerfil, queryClient],
  )

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return
        const atual = data.session
        setSession(atual)
        setUser(atual?.user ?? null)
        perfilDoUsuario.current = atual?.user.id ?? null
        if (atual?.user) {
          // O perfil carrega em paralelo: o app não espera por ele para aparecer.
          setProfileLoading(true)
          void carregarPerfil(atual.user.id)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data: listener } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      if (evento === 'PASSWORD_RECOVERY') setRecovering(true)
      if (evento === 'SIGNED_OUT') setRecovering(false)
      aplicarSessao(novaSessao)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [aplicarSessao, carregarPerfil])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? mensagemLogin(error.message) : null }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    return { error: error ? error.message : null }
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) setRecovering(false)
    return { error: error ? error.message : null }
  }

  const confirmarSenha = async (password: string) => {
    const email = user?.email
    if (!email) return { error: 'Sessão expirada. Entre novamente.' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return { error: null }
    const texto = error.message.toLowerCase()
    if (error.status === 429 || texto.includes('rate limit')) {
      return { error: 'Muitas tentativas. Aguarde um instante e tente de novo.' }
    }
    return { error: 'Senha incorreta.' }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    perfilDoUsuario.current = null
    setProfile(null)
    setProfileLoading(false)
  }

  const value: AuthContextValue = {
    user,
    session,
    profile,
    loading,
    profileLoading,
    recovering,
    signIn,
    resetPassword,
    updatePassword,
    confirmarSenha,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
