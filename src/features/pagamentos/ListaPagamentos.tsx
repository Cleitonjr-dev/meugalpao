import { useCallback, useState } from 'react'
import { Ban, Download, ShieldCheck } from 'lucide-react'
import { useGalpao } from '@/context/GalpaoContext'
import { useGalpaoDados } from '@/context/GalpaoDadosContext'
import { useGuardaPagina } from '@/components/shared/useGuardaPagina'
import { ConfirmarSenhaModal } from '@/components/shared/ConfirmarSenhaModal'
import { ErroCarregamento } from '@/components/shared/ErroCarregamento'
import { FiltroPeriodo } from '@/components/shared/FiltroPeriodo'
import { PageLoader } from '@/components/ui/PageLoader'
import { Table } from '@/components/ui/Table'
import type { TableAction, TableColumn } from '@/components/ui/Table'
import { FilterModal } from '@/components/ui/FilterModal'
import type { FilterGroup, FilterValues } from '@/components/ui/FilterModal'
import { contarFiltros } from '@/components/ui/contarFiltros'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useHoje } from '@/hooks/useHoje'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { formatarDataBR, formatarNumeroRecibo } from '@/utils/recibo'
import { formatarCodigo } from '@/utils/codigo'
import { FORMAS_PAGAMENTO, FORMAS_PAGAMENTO_LABEL, STATUS_PAGAMENTO_LABEL } from '@/config/constants'
import type { FormaPagamento, LinhaPagamento, StatusPagamento } from '@/types'
import { cancelarPagamento } from './pagamentos.service'
import { TAMANHO_PAGINA } from './pagamentos.queries'
import { exportarPagamentosCsv, LIMITE_EXPORTACAO } from './exportarPagamentos'
import { dataLocalISO } from '@/utils/recibo'
import { montarDadosRecibo } from './recibo'
import { useReciboAcoes } from './useReciboAcoes'
import { useBuscaNaUrl, useFiltrosLista, usePagamentosPaginados } from './useListaPagamentos'
import { VerificarReciboModal } from '@/features/verificacao/VerificarReciboModal'
import { VerificarCodigoModal } from '@/features/verificacao/VerificarCodigoModal'

const FILTER_GROUPS: FilterGroup[] = [
  {
    key: 'forma',
    label: 'Forma de pagamento',
    options: FORMAS_PAGAMENTO.map((f) => ({ value: f, label: FORMAS_PAGAMENTO_LABEL[f] })),
  },
  {
    key: 'status',
    label: 'Situação',
    options: [
      { value: 'pago', label: 'Pago' },
      { value: 'cancelado', label: 'Cancelado' },
    ],
  },
]

interface ListaPagamentosProps {
  /** "pagamentos": histórico por data, com cancelamento. "recibos": por número do recibo. */
  modo: 'pagamentos' | 'recibos'
}

/** Lista paginada no servidor, usada pelas telas Pagamentos e Recibos. */
export function ListaPagamentos({ modo }: ListaPagamentosProps) {
  const porRecibo = modo === 'recibos'
  const guarda = useGuardaPagina()
  const toast = useToast()
  const hoje = useHoje()
  const { galpaoSelecionado } = useGalpao()
  const { recarregar } = useGalpaoDados()
  const { criarAcoes, overlay } = useReciboAcoes()

  const { filtros, atualizar } = useFiltrosLista()
  const aoBuscar = useBuscaNaUrl(atualizar)
  const irParaPagina = useCallback((pagina: number) => atualizar({ pagina }), [atualizar])
  const lista = usePagamentosPaginados(
    galpaoSelecionado?.id ?? null,
    filtros,
    porRecibo,
    irParaPagina,
  )

  const [filtroAberto, setFiltroAberto] = useState(false)
  const [cancelando, setCancelando] = useState<LinhaPagamento | null>(null)
  const [motivo, setMotivo] = useState('')
  const [verificando, setVerificando] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)
  const [digitandoCodigo, setDigitandoCodigo] = useState(false)

  const valoresFiltro: FilterValues = { forma: filtros.formas, status: filtros.status }

  const exportar = async () => {
    if (!galpaoSelecionado) return
    setExportando(true)
    try {
      const { linhas, truncado } = await exportarPagamentosCsv(
        galpaoSelecionado.id,
        {
          busca: filtros.busca,
          formas: filtros.formas,
          status: filtros.status,
          de: filtros.de,
          ate: filtros.ate,
          porRecibo,
        },
        `${porRecibo ? 'recibos' : 'pagamentos'}-${dataLocalISO(hoje)}.csv`,
      )
      if (truncado) {
        toast.info(
          `Arquivo com as primeiras ${LIMITE_EXPORTACAO.toLocaleString('pt-BR')} linhas. Use o período para exportar o restante.`,
        )
      } else {
        toast.success(`${linhas} linha${linhas === 1 ? '' : 's'} exportada${linhas === 1 ? '' : 's'}.`)
      }
    } catch {
      toast.error('Não foi possível exportar. Verifique a conexão e tente novamente.')
    } finally {
      setExportando(false)
    }
  }

  // Chamada depois que a senha foi confirmada. Devolve a mensagem de erro, ou null se deu certo.
  const confirmarCancelamento = async (): Promise<string | null> => {
    if (!cancelando) return null
    const resultado = await cancelarPagamento(cancelando.id, motivo)
    if ('error' in resultado) return resultado.error
    toast.success('Pagamento cancelado. A cobrança voltou a ficar em aberto.')
    setMotivo('')
    await recarregar()
    return null
  }

  const colunaCodigo: TableColumn<LinhaPagamento> = {
    key: 'codigo',
    header: 'Autenticação',
    render: (l) =>
      l.recibo_codigo ? (
        <span className="font-mono text-xs">{formatarCodigo(l.recibo_codigo)}</span>
      ) : (
        '—'
      ),
  }
  const colunaRecibo: TableColumn<LinhaPagamento> = {
    key: 'recibo',
    header: 'Recibo',
    render: (l) => (l.recibo_numero !== null ? `Recibo ${formatarNumeroRecibo(l.recibo_numero)}` : '—'),
  }
  const colunaCliente: TableColumn<LinhaPagamento> = {
    key: 'cliente',
    header: 'Cliente',
    render: (l) => l.cliente_nome,
  }
  const colunasComuns: TableColumn<LinhaPagamento>[] = [
    {
      key: 'referente',
      header: 'Referente a',
      render: (l) => formatarDataBR(l.semana_referencia ?? l.data_pagamento),
    },
    { key: 'pagoEm', header: 'Pago em', render: (l) => formatDateTime(l.created_at) },
    {
      key: 'forma',
      header: 'Forma',
      render: (l) => FORMAS_PAGAMENTO_LABEL[l.forma_pagamento],
    },
    {
      key: 'status',
      header: 'Situação',
      render: (l) => {
        const badge = (
          <Badge variant={l.status === 'cancelado' ? 'danger' : 'success'}>
            {STATUS_PAGAMENTO_LABEL[l.status] ?? l.status}
          </Badge>
        )
        if (l.status !== 'cancelado') return badge
        const quem = l.cancelado_por_nome ?? 'alguém'
        const quando = l.cancelado_em ? ` em ${formatDateTime(l.cancelado_em)}` : ''
        const motivoTexto = l.motivo_cancelamento ? ` Motivo: ${l.motivo_cancelamento}` : ''
        return <Tooltip texto={`Cancelado por ${quem}${quando}.${motivoTexto}`}>{badge}</Tooltip>
      },
    },
    colunaCodigo,
    {
      key: 'recebidoPor',
      header: 'Recebido por',
      render: (l) => l.recebido_por_nome ?? '—',
    },
    {
      key: 'valor',
      header: 'Valor',
      align: 'right',
      render: (l) => formatCurrency(Number(l.valor)),
    },
  ]
  const [referente, pagoEm, forma, situacao, codigo, recebidoPor, valor] = colunasComuns
  const columns = porRecibo
    ? [colunaRecibo, colunaCliente, referente, pagoEm, forma, situacao, codigo, recebidoPor, valor]
    : [colunaCliente, referente, pagoEm, forma, situacao, colunaRecibo, codigo, recebidoPor, valor]

  const actions: TableAction<LinhaPagamento>[] = [
    ...criarAcoes<LinhaPagamento>((l) =>
      l.recibo_numero === null
        ? null
        : montarDadosRecibo(
            galpaoSelecionado?.nome ?? '',
            { nome: l.cliente_nome, whatsapp: l.cliente_whatsapp },
            l,
            l.recibo_numero,
            l.recibo_codigo,
          ),
    ),
    {
      icon: ShieldCheck,
      label: 'Verificar autenticidade',
      variant: 'info' as const,
      hidden: (l: LinhaPagamento) => !l.recibo_codigo,
      onClick: (l: LinhaPagamento) => setVerificando(l.recibo_codigo),
    },
    ...(porRecibo
      ? []
      : [
          {
            icon: Ban,
            label: 'Cancelar pagamento',
            variant: 'danger' as const,
            hidden: (l: LinhaPagamento) => l.status === 'cancelado',
            onClick: (l: LinhaPagamento) => {
              setMotivo('')
              setCancelando(l)
            },
          },
        ]),
  ]

  if (guarda) return guarda
  if (!galpaoSelecionado) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {porRecibo ? 'Recibos' : 'Pagamentos'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {porRecibo
              ? `Reemitir e reenviar recibos de ${galpaoSelecionado.nome}`
              : `Histórico de ${galpaoSelecionado.nome}`}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => void exportar()}
            loading={exportando}
            disabled={exportando || lista.total === 0}
          >
            <Download size={16} />
            {exportando ? 'Exportando...' : 'Exportar'}
          </Button>
          {porRecibo && (
            <Button variant="secondary" onClick={() => setDigitandoCodigo(true)}>
              <ShieldCheck size={16} />
              Verificar código
            </Button>
          )}
        </div>
      </div>

      <FiltroPeriodo
        hoje={hoje}
        de={filtros.de}
        ate={filtros.ate}
        onChange={({ de, ate }) => atualizar({ de, ate })}
        onLimpar={() => atualizar({ de: null, ate: null })}
      />

      {lista.erro ? (
        <ErroCarregamento
          mensagem="Não foi possível carregar a lista. Verifique a conexão e tente novamente."
          onRetry={lista.tentarNovamente}
        />
      ) : lista.carregando ? (
        <PageLoader />
      ) : (
        <Table
          columns={columns}
          data={lista.itens}
          rowKey={(l) => l.id}
          serverSide
          total={lista.total}
          page={filtros.pagina}
          pageSize={TAMANHO_PAGINA}
          onPageChange={irParaPagina}
          busy={lista.atualizando}
          compact
          emptyMessage={porRecibo ? 'Nenhum recibo encontrado' : 'Nenhum pagamento encontrado'}
          onSearch={aoBuscar}
          searchDefault={filtros.busca}
          onFilter={() => setFiltroAberto(true)}
          filterCount={contarFiltros(valoresFiltro)}
          searchPlaceholder="Buscar cliente, recibo ou código..."
          actions={actions}
        />
      )}

      <FilterModal
        open={filtroAberto}
        onClose={() => setFiltroAberto(false)}
        groups={FILTER_GROUPS}
        values={valoresFiltro}
        onApply={(v) =>
          atualizar({
            formas: (v.forma ?? []) as FormaPagamento[],
            status: (v.status ?? []) as StatusPagamento[],
          })
        }
      />

      <ConfirmarSenhaModal
        open={cancelando !== null}
        titulo="Cancelar pagamento"
        textoBotao="Cancelar pagamento"
        perigo
        podeConfirmar={motivo.trim().length >= 3}
        descricao={
          <>
            Cancelar o pagamento de <strong>{cancelando?.cliente_nome ?? 'cliente'}</strong> (
            {cancelando ? formatCurrency(Number(cancelando.valor)) : ''}). O recibo continua no
            histórico, marcado como cancelado, a cobrança volta a ficar em aberto e o seu nome fica
            registrado no histórico.
          </>
        }
        onConfirmar={confirmarCancelamento}
        onClose={() => {
          setCancelando(null)
          setMotivo('')
        }}
      >
        <Input
          label="Motivo do cancelamento"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={500}
          placeholder="Ex.: valor lançado errado"
          hint="Obrigatório. Fica registrado junto com o seu nome."
          autoFocus
        />
      </ConfirmarSenhaModal>

      <VerificarReciboModal codigo={verificando} onClose={() => setVerificando(null)} />
      <VerificarCodigoModal open={digitandoCodigo} onClose={() => setDigitandoCodigo(false)} />

      {overlay}
    </div>
  )
}
