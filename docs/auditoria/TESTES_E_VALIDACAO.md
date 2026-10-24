# Testes e validação

Resultados reais de 17/10/2026. Cada linha foi executada nesta auditoria.

## Comandos executados

| Comando | Resultado |
|---|---|
| `npx tsc -b` | sem erros |
| `npx oxlint` | sem avisos |
| `npm test` | 348 passando (17 arquivos). Antes da correção do AUD-030: 1 falha em 2 de 3 execuções completas |
| `npm test` ×5 após a correção | 5 de 5 verdes |
| `npm run test:db` | `01-codigo-paginacao`, `02-acesso-rls`, `03-descricao-recibo`, `04-auditoria`, `05-fechamento`: todos passaram |
| `npm run build` | sucesso (código dividido por página; `jspdf` em arquivo separado) |
| `npm audit` | 0 vulnerabilidades |
| `npx vitest run --coverage` (saída fora do projeto) | 65,3% linhas, 63,7% instruções, 60,9% ramos, 62,9% funções |
| `npx playwright test --list` | 20 testes em 6 arquivos reconhecidos |
| `playwright test` (3 cenários sem login) | passaram. Os demais **não foram executados** |
| Consulta ao catálogo do Postgres local | privilégios de `anon` e políticas/gatilhos de `pagamentos`/`recibos` (AUD-002, AUD-008) |

## Estrutura dos testes

| Camada | Onde | O que prova | Limite |
|---|---|---|---|
| Regras | `src/utils/__tests__`, `src/features/**/__tests__` | cálculos de cobrança, valores, CSV, código, período, planejamento de preços | sem interface |
| Telas (jsdom + banco falso) | `src/**/*.tela.test.tsx`, `src/test/` | o que a pessoa vê e faz: Login, Cobranças, Clientes, Pagamentos, Recibos | banco simulado; sem layout/CSS |
| Banco | `tests/db` (PGlite) | migrações, RLS, funções, auditoria, fechamento | PGlite não reproduz os *default privileges* do Supabase (AUD-029) |
| Navegador | `tests/e2e` (Playwright) | fluxo completo contra Supabase de teste | exige projeto de teste (AUD-028) |

## Cobertura por área (linhas)

| Área | Cobertura |
|---|---|
| `utils/*` (regras) | 100% |
| Cobranças (`DashboardPage`) | 100% |
| Clientes | 99% |
| Pagamentos/Recibos (`features/pagamentos`) | 95% |
| Contextos (Auth, Galpões, Dados) | 77-100% |
| Login e autenticação | 79% |
| Verificação de recibo | 73% |
| Componentes de interface (`components/ui`) | 76% |
| Componentes compartilhados | 35% |
| Configurações | **9%** |
| Fechamento, Relatórios, Menu, Rotas, App | **0%** |
| `reciboPdf` | **4%** |

Cobertura percentual é um indicador, não uma prova de qualidade. Aqui ela é útil para apontar **onde não há teste nenhum**.

## Qualidade dos testes existentes

- Bons: descrevem o comportamento visto pelo usuário (português), usam relógio fixo (sábado 11/10/2025 em Fortaleza), banco
  falso com RLS simplificada, cenário padrão com 7 clientes em situações diferentes.
- Cuidados já tomados: sem esperas fixas, `userEvent` sem atraso, verificação de requisições enviadas ao servidor.
- Riscos conhecidos: o banco falso simplifica regras (conferidas de verdade em `tests/db`); asserções que dependem do espaço sem
  quebra do real (`R$ 110,00`) usam um auxiliar (`semNbsp`).
- Instabilidade encontrada e corrigida: AUD-030.

## Lacunas de teste (prioridade)

1. **Segurança/dinheiro novos:** exclusão de galpão com pagamentos, exclusão de pagamento, super usuário com senha, tipo em uso, janela de dívida.
2. **Telas sem teste:** Fechamento, Relatórios, Configurações (Galpões, Usuários, Tipos e preços, Histórico), Navbar, ProfileDropdown, rotas protegidas.
3. **Componentes de interface:** Table, Modal, Select, DatePicker, FilterModal, Toast, Tooltip.
4. **`reciboPdf`** (smoke com jsPDF real) e `exportarPagamentos` (limite de 20.000 linhas).
5. **Banco:** teste que lista funções chamáveis por anônimo; migração de ledger; novas validações de `registrar_pagamento`.
6. **Navegador:** executar o `test:e2e` completo.

## Como validar uma correção

Para cada correção do `PLANO_DE_CORRECAO.md`: (a) escrever o teste que **falha** antes; (b) aplicar a correção; (c) rodar
`npx tsc -b && npx oxlint && npm test && npm run test:db && npm run build`; (d) rodar o roteiro manual da área.
