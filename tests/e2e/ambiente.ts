import { existsSync, readFileSync } from 'node:fs'

const OBRIGATORIAS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'E2E_EMAIL_SUPER',
  'E2E_SENHA_SUPER',
  'E2E_EMAIL_COMUM',
  'E2E_SENHA_COMUM',
] as const

/** Lê o arquivo .env.e2e (projeto Supabase de teste) para dentro do ambiente do processo. */
export function carregarAmbiente(): void {
  if (!existsSync('.env.e2e')) {
    throw new Error(
      'Arquivo .env.e2e não encontrado. Os testes de tela precisam de um projeto Supabase de TESTE: veja docs/TESTES.md.',
    )
  }
  for (const linha of readFileSync('.env.e2e', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(linha)
    if (m && !linha.trim().startsWith('#')) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  const faltando = OBRIGATORIAS.filter((chave) => !process.env[chave])
  if (faltando.length > 0) {
    throw new Error(`Faltam variáveis no .env.e2e: ${faltando.join(', ')}`)
  }
}

export function ambiente() {
  return {
    emailSuper: process.env.E2E_EMAIL_SUPER as string,
    senhaSuper: process.env.E2E_SENHA_SUPER as string,
    emailComum: process.env.E2E_EMAIL_COMUM as string,
    senhaComum: process.env.E2E_SENHA_COMUM as string,
  }
}
