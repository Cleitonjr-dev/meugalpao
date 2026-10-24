import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Banknote, Download, Printer, Receipt, XCircle } from 'lucide-react'
import { useGalpao } from '@/context/GalpaoContext'
import { useGuardaPagina } from '@/components/shared/useGuardaPagina'
import { ErroCarregamento } from '@/components/shared/ErroCarregamento'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DatePicker } from '@/components/ui/DatePicker'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLoader } from '@/components/ui/PageLoader'
import { StatCard } from '@/components/ui/StatCard'
import { Table } from '@/components/ui/Table'
import type { TableColumn } from '@/components/ui/Table'
import { buscarFechamentoDia } from '@/features/pagamentos/pagamentos.queries'
import { FORMAS_PAGAMENTO, FORMAS_PAGAMENTO_LABEL, STATUS_PAGAMENTO_LABEL } from '@/config/constants'
import { useHoje } from '@/hooks/useHoje'
import { useLimitesPeriodo } from '@/hooks/useLimitesPeriodo'
import { chaves } from '@/lib/queryClient'
import { formatCurrency } from '@/lib/utils'
import { baixarCsv, gerarCsv, reaisCsv } from '@/utils/csv'
import { dataLocalISO, formatarDataBR, formatarNumeroRecibo } from '@/utils/recibo'
import type { PagamentoDoDia, UsuarioDoDia } from '@/types'

const hora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

export function FechamentoPage() {
  const guarda = useGuardaPagina()
  const { galpaoSelecionado } = useGalpao()
  const hoje = useHoje()
  const limites = useLimitesPeriodo()
  const hojeStr = dataLocalISO(hoje)
  const [data, setData] = useState(hojeStr)

  const galpaoId = galpaoSelecionado?.id ?? null
  const consulta = useQuery({
    queryKey: chaves.fechamento(galpaoId, data),
    queryFn: () => buscarFechamentoDia(galpaoId as string, data),
    enabled: galpaoId !== null,
    placeholderData: (anterior, consultaAnterior) =>
      consultaAnterior?.queryKey[1] === galpaoId ? keepPreviousData(anterior) : undefined,
  })
  const resumo = consulta.data

  const dinheiro = useMemo(
    () => Number(resumo?.por_forma.find((f) => f.forma === 'dinheiro')?.total ?? 0),
    [resumo],
  )
  const porForma = useMemo(() => {
    const mapa = new Map((resumo?.por_forma ?? []).map((f) => [f.forma, Number(f.total)]))
    return FORMAS_PAGAMENTO.map((forma) => ({ forma, total: mapa.get(forma) ?? 0 }))
  }, [resumo])
  const maiorForma = Math.max(1, ...porForma.map((f) => f.total))

  const colunasUsuarios: TableColumn<UsuarioDoDia>[] = [
    { key: 'nome', header: 'Pessoa', render: (u) => u.nome },
    { key: 'dinheiro', header: 'Dinheiro', align: 'right', render: (u) => formatCurrency(Number(u.dinheiro)) },
    { key: 'pix', header: 'Pix', align: 'right', render: (u) => formatCurrency(Number(u.pix)) },
    { key: 'cartao', header: 'Cartão', align: 'right', render: (u) => formatCurrency(Number(u.cartao)) },
    { key: 'total', header: 'Total', align: 'right', render: (u) => formatCurrency(Number(u.total)) },
  ]

  const colunasPagamentos: TableColumn<PagamentoDoDia>[] = [
    { key: 'hora', header: 'Hora', render: (p) => hora(p.hora) },
    { key: 'cliente', header: 'Cliente', render: (p) => p.cliente },
    { key: 'forma', header: 'Forma', render: (p) => FORMAS_PAGAMENTO_LABEL[p.forma] },
    {
      key: 'recibo',
      header: 'Recibo',
      render: (p) => (p.recibo !== null ? `Recibo ${formatarNumeroRecibo(p.recibo)}` : '—'),
    },
    { key: 'recebidoPor', header: 'Recebido por', render: (p) => p.recebido_por ?? '—' },
    {
      key: 'status',
      header: 'Situação',
      render: (p) => (
        <Badge variant={p.status === 'cancelado' ? 'danger' : 'success'}>
          {STATUS_PAGAMENTO_LABEL[p.status] ?? p.status}
        </Badge>
      ),
    },
    { key: 'valor', header: 'Valor', align: 'right', render: (p) => formatCurrency(Number(p.valor)) },
  ]

  const exportar = () => {
    if (!resumo) return
    const colunas = ['Hora', 'Cliente', 'Forma', 'Recibo', 'Item', 'Recebido por', 'Situação', 'Valor']
    const linhas = resumo.pagamentos.map((p) => [
      hora(p.hora),
      p.cliente,
      FORMAS_PAGAMENTO_LABEL[p.forma],
      p.recibo !== null ? formatarNumeroRecibo(p.recibo) : null,
      p.descricao,
      p.recebido_por,
      STATUS_PAGAMENTO_LABEL[p.status] ?? p.status,
      reaisCsv(Number(p.valor)),
    ])
    baixarCsv(`fechamento-${data}.csv`, gerarCsv(colunas, linhas))
  }

  if (guarda) return guarda
  if (!galpaoSelecionado) return null

  const vazio = resumo !== undefined && resumo.pagamentos.length === 0

  return (
    <div id="fechamento-print" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Fechamento do dia</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {galpaoSelecionado.nome} · {formatarDataBR(data)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 print:hidden">
          <div className="w-44">
            <DatePicker
              label="Data"
              value={data}
              min={limites.min}
              max={hojeStr}
              placeholder="dd/mm/aaaa"
              onChange={(v) => setData(v || hojeStr)}
            />
          </div>
          <Button variant="secondary" onClick={exportar} disabled={!resumo || vazio}>
            <Download size={16} />
            Exportar CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()} disabled={!resumo}>
            <Printer size={16} />
            Imprimir
          </Button>
        </div>
      </div>

      {consulta.isError && !resumo ? (
        <ErroCarregamento
          mensagem="Não foi possível carregar o fechamento. Verifique a conexão e tente novamente."
          onRetry={() => void consulta.refetch()}
        />
      ) : !resumo ? (
        <PageLoader />
      ) : (
        <div
          className={
            consulta.isPlaceholderData ? 'flex flex-col gap-6 opacity-60' : 'flex flex-col gap-6'
          }
          aria-busy={consulta.isPlaceholderData || undefined}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Banknote}
              label="Total recebido"
              value={formatCurrency(Number(resumo.total))}
              tone="success"
            />
            <StatCard
              icon={Receipt}
              label="Pagamentos"
              value={String(resumo.quantidade)}
              tone="primary"
            />
            <StatCard
              icon={Banknote}
              label="Dinheiro a conferir"
              value={formatCurrency(dinheiro)}
              sub="Soma dos pagamentos em dinheiro"
              tone="warning"
            />
            <StatCard
              icon={XCircle}
              label="Cancelados"
              value={formatCurrency(Number(resumo.cancelados.total))}
              sub={`${resumo.cancelados.quantidade} pagamento${resumo.cancelados.quantidade === 1 ? '' : 's'} (fora do total)`}
              tone="neutral"
            />
          </div>

          {vazio ? (
            <Card className="p-6">
              <EmptyState
                title="Nenhum pagamento neste dia"
                description="Escolha outra data para ver o fechamento."
              />
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="p-5">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Por forma de pagamento
                  </h2>
                  <ul className="mt-4 flex flex-col gap-3">
                    {porForma.map(({ forma, total }) => (
                      <li key={forma} className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-sm text-slate-600 dark:text-slate-300">
                          {FORMAS_PAGAMENTO_LABEL[forma]}
                        </span>
                        <div className="h-6 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full rounded bg-primary-500"
                            style={{ width: `${(total / maiorForma) * 100}%` }}
                          />
                        </div>
                        <span className="w-24 shrink-0 text-right text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {formatCurrency(total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <div className="flex flex-col gap-2">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Por quem recebeu
                  </h2>
                  <Table
                    columns={colunasUsuarios}
                    data={resumo.por_usuario}
                    rowKey={(u) => u.usuario_id ?? u.nome}
                    emptyMessage="Nenhum recebimento"
                    compact
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Pagamentos do dia
                </h2>
                <Table
                  columns={colunasPagamentos}
                  data={resumo.pagamentos}
                  rowKey={(p) => p.id}
                  emptyMessage="Nenhum pagamento"
                  compact
                />
                {resumo.truncado && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Lista limitada aos primeiros 500 pagamentos; os totais acima consideram todos.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
