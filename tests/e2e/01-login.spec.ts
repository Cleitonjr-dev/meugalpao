import { expect, test } from '@playwright/test'
import { ambiente } from './ambiente.ts'
import { entrar } from './helpers.ts'

test.describe('Login', () => {
  test('senha errada mostra o erro e continua na tela de login', async ({ page }) => {
    const { emailSuper } = ambiente()
    await page.goto('/login')
    await page.getByLabel('E-mail', { exact: true }).fill(emailSuper)
    await page.getByLabel('Senha', { exact: true }).fill('senha-errada-123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('senha certa abre as Cobranças', async ({ page }) => {
    const { emailSuper, senhaSuper } = ambiente()
    await entrar(page, emailSuper, senhaSuper)
    await expect(page.getByRole('heading', { name: 'Cobranças' })).toBeVisible()
  })

  test('a tela de verificação pública tem caminho de volta para o login', async ({ page }) => {
    await page.goto('/verificar')
    await page.getByRole('link', { name: 'Voltar ao login' }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})
