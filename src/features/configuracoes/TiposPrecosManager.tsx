import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/queryClient'
import { useGalpao } from '@/context/GalpaoContext'
import { ErroCarregamento } from '@/components/shared/ErroCarregamento'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import { FilterModal } from '@/components/ui/FilterModal'
import type { FilterGroup, FilterValues } from '@/components/ui/FilterModal'
import { contarFiltros } from '@/components/ui/contarFiltros'
import type { TableAction, TableColumn } from '@/components/ui/Table'
import { PageLoader } from '@/components/ui/PageLoader'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import type { PrecoGalpao, TipoItem } from '@/types'
import { TipoModal } from './TipoModal'

/** Tipo aberto no modal (null = tipo novo); fechado quando não há modal. */
type ModalState = { tipo: TipoItem | null } | null

async function buscarTipos(): Promise<TipoItem[]> {
  const { data, error } = await supabase
    .from('tipos_item')
    .select('*')
    .order('nome', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as TipoItem[]) ?? []
}

async function buscarTodosOsPrecos(): Promise<PrecoGalpao[]> {
  const { data, error } = await supabase.from('precos_galpao').select('*')
  if (error) throw new Error(error.message)
  return (data as PrecoGalpao[]) ?? []
}

export function TiposPrecosManager() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { galpoes } = useGalpao()

  const [modal, setModal] = useState<ModalState>(null)
  const [busca, setBusca] = useState('')
  const [filtros, setFiltros] = useState<FilterValues>({})
  const [filtroAberto, setFiltroAberto] = useState(false)

  const tiposQuery = useQuery({ queryKey: chaves.tipos, queryFn: buscarTipos })
  const precosQuery = useQuery({ queryKey: chaves.precosTodos, queryFn: buscarTodosOsPrecos })
  const tipos = useMemo(() => tiposQuery.data ?? [], [tiposQuery.data])
  const precos = useMemo(() => precosQuery.data ?? [], [precosQuery.data])

  // Depois de salvar, atualiza por trás (sem "Carregando...") e avisa as telas que usam estes preços.
  const atualizar = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: chaves.tipos }),
      queryClient.invalidateQueries({ queryKey: chaves.precosTodos }),
      queryClient.invalidateQueries({ queryKey: ['galpao-dados'] }),
    ])
  }

  const precoProprio = (tipoId: string, galpaoId: string): PrecoGalpao | undefined =>
    precos.find((p) => p.tipo_item_id === tipoId && p.galpao_id === galpaoId)

  const precoNoGalpao = (tipo: TipoItem, galpaoId: string): number => {
    const proprio = precoProprio(tipo.id, galpaoId)
    return Number(proprio ? proprio.preco_semanal : tipo.preco_semanal)
  }

  const gruposDeFiltro: FilterGroup[] = [
    {
      key: 'preco',
      label: 'Preço',
      options: [
        { value: 'proprio', label: 'Com preço próprio em algum galpão' },
        { value: 'padrao', label: 'Só com o preço padrão' },
      ],
    },
    {
      key: 'galpao',
      label: 'Mostrar galpões',
      options: galpoes.map((g) => ({ value: g.id, label: g.nome })),
    },
  ]

  const tiposFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const preco = filtros['preco'] ?? []
    return tipos.filter((t) => {
      if (termo && !t.nome.toLowerCase().includes(termo)) return false
      if (preco.length === 1) {
        const temProprio = precos.some((p) => p.tipo_item_id === t.id)
        if (preco.includes('proprio') !== temProprio) return false
      }
      return true
    })
  }, [tipos, precos, busca, filtros])

  // Sem galpão marcado no filtro, todas as colunas aparecem.
  const escolhidos = filtros['galpao'] ?? []
  const galpoesVisiveis = escolhidos.length > 0 ? galpoes.filter((g) => escolhidos.includes(g.id)) : galpoes

  const abrirNovoTipo = () => setModal({ tipo: null })
  const abrirEditarTipo = (tipo: TipoItem) => setModal({ tipo })

  const excluirTipo = async (tipo: TipoItem) => {
    if (
      !window.confirm(
        `Excluir o tipo "${tipo.nome}"? Os preços próprios dele serão apagados. Tipos em uso por clientes não podem ser excluídos: desative-os.`,
      )
    ) {
      return
    }
    const { error } = await supabase.from('tipos_item').delete().eq('id', tipo.id)
    if (error) {
      // o banco recusa tipo em uso e já explica em português
      toast.error(error.code === 'P0001' ? error.message : 'Erro ao excluir tipo.')
      return
    }
    toast.success('Tipo excluído.')
    await atualizar()
  }

  // Desativar tira o tipo das opções de novos itens, sem mexer em quem já usa.
  const alternarAtivo = async (tipo: TipoItem) => {
    const { error } = await supabase.from('tipos_item').update({ ativo: !tipo.ativo }).eq('id', tipo.id)
    if (error) {
      toast.error('Erro ao alterar o tipo.')
      return
    }
    toast.success(tipo.ativo ? 'Tipo desativado.' : 'Tipo ativado.')
    await atualizar()
  }

  if (tiposQuery.isPending || precosQuery.isPending) return <PageLoader />

  if (tiposQuery.isError || precosQuery.isError) {
    return (
      <ErroCarregamento
        mensagem="Não foi possível carregar os tipos e preços."
        onRetry={() => {
          void tiposQuery.refetch()
          void precosQuery.refetch()
        }}
      />
    )
  }

  // Mesma tabela das outras telas: uma coluna por galpão, gerada a partir da lista de galpões.
  const colunas: TableColumn<TipoItem>[] = [
    {
      key: 'tipo',
      header: 'Tipo',
      render: (t) => (
        <span className="inline-flex items-center gap-2">
          {t.nome}
          {!t.ativo && <Badge variant="neutral">Inativo</Badge>}
        </span>
      ),
    },
    {
      key: 'padrao',
      header: 'Padrão',
      align: 'right',
      render: (t) => formatCurrency(Number(t.preco_semanal)),
    },
    ...galpoesVisiveis.map(
      (g): TableColumn<TipoItem> => ({
        key: `galpao-${g.id}`,
        header: g.nome,
        align: 'right',
        render: (t) => formatCurrency(precoNoGalpao(t, g.id)),
      }),
    ),
  ]

  const acoes: TableAction<TipoItem>[] = [
    { icon: Pencil, label: 'Editar tipo', variant: 'info', onClick: abrirEditarTipo },
    {
      icon: EyeOff,
      label: 'Desativar tipo',
      hidden: (t) => !t.ativo,
      onClick: (t) => void alternarAtivo(t),
    },
    {
      icon: Eye,
      label: 'Ativar tipo',
      hidden: (t) => t.ativo,
      onClick: (t) => void alternarAtivo(t),
    },
    { icon: Trash2, label: 'Excluir tipo', variant: 'danger', onClick: (t) => void excluirTipo(t) },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tipos e preços</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Preço semanal de cada tipo de item em cada galpão. Use o lápis para editar o tipo e os
            preços de todos os galpões de uma vez.
          </p>
        </div>
        <Button variant="secondary" onClick={abrirNovoTipo} className="shrink-0">
          <Plus size={16} />
          Novo tipo
        </Button>
      </div>

      <Table
        columns={colunas}
        data={tiposFiltrados}
        rowKey={(t) => t.id}
        emptyMessage="Nenhum tipo encontrado"
        onSearch={setBusca}
        onFilter={() => setFiltroAberto(true)}
        filterCount={contarFiltros(filtros)}
        searchPlaceholder="Buscar tipo..."
        actions={acoes}
      />

      <FilterModal
        open={filtroAberto}
        onClose={() => setFiltroAberto(false)}
        groups={gruposDeFiltro}
        values={filtros}
        onApply={setFiltros}
      />

      {galpoes.length === 0 && tipos.length > 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cadastre um galpão na aba Galpões para definir preços por galpão.
        </p>
      )}

      <TipoModal
        open={modal !== null}
        tipo={modal?.tipo ?? null}
        galpoes={galpoes}
        precos={precos}
        onClose={() => setModal(null)}
        onSaved={atualizar}
      />
    </div>
  )
}
