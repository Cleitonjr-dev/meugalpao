import { useMemo, type ComponentType } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CreditCard,
  DollarSign,
  Smartphone,
  Target,
  Wallet,
} from 'lucide-react'
import { useGalpao } from '@/context/GalpaoContext'
import { useGalpaoDados } from '@/context/GalpaoDadosContext'
import { useGuardaPagina } from '@/components/shared/useGuardaPagina'
import { ErroCarregamento } from '@/components/shared/ErroCarregamento'
import { FiltroPeriodo } from '@/components/shared/FiltroPeriodo'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { PageLoader } from '@/components/ui/PageLoader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { buscarRelatorioResumo } from '@/features/pagamentos/pagamentos.queries'
import { useFiltrosLista } from '@/features/pagamentos/useListaPagamentos'
import { chaves } from '@/lib/queryClient'
import { formatCurrency } from '@/lib/utils'
import { valorSemanal } from '@/utils/valor'
import { dataLocalISO, formatarDataBR } from '@/utils/data'
import { BotaoCobrarWhatsapp } from '@/features/pagamentos/BotaoCobrarWhatsapp'
import { indexarPagos, pendenciasCliente, pendenciasTruncadas, formatarDataCurta } from '@/utils/pagamentos'
import { periodoDoPreset } from '@/utils/periodo'
import { useHoje } from '@/hooks/useHoje'
import { DIAS_PAGAMENTO_LABEL, FORMAS_PAGAMENTO, FORMAS_PAGAMENTO_LABEL } from '@/config/constants'
import type { FormaPagamento } from '@/types'

const FORMA_ICONS: Record<FormaPagamento, ComponentType<{ size?: number; className?: string }>> = {
  dinheiro: Banknote,
  pix: Smartphone,
  cartao: CreditCard,
}

const SEMANAS_POR_MES = 52 / 12

export function RelatoriosPage() {
  const guarda = useGuardaPagina()
  const { galpaoSelecionado } = useGalpao()
  const { clientes, itens, tipos, precos, pagamentos } = useGalpaoDados()
  const hoje = useHoje()
  const hojeStr = dataLocalISO(hoje)

  // O período fica na URL; sem nada escolhido, o padrão é "este mês".
  const { filtros, atualizar } = useFiltrosLista()
  const padrao = periodoDoPreset('mes', hoje)
  const de = filtros.de ?? padrao.de
  const ate = filtros.ate ?? padrao.ate

  const galpaoId = galpaoSelecionado?.id ?? null
  const resumoQuery = useQuery({
    queryKey: chaves.relatorio(galpaoId, de, ate, hojeStr),
    queryFn: () => buscarRelatorioResumo(galpaoId as string, de, ate, hojeStr),
    enabled: galpaoId !== null,
    // Mantém o período anterior só dentro do mesmo galpão enquanto o novo carrega.
    placeholderData: (anterior, consultaAnterior) =>
      consultaAnterior?.queryKey[1] === galpaoId ? keepPreviousData(anterior) : undefined,
  })
  const resumo = resumoQuery.data

  const pagosIndex = useMemo(() => indexarPagos(pagamentos), [pagamentos])
  const clientesAtivos = useMemo(() => clientes.filter((c) => c.ativo), [clientes])

  const valoresSemanais = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const c of clientes) mapa.set(c.id, valorSemanal(c.id, itens, precos, tipos))
    return mapa
  }, [clientes, itens, precos, tipos])

  const pendentes = useMemo(
    () =>
      clientesAtivos
        .map((cliente) => ({
          cliente,
          datas: pendenciasCliente(cliente, pagosIndex, hoje),
          truncada: pendenciasTruncadas(cliente, hoje),
        }))
        .filter((p) => p.datas.length > 0),
    [clientesAtivos, pagosIndex, hoje],
  )

  const totalPendente = useMemo(
    () =>
      pendentes.reduce((acc, p) => acc + (valoresSemanais.get(p.cliente.id) ?? 0) * p.datas.length, 0),
    [pendentes, valoresSemanais],
  )

  const totalMensalEsperado = useMemo(
    () =>
      clientesAtivos.reduce((acc, c) => acc + (valoresSemanais.get(c.id) ?? 0), 0) * SEMANAS_POR_MES,
    [clientesAtivos, valoresSemanais],
  )

  const porForma = useMemo(() => {
    const mapa = new Map((resumo?.por_forma ?? []).map((f) => [f.forma, Number(f.total)]))
    return FORMAS_PAGAMENTO.map((forma) => ({ forma, total: mapa.get(forma) ?? 0 }))
  }, [resumo])

  const porDia = useMemo(
    () => (resumo?.por_dia ?? []).map((d) => [d.data, Number(d.total)] as const),
    [resumo],
  )

  const totalFormas = porForma.reduce((acc, f) => acc + f.total, 0)
  const maxPorDia = Math.max(1, ...porDia.map(([, total]) => total))

  if (guarda) return guarda
  if (!galpaoSelecionado) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Relatórios</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {galpaoSelecionado.nome} · {formatarDataBR(de)} a {formatarDataBR(ate)}
        </p>
      </div>

      <FiltroPeriodo
        hoje={hoje}
        de={de}
        ate={ate}
        onChange={(periodo) => atualizar({ de: periodo.de, ate: periodo.ate })}
      />

      {resumoQuery.isError && !resumo ? (
        <ErroCarregamento
          mensagem="Não foi possível carregar o relatório. Verifique a conexão e tente novamente."
          onRetry={() => void resumoQuery.refetch()}
        />
      ) : !resumo ? (
        <PageLoader />
      ) : (
        <div
          className={
            resumoQuery.isPlaceholderData ? 'flex flex-col gap-6 opacity-60' : 'flex flex-col gap-6'
          }
          aria-busy={resumoQuery.isPlaceholderData || undefined}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              icon={CalendarDays}
              label="Recebido no período"
              value={formatCurrency(Number(resumo.total_periodo))}
              sub={`${resumo.quantidade_periodo} pagamento${resumo.quantidade_periodo === 1 ? '' : 's'}`}
              tone="success"
            />
            <StatCard
              icon={Wallet}
              label="Recebido hoje"
              value={formatCurrency(Number(resumo.total_hoje))}
              tone="primary"
            />
            <StatCard
              icon={DollarSign}
              label="Recebido (geral)"
              value={formatCurrency(Number(resumo.total_geral))}
              tone="primary"
            />
            <StatCard
              icon={AlertTriangle}
              label="Em atraso"
              value={String(pendentes.length)}
              sub={`${formatCurrency(totalPendente)} em aberto`}
              tone="warning"
            />
            <StatCard
              icon={Target}
              label="Previsão mensal"
              value={formatCurrency(totalMensalEsperado)}
              tone="neutral"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Arrecadação por dia
              </h2>
              {porDia.length === 0 ? (
                <div className="mt-2">
                  <EmptyState
                    title="Nenhum pagamento no período"
                    description="Os pagamentos registrados nestas datas aparecerão aqui."
                  />
                </div>
              ) : (
                <>
                  <ul className="mt-4 flex flex-col gap-3">
                    {porDia.map(([data, total]) => (
                      <li key={data} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                          {formatarDataCurta(data)}
                        </span>
                        <div className="h-6 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full rounded bg-primary-500"
                            style={{ width: `${(total / maxPorDia) * 100}%` }}
                          />
                        </div>
                        <span className="w-28 shrink-0 text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {formatCurrency(total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {porDia.length === 31 && (
                    <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                      Mostrando os 31 dias mais recentes do período.
                    </p>
                  )}
                </>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Recebido por forma de pagamento
              </h2>
              <ul className="mt-4 flex flex-col gap-4">
                {porForma.map(({ forma, total }) => {
                  const pct = totalFormas > 0 ? Math.round((total / totalFormas) * 100) : 0
                  const Icon = FORMA_ICONS[forma]
                  return (
                    <li key={forma} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 dark:text-slate-200">
                            {FORMAS_PAGAMENTO_LABEL[forma]}
                          </span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(total)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-primary-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Pendências (em atraso)
            </h2>
            {pendentes.length === 0 ? (
              <div className="mt-2">
                <EmptyState
                  title="Nenhum cliente em pendência"
                  description="Todos os clientes estão em dia."
                />
              </div>
            ) : (
              <>
                <ul className="mt-3 flex flex-col gap-2">
                  {pendentes.map(({ cliente: c, datas, truncada }) => {
                    const semanas = datas.length
                    return (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900 dark:text-white">
                          {c.nome}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {c.telefone ?? 'Sem telefone'}
                        </p>
                      </div>
                      <Badge variant="neutral">{DIAS_PAGAMENTO_LABEL[c.dia_pagamento]}</Badge>
                      <span className="shrink-0 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {formatCurrency((valoresSemanais.get(c.id) ?? 0) * semanas)}
                        {truncada ? ` (${semanas}+ semanas)` : semanas > 1 ? ` (${semanas} semanas)` : ''}
                      </span>
                      <BotaoCobrarWhatsapp
                        cliente={c}
                        galpao={galpaoSelecionado?.nome ?? ''}
                        semanas={datas}
                        valorSemanal={valoresSemanais.get(c.id) ?? 0}
                        truncada={truncada}
                      />
                    </li>
                    )
                  })}
                </ul>
                <p className="mt-3 text-right text-xs text-slate-500 dark:text-slate-400">
                  {pendentes.length} cliente{pendentes.length > 1 ? 's' : ''} ·{' '}
                  {formatCurrency(totalPendente)} em aberto
                </p>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
