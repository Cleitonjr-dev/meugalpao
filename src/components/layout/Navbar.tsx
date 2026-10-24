import { useState } from 'react'
import { NavLink } from 'react-router'
import { Menu, X } from 'lucide-react'
import { ProfileDropdown } from '@/components/shared/ProfileDropdown'
import { Logo } from '@/components/shared/Logo'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Cobranças', end: true },
  { to: '/clientes', label: 'Clientes' },
  { to: '/pagamentos', label: 'Pagamentos' },
  { to: '/recibos', label: 'Recibos' },
  { to: '/relatorios', label: 'Relatórios' },
  { to: '/fechamento', label: 'Fechamento' },
  { to: '/configuracoes', label: 'Configurações' },
]

function navLinkClass(isActive: boolean) {
  return cn(
    'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary-600 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
  )
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-16 w-full items-center gap-3 px-4 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2.5" onClick={() => setMenuOpen(false)}>
          <Logo className="h-10 w-auto" />
          <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            MeuGalpão
          </span>
        </NavLink>

        <nav className="ml-8 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ProfileDropdown />
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <nav className="border-t border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => navLinkClass(isActive)}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
