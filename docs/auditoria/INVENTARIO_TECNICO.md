# Inventário técnico

Levantado em 17/10/2026 a partir dos arquivos de configuração, `package-lock.json` e comandos de diagnóstico.

## Ambiente de execução

| Item | Versão |
|---|---|
| Node.js | 24.22.0 (README pede 20+) |
| npm | 12.0.2 |
| Sistema operacional do desenvolvimento | Windows 11 |
| Controle de versão | **nenhum** (pasta não é repositório Git) |

## Tecnologias e versões efetivamente instaladas

| Camada | Pacote | Declarado | Instalado |
|---|---|---|---|
| Interface | react / react-dom | ^19.2.8 | 19.3.1 |
| Rotas | react-router-dom | ^7.18.4 | 7.x (ver AUD-022) |
| Dados do servidor | @tanstack/react-query | ^5.104.1 | 5.104.3 |
| Backend | @supabase/supabase-js | ^2.117.2 | 2.118.0 |
| Estilos | tailwindcss, @tailwindcss/vite | ^4.3.3 | 4.3.x |
| Ícones | lucide-react | ^1.48.0 | 1.59.0 |
| PDF | jspdf | ^4.2.1 | 4.2.x (carregado sob demanda) |
| Build | vite | ^8.3.0 | 8.3.4 |
| Linguagem | typescript | ^7.0.2 | 7.0.2 |
| Lint | oxlint | ^1.81.0 | 1.88.0 |
| Testes de regra e tela | vitest, jsdom, @testing-library/*, @vitest/coverage-v8 | ver `package.json` | vitest 5.0.5, jsdom 30.1.3 |
| Testes de banco | @electric-sql/pglite | ^0.5.10 | 0.5.x (Postgres em WebAssembly) |
| Testes de navegador | @playwright/test | ^1.64.1 | 1.64.x (Chromium baixado) |

Dependências de produção: 9. De desenvolvimento: 16. `npm audit`: 0 vulnerabilidades.

## Scripts (`package.json`)

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento (Vite) |
| `npm run build` | `tsc -b` + `vite build` |
| `npm run lint` | oxlint |
| `npm run typecheck` | `tsc -b` |
| `npm test` | Vitest (regras e telas, jsdom, Supabase falso) |
| `npm run test:cobertura` | Vitest com cobertura |
| `npm run test:db` | 5 baterias SQL em Postgres local, todas as migrações |
| `npm run test:e2e` | Playwright (exige `.env.e2e` de um projeto de teste) |

## Estrutura

```
src/                       10.257 linhas de código de aplicação (sem testes)
  components/ui/           20 componentes de interface (Table, Modal, Select, DatePicker, Toast...)
  components/shared/       10 componentes (menu do perfil, filtro de período, guarda de página...)
  components/layout/       Navbar, AppShell
  context/                 Auth, Galpao, GalpaoDados, Theme
  features/                auth, clientes, pagamentos, configuracoes, verificacao
  pages/                   Cobranças, Pagamentos, Recibos, Relatórios, Fechamento
  hooks/ lib/ utils/ types/ config/ routes/
  test/                    infraestrutura de teste (banco falso, fábricas, renderização)
supabase/migrations/       13 arquivos SQL (2.414 linhas)
tests/db/                  5 baterias + base comum
tests/e2e/                 6 cenários Playwright
docs/                      documentação (ver ARQUITETURA_E_QUALIDADE.md)
```

## Banco de dados (Supabase / Postgres)

Tabelas: `galpoes`, `profiles`, `galpao_membros`, `tipos_item`, `precos_galpao`, `clientes`, `itens_guardados`,
`pagamentos`, `recibos`, `recibo_sequences`, `auditoria`. Todas com RLS.

Funções expostas à API (schema `public`): `registrar_pagamento`, `cancelar_pagamento`, `listar_pagamentos`,
`pagamentos_recentes`, `relatorio_resumo`, `fechamento_dia`, `verificar_recibo` (a única pública), `listar_auditoria`,
`nome_usuario`, `fmt_brl`, `abreviar_nome`, `gerar_codigo_recibo`, auxiliares de acesso (`is_super`, `pode_acessar_galpao`,
`auth_galpao_ids`) e gatilhos de auditoria.

Storage: bucket `avatars` (público, 2 MB, só imagens raster).

| Migração | Assunto |
|---|---|
| 0001 | tabelas, funções de acesso, gatilho de perfil |
| 0002 | RLS |
| 0003 | tipos de item iniciais |
| 0004 | e-mail em `profiles` |
| 0005 | preços por galpão |
| 0006 | pagamento único por cliente/semana |
| 0007 | "dono" vira super usuário; avatar |
| 0008 | endurecimento: escalada de privilégio, funções atômicas, integridade |
| 0009 | código de autenticação, paginação no servidor, verificação pública |
| 0010 | código sem repetição entre galpões |
| 0011 | item pago gravado no recibo |
| 0012 | histórico (auditoria), cancelar com senha e motivo |
| 0013 | fechamento do dia |

## Pontos de entrada e fluxo

`index.html` → `src/main.tsx` (checa variáveis de ambiente, carrega `App`) → `App.tsx` (Tema → Avisos → Query → Auth → Galpões →
Dados → Rotas) → `routes/index.tsx` (rotas protegidas, rotas carregadas sob demanda) → páginas.

Fluxo de cobrança: `DashboardPage` → `RegistrarPagamentoModal` → `registrarPagamento` (RPC) → recibo → recarga do cache.

## Configuração e segredos

- `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ambas públicas por desenho); `.env.example` documenta; `.gitignore` ignora `.env*`
  (exceto o exemplo), `.env.e2e`, `coverage`, relatórios de teste.
- Nenhuma ocorrência de `service_role` no projeto.
- Não há `CLAUDE.md`/`AGENTS.md`, `.github/`, `Dockerfile` ou configuração de hospedagem.

## Convenções observadas

Português do Brasil nos textos e nos nomes de domínio; TypeScript estrito com `erasableSyntaxOnly`; componentes funcionais;
estado do servidor só no TanStack Query; regras puras em `utils/` com testes; arquivos de teste em `__tests__/`.
