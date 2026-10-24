import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Os testes rodam sempre no fuso de Fortaleza, igual aos usuários (datas de cobrança dependem disso).
process.env.TZ = 'America/Fortaleza'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // tests/ tem os testes do banco (node) e de tela (Playwright): rodam por comandos próprios
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/vite-env.d.ts'],
      reporter: ['text-summary', 'html'],
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Bibliotecas em arquivos próprios: o navegador as guarda em cache entre versões do app.
        advancedChunks: {
          groups: [
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase/ },
            { name: 'vendor-query', test: /node_modules[\\/]@tanstack/ },
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
})
