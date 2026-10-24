# Plano de correção

Baseado em `ACHADOS_TECNICOS.md` (17/10/2026). Cada grupo é pequeno e verificável. Regra de ouro: **teste antes e depois**;
migração nova nunca altera uma já aplicada; nada de refatoração grande misturada com correção de segurança.

Validação padrão de todo grupo: `npx tsc -b && npx oxlint && npm test && npm run test:db && npm run build`.

## Resumo das fases

| Fase | Foco | Achados | Precisa de ação do dono? |
|---|---|---|---|
| A | Segurança e dinheiro (banco + front) | 001, 002, 003, 004, 005, 006, 007, 008, 010, 011, 012, 015 | Sim: rodar a migração `0014` e desligar o cadastro no painel |
| B | Regras e interface | 013, 014, 017, 018, 019, 020, 021, 022, 023, 033 | Não |
| C | Operação e documentação | 009, 024, 025, 026, 029 | Escolher a hospedagem (para ativar os cabeçalhos) |
| D | Testes | 027, 028 | Criar o projeto Supabase de teste (para o E2E) |
| Adiado | Estrutural | 016, 032, 034 | (justificado abaixo) |

## Fase A: segurança e dinheiro

### A1: Dado financeiro não se apaga (AUD-001, AUD-002)
- **Arquivos:** nova `supabase/migrations/0014_endurecimento.sql`; `GalpoesManager.tsx`; `tests/db/06-endurecimento.mjs`; teste de tela.
- **Causa raiz:** cascata total e políticas de exclusão em tabelas financeiras.
- **Estratégia:** (1) gatilho `BEFORE DELETE` em `galpoes` recusa quando há pagamentos (mensagem em português); (2) remover as
  políticas `pagamentos_delete` e `recibos_delete` e revogar `DELETE` de `authenticated`; (3) gatilho de auditoria para `DELETE`
  em `pagamentos`/`recibos` (cobre `service_role` e SQL Editor); (4) na interface, exclusão de galpão pede senha (`ConfirmarSenhaModal`)
  e explica "galpão com pagamentos não pode ser excluído".
- **Dependências:** nenhuma. **Riscos:** limpar galpões de teste com pagamentos deixa de ser possível pela tela
  (limpeza passa a ser pelo SQL Editor, documentada). **Validação:** `test:db` (delete recusado/permitido), teste de tela, roteiro manual.

### A2: Senha recente única e sem brecha (AUD-003, AUD-004)
- **Estratégia:** função `public.senha_confirmada_recentemente()` (usa `amr`, **sem** fallback de `iat`, janela de 2 min);
  `cancelar_pagamento` e o gatilho `proteger_colunas_profile` (mudança de `is_super`) passam a usá-la; na tela de Usuários,
  alterar super usuário abre `ConfirmarSenhaModal`.
- **Dependências:** A1 (mesma migração). **Riscos:** se o token real não trouxer `amr`, o cancelamento e a promoção deixam de funcionar:
  por isso o passo manual "conferir o token" é verificado logo após rodar a migração (instrução no `CHANGELOG`).
- **Testes:** `test:db` (token sem senha recente é recusado; com senha recente passa; sem `amr` é recusado); tela (pede senha).

### A3: Endurecimento do restante do banco (AUD-006, 007, 008, 011, 012)
- **Estratégia (mesma migração):** `drop policy avatars_public_read`; gatilho que só aceita `avatar_url` do bucket do próprio usuário;
  `revoke execute ... from public, anon` nas auxiliares e gatilhos (mantendo `authenticated`, necessário às políticas RLS);
  `CHECK ... NOT VALID` de tamanho (nome 120, endereço 200, telefone/WhatsApp 30, observações 500); `registrar_pagamento` passa a
  limitar a semana (de 53 semanas atrás a 8 semanas à frente) e o valor (até R$ 100.000,00).
- **Cuidado:** a nova versão de `registrar_pagamento` parte do corpo atual (`0012`), mudando só as validações.
- **Testes:** `test:db` (listar funções chamáveis por anônimo: só `verificar_recibo`; valores/semanas fora do limite recusados).

### A4: Cadastro e sessão (AUD-005, AUD-010)
- **Estratégia:** remover o modo "Criar conta" do `LoginPage` e o `signUp` do `AuthContext`; hook `useInatividade` (30 min) no
  `AppShell` que faz `signOut` e avisa. Passo manual: desligar **Allow new users to sign up** no painel.
- **Testes:** tela de login (sem botão de cadastro), hook com relógio simulado.

### A5: Tipos de item em uso (AUD-015)
- **Estratégia:** não permitir excluir tipo em uso (tela: mensagem com a quantidade; banco: gatilho `BEFORE DELETE` em `tipos_item`);
  ação **Desativar/Ativar** (usa a coluna `ativo`, que já tira o tipo das opções de novos itens).
- **Testes:** tela e `test:db`.

## Fase B: regras e interface

| Grupo | Achado | Estratégia | Testes |
|---|---|---|---|
| B1 | AUD-013, AUD-033 | `src/utils/data.ts`: `agoraEmFortaleza()` (devolve um `Date` cujos campos locais são os de Fortaleza, via `Intl`), `parseISO` único; usado por `useHoje` e pela janela de dados | unidade com instantes fixos em fusos diferentes |
| B2 | AUD-014 | janela de 26 semanas (dados e pendências em sincronia); quando ainda houver corte, etiqueta "26+ semanas" e aviso na mensagem de cobrança | unidade (30 semanas em aberto) + tela |
| B3 | AUD-017 | aviso "mostrando os 31 dias mais recentes" quando o período passa de 31 dias | tela de Relatórios |
| B4 | AUD-018 | `Table` sincroniza o campo com `searchDefault` quando ele muda (sem apagar espaços digitados) | tela: botão Voltar |
| B5 | AUD-019 | exportação remove duplicados por `id` e confere a contagem | unidade |
| B6 | AUD-020, 021, 023 | menu "Cobranças"; `role="alert"` em erros; `APP_NAME` no texto do recibo | tela / unidade |
| B7 | AUD-022 | imports de `react-router`, remover `react-router-dom` | `tsc`, testes, build |

## Fase C: operação e documentação

| Grupo | Achado | Estratégia |
|---|---|---|
| C1 | AUD-024 | tabela `migracoes_aplicadas` (criada e preenchida na `0014`; cada migração futura se registra), consulta de verificação documentada; roteiro de migração |
| C2 | AUD-025 | `.github/workflows/ci.yml` (tsc, lint, testes, banco, build, audit) pronto para o repositório |
| C3 | AUD-009 | `public/_headers` e `vercel.json` com CSP e cabeçalhos; documentação |
| C4 | AUD-029 | `tests/db/_base.mjs` aplica os *default privileges* do Supabase; teste das funções chamáveis por anônimo |
| C5 | AUD-026 | reorganizar `docs/` no padrão descrito em `docs/README.md` e atualizar README, ENTREGA, TESTES, MANUAL, PLANO_ENTREGA |

## Fase D: testes

- Completar telas sem teste: Fechamento, Relatórios, Configurações (4 abas), Navbar, ProfileDropdown, rotas, App, `reciboPdf`,
  componentes `Table`, `Modal`, `Select`, `DatePicker`, `FilterModal`, `Toast`, `Tooltip`. Meta: **≥ 85% das linhas**.
- E2E: depende do projeto Supabase de teste (ação do dono).

## Itens adiados (com motivo)

| Achado | Por que adiar |
|---|---|
| AUD-016 (transações em `salvar_cliente`/`salvar_tipo`) | Reescreve dois fluxos grandes já testados; o comportamento atual é seguro de repetir e informa o usuário. Fazer como projeto próprio, com testes antes |
| AUD-032 (telemetria de erros) | Opcional; escolha de serviço é decisão do dono |
| AUD-034 (componentes extensos) | Sem defeito; extrair só ao mexer de novo |

## Ordem de execução

A1 → A2 → A3 → A5 (mesma migração `0014`, o teste de banco primeiro) → A4 → B1 → B2 → B3 a B7 → C → D.
Cada grupo termina com a validação padrão e uma linha no `docs/CHANGELOG.md`.
