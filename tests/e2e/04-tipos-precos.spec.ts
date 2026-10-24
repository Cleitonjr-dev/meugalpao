import { expect, test } from '@playwright/test'
import { ambiente } from './ambiente.ts'
import { entrar } from './helpers.ts'

test('Tipos e Preços: a tabela abre, tem busca e o modal de edição abre', async ({ page }) => {
  const { emailSuper, senhaSuper } = ambiente()
  await entrar(page, emailSuper, senhaSuper)
  await page.goto('/configuracoes')
  await page.getByRole('button', { name: 'Tipos e Preços' }).click()
  await expect(page.getByText('Carrinho de roupa').first()).toBeVisible()
  await page.getByPlaceholder(/Buscar/).fill('Carrinho')
  await expect(page.getByText('Carrinho de roupa').first()).toBeVisible()
  await page.getByRole('button', { name: /Editar/ }).first().click()
  const modal = page.getByRole('dialog')
  await expect(modal.getByLabel(/Nome/).first()).toBeVisible()
  // fecha sem salvar: este teste não altera os preços do projeto de teste
  await modal.getByRole('button', { name: 'Fechar' }).click()
})
