import { useMemo, useState } from 'react'
import { AlertTriangle, Check, DollarSign, Receipt, Search, Wallet } from 'lucide-react'
import { useGalpao } from '@/context/GalpaoContext'
import { useGalpaoDados } from '@/context/GalpaoDadosContext'
import { useGuardaPagina } from '@/components/shared/useGuardaPagina'
import { RegistrarPagamentoModal } from '@/features/pagamentos/RegistrarPagamentoModal'
import { ReceiptModal } from '@/features/pagamentos/ReceiptModal'
import { montarDadosRecibo, type DadosRecibo } from '@/features/pagamentos/dadosRecibo'
import { BotaoCobrarWhatsapp } from '@/features/pagamentos/BotaoCobrarWhatsapp'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatDateLong } from '@/utils/data'
import { cn } from '@/lib/cn'
import { formatCurrency, valorExibido } from '@/utils/valor'
import { chavePagamento, formatarDataCurta, situacaoCliente } from '@/utils/pagamentos'
import { DIAS_PAGAMENTO_LABEL } from '@/config/constants'
import { useHoje } from '@/hooks/useHoje'
import { calcularPainel, listarClientes, type FiltroPainel } from './painel'
import type { Cliente, Pagamento, PagamentoRecente, Recibo } from '@/types'

const FILTRO_ATIVO = 'bg-primary-600 text-white'
const FILTRO_INATIVO =
  'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'

export function DashboardPage() {
  const guarda = useGuardaPagina()
  const { galpaoSelecionado } = useGalpao()
  const { clientes, itens, tipos, precos, pagamentos, recarregar } = useGalpaoDados()
  const hoje = useHoje()

  const [filtro, setFiltro] = useState<FiltroPainel>('hoje')
  const [busca, setBusca] = useState('')
  const [registrarAberto, setRegistrarAberto] = useState(false)
  const [clienteInicialId, setClienteInicialId] = useState<string | null>(null)
  const [recebido, setRecebido] = useState<DadosRecibo | null>(null)

  const painel = useMemo(
    () => calcularPainel({ clientes, itens, tipos, precos, pagamentos, hoje }),
    [clientes, itens, tipos, precos, pagamentos, hoje],
  )
  const {
    diaKey,
    pagos,
    ativos,
    situacoes,
    clientesHoje,
    clientesEmAtraso,
    emAtrasoHoje,
    pagamentoDaSemana,
    ultimoPagamento,
    totalHoje,
    aReceberHoje,
    valorSemanalDe: getValorSemanal,
  } = painel
  const lista = useMemo(() => listarClientes(painel, filtro, busca), [painel, filtro, busca])

  const mostrarRecibo = (cliente: Cliente, pagamento: PagamentoRecente | undefined) => {
    if (!pagamento || !galpaoSelecionado) return
    setRecebido(
      montarDadosRecibo(
        galpaoSelecionado.nome,
        cliente,
        pagamento,
        pagamento.recibo_numero,
        pagamento.recibo_codigo,
      ),
    )
  }

  const abrirRegistrar = (clienteId: string | null) => {
    setClienteInicialId(clienteId)
    setRegistrarAberto(true)
  }

  const aoPagar = (pagamento: Pagamento, recibo: Recibo) => {
    setRegistrarAberto(false)
    const cliente = clientes.find((c) => c.id === pagamento.cliente_id) ?? null
    if (cliente && galpaoSelecionado) {
      setRecebido(
        montarDadosRecibo(galpaoSelecionado.nome, cliente, pagamento, recibo.numero, recibo.codigo),
      )
    }
    void recarregar()
  }

  if (guarda) return guarda
  if (!galpaoSelecionado) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Cobranças</h1>
          <p className="text-sm capitalize text-slate-500 dark:text-slate-400">
            {formatDateLong(hoje)}
          </p>
        </div>
        <Button onClick={() => abrirRegistrar(null)}>Registrar pagamento</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Wallet}
          label="A receber hoje"
          value={formatCurrency(aReceberHoje)}
          tone="primary"
        />
        <StatCard
          icon={DollarSign}
          label="Recebido hoje"
          value={formatCurrency(totalHoje)}
          tone="success"
        />
        <StatCard
          icon={AlertTriangle}
          label="Em atraso hoje"
          value={String(emAtrasoHoje.length)}
          tone="warning"
        />
      </div>

      {!diaKey && (
        <Card className="border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Hoje não é dia de cobrança (quarta ou sábado). Você ainda pode registrar pagamentos na
            aba &quot;Todos&quot;.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['hoje', `Hoje (${clientesHoje.length})`],
              ['atraso', `Em atraso (${clientesEmAtraso.length})`],
              ['todos', `Todos (${ativos.length})`],
            ] as [FiltroPainel, string][]
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                filtro === valor ? FILTRO_ATIVO : FILTRO_INATIVO,
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <div className="sm:w-72">
          <Input
            type="search"
            aria-label="Buscar cliente"
            placeholder="Buscar por nome ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            endAdornment={<Search size={16} className="text-slate-400" />}
          />
        </div>
      </div>

      {lista.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            title={
              busca.trim()
                ? 'Nenhum cliente encontrado'
                : filtro === 'hoje'
                  ? 'Nenhuma cobrança para hoje'
                  : filtro === 'atraso'
                    ? 'Nenhum cliente em atraso'
                    : 'Nenhum cliente ativo'
            }
            description={
              busca.trim()
                ? 'Tente outro nome ou telefone.'
                : filtro === 'hoje'
                  ? 'Não há clientes com cobrança marcada para hoje.'
                  : filtro === 'atraso'
                    ? 'Todos os clientes estão em dia.'
                    : 'Cadastre clientes neste galpão para começar a cobrar.'
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((c) => {
            const situacao = situacoes.get(c.id) ?? situacaoCliente(c, pagos, hoje)
            const emAtraso = situacao.status === 'em_atraso'
            const semanasAtrasadas = situacao.pendentes.length
            // Cobrança atual paga: mostra o que foi pago (os itens podem ter mudado depois).
            const pagamentoAtual =
              !emAtraso && situacao.semanas[0]?.pago
                ? pagamentoDaSemana.get(chavePagamento(c.id, situacao.semanas[0].iso))
                : undefined
            const exibido = valorExibido(
              getValorSemanal(c.id),
              pagamentoAtual ? Number(pagamentoAtual.valor) : null,
            )
            const badgeTexto = emAtraso
              ? situacao.truncada
                ? `Em atraso (${semanasAtrasadas}+ semanas)`
                : semanasAtrasadas > 1
                  ? `Em atraso (${semanasAtrasadas} semanas)`
                  : 'Em atraso'
              : situacao.status === 'em_dia'
                ? 'Em dia'
                : `Adiantado até ${formatarDataCurta(situacao.pagoAte ?? '')}`

            return (
              <li
                key={c.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate font-medium text-slate-900 dark:text-white">{c.nome}</p>
                    <Badge
                      variant={emAtraso ? 'warning' : situacao.status === 'em_dia' ? 'success' : 'primary'}
                    >
                      {badgeTexto}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {DIAS_PAGAMENTO_LABEL[c.dia_pagamento]}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {situacao.semanas.map((s, i) => {
                      const base =
                        'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium'
                      const pagoClasses =
                        'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900'
                      const pendenteClasses =
                        'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                      const atual = i === 0 ? ' ring-1 ring-primary-400 dark:ring-primary-600' : ''
                      const conteudo = (
                        <>
                          {s.pago ? '✓' : '○'} {formatarDataCurta(s.iso)}
                          {i === 0 ? ' (atual)' : ''}
                        </>
                      )
                      if (s.pago) {
                        return (
                          <Tooltip
                            key={s.iso}
                            texto={`Ver recibo${
                              pagamentoDaSemana.get(chavePagamento(c.id, s.iso))
                                ? ` · ${formatCurrency(Number(pagamentoDaSemana.get(chavePagamento(c.id, s.iso))?.valor))}`
                                : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => mostrarRecibo(c, pagamentoDaSemana.get(chavePagamento(c.id, s.iso)))}
                              className={cn(base, pagoClasses, atual, 'cursor-pointer')}
                            >
                              {conteudo}
                            </button>
                          </Tooltip>
                        )
                      }
                      return (
                        <span key={s.iso} className={cn(base, pendenteClasses, atual)}>
                          {conteudo}
                        </span>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="flex flex-col sm:min-w-32 sm:items-end">
                    <span className="flex items-baseline gap-2">
                      <span className="text-base font-semibold leading-tight text-slate-900 dark:text-white">
                        {formatCurrency(exibido.valor)}
                      </span>
                      {exibido.pago && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <Check size={12} strokeWidth={3} />
                          pago
                        </span>
                      )}
                    </span>
                    {exibido.proximas !== null && (
                      <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Próximas: {formatCurrency(exibido.proximas)}
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center justify-end gap-2">
                    {emAtraso ? (
                      <>
                        <BotaoCobrarWhatsapp
                          cliente={c}
                          galpao={galpaoSelecionado.nome}
                          semanas={situacao.pendentes}
                          valorSemanal={getValorSemanal(c.id)}
                          truncada={situacao.truncada}
                        />
                        <Button className="sm:w-32" onClick={() => abrirRegistrar(c.id)}>
                          Receber
                        </Button>
                      </>
                    ) : (
                      <Tooltip texto="Ver recibo">
                        <button
                          type="button"
                          aria-label="Ver recibo"
                          disabled={!ultimoPagamento.has(c.id)}
                          onClick={() =>
                            mostrarRecibo(
                              c,
                              (situacao.semanas[0]?.pago
                                ? pagamentoDaSemana.get(chavePagamento(c.id, situacao.semanas[0].iso))
                                : undefined) ?? ultimoPagamento.get(c.id),
                            )
                          }
                          className="inline-flex h-10 w-10 items-center justify-center rounded bg-primary-600 text-white transition-colors hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Receipt size={18} />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <RegistrarPagamentoModal
        open={registrarAberto}
        onClose={() => setRegistrarAberto(false)}
        galpaoId={galpaoSelecionado.id}
        clientes={clientes}
        pagos={pagos}
        hoje={hoje}
        clienteInicialId={clienteInicialId}
        getValorSemanal={getValorSemanal}
        onPago={aoPagar}
      />

      <ReceiptModal dados={recebido} onClose={() => setRecebido(null)} />
    </div>
  )
}
