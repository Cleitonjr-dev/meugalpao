import { useState, type FormEvent } from 'react'
import { Trash2, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Tooltip } from '@/components/ui/Tooltip'
import { SeletorQuantidade } from './SeletorQuantidade'
import { cn, formatCurrency } from '@/lib/utils'
import { precoEfetivo } from '@/utils/valor'
import type { ItemGuardado, PrecoGalpao, TipoItem } from '@/types'
import {
  RASCUNHO_VAZIO,
  novaChave,
  validarRascunho,
  type ItemNovo,
  type RascunhoItem,
} from './itens'

interface ItensEditorProps {
  tipos: TipoItem[]
  precos: PrecoGalpao[]
  /** Itens que já estão gravados para este cliente */
  salvos: ItemGuardado[]
  /** Ids de itens gravados marcados para remover ao salvar */
  removidos: string[]
  /** Itens incluídos agora, ainda não gravados */
  novos: ItemNovo[]
  /** Mudança de quantidade em itens gravados (id -> diferença, pode ser negativa) */
  ajustes: Record<string, number>
  rascunho: RascunhoItem
  desabilitado: boolean
  onRascunhoChange: (rascunho: RascunhoItem) => void
  onAdicionar: (item: ItemNovo) => void
  onAlternarRemocao: (id: string) => void
  onAlterarQuantidade: (item: ItemGuardado, passo: number) => void
  onDesfazerAjuste: (id: string) => void
  onAlterarQuantidadeNovo: (chave: string, passo: number) => void
  onRemoverNovo: (chave: string) => void
}

const BOTAO_ICONE =
  'shrink-0 rounded p-1 text-slate-400 transition-colors disabled:opacity-50 dark:text-slate-500'
const BOTAO_REMOVER = `${BOTAO_ICONE} hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400`
const BOTAO_MANTER = `${BOTAO_ICONE} hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white`

/**
 * Lista e formulário de itens guardados. As alterações ficam só na tela: quem grava no banco
 * é o botão Salvar do modal (ClienteModal), que também descarta tudo se o modal for fechado.
 */
export function ItensEditor({
  tipos,
  precos,
  salvos,
  removidos,
  novos,
  ajustes,
  rascunho,
  desabilitado,
  onRascunhoChange,
  onAdicionar,
  onAlternarRemocao,
  onAlterarQuantidade,
  onDesfazerAjuste,
  onAlterarQuantidadeNovo,
  onRemoverNovo,
}: ItensEditorProps) {
  const [erro, setErro] = useState<string | null>(null)

  const nomeTipo = (tipoItemId: string | null): string =>
    tipos.find((t) => t.id === tipoItemId)?.nome ?? 'Sem tipo'

  const descricao = (tipoItemId: string | null, identificacao: string | null) =>
    `${nomeTipo(tipoItemId)}${identificacao ? ` — ${identificacao}` : ''}`

  const valor = (tipoItemId: string | null, quantidade: number) =>
    formatCurrency(precoEfetivo(tipoItemId, precos, tipos) * quantidade)

  const adicionar = (e: FormEvent) => {
    e.preventDefault()
    const resultado = validarRascunho(rascunho)
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setErro(null)
    onAdicionar({ chave: novaChave(), ...resultado.item })
    onRascunhoChange(RASCUNHO_VAZIO)
  }

  const opcoesDeTipo = tipos
    .filter((t) => t.ativo)
    .map((t) => ({
      value: t.id,
      // mostra o preço que realmente vale neste galpão (preço próprio ou padrão)
      label: `${t.nome} (${formatCurrency(precoEfetivo(t.id, precos, tipos))})`,
    }))

  const semItens = salvos.length === 0 && novos.length === 0

  return (
    <div className="flex flex-col">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Itens guardados
      </h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        As alterações só são gravadas quando você clicar em Salvar e valem a partir das próximas
        cobranças. Pagamentos já feitos não mudam.
      </p>

      {semItens && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Nenhum item cadastrado ainda.
        </p>
      )}

      <ul className="mt-2 flex max-h-60 flex-col gap-2 overflow-y-auto pr-1">
        {salvos.map((item) => {
          const marcado = removidos.includes(item.id)
          const diferenca = marcado ? 0 : (ajustes[item.id] ?? 0)
          const quantidade = item.quantidade + diferenca
          return (
            <li
              key={item.id}
              className="flex min-h-[40px] w-full items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200',
                  marcado && 'text-slate-400 line-through dark:text-slate-500',
                )}
              >
                {descricao(item.tipo_item_id, item.identificacao)}
              </span>
              {marcado ? (
                <Badge variant="warning">Será removido</Badge>
              ) : (
                <>
                  {diferenca !== 0 && (
                    <Badge variant={diferenca > 0 ? 'primary' : 'warning'}>
                      {item.quantidade} → {quantidade}
                    </Badge>
                  )}
                  <SeletorQuantidade
                    valor={quantidade}
                    desabilitado={desabilitado}
                    onMenos={() => onAlterarQuantidade(item, -1)}
                    onMais={() => onAlterarQuantidade(item, 1)}
                    textoMenos={quantidade === 1 ? 'Remover item' : 'Diminuir quantidade'}
                  />
                  <span className="w-20 shrink-0 text-right text-slate-500 dark:text-slate-400">
                    {valor(item.tipo_item_id, quantidade)}
                  </span>
                </>
              )}
              {diferenca !== 0 && (
                <Tooltip texto="Desfazer a mudança de quantidade">
                  <button
                    type="button"
                    onClick={() => onDesfazerAjuste(item.id)}
                    disabled={desabilitado}
                    aria-label="Desfazer a mudança de quantidade"
                    className={BOTAO_MANTER}
                  >
                    <Undo2 size={16} />
                  </button>
                </Tooltip>
              )}
              <Tooltip texto={marcado ? 'Manter item' : 'Remover item'}>
                <button
                  type="button"
                  onClick={() => onAlternarRemocao(item.id)}
                  disabled={desabilitado}
                  aria-label={marcado ? 'Manter item' : 'Remover item'}
                  className={marcado ? BOTAO_MANTER : BOTAO_REMOVER}
                >
                  {marcado ? <Undo2 size={16} /> : <Trash2 size={16} />}
                </button>
              </Tooltip>
            </li>
          )
        })}

        {novos.map((item) => (
          <li
            key={item.chave}
            className="flex min-h-[40px] w-full items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-1 text-sm dark:border-primary-900 dark:bg-primary-950/40"
          >
            <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
              {descricao(item.tipo_item_id, item.identificacao)}
            </span>
            <Badge variant="primary">Novo</Badge>
            <SeletorQuantidade
              valor={item.quantidade}
              desabilitado={desabilitado}
              semMenos={item.quantidade <= 1}
              onMenos={() => onAlterarQuantidadeNovo(item.chave, -1)}
              onMais={() => onAlterarQuantidadeNovo(item.chave, 1)}
            />
            <span className="w-20 shrink-0 text-right text-slate-500 dark:text-slate-400">
              {valor(item.tipo_item_id, item.quantidade)}
            </span>
            <Tooltip texto="Remover item">
              <button
                type="button"
                onClick={() => onRemoverNovo(item.chave)}
                disabled={desabilitado}
                aria-label="Remover item"
                className={BOTAO_REMOVER}
              >
                <Trash2 size={16} />
              </button>
            </Tooltip>
          </li>
        ))}
      </ul>

      <form
        onSubmit={adicionar}
        className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40"
      >
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Adicionar item</p>

        <Select
          label="Tipo do item"
          value={rascunho.tipoId}
          onChange={(tipoId) => onRascunhoChange({ ...rascunho, tipoId })}
          options={opcoesDeTipo}
          placeholder="Selecione o tipo..."
        />

        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
          <Input
            label="Identificação"
            placeholder="Ex.: placa (opcional)"
            value={rascunho.identificacao}
            onChange={(e) => onRascunhoChange({ ...rascunho, identificacao: e.target.value })}
          />
          <Input
            label="Qtd."
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={rascunho.quantidade}
            onChange={(e) => onRascunhoChange({ ...rascunho, quantidade: e.target.value })}
          />
        </div>

        {erro && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {erro}
          </p>
        )}

        <Button
          type="submit"
          variant="secondary"
          disabled={desabilitado || !rascunho.tipoId}
          className="w-full"
        >
          Adicionar à lista
        </Button>
      </form>
    </div>
  )
}
