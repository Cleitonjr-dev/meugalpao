import { lazy, type ComponentType } from 'react'

// Cada página vira um arquivo separado, baixado só quando visitada (ou antes, em ociosidade).
const carregarDashboard = () => import('@/pages/DashboardPage')
const carregarClientes = () => import('@/features/clientes')
const carregarPagamentos = () => import('@/pages/PagamentosPage')
const carregarRecibos = () => import('@/pages/RecibosPage')
const carregarRelatorios = () => import('@/pages/RelatoriosPage')
const carregarFechamento = () => import('@/pages/FechamentoPage')
const carregarConfiguracoes = () => import('@/features/configuracoes')

/** Os módulos exportam a página por nome; o React.lazy espera o componente em `default`. */
function paginaLazy<K extends string>(
  carregar: () => Promise<Record<K, ComponentType>>,
  nome: K,
) {
  return lazy(() => carregar().then((m) => ({ default: m[nome] })))
}

export const DashboardPage = paginaLazy(carregarDashboard, 'DashboardPage')
export const ClientesPage = paginaLazy(carregarClientes, 'ClientesPage')
export const PagamentosPage = paginaLazy(carregarPagamentos, 'PagamentosPage')
export const RecibosPage = paginaLazy(carregarRecibos, 'RecibosPage')
export const RelatoriosPage = paginaLazy(carregarRelatorios, 'RelatoriosPage')
export const FechamentoPage = paginaLazy(carregarFechamento, 'FechamentoPage')
export const ConfiguracoesPage = paginaLazy(carregarConfiguracoes, 'ConfiguracoesPage')

/** Baixa o código das demais páginas em segundo plano, para a navegação não esperar. */
export function precarregarPaginas() {
  void carregarClientes()
  void carregarPagamentos()
  void carregarRecibos()
  void carregarRelatorios()
  void carregarFechamento()
  void carregarConfiguracoes()
}
