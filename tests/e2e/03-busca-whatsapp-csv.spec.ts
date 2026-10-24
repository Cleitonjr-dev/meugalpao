import { readFileSync } from 'node:fs'
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

test.describe.serial('Busca, cobrança por WhatsApp e exportação CSV', () => {
  const galpao = nomeUnico('E2E')
  const clienteA = 'Ana Busca E2E'
  const clienteB = 'Bruno Busca E2E'
  let page: Page

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    const { emailSuper, senhaSuper } = ambiente()
    page = await browser.newPage()
    await entrar(page, emailSuper, senhaSuper)
    await criarGalpao(page, galpao)
    await selecionarGalpao(page, galpao)
    await criarCliente(page, clienteA)
    await criarCliente(page, clienteB)
  })

  test.afterAll(async () => {
    try {
      // com pagamentos o banco recusa a exclusão; o galpão E2E é limpo depois pelo SQL (docs/TESTES.md)
      await excluirGalpao(page, galpao, ambiente().senhaSuper)
    } finally {
      await page.close()
    }
  })

  test('a busca nas Cobranças filtra por nome (sem diferenciar acento nem maiúscula)', async () => {
    await page.goto('/')
    await page.getByRole('button', { name: /^Todos/ }).click()
    await expect(page.getByText(clienteA)).toBeVisible()
    await expect(page.getByText(clienteB)).toBeVisible()
    await page.getByLabel('Buscar cliente').fill('ANA')
    await expect(page.getByText(clienteA)).toBeVisible()
    await expect(page.getByText(clienteB)).toHaveCount(0)
    await page.getByLabel('Buscar cliente').fill('zzz')
    await expect(page.getByText('Nenhum cliente encontrado')).toBeVisible()
  })

  test('cliente em atraso tem o botão de cobrar pelo WhatsApp com a mensagem pronta', async () => {
    const hoje = new Date().getDay() // 3 = quarta, 6 = sábado
    test.skip(
      hoje !== 3 && hoje !== 6,
      'Só há cliente em atraso no próprio dia de cobrança (quarta ou sábado).',
    )
    await page.goto('/')
    const link = page.getByRole('link', { name: 'Cobrar pelo WhatsApp' }).first()
    await expect(link).toBeVisible()
    const href = (await link.getAttribute('href')) ?? ''
    expect(href).toMatch(/^https:\/\/wa\.me\/5585/)
    expect(decodeURIComponent(href)).toContain('cobrança')
  })

  test('exportar Pagamentos baixa um CSV para o Excel (BOM, ponto e vírgula, cabeçalho)', async () => {
    await registrarPagamento(page, clienteA)
    await page.getByRole('dialog', { name: 'Recibo' }).getByRole('button', { name: 'Fechar' }).click()
    await page.goto('/pagamentos')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^pagamentos-\d{4}-\d{2}-\d{2}\.csv$/)
    const texto = readFileSync(await download.path(), 'utf8')
    expect(texto.startsWith('﻿')).toBe(true)
    expect(texto).toContain('Recibo;Código de autenticação;Cliente;Cobrança de;Pago em;Forma;Situação;Valor')
    expect(texto).toContain(clienteA)
  })
})
