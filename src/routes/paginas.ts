import { lazy } from 'react'

// Cada página vira um arquivo separado, baixado só quando visitada (ou antes, em ociosidade).
const carregarDashboard = () => import('@/pages/DashboardPage')
const carregarClientes = () => import('@/features/clientes')
const carregarPagamentos = () => import('@/pages/PagamentosPage')
const carregarRecibos = () => import('@/pages/RecibosPage')
const carregarRelatorios = () => import('@/pages/RelatoriosPage')
const carregarFechamento = () => import('@/pages/FechamentoPage')
const carregarConfiguracoes = () => import('@/features/configuracoes')

export const DashboardPage = lazy(() =>
  carregarDashboard().then((m) => ({ default: m.DashboardPage })),
)
export const ClientesPage = lazy(() =>
  carregarClientes().then((m) => ({ default: m.ClientesPage })),
)
export const PagamentosPage = lazy(() =>
  carregarPagamentos().then((m) => ({ default: m.PagamentosPage })),
)
export const RecibosPage = lazy(() => carregarRecibos().then((m) => ({ default: m.RecibosPage })))
export const RelatoriosPage = lazy(() =>
  carregarRelatorios().then((m) => ({ default: m.RelatoriosPage })),
)
export const FechamentoPage = lazy(() =>
  carregarFechamento().then((m) => ({ default: m.FechamentoPage })),
)
export const ConfiguracoesPage = lazy(() =>
  carregarConfiguracoes().then((m) => ({ default: m.ConfiguracoesPage })),
)

/** Baixa o código das demais páginas em segundo plano, para a navegação não esperar. */
export function precarregarPaginas() {
  void carregarClientes()
  void carregarPagamentos()
  void carregarRecibos()
  void carregarRelatorios()
  void carregarFechamento()
  void carregarConfiguracoes()
}
