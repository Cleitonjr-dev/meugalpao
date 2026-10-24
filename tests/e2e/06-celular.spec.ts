import { expect, test } from '@playwright/test'
import { ambiente } from './ambiente.ts'
import { entrar } from './helpers.ts'

// Roda só no projeto "celular" (390 px de largura).
test.describe('Celular', () => {
  test('as telas principais cabem na largura, sem rolar para o lado', async ({ page }) => {
    const { emailSuper, senhaSuper } = ambiente()
    await entrar(page, emailSuper, senhaSuper)
    for (const rota of ['/', '/clientes', '/pagamentos', '/recibos', '/relatorios', '/fechamento']) {
      await page.goto(rota)
      await page.waitForLoadState('networkidle')
      const sobra = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(sobra, `a tela ${rota} não deve ter rolagem horizontal`).toBeLessThanOrEqual(1)
    }
  })

  test('o menu abre sem erros na página', async ({ page }) => {
    const erros: string[] = []
    page.on('pageerror', (e) => erros.push(e.message))
    const { emailSuper, senhaSuper } = ambiente()
    await entrar(page, emailSuper, senhaSuper)
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await expect(page.getByRole('link', { name: 'Pagamentos' })).toBeVisible()
    expect(erros).toEqual([])
  })
})
