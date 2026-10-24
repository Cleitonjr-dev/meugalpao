import { expect, test } from '@playwright/test'
import { ambiente } from './ambiente.ts'
import { entrar } from './helpers.ts'

test.describe('Segurança de acesso', () => {
  test('sem login, abrir uma tela interna leva para o login', async ({ page }) => {
    await page.goto('/pagamentos')
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/fechamento')
    await expect(page).toHaveURL(/\/login/)
  })

  test('sem login, a verificação de recibo continua aberta', async ({ page }) => {
    await page.goto('/verificar')
    await expect(page.getByLabel('Código de autenticação')).toBeVisible()
  })

  test('usuário comum não vê a aba Histórico', async ({ page }) => {
    const { emailComum, senhaComum } = ambiente()
    await entrar(page, emailComum, senhaComum)
    await page.goto('/configuracoes')
    await expect(page.getByRole('button', { name: 'Histórico' })).toHaveCount(0)
  })
})
