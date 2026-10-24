import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { chaves } from '@/lib/queryClient'
import { ErroCarregamento } from '@/components/shared/ErroCarregamento'
import { FiltroPeriodo } from '@/components/shared/FiltroPeriodo'
import { Badge } from '@/components/ui/Badge'
import { FilterModal } from '@/components/ui/FilterModal'
import type { FilterGroup, FilterValues } from '@/components/ui/FilterModal'
import { contarFiltros } from '@/components/ui/contarFiltros'
import { PageLoader } from '@/components/ui/PageLoader'
import { Table } from '@/components/ui/Table'
import type { TableColumn } from '@/components/ui/Table'
import { useDebounce } from '@/hooks/useDebounce'
import { useHoje } from '@/hooks/useHoje'
import { formatDateTime } from '@/lib/utils'
import type { LinhaAuditoria } from '@/types'
import { opcoesDeAcao, rotuloAcao, tomAcao, type TomAcao } from './auditoria'
import { listarAuditoria, TAMANHO_PAGINA_AUDITORIA } from './auditoria.queries'

const VARIANTE: Record<TomAcao, 'success' | 'danger' | 'warning' | 'neutral'> = {
  sucesso: 'success',
  perigo: 'danger',
  aviso: 'warning',
  neutro: 'neutral',
}

const GRUPOS: FilterGroup[] = [{ key: 'acao', label: 'Tipo de registro', options: opcoesDeAcao() }]

/** Histórico de tudo que foi feito no sistema (quem, o quê e quando). Só o super usuário vê. */
export function HistoricoManager() {
  const hoje = useHoje()
  const [busca, setBusca] = useState('')
  const [filtros, setFiltros] = useState<FilterValues>({})
  const [filtroAberto, setFiltroAberto] = useState(false)
  const [de, setDe] = useState<string | null>(null)
  const [ate, setAte] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)

  const buscaAtrasada = useDebounce(busca, 300)
  const acoes = useMemo(() => filtros['acao'] ?? [], [filtros])

  const params = useMemo(
    () => ({ busca: buscaAtrasada.trim(), acoes, de, ate, pagina }),
    [buscaAtrasada, acoes, de, ate, pagina],
  )

  const consulta = useQuery({
    queryKey: chaves.auditoria(params),
    queryFn: () => listarAuditoria(params),
    placeholderData: keepPreviousData,
  })

  // Qualquer mudança de busca, filtro ou período volta para a primeira página.
  const aoBuscar = (texto: string) => {
    setBusca(texto)
    setPagina(1)
  }

  const colunas: TableColumn<LinhaAuditoria>[] = [
    { key: 'quando', header: 'Quando', render: (l) => formatDateTime(l.created_at) },
    { key: 'quem', header: 'Quem', render: (l) => l.usuario_nome ?? '—' },
    {
      key: 'acao',
      header: 'Registro',
      render: (l) => <Badge variant={VARIANTE[tomAcao(l.acao)]}>{rotuloAcao(l.acao)}</Badge>,
    },
    { key: 'galpao', header: 'Galpão', render: (l) => l.galpao_nome ?? '—' },
    {
      key: 'resumo',
      header: 'O que aconteceu',
      render: (l) => <span className="whitespace-normal break-words">{l.resumo}</span>,
    },
  ]

  if (consulta.isPending) return <PageLoader />

  if (consulta.isError && !consulta.data) {
    return (
      <ErroCarregamento
        mensagem="Não foi possível carregar o histórico. Verifique a conexão e tente novamente."
        onRetry={() => void consulta.refetch()}
      />
    )
  }

  const dados = consulta.data

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Histórico</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tudo o que foi feito no sistema: quem fez, o quê e quando. Os registros não podem ser
          editados nem apagados.
        </p>
      </div>

      <FiltroPeriodo
        hoje={hoje}
        de={de}
        ate={ate}
        onChange={(periodo) => {
          setDe(periodo.de)
          setAte(periodo.ate)
          setPagina(1)
        }}
        onLimpar={() => {
          setDe(null)
          setAte(null)
          setPagina(1)
        }}
      />

      <Table
        columns={colunas}
        data={dados?.itens ?? []}
        rowKey={(l) => l.id}
        serverSide
        total={dados?.total ?? 0}
        page={pagina}
        pageSize={TAMANHO_PAGINA_AUDITORIA}
        onPageChange={setPagina}
        busy={consulta.isPlaceholderData}
        emptyMessage="Nenhum registro encontrado"
        onSearch={aoBuscar}
        searchDefault={busca}
        onFilter={() => setFiltroAberto(true)}
        filterCount={contarFiltros(filtros)}
        searchPlaceholder="Buscar por pessoa ou texto..."
      />

      <FilterModal
        open={filtroAberto}
        onClose={() => setFiltroAberto(false)}
        groups={GRUPOS}
        values={filtros}
        onApply={(valores) => {
          setFiltros(valores)
          setPagina(1)
        }}
      />
    </div>
  )
}
