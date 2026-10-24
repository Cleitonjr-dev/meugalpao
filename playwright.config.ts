import { defineConfig } from '@playwright/test'
import { carregarAmbiente } from './tests/e2e/ambiente.ts'

// Testes de tela (ponta a ponta). Rodam contra um projeto Supabase SÓ DE TESTE (arquivo .env.e2e).
// Passo a passo para montar esse ambiente: docs/TESTES.md
carregarAmbiente()

const PORTA = 5199

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  // um de cada vez: o Supabase limita tentativas de login seguidas e os testes dividem o mesmo banco
  workers: 1,
  fullyParallel: false,
  retries: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORTA}`,
    locale: 'pt-BR',
    timezoneId: 'America/Fortaleza',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /06-celular/,
      use: { browserName: 'chromium', viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'celular',
      testMatch: /06-celular/,
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npx vite --mode e2e --port ${PORTA} --strictPort`,
    url: `http://localhost:${PORTA}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
