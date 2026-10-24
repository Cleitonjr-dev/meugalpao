# Matriz de cobertura da auditoria

O que foi inspecionado, como, e com qual resultado. "Lido" significa leitura integral ou das partes relevantes do arquivo.
"Verificado" significa que houve também execução (teste, consulta, build).

| Área | Arquivos | Como foi analisado | Resultado |
|---|---|---|---|
| Banco: estrutura e RLS | `0001`, `0002`, `0004`, `0005`, `0006` | lidos na íntegra; catálogo no Postgres local | AUD-002, 008 |
| Banco: endurecimento | `0007`, `0008` | lidos na íntegra | AUD-003, 006, 007, 011 |
| Banco: funções e verificação pública | `0009`, `0010`, `0011` | lidos (funções e permissões) | AUD-012, 017 |
| Banco: auditoria e cancelamento | `0012` | lido (gatilhos, cancelar, listar, permissões) | AUD-001, 002, 004 |
| Banco: fechamento | `0013` | escrito nesta etapa do projeto; testado | sem achados |
| Testes de banco | `tests/db/*` | lidos e executados | AUD-029 |
| Autenticação e sessão | `AuthContext`, `LoginPage`, `ProfileDropdown`, `useUserAvatar`, `ConfirmarSenhaModal` | lidos; testes de tela | AUD-005, 007, 010 |
| Rotas e estrutura | `App`, `main`, `routes/*`, `AppShell`, `Navbar` | lidos | AUD-020, 022 |
| Contextos e cache | `GalpaoContext`, `GalpaoDadosContext`, `ThemeContext`, `lib/*` | lidos | AUD-013, sem outros |
| Regras de cobrança | `utils/pagamentos`, `valor`, `periodo`, `recibo`, `codigo`, `csv`, `clientes`, `cobranca` | lidos; 100% cobertos | AUD-013, 014, 023, 033 |
| Cobranças | `DashboardPage`, `RegistrarPagamentoModal`, `BotaoCobrarWhatsapp` | lidos; testes de tela (100%) | sem achados novos |
| Clientes | `features/clientes/*` | lidos; testes de tela (99%) | AUD-016 |
| Pagamentos e recibos | `features/pagamentos/*`, `utils/reciboPdf` | lidos; testes de tela (95%) | AUD-018, 019 |
| Relatórios e Fechamento | `RelatoriosPage`, `FechamentoPage` | lidos | AUD-017; sem teste (AUD-027) |
| Configurações | `features/configuracoes/*` | lidos | AUD-001, 003, 015, 016; pouco teste |
| Verificação pública | `features/verificacao/*` | lidos | sem achados |
| Interface | `components/ui/*`, `components/shared/*` | lidos (Table, Modal, Select, Toast, Tooltip, DatePicker, Button, Input, FilterModal...) | AUD-018, 021, 034 |
| Configuração do projeto | `package.json`, `vite.config.ts`, `tsconfig*`, `.oxlintrc.json`, `.gitignore`, `index.html`, `playwright.config.ts` | lidos | AUD-009, 025 |
| Dependências | lockfile, `npm audit`, `npm outdated` | executados | AUD-031 |
| Documentação | `README.md`, `docs/*.md` | lidos | AUD-026 |
| Padrões de risco | todo `src` | buscas por `dangerouslySetInnerHTML`, `eval`, `innerHTML`, `any`, `@ts-`, `console`, storage, `service_role`, `window.open` | nada além do informado |
| Documentação oficial (Context7) | Supabase, React Router, TanStack Query, Vitest, jsPDF, Tailwind | consultadas (ver abaixo) | AUD-004, 006, 008, 022 |

## Consultas ao Context7

| Biblioteca (id) | Pergunta | Uso no relatório |
|---|---|---|
| Supabase `/websites/supabase` | claims `amr` com `method`/`timestamp`; ordem do array | AUD-004 |
| Supabase `/websites/supabase` | funções `security definer`, `revoke execute from public`, `search_path` | AUD-008 |
| Supabase `/websites/supabase` | buckets públicos e política `SELECT` (advisor "Public bucket listing") | AUD-006 |
| Supabase `/websites/supabase` | cadastro, política de senha, limites | `SEGURANCA.md` |
| React Router `/websites/reactrouter` | `react-router-dom` no v7/v8 | AUD-022 |
| TanStack Query `/tanstack/query` | `placeholderData`/`keepPreviousData`, invalidação por prefixo | `ARQUITETURA_E_QUALIDADE.md` |
| Vitest `/vitest-dev/vitest` | `useFakeTimers({ toFake })`, `setSystemTime` | `TESTES_E_VALIDACAO.md` |
| jsPDF `/parallax/jspdf` | aviso de segurança do README sobre entrada do usuário | `SEGURANCA.md` |
| Tailwind `/websites/tailwindcss` | renomeações do v4 (consulta na revisão anterior) | sem achados |

Limitação: as versões consultadas são as da documentação publicada pelo Context7 para cada biblioteca; o projeto usa as
versões listadas em `INVENTARIO_TECNICO.md`. Onde a documentação não distingue versão, está dito no achado.

## Não inspecionado ou pendente

| Item | Motivo |
|---|---|
| Painel do Supabase (cadastro, senhas, backups, URL) | sem acesso; MCP do Supabase instalado, não autenticado |
| Dados reais do banco | fora do escopo e sem autorização |
| Hospedagem, HTTPS, cabeçalhos | ainda não escolhida |
| Execução dos testes de navegador completos | falta o projeto Supabase de teste |
| Desempenho com volume | sem métricas; inspeção só |
| Arquivos binários (`public/*.png`, `.svg`) | sem relevância de segurança |
