import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/Card'
import { PageLoader } from '@/components/ui/PageLoader'
import { GalpoesManager } from './GalpoesManager'
import { UsuariosManager } from './UsuariosManager'
import { TiposPrecosManager } from './TiposPrecosManager'
import { HistoricoManager } from './HistoricoManager'
import { cn } from '@/lib/utils'

type Tab = 'galpoes' | 'usuarios' | 'precos' | 'historico'

export function ConfiguracoesPage() {
  const { profile, profileLoading } = useAuth()
  const [tab, setTab] = useState<Tab>('galpoes')
  const isSuper = profile?.is_super ?? false

  const selecionar = (t: Tab) => setTab(t)

  if (profileLoading) return <PageLoader />

  if (!isSuper) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Configurações</h1>
        <Card className="p-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Apenas o super usuário pode gerenciar galpões e usuários.
          </p>
        </Card>
      </div>
    )
  }

  const tabClass = (t: Tab) =>
    cn(
      'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
      tab === t
        ? 'bg-primary-600 text-white'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
    )

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Configurações</h1>

      <div className="flex gap-2">
        <button type="button" onClick={() => selecionar('galpoes')} className={tabClass('galpoes')}>
          Galpões
        </button>
        <button
          type="button"
          onClick={() => selecionar('usuarios')}
          className={tabClass('usuarios')}
        >
          Usuários
        </button>
        <button type="button" onClick={() => selecionar('precos')} className={tabClass('precos')}>
          Tipos e Preços
        </button>
        <button
          type="button"
          onClick={() => selecionar('historico')}
          className={tabClass('historico')}
        >
          Histórico
        </button>
      </div>

      {tab === 'galpoes' && <GalpoesManager />}
      {tab === 'usuarios' && <UsuariosManager />}
      {tab === 'precos' && <TiposPrecosManager />}
      {tab === 'historico' && <HistoricoManager />}
    </div>
  )
}
