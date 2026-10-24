import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  AlertTriangle,
  Camera,
  Check,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  Warehouse,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme, type Theme } from '@/context/ThemeContext'
import { useGalpao } from '@/context/GalpaoContext'
import { useToast } from '@/components/ui/Toast'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useUserAvatar } from '@/features/auth/hooks/useUserAvatar'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const THEME_OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'Sistema', icon: Monitor },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
]

export function ProfileDropdown() {
  const { user, profile, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { galpoes, galpaoSelecionado, setGalpaoSelecionado } = useGalpao()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const initialFocusRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const nome = profile?.nome || user?.email?.split('@')[0] || 'Usuário'
  const email = user?.email ?? ''
  const cargo = profile?.is_super ? 'Super Usuário' : 'Usuário'

  const { avatar, handleFile } = useUserAvatar(user?.id ?? '', profile?.avatar_url)

  const getItems = () =>
    Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  const openMenu = (focusIndex: number) => {
    setOpen(true)
    initialFocusRef.current = focusIndex
  }

  useEffect(() => {
    if (!open) return
    const items = getItems()
    items[initialFocusRef.current ?? 0]?.focus()
    initialFocusRef.current = null
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const items = getItems()
      const current = items.indexOf(document.activeElement as HTMLElement)

      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
        return
      }

      if (event.key === 'Tab') {
        setOpen(false)
        return
      }

      let next: number
      if (event.key === 'ArrowDown') {
        next = current < 0 ? 0 : (current + 1) % items.length
      } else if (event.key === 'ArrowUp') {
        next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length
      } else if (event.key === 'Home') {
        next = 0
      } else if (event.key === 'End') {
        next = items.length - 1
      } else {
        return
      }

      event.preventDefault()
      items[next]?.focus()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu(event.key === 'ArrowDown' ? 0 : -1)
    }
  }

  const pickPhoto = () => fileInputRef.current?.click()

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setOpen(false)
    const erroFoto = await handleFile(file)
    if (erroFoto) {
      toast.error(erroFoto)
    } else {
      toast.success('Foto atualizada')
    }
  }

  const itemClass = (danger = false) =>
    cn(
      'flex w-full items-center gap-2 rounded-md px-3 text-sm transition-colors',
      'h-[38px] text-left',
      danger
        ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
    )

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handlePhotoChange}
      />

      <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:border-slate-700 dark:bg-slate-900">
        <span className="flex items-center gap-1.5 whitespace-nowrap pl-2 pr-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          <Warehouse size={14} className="shrink-0 text-primary-600 dark:text-primary-400" />
          {galpaoSelecionado?.nome ?? 'Sem galpão'}
        </span>

        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Menu do perfil — ${nome}`}
          onClick={() => (open ? setOpen(false) : openMenu(0))}
          onKeyDown={handleTriggerKeyDown}
          className="rounded-full transition-all duration-150 hover:scale-105 hover:shadow-[0_0_0_3px_rgba(50,167,216,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          <UserAvatar name={nome} avatar={avatar} size={32} />
        </button>
      </div>

      <div
        role="menu"
        aria-label="Menu do perfil"
        className={cn(
          'absolute right-0 top-[calc(100%+8px)] z-100 w-70 origin-top-right rounded-xl border border-slate-200 bg-white p-1 shadow-[0_10px_30px_rgba(0,0,0,0.15)] dark:border-slate-700 dark:bg-slate-900',
          open
            ? 'visible scale-100 opacity-100 transition-[opacity,transform] duration-200 ease-out'
            : 'pointer-events-none invisible scale-95 opacity-0 transition-[opacity,transform,visibility] duration-150 ease-in',
        )}
      >
        <div className="flex items-center gap-2 p-2">
          <UserAvatar name={nome} avatar={avatar} size={40} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {nome}
            </span>
            <span className="truncate text-xs text-slate-500 dark:text-slate-400">{email}</span>
            {cargo && (
              <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                {cargo}
              </span>
            )}
          </div>
        </div>

        <div className="mx-2 my-1 h-px bg-slate-200 dark:bg-slate-700" />

        {galpoes.length > 1 && (
          <>
            <div role="group" aria-label="Galpão" className="flex flex-col gap-1 px-2 py-1">
              <span className="px-1 text-xs font-semibold text-slate-400 dark:text-slate-500">
                Galpão
              </span>
              <div className="flex flex-col gap-0.5">
                {galpoes.map((g) => {
                  const ativo = g.id === galpaoSelecionado?.id
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      onClick={() => {
                        setGalpaoSelecionado(g)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                        ativo
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
                      )}
                    >
                      <Warehouse
                        size={16}
                        className={cn(
                          'shrink-0',
                          ativo ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400',
                        )}
                      />
                      <span className="flex-1 truncate">{g.nome}</span>
                      {ativo && (
                        <Check
                          size={16}
                          className="shrink-0 text-primary-600 dark:text-primary-400"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mx-2 my-1 h-px bg-slate-200 dark:bg-slate-700" />
          </>
        )}

        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={itemClass()}
          onClick={pickPhoto}
        >
          <Camera size={16} className="shrink-0" />
          Alterar foto
        </button>

        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={itemClass()}
          onClick={() => {
            setOpen(false)
            navigate('/configuracoes')
          }}
        >
          <Settings size={16} className="shrink-0" />
          Configurações
        </button>

        <div className="mx-2 my-1 h-px bg-slate-200 dark:bg-slate-700" />

        <div role="group" aria-label="Tema" className="flex flex-col gap-1 px-2 py-1">
          <span className="px-1 text-xs font-semibold text-slate-400 dark:text-slate-500">
            Tema do sistema
          </span>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1 rounded-md px-1 py-1.5 text-xs font-semibold transition-colors',
                  theme === value
                    ? 'bg-white text-primary-600 dark:bg-slate-900 dark:text-primary-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-2 my-1 h-px bg-slate-200 dark:bg-slate-700" />

        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={itemClass(true)}
          onClick={() => {
            setOpen(false)
            setLogoutOpen(true)
          }}
        >
          <LogOut size={16} className="shrink-0" />
          Sair
        </button>
      </div>

      <Modal open={logoutOpen} onClose={() => setLogoutOpen(false)} title="Atenção">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
            <AlertTriangle size={22} />
          </span>
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Tem certeza que deseja sair do sistema? Sua sessão será encerrada.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="text" onClick={() => setLogoutOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setLogoutOpen(false)
              signOut()
              navigate('/login', { replace: true })
            }}
          >
            Sair
          </Button>
        </div>
      </Modal>
    </div>
  )
}
