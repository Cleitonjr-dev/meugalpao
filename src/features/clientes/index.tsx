import { useMemo, useState } from 'react'
import { Download, Pencil, Trash2 } from 'lucide-react'
import { useGalpao } from '@/context/GalpaoContext'
import { useGalpaoDados } from '@/context/GalpaoDadosContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { useGuardaPagina } from '@/components/shared/useGuardaPagina'
import { useToast } from '@/components/ui/Toast'
import { Table } from '@/components/ui/Table'
import type { TableAction, TableColumn } from '@/components/ui/Table'
import { FilterModal } from '@/components/ui/FilterModal'
import { contarFiltros } from '@/components/ui/contarFiltros'
import type { FilterGroup, FilterValues } from '@/components/ui/FilterModal'
import { ClienteModal } from './ClienteModal'
import { formatCurrency } from '@/lib/utils'
import { dataLocalISO, formatarDataBR } from '@/utils/recibo'
import { filtrarClientes } from '@/utils/clientes'
import { baixarCsv, gerarCsv, reaisCsv } from '@/utils/csv'
import { useHoje } from '@/hooks/useHoje'
import { valorSemanal } from '@/utils/valor'
import { Badge } from '@/components/ui/Badge'
import { DIAS_PAGAMENTO, DIAS_PAGAMENTO_LABEL } from '@/config/constants'
import type { Cliente } from '@/types'

const FILTER_GROUPS: FilterGroup[] = [
  {
    key: 'dia',
    label: 'Dia de pagamento',
    options: DIAS_PAGAMENTO.map((d) => ({ value: d, label: DIAS_PAGAMENTO_LABEL[d] })),
  },
  {
    key: 'ativo',
    label: 'Status',
    options: [
      { value: 'ativo', label: 'Ativo' },
      { value: 'inativo', label: 'Inativo' },
    ],
  },
]

export function ClientesPage() {
  const guarda = useGuardaPagina()
  const toast = useToast()
  const { galpaoSelecionado } = useGalpao()
  const { clientes, itens, tipos, precos, recarregar } = useGalpaoDados()
  const hoje = useHoje()
  const [busca, setBusca] = useState('')
  const [filtros, setFiltros] = useState<FilterValues>({})
  const [filtroAberto, setFiltroAberto] = useState(false)
  const [formAberto, setFormAberto] = useState(false)
  const [clienteEdicao, setClienteEdicao] = useState<Cliente | null>(null)

  const filtrados = useMemo(() => {
    let resultado = filtrarClientes(clientes, busca)

    const dia = filtros['dia'] ?? []
    if (dia.length > 0) resultado = resultado.filter((c) => dia.includes(c.dia_pagamento))

    const ativo = filtros['ativo'] ?? []
    if (ativo.length === 1) {
      const somenteAtivos = ativo.includes('ativo')
      resultado = resultado.filter((c) => c.ativo === somenteAtivos)
    }

    return resultado
  }, [clientes, busca, filtros])

  const valoresSemanais = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const c of clientes) mapa.set(c.id, valorSemanal(c.id, itens, precos, tipos))
    return mapa
  }, [clientes, itens, precos, tipos])

  const exportar = () => {
    const colunas = [
      'Nome',
      'Telefone',
      'WhatsApp',
      'Dia de pagamento',
      'Situação',
      'Valor semanal',
      'Observações',
      'Cadastro',
    ]
    const linhas = filtrados.map((c) => [
      c.nome,
      c.telefone,
      c.whatsapp,
      DIAS_PAGAMENTO_LABEL[c.dia_pagamento],
      c.ativo ? 'Ativo' : 'Inativo',
      reaisCsv(valoresSemanais.get(c.id) ?? 0),
      c.observacoes,
      formatarDataBR(c.created_at),
    ])
    baixarCsv(`clientes-${dataLocalISO(hoje)}.csv`, gerarCsv(colunas, linhas))
    toast.success(`${linhas.length} cliente${linhas.length === 1 ? '' : 's'} exportado${linhas.length === 1 ? '' : 's'}.`)
  }

  const abrirNovo = () => {
    setClienteEdicao(null)
    setFormAberto(true)
  }

  const abrirEditar = (cliente: Cliente) => {
    setClienteEdicao(cliente)
    setFormAberto(true)
  }

  const excluir = async (cliente: Cliente) => {
    if (
      !window.confirm(
        `Excluir "${cliente.nome}"? Isso apaga também os itens guardados.\n\nClientes que já têm pagamentos não podem ser excluídos: deixe-os inativos.`,
      )
    ) {
      return
    }
    const { error } = await supabase.from('clientes').delete().eq('id', cliente.id)
    if (error) {
      // 23503 = violação de chave estrangeira (existem pagamentos)
      toast.error(
        error.code === '23503'
          ? 'Este cliente tem pagamentos registrados e não pode ser excluído. Marque-o como inativo.'
          : 'Não foi possível excluir o cliente.',
      )
      return
    }
    toast.success('Cliente excluído.')
    void recarregar()
  }

  const columns: TableColumn<Cliente>[] = [
    { key: 'nome', header: 'Nome', render: (c) => c.nome },
    { key: 'telefone', header: 'Telefone', render: (c) => c.telefone ?? '—' },
    { key: 'whatsapp', header: 'WhatsApp', render: (c) => c.whatsapp ?? '—' },
    {
      key: 'dia',
      header: 'Dia de pagamento',
      render: (c) => DIAS_PAGAMENTO_LABEL[c.dia_pagamento],
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <Badge variant={c.ativo ? 'success' : 'neutral'}>{c.ativo ? 'Ativo' : 'Inativo'}</Badge>
      ),
    },
    { key: 'cadastro', header: 'Data de cadastro', render: (c) => formatarDataBR(c.created_at) },
    {
      key: 'valor',
      header: 'Valor semanal',
      align: 'right',
      render: (c) => formatCurrency(valoresSemanais.get(c.id) ?? 0),
    },
  ]

  const actions: TableAction<Cliente>[] = [
    { icon: Pencil, label: 'Editar', variant: 'info', onClick: (c) => abrirEditar(c) },
    { icon: Trash2, label: 'Excluir', variant: 'danger', onClick: (c) => excluir(c) },
  ]

  if (guarda) return guarda
  if (!galpaoSelecionado) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Clientes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Galpão: {galpaoSelecionado.nome}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={exportar} disabled={filtrados.length === 0}>
            <Download size={16} />
            Exportar
          </Button>
          <Button onClick={abrirNovo}>Novo cliente</Button>
        </div>
      </div>

      <Table
        columns={columns}
        data={filtrados}
        rowKey={(c) => c.id}
        emptyMessage="Nenhum cliente encontrado"
        onSearch={setBusca}
        onFilter={() => setFiltroAberto(true)}
        filterCount={contarFiltros(filtros)}
        searchPlaceholder="Buscar nome, telefone ou WhatsApp..."
        actions={actions}
      />

      <FilterModal
        open={filtroAberto}
        onClose={() => setFiltroAberto(false)}
        groups={FILTER_GROUPS}
        values={filtros}
        onApply={setFiltros}
      />

      <ClienteModal
        open={formAberto}
        cliente={clienteEdicao}
        galpaoId={galpaoSelecionado.id}
        tipos={tipos}
        precos={precos}
        itens={itens}
        onClose={() => setFormAberto(false)}
        onSaved={() => void recarregar()}
      />
    </div>
  )
}
