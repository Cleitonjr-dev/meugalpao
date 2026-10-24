// Roda todos os testes do banco em sequência (cada um num Postgres novo) e falha se algum falhar.
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const pasta = fileURLToPath(new URL('./', import.meta.url))
const arquivos = readdirSync(pasta).filter((a) => /^\d{2}-.*\.mjs$/.test(a)).sort()

let falhou = false
for (const arquivo of arquivos) {
  console.log(`\n=== ${arquivo}`)
  const r = spawnSync(process.execPath, [pasta + arquivo], { stdio: 'inherit' })
  if (r.status !== 0) falhou = true
}

console.log(falhou ? '\nHÁ TESTES DO BANCO FALHANDO' : '\nTODOS OS TESTES DO BANCO PASSARAM')
process.exit(falhou ? 1 : 0)
