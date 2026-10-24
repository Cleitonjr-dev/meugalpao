import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MapPin, Pencil, Plus, Trash2, UserCog, Users, Warehouse } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/queryClient'
import { useGalpao } from '@/context/GalpaoContext'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/PageLoader'
import { useToast } from '@/components/ui/Toast'
import { Tooltip } from '@/components/ui/Tooltip'
import { ConfirmarSenhaModal } from '@/components/shared/ConfirmarSenhaModal'
import { cn } from '@/lib/utils'
import type { Galpao } from '@/types'
import { useResumoGalpoes } from './useResumoGalpoes'

const ICON_BTN =
  'inline-flex shrink-0 items-center justify-center rounded-md bg-transparent p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-white'
const ICON_BTN_DANGER =
  'inline-flex shrink-0 items-center justify-center rounded-md bg-transparent p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950 dark:hover:text-red-400'

type ModalState = { kind: 'novo' } | { kind: 'editar'; galpao: Galpao } | null

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`
}

export function GalpoesManager() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { galpoes, loading, recarregar } = useGalpao()
  const resumo = useResumoGalpoes(galpoes).data
  const [modal, setModal] = useState<ModalState>(null)
  const [formNome, setFormNome] = useState('')
  const [formEndereco, setFormEndereco] = useState('')
  const [saving, setSaving] = useState(false)
  const [excluindo, setExcluindo] = useState<Galpao | null>(null)
  const [confirmaNome, setConfirmaNome] = useState('')

  const abrirNovo = () => {
    setFormNome('')
    setFormEndereco('')
    setModal({ kind: 'novo' })
  }

  const abrirEditar = (galpao: Galpao) => {
    setFormNome(galpao.nome)
    setFormEndereco(galpao.endereco ?? '')
    setModal({ kind: 'editar', galpao })
  }

  const fecharModal = () => {
    if (saving) return
    setModal(null)
  }

  const atualizarTudo = () => {
    void recarregar()
    void queryClient.invalidateQueries({ queryKey: chaves.usuarios })
    void queryClient.invalidateQueries({ queryKey: chaves.resumoGalpoes })
  }

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    const nome = formNome.trim()
    if (!nome || !modal) return
    const dados = { nome, endereco: formEndereco.trim() || null }
    const editando = modal.kind === 'editar'

    setSaving(true)
    const { error } = editando
      ? await supabase.from('galpoes').update(dados).eq('id', modal.galpao.id)
      : await supabase.from('galpoes').insert(dados)
    setSaving(false)

    if (error) {
      toast.error(editando ? 'Erro ao salvar o galpão.' : 'Erro ao criar o galpão.')
      return
    }
    setModal(null)
    toast.success(editando ? 'Galpão atualizado.' : 'Galpão criado.')
    atualizarTudo()
  }

  // Excluir é protegido em três camadas: digitar o nome, confirmar a senha e o banco, que recusa
  // galpões com pagamentos (o histórico financeiro nunca é apagado).
  const abrirExclusao = (galpao: Galpao) => {
    setConfirmaNome('')
    setExcluindo(galpao)
  }

  const fecharExclusao = () => {
    setExcluindo(null)
    setConfirmaNome('')
  }

  /** Chamada depois que a senha foi confirmada. Devolve a mensagem de erro, ou null se deu certo. */
  const confirmarExclusao = async (): Promise<string | null> => {
    if (!excluindo) return null
    const { error } = await supabase.from('galpoes').delete().eq('id', excluindo.id)
    if (error) {
      // as mensagens do banco (ex.: galpão com pagamentos) já vêm em português
      return error.code === 'P0001' ? error.message : 'Erro ao excluir o galpão.'
    }
    queryClient.removeQueries({ queryKey: chaves.dados(excluindo.id) })
    toast.success('Galpão excluído.')
    atualizarTudo()
    return null
  }

  if (loading) return <PageLoader />

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Galpões</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cadastre os galpões com o endereço de cada um. Renomear ou excluir também é por aqui.
          </p>
        </div>
        <Button variant="secondary" onClick={abrirNovo} className="shrink-0">
          <Plus size={16} />
          Novo galpão
        </Button>
      </div>

      {galpoes.length === 0 ? (
        <EmptyState
          title="Nenhum galpão cadastrado"
          description="Crie o primeiro galpão para começar."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {galpoes.map((g) => {
            const numeros = resumo?.[g.id]
            return (
              <li
                key={g.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
                    <Warehouse size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-slate-900 dark:text-white">
                      {g.nome}
                    </h3>
                    <p className="mt-0.5 flex items-start gap-1 text-sm text-slate-500 dark:text-slate-400">
                      <MapPin size={14} className="mt-0.5 shrink-0" />
                      {g.endereco ? (
                        <span className="break-words">{g.endereco}</span>
                      ) : (
                        <span className="italic text-slate-400 dark:text-slate-500">
                          Sem endereço cadastrado
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="-mr-1 -mt-1 flex shrink-0">
                    <Tooltip texto="Editar galpão">
                      <button
                        type="button"
                        aria-label="Editar galpão"
                        onClick={() => abrirEditar(g)}
                        className={ICON_BTN}
                      >
                        <Pencil size={16} />
                      </button>
                    </Tooltip>
                    <Tooltip texto="Excluir galpão">
                      <button
                        type="button"
                        aria-label="Excluir galpão"
                        onClick={() => abrirExclusao(g)}
                        disabled={saving}
                        className={cn(ICON_BTN_DANGER, 'disabled:opacity-50')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-200 pt-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={15} className="text-slate-400 dark:text-slate-500" />
                    {numeros ? plural(numeros.clientes, 'cliente ativo', 'clientes ativos') : '—'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <UserCog size={15} className="text-slate-400 dark:text-slate-500" />
                    {numeros ? plural(numeros.usuarios, 'usuário', 'usuários') : '—'}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={modal !== null}
        title={modal?.kind === 'editar' ? 'Editar galpão' : 'Novo galpão'}
        onClose={fecharModal}
        size="sm"
      >
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <Input
            label="Nome"
            value={formNome}
            onChange={(e) => setFormNome(e.target.value)}
            placeholder="Nome do galpão"
            autoFocus
          />
          <Input
            label="Endereço"
            value={formEndereco}
            onChange={(e) => setFormEndereco(e.target.value)}
            placeholder="Rua, número e bairro (opcional)"
            hint="Aparece no cartão do galpão."
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={fecharModal} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} disabled={!formNome.trim()}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmarSenhaModal
        open={excluindo !== null}
        titulo="Excluir galpão"
        textoBotao="Excluir galpão"
        perigo
        podeConfirmar={confirmaNome.trim() === excluindo?.nome}
        descricao={
          <>
            Excluir o galpão <strong>{excluindo?.nome}</strong> apaga os clientes, itens e preços dele e não dá
            para desfazer. Galpões que já têm pagamentos registrados <strong>não podem ser excluídos</strong>:
            o histórico financeiro é preservado.
          </>
        }
        onConfirmar={confirmarExclusao}
        onClose={fecharExclusao}
      >
        <Input
          label="Digite o nome do galpão para confirmar"
          value={confirmaNome}
          onChange={(e) => setConfirmaNome(e.target.value)}
          placeholder={excluindo?.nome}
          autoComplete="off"
        />
      </ConfirmarSenhaModal>
    </div>
  )
}
