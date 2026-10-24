import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { Card } from '@/components/ui/Card'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { Logo } from '@/components/shared/Logo'
import { APP_NAME } from '@/config/constants'

const REMEMBER_EMAIL_KEY = 'meugalpao.lembrarEmail'
const SENHA_MINIMA = 6

type Mode = 'login' | 'recover' | 'reset'

const SUBTITLE: Record<Mode, string> = {
  login: 'Entre para gerenciar seus galpões',
  recover: 'Informe seu e-mail para redefinir a senha',
  reset: 'Defina sua nova senha',
}

function lembrado(): string {
  try {
    return localStorage.getItem(REMEMBER_EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}

function guardarEmail(email: string | null) {
  try {
    if (email) localStorage.setItem(REMEMBER_EMAIL_KEY, email)
    else localStorage.removeItem(REMEMBER_EMAIL_KEY)
  } catch {
    // armazenamento indisponível: apenas não lembramos o e-mail
  }
}

export function LoginPage() {
  const { session, recovering, signIn, resetPassword, updatePassword } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState(lembrado)
  const [password, setPassword] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(() => Boolean(lembrado()))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Quem chegou pelo link do e-mail precisa definir a nova senha antes de qualquer coisa.
  const modo: Mode = recovering ? 'reset' : mode

  if (session && !recovering) {
    return <Navigate to="/" replace />
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setSuccess(null)
    setPassword('')
    setConfirmacao('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    const { error: signInError } = await signIn(email.trim(), password)
    setSubmitting(false)
    if (signInError) {
      setError(signInError)
      return
    }
    guardarEmail(remember ? email.trim() : null)
    navigate('/', { replace: true })
  }

  const handleRecover = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    const { error: resetError } = await resetPassword(email.trim())
    setSubmitting(false)
    if (resetError) {
      setError('Não foi possível enviar o link de redefinição. Verifique o e-mail.')
      return
    }
    setSuccess('Se existir uma conta para este e-mail, enviaremos um link de redefinição.')
    toast.success('Link de redefinição enviado. Verifique seu e-mail.')
  }

  const handleReset = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < SENHA_MINIMA) {
      setError(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
      return
    }
    if (password !== confirmacao) {
      setError('As senhas não conferem.')
      return
    }
    setSubmitting(true)
    const { error: updateError } = await updatePassword(password)
    setSubmitting(false)
    if (updateError) {
      setError('Não foi possível alterar a senha. Peça um novo link e tente de novo.')
      return
    }
    toast.success('Senha alterada com sucesso!')
    navigate('/', { replace: true })
  }

  const passwordEndAdornment = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
      className="inline-flex items-center justify-center rounded border-none bg-transparent p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
    >
      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  )

  const mensagens = (
    <>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}
    </>
  )

  const voltarAoLogin = (
    <button
      type="button"
      onClick={() => switchMode('login')}
      className="self-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
    >
      Voltar ao login
    </button>
  )

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo className="h-24 w-auto" />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{APP_NAME}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{SUBTITLE[modo]}</p>
        </div>

        {modo === 'login' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="E-mail"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
            <Input
              label="Senha"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              endAdornment={passwordEndAdornment}
            />
            <div className="flex items-center justify-between gap-2">
              <Checkbox label="Lembrar usuário" checked={remember} onChange={setRemember} />
              <button
                type="button"
                onClick={() => switchMode('recover')}
                className="whitespace-nowrap text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                Esqueceu a senha?
              </button>
            </div>
            {mensagens}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        )}

        {modo === 'recover' && (
          <form onSubmit={handleRecover} className="flex flex-col gap-4">
            <Input
              label="E-mail"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
            {mensagens}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Enviando...' : 'Enviar link de redefinição'}
            </Button>
            {voltarAoLogin}
          </form>
        )}

        {modo === 'reset' && (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <Input
              label="Nova senha"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              required
              minLength={SENHA_MINIMA}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha"
              hint={`Mínimo de ${SENHA_MINIMA} caracteres`}
              endAdornment={passwordEndAdornment}
            />
            <Input
              label="Confirmar nova senha"
              type={showPassword ? 'text' : 'password'}
              name="password-confirm"
              autoComplete="new-password"
              required
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder="Repita a senha"
            />
            {mensagens}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </form>
        )}
      </Card>

      <Link
        to="/verificar"
        className="mt-4 text-sm font-medium text-slate-500 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white"
      >
        Verificar a autenticidade de um recibo
      </Link>
    </div>
  )
}
