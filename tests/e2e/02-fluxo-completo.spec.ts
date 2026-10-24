import { expect, test, type Browser, type Page } from '@playwright/test'
import { ambiente } from './ambiente.ts'
import {
  criarCliente,
  criarGalpao,
  entrar,
  excluirGalpao,
  nomeUnico,
  registrarPagamento,
  selecionarGalpao,
} from './helpers.ts'

// Fluxo principal: cria um galpão de teste, cobra, confere o recibo, cancela e confere o histórico.
// O galpão "E2E ..." é apagado no final (a exclusão leva junto clientes, pagamentos e recibos).
test.describe.serial('Fluxo completo: cobrar, verificar e cancelar', () => {
  const galpao = nomeUnico('E2E')
  const cliente = 'Cliente E2E Fluxo'
  let page: Page
  let codigo = ''

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    const { emailSuper, senhaSuper } = ambiente()
    page = await browser.newPage()
    await entrar(page, emailSuper, senhaSuper)
    await criarGalpao(page, galpao)
    await selecionarGalpao(page, galpao)
    await criarCliente(page, cliente)
  })

  test.afterAll(async () => {
    try {
      // com pagamentos o banco recusa a exclusão; o galpão E2E é limpo depois pelo SQL (docs/TESTES.md)
      await excluirGalpao(page, galpao, ambiente().senhaSuper)
    } finally {
      await page.close()
    }
  })

  test('recebe o pagamento e o recibo mostra o item e o código de autenticação', async () => {
    codigo = await registrarPagamento(page, cliente)
    expect(codigo).toMatch(/^[0-9A-F]{16}$/)
    const recibo = page.getByRole('dialog', { name: 'Recibo' })
    await expect(recibo.getByText(/Referente a: .*Carrinho de roupa/)).toBeVisible()
    await expect(recibo.getByText(cliente)).toBeVisible()
  })

  test('quem não está logado confere o código na página pública: válido', async ({ browser }) => {
    const anonimo = await browser.newPage()
    await anonimo.goto(`/verificar?c=${codigo}`)
    await expect(anonimo.getByText('Válido', { exact: true })).toBeVisible()
    await expect(anonimo.getByText(galpao)).toBeVisible()
    await anonimo.close()
  })

  test('cancelar com senha errada falha e o pagamento continua pago', async () => {
    await page.goto('/pagamentos')
    await page.getByRole('button', { name: 'Cancelar pagamento' }).first().click()
    const modal = page.getByRole('dialog')
    const confirmar = modal.getByRole('button', { name: 'Cancelar pagamento' })
    await expect(confirmar).toBeDisabled() // sem motivo, não deixa confirmar
    await modal.getByLabel('Motivo do cancelamento').fill('Teste automático')
    await modal.getByLabel('Senha', { exact: true }).fill('senha-errada-123')
    await confirmar.click()
    await expect(modal.getByText('Senha incorreta.')).toBeVisible()
    await modal.getByRole('button', { name: 'Fechar' }).click()
    await expect(page.getByText('Pago', { exact: true }).first()).toBeVisible()
  })

  test('cancelar com a senha certa e o motivo funciona', async () => {
    const { senhaSuper } = ambiente()
    await page.goto('/pagamentos')
    await page.getByRole('button', { name: 'Cancelar pagamento' }).first().click()
    const modal = page.getByRole('dialog')
    await modal.getByLabel('Motivo do cancelamento').fill('Teste automático')
    await modal.getByLabel('Senha', { exact: true }).fill(senhaSuper)
    await modal.getByRole('button', { name: 'Cancelar pagamento' }).click()
    await expect(page.getByText(/Pagamento cancelado/)).toBeVisible()
    await expect(page.getByText('Cancelado', { exact: true }).first()).toBeVisible()
  })

  test('o tooltip da situação mostra quem cancelou e o motivo', async () => {
    await page.getByText('Cancelado', { exact: true }).first().hover()
    await expect(page.getByText(/Cancelado por .*Motivo: Teste automático/)).toBeVisible()
  })

  test('a verificação pública agora mostra o recibo como cancelado', async ({ browser }) => {
    const anonimo = await browser.newPage()
    await anonimo.goto(`/verificar?c=${codigo}`)
    await expect(anonimo.getByText('Cancelado', { exact: true })).toBeVisible()
    await anonimo.close()
  })

  test('o histórico registra o pagamento, o cancelamento e o cliente', async () => {
    await page.goto('/configuracoes')
    await page.getByRole('button', { name: 'Histórico' }).click()
    await expect(page.getByText(/Pagamento cancelado/).first()).toBeVisible()
    await expect(page.getByText(/Pagamento registrado/).first()).toBeVisible()
    await expect(page.getByText(/Cliente criado/).first()).toBeVisible()
  })

  test('o fechamento do dia mostra 1 cancelado, fora do total', async () => {
    await page.goto('/fechamento')
    await expect(page.getByRole('heading', { name: 'Fechamento do dia' })).toBeVisible()
    await expect(page.getByText('1 pagamento (fora do total)')).toBeVisible()
  })
})
