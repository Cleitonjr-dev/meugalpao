# Plano de entrega do MeuGalpão

> **Para quem for executar (inclusive o Claude em uma conversa nova):** este documento foi escrito para
> que cada parte possa ser feita **sem refazer perguntas**. Leia primeiro as seções 1 e 2 (decisões e
> estado atual) e depois só a parte pedida. Nada aqui foi implementado ainda, exceto o que a seção 2
> lista como "já existe".
>
> Para pedir uma parte, basta dizer, por exemplo: **"faça a Parte 1.2"**. A seção 9 diz o que acontece
> em cada pedido.

Última atualização: 17/10/2026.

## STATUS DA EXECUÇÃO (17/10/2026)

**Feito e verificado** (`tsc`, `oxlint` sem avisos, 107 testes de unidade, 6 grupos de testes do banco, build):
- 1.1 Busca e filtro "Em atraso" nas Cobranças. 1.2 Botão de cobrança por WhatsApp (Cobranças e Relatórios).
- 1.3 Exportar CSV (Pagamentos, Recibos, Clientes). A busca de Clientes agora ignora acentos.
- 1.4 Fechamento do dia: migração `0013_fechamento_dia.sql` + página `/fechamento` + impressão + CSV.
- 2.1 Testes do banco em `tests/db` (`npm run test:db`), incluindo `05-fechamento`.
- 2.2 Playwright configurado (`playwright.config.ts`, `tests/e2e`, `npm run test:e2e`). Só os cenários que não
  precisam de login foram executados (passaram); o restante **ainda não rodou contra um Supabase**.
- 2.3 e Parte 3: `docs/TESTES.md`, `docs/ROTEIRO_DE_TESTES.md`, `docs/ENTREGA.md`, `docs/MANUAL.md`.

**Pendente do usuário:** rodar a migração `0013` (e a `0012`, se ainda não rodou) no Supabase real; criar o
projeto Supabase de teste e o `.env.e2e` para rodar `npm run test:e2e`; desligar o cadastro público.
**Adiado pelo usuário (contas próprias):** migrar para contas próprias (Google, GitHub privado, Supabase novo na região São Paulo). Passos em `docs/ENTREGA.md`: rodar as migrações no projeto novo, trocar URL e chave no `.env`, autorizar o Supabase MCP (somente leitura) no projeto novo e renomear a pasta para `meugalpao`.
**Pendente de decisão:** 3.2 (remover "Criar conta") só depois de o cadastro público estar desligado;
mensagem de cobrança do WhatsApp (texto da Parte 1.2) aprovada pelo usuário?

---

## 1. Contexto e decisões já tomadas pelo usuário

**Sistema:** MeuGalpão, gestão de galpões da Feira da José Avelino (Fortaleza). Clientes guardam itens
(carrinhos, carros) e pagam uma cobrança semanal (quarta ou sábado); cada pagamento gera um recibo.

**Escala:** **3 galpões e 3 usuários.** Por isso foram descartados: convites por e-mail, verificação em
duas etapas (2FA, recusada pelo usuário) e qualquer coisa que só compense com muita gente.

**Decisões do usuário (não perguntar de novo):**
- Cancelar pagamento: qualquer usuário com acesso ao galpão, **sempre com a senha** (já implementado).
- Histórico completo de alterações: **só super usuário** vê (já implementado).
- Numeração de recibo: **por galpão** (continua assim). O código de autenticação do recibo é único no sistema.
- O recibo mostra o item pago em "Referente a:" e a data da semana em "Cobrança de:" (já implementado).
- Visual: usar sempre os componentes padrão do sistema (`Table`, `Modal`, `Tooltip`, `Select`,
  `DatePicker`, `Button`, loading padrão). **Não inventar componente novo se já existe um.**
- Tema claro e escuro precisam funcionar; interface toda em **português do Brasil**.
- Avisos de sucesso/erro: `toast` do sistema. Ações destrutivas: confirmação (e senha quando for sensível).
- O usuário prefere ser consultado sobre layout quando houver mais de uma boa opção (mostrar opções
  com desenho). Para o resto, decidir e explicar.
- Tabela com muitas colunas não deve rolar para o lado: usar a prop `compact` e/ou alargar a página
  (`ROTAS_LARGAS` em `src/components/layout/AppShell.tsx`).

**Escolhidos para esta etapa de entrega:** as 4 melhorias da Parte 1, testes de banco no projeto,
testes de tela com Playwright, roteiro manual e checklist de entrega.

---

## 2. Estado atual do sistema (antes desta execução; veja o STATUS acima)

**Tecnologia:** React 19, Vite 8, TypeScript, Tailwind v4, react-router 7, TanStack Query,
Supabase (Auth, Postgres, RLS, Storage), jsPDF (carregado sob demanda), Vitest.

**Estrutura:**
```
src/
  components/{layout,shared,ui}   componentes reutilizáveis
  config/constants.ts             rótulos (DIAS_PAGAMENTO_LABEL, FORMAS_PAGAMENTO_LABEL, ...)
  context/                        Auth, Galpao (lista/seleção), GalpaoDados (clientes, itens, tipos, preços,
                                  pagamentos da janela recente), Theme
  features/{auth,clientes,configuracoes,pagamentos,verificacao}
  hooks/                          useHoje, useDebounce, useLimitesPeriodo, useMediaQuery, useClickOutside
  lib/                            supabase.ts, queryClient.ts (cache e chaves), buscarTudo.ts, utils.ts
  pages/                          Dashboard (Cobranças), Pagamentos, Recibos, Relatorios
  routes/                         index.tsx (rotas), paginas.ts (carregamento sob demanda)
  types/index.ts
  utils/                          regras puras (pagamentos, valor, recibo, codigo, periodo) + __tests__
supabase/migrations/              0001 a 0012 (SQL aplicado manualmente no SQL Editor)
docs/anexos/testes-db/            scripts de teste do banco (ver Parte 2.1)
```

**Migrações (cada uma roda UMA vez, em ordem):**
| Arquivo | O que faz |
|---|---|
| 0001_init | tabelas, funções de acesso, gatilho de perfil |
| 0002_rls | segurança por linha (RLS) |
| 0003_seed | tipos de item padrão |
| 0004_profiles_email | e-mail no perfil |
| 0005_precos_galpao | preços próprios por galpão |
| 0006_integridade_indices | bloqueia pagamento duplicado |
| 0007_super_usuario_avatar | "dono" vira super usuário; foto de perfil |
| 0008_hardening | correções de segurança; `registrar_pagamento` e `cancelar_pagamento` atômicos; pagamentos/recibos só por função |
| 0009_paginacao_codigo | código de autenticação do recibo; `listar_pagamentos`, `pagamentos_recentes`, `relatorio_resumo`, `verificar_recibo` |
| 0010_codigo_sem_repeticao | gerador do código confere todos os galpões |
| 0011_descricao_pagamento | grava o item pago junto ao pagamento |
| 0012_auditoria | tabela `auditoria`, gatilhos, cancelar com senha recente e motivo, `listar_auditoria`, `nome_usuario` |

**Funcionalidades prontas:** login/recuperação de senha; Cobranças (lista, registrar, recibo, situação em
dia/atraso/adiantado, valor pago preservado); Clientes (modal com dados e itens, itens só gravam ao
"Salvar", itens iguais somam, seletor de quantidade); Pagamentos e Recibos (paginados no servidor, busca,
filtros, período, cancelar com senha, verificar código, WhatsApp, PDF, imprimir); Relatórios (período,
totais no banco, pendências); Configurações (Galpões em cartões com endereço e números, Usuários, Tipos e
preços em tabela com modal por tipo, aba **Histórico** só para super usuário); página pública
`/verificar`; cache TanStack Query; tema claro/escuro sem piscar.

**Testes que existem hoje:** 94 testes de unidade em `src/**/__tests__` (`npm test`). Os testes do banco
**ainda não são um comando do projeto**: os scripts estão em `docs/anexos/testes-db/` (cópia de segurança).

**Funções e peças que serão reaproveitadas (nomes reais):**
- `src/utils/pagamentos.ts`: `indexarPagos`, `pendenciasCliente(cliente, pagos, hoje)` (datas ISO da mais antiga à mais nova), `situacaoCliente`, `SEMANAS_RETROATIVAS_MAX = 8`.
- `src/utils/recibo.ts`: `normalizarWhatsapp`, `whatsappLink(telefone, mensagem)` (devolve `null` se o número for inválido), `formatarDataBR`.
- `src/utils/valor.ts`: `valorSemanal`, `formatarValorInput`, `parseValorBR`, `valorExibido`.
- `src/lib/utils.ts`: `formatCurrency`, `formatDateTime`, `formatDateLong`.
- `src/features/pagamentos/pagamentos.queries.ts`: `listarPagamentos(galpaoId, params)` → `{ total, itens: LinhaPagamento[] }` (máximo 100 por página no servidor).
- `src/components/ui/Table.tsx` (props: `columns`, `data`, `actions`, `serverSide`, `compact`, `onSearch`, `onFilter`...), `Modal` (`size`, `footer`), `Tooltip`, `Button`, `Input`, `Select`, `DatePicker`, `FilterModal`, `ConfirmarSenhaModal`.
- `src/components/shared/FiltroPeriodo.tsx`, `useGuardaPagina`, `ErroCarregamento`.
- `src/hooks/useHoje`, `useLimitesPeriodo`.
- No banco: `pode_acessar_galpao`, `nome_usuario(uuid)` (só o nome), `fmt_brl(numeric)`, `registrar_auditoria` (só interna).

**Antes de começar qualquer parte, confirmar com o usuário quais migrações ele já rodou no Supabase real**
(provavelmente até a 0012). O front depende delas.

---

## 3. Regras de trabalho (como executar qualquer parte)

1. Ler os arquivos reais antes de editar; não confiar só neste documento.
2. Mudanças de banco = **migração nova** (próximo número livre), nunca editar uma já aplicada.
3. Depois de cada mudança rodar: `npx tsc -b`, `npx oxlint` (meta: zero avisos), `npm test`, `npm run build`.
4. Todo cálculo/regra nova vira **função pura** com teste de unidade.
5. Toda função SQL nova: `security invoker` quando for só leitura sob RLS; `revoke ... from public, anon;`
   `grant execute ... to authenticated;` (funções novas são públicas por padrão no Supabase!).
6. Testar SQL no Postgres local (PGlite) antes de entregar a migração (ver Parte 2.1).
7. Textos em português do Brasil, sem emojis, sem travessão longo (—) nos textos novos.
8. Ao terminar, explicar em português simples: o que mudou, o que conferir e o que não foi testado
   (se não abriu o navegador, dizer).
9. **Não** acessar nem usar a chave do `.env` do usuário para consultar o banco dele.

---

# PARTE 1: Melhorias do dia a dia

Ordem sugerida: 1.1 → 1.2 → 1.3 → 1.4.

## 1.1 Busca nas Cobranças

**Objetivo:** achar um cliente rápido quando a lista tiver dezenas de linhas.

**Onde:** `src/pages/DashboardPage.tsx`.

**Comportamento:**
- Campo de busca (componente `Input` com ícone de lupa, `placeholder="Buscar cliente..."`) acima da lista,
  na mesma linha dos botões "Hoje" e "Todos".
- Filtra por **nome, telefone e WhatsApp**, ignorando acentos e maiúsculas ("jose" acha "José"; "8599" acha
  "(85) 99999-9999", comparando só os dígitos quando a busca tiver número).
- Novo filtro rápido **"Em atraso (n)"** ao lado de "Hoje (n)" e "Todos (n)". O número é a quantidade de
  clientes ativos em atraso. Os três funcionam junto com a busca.
- Sem resultado: `EmptyState` com título "Nenhum cliente encontrado" e descrição "Tente outro nome ou
  telefone." (quando há busca) ou o texto atual (quando não há).
- A busca é digitada localmente (não precisa ir para a URL).

**Função pura** em `src/utils/clientes.ts`:
```ts
export function normalizarTexto(texto: string): string            // minúsculas, sem acentos, espaços aparados
export function filtrarClientes(clientes: Cliente[], termo: string): Cliente[]
```
`filtrarClientes` casa o termo normalizado com nome, telefone e WhatsApp (e, se o termo tiver dígitos, com
os dígitos de telefone/WhatsApp). Termo vazio devolve a lista inteira.

**Testes (`src/utils/__tests__/clientes.test.ts`):** acento/maiúscula; busca por telefone com e sem
máscara; termo vazio; sem resultado; cliente sem telefone não quebra.

**Pronto quando:** digitar parte do nome filtra na hora; o chip "Em atraso" mostra só os atrasados;
`tsc`, lint, testes e build passam.

## 1.2 Cobrar atrasados pelo WhatsApp

**Objetivo:** com um clique, abrir o WhatsApp do cliente em atraso com a mensagem pronta.

**Onde:** `src/pages/DashboardPage.tsx` (linha do cliente) e `src/pages/RelatoriosPage.tsx` (lista de pendências).

**Comportamento:**
- Na linha do cliente **em atraso**, ao lado do botão "Receber", um botão **só com ícone**
  (`MessageCircle`) com `Tooltip` "Cobrar pelo WhatsApp". Estilo secundário (borda), 40 px, como o
  botão do recibo (mas sem o azul, para não competir com "Receber").
- Abre `whatsappLink(cliente.whatsapp, mensagem)` em nova aba (`target="_blank" rel="noreferrer"`).
- Se o cliente não tem WhatsApp válido (`whatsappLink` devolve `null`): botão esmaecido e desativado,
  tooltip "Cliente sem WhatsApp válido".
- Em Relatórios, na lista "Pendências (em atraso)", mesmo ícone em cada linha.

**Mensagem (rascunho aprovado a revisar com o usuário):**
```
Olá, {primeiroNome}! Tudo bem?
Passando para lembrar que existe(m) {n} cobrança(s) em aberto no {galpão}:
{lista de datas: "sáb 03/10, sáb 10/10"}
Total: {R$ 220,00}.
Qualquer dúvida, é só falar. Obrigado!
```
(singular/plural corretos; datas com `formatarDataCurta`; valor = valor semanal atual × semanas em aberto.)

**Função pura** em `src/utils/cobranca.ts`:
```ts
export function mensagemCobranca(p: { nomeCliente: string; galpao: string; semanas: string[]; valorTotal: number }): string
```
`semanas` são datas ISO (saída de `pendenciasCliente`).

**Testes:** 1 semana (singular), 3 semanas (plural, lista de datas), primeiro nome de nome composto, valor
formatado em reais.

**Pronto quando:** clicar abre `wa.me/55...` com o texto codificado; cliente sem WhatsApp fica desativado.

## 1.3 Exportar para Excel (CSV)

**Objetivo:** baixar listas em planilha (cópia de segurança, conferência, contador).

**Onde:** botão **Exportar** (ícone `Download`, estilo secundário) no topo de `ListaPagamentos.tsx`
(telas Pagamentos e Recibos) e em `src/features/clientes/index.tsx` (Clientes).

**Comportamento:**
- **Pagamentos/Recibos:** exporta **tudo** que estiver no filtro atual (busca, forma, situação, período),
  não só a página. Busca em lotes de 100 chamando `listarPagamentos` com `pagina` crescente até acabar ou até
  **20.000 linhas** (limite de segurança; avisar com toast se passar). Enquanto baixa, botão com
  `loading` e texto "Exportando...". Colunas (Pagamentos): Recibo, Código, Cliente, Cobrança de, Pago em,
  Forma, Situação, Valor, Item, Recebido por, Cancelado por, Motivo do cancelamento.
- **Clientes:** exporta a lista **filtrada** que está na tela. Colunas: Nome, Telefone, WhatsApp, Dia de
  pagamento, Situação, Valor semanal, Observações, Cadastro.
- Nome do arquivo: `pagamentos-AAAA-MM-DD.csv`, `recibos-...csv`, `clientes-...csv`.
- Formato: UTF-8 **com BOM**, separador `;`, fim de linha `\r\n`, valores em reais com vírgula (`110,00`,
  texto, não fórmula), datas `dd/mm/aaaa`.
- **Proteção contra injeção de fórmula:** se um texto começar com `=`, `+`, `-`, `@`, tab ou retorno de
  carro, prefixar com apóstrofo.
- Aspas duplas dentro do texto são dobradas; campos com `;`, aspas ou quebra de linha vão entre aspas.

**Funções puras** em `src/utils/csv.ts`:
```ts
export function escaparCelula(valor: string | number | null | undefined): string
export function gerarCsv(colunas: string[], linhas: (string | number | null | undefined)[][]): string   // já com BOM
export function baixarCsv(nomeArquivo: string, conteudo: string): void                                    // Blob + link temporário
```

**Testes:** aspas, `;` e quebra de linha; acentos; injeção de fórmula (`=1+1` → `'=1+1`); BOM no início;
número com vírgula; `null` vira vazio. (`baixarCsv` fica fora do teste de unidade.)

**Pronto quando:** o arquivo abre no Excel com acentos corretos e uma coluna por campo; exportar com filtro
traz só o filtrado.

## 1.4 Fechamento do dia

**Objetivo:** conferir o caixa do dia: quanto entrou, em que forma e **quem recebeu**.

### Banco: `supabase/migrations/0013_fechamento_dia.sql`
Função de leitura sob as regras de acesso de quem chama:
```sql
create or replace function public.fechamento_dia(p_galpao uuid, p_data date)
returns jsonb
language sql stable security invoker set search_path = public
as $$ ... $$;
```
Retorno (jsonb):
```json
{
  "data": "2026-10-15",
  "total": 330.00,
  "quantidade": 3,
  "cancelados": { "quantidade": 1, "total": 110.00 },
  "por_forma": [ { "forma": "dinheiro", "total": 220.00, "quantidade": 2 }, ... ],
  "por_usuario": [
    { "usuario_id": "...", "nome": "Maria", "total": 220.00, "quantidade": 2,
      "dinheiro": 110.00, "pix": 110.00, "cartao": 0 }
  ],
  "pagamentos": [
    { "id": "...", "hora": "2026-10-15T14:32:00-03:00", "cliente": "Cleiton Junior", "valor": 110.00,
      "forma": "dinheiro", "status": "pago", "recibo": 6, "recebido_por": "Maria" }
  ]
}
```
Regras:
- Considera pagamentos do galpão com `data_pagamento = p_data`.
- `total`, `por_forma` e `por_usuario` **excluem cancelados**; os cancelados aparecem em `cancelados` e na lista (`status`).
- `por_usuario`: agrupa por `criado_por`; sem usuário vira "Não informado". Nome vem de `nome_usuario(criado_por)`.
- `pagamentos` ordenados por `created_at`; no máximo 500 (se houver mais, devolver também `"truncado": true`).
- Fim da migração: `revoke all ... from public, anon; grant execute ... to authenticated;`.

### Tela: nova página `/fechamento`
- Item **"Fechamento"** no menu (`Navbar.tsx`, depois de "Relatórios"); rota protegida em
  `src/routes/index.tsx` e carregamento sob demanda em `src/routes/paginas.ts`; arquivo
  `src/pages/FechamentoPage.tsx`; consulta em `src/features/pagamentos/pagamentos.queries.ts`
  (`buscarFechamentoDia(galpaoId, dataISO)`) com chave `chaves.fechamento(galpaoId, data)` em
  `src/lib/queryClient.ts`.
- Topo: título "Fechamento do dia", galpão selecionado, `DatePicker` da data (padrão hoje, máximo hoje, mínimo
  `useLimitesPeriodo().min`), botões **Imprimir** e **Exportar CSV**.
- Cartões (`StatCard`): **Total recebido**, **Pagamentos**, **Cancelados** (valor e quantidade).
- Destaque **"Dinheiro a conferir"** (total em dinheiro do dia) em cartão de cor de aviso.
- Bloco **Por forma de pagamento** (dinheiro, pix, cartão) com barras como em Relatórios.
- Tabela **Por quem recebeu** (`Table` padrão): Pessoa, Dinheiro, Pix, Cartão, Total.
- Tabela **Pagamentos do dia** (`Table` padrão, `compact`): Hora, Cliente, Forma, Recibo, Recebido por, Situação, Valor.
- Estados: carregando (`PageLoader`), erro (`ErroCarregamento`), dia sem pagamentos (`EmptyState`
  "Nenhum pagamento neste dia").
- **Impressão:** acrescentar em `src/index.css` (`@media print`) a regra para exibir só `#fechamento-print`
  (como já existe para `#recibo-print`); a página inteira de conteúdo recebe esse `id`; esconde menu e botões.
- **CSV:** reaproveita `gerarCsv`/`baixarCsv` da Parte 1.3 (por isso 1.3 vem antes).
- Nenhum "travar o dia" nesta etapa (fica como ideia futura).

**Função pura** (formatar o resumo para tela/CSV) em `src/utils/fechamento.ts`, se houver lógica além de exibir.

**Testes:**
- Banco (PGlite, em `tests/db`): totais batem; cancelado não entra no total; separa por forma e por pessoa;
  pagamento de outro galpão e de outro dia não entra; usuário sem acesso ao galpão recebe vazio; anônimo
  não executa; pagamento sem `criado_por` aparece como "Não informado"; `truncado` com mais de 500.
- Unidade: o que for função pura.

**Pronto quando:** o total do fechamento de hoje bate com a soma dos pagamentos de hoje na tela Pagamentos
(filtrando o mesmo dia); "Dinheiro a conferir" bate com a soma dos pagamentos em dinheiro; imprime numa
folha sem menu.

---

# PARTE 2: Testes

## 2.1 Testes do banco dentro do projeto (`npm run test:db`)

**Estado:** os scripts existem em `docs/anexos/testes-db/` (4 arquivos, ~600 linhas), escritos com
`@electric-sql/pglite` (Postgres real em WebAssembly). Eles criam um banco vazio, simulam o que o Supabase
fornece (papéis `anon`/`authenticated`/`service_role`, schema `auth` com `auth.uid()`/`auth.jwt()`/`auth.role()`,
schema `storage`), rodam as migrações em ordem e verificam o comportamento.

**O que cada script cobre:**
| Arquivo | Verifica |
|---|---|
| 01-codigo-paginacao | migrações 0001-0012 rodam; código de 16 caracteres único (inclusive entre galpões); numeração sequencial por galpão; pagar a mesma semana é recusado; `listar_pagamentos` (paginação sem repetir linha, busca com `%` e `_` literais, por nº de recibo e por código com traços, filtros de forma/situação/período, ordenação por recibo); `verificar_recibo` (válido, cancelado, inexistente, nulo; nome abreviado; sem campos internos); `abreviar_nome`; `relatorio_resumo`; `pagamentos_recentes`; permissões; migrações 0010 e 0011 repetíveis |
| 02-acesso-rls | usuário comum só vê o próprio galpão (listar, relatório, recentes); não insere recibo direto; não vira super usuário; anônimo só verifica recibo |
| 03-descricao-recibo | item gravado junto ao pagamento; trocar itens depois não altera o antigo; vários itens; item inativo fora; cliente sem item |
| 04-auditoria | `fmt_brl`; cancelar exige senha recente (`amr`) e motivo; token sem `amr` usa `iat`; auditoria criada; gatilhos de cliente/item/tipo/preço/galpão/acesso/permissão; cascata sem ruído; usuário comum não lê; ninguém escreve direto; `listar_auditoria` (paginação, busca, filtro, período); `listar_pagamentos` traz quem recebeu/cancelou sem vazar e-mail; anônimo bloqueado |

**O que fazer ao executar esta parte:**
1. `npm install -D @electric-sql/pglite`.
2. Criar `tests/db/_base.mjs` com a preparação comum (papéis, schemas `auth` e `storage`, função que roda
   as migrações em ordem **lendo `supabase/migrations/` por caminho relativo**, e utilitários `ok`, `falha`,
   `como(usuario, opcoes)` que simula o token). Hoje cada script repete isso.
3. Mover os 4 scripts para `tests/db/` usando `_base.mjs` (trocar o caminho absoluto `PASTA` por relativo;
   o simulador de token usa `set_config('request.jwt.claims', '{"sub":"...","amr":[{"method":"password","timestamp":...}]}', false)`).
4. Criar `tests/db/rodar.mjs` que executa todos em sequência e falha se algum falhar; script no
   `package.json`: `"test:db": "node tests/db/rodar.mjs"`.
5. Acrescentar `05-fechamento.mjs` (Parte 1.4) quando a 0013 existir.
6. Atualizar `README.md` (seção de testes).
- Lembrete: no teste, rodar a `0009` de novo **depois** da `0011` falha (a 0011 muda colunas): isso é esperado,
  cada migração roda uma vez; o teste repete apenas a 0010 e a 0011.

**Pronto quando:** `npm run test:db` mostra todas as verificações "OK" e termina com código 0.

## 2.2 Testes de tela de ponta a ponta (Playwright, `npm run test:e2e`)

**Por que um projeto de teste:** os testes fazem login e gravam dados de verdade. Rodar contra o banco real
é arriscado, e não há Docker/Supabase CLI neste computador. Solução: um **projeto Supabase gratuito só para
teste**.

**Passo a passo para o usuário (também vai em `docs/TESTES.md`):**
1. Em supabase.com criar um projeto novo (nome sugerido: `meugalpao-teste`).
2. No SQL Editor, rodar as migrações `0001` a `0013` em ordem (uma vez cada).
3. Em Authentication → Providers → Email: **desligar "Confirm email"** (só neste projeto de teste).
4. Em Authentication → Users: criar 2 usuários com senha fixa: `e2e-super@teste.com` e `e2e-comum@teste.com`.
5. No SQL Editor: `update public.profiles set is_super = true where email = 'e2e-super@teste.com';`
6. Criar `.env.e2e` na raiz do projeto (o `.gitignore` já ignora `.env.*`):
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO-DE-TESTE.supabase.co
   VITE_SUPABASE_ANON_KEY=chave-anon-do-projeto-de-teste
   E2E_EMAIL_SUPER=e2e-super@teste.com
   E2E_SENHA_SUPER=...
   E2E_EMAIL_COMUM=e2e-comum@teste.com
   E2E_SENHA_COMUM=...
   ```
   **Nunca** colocar as chaves do projeto real aqui.

**Configuração (a criar):**
- `npm install -D @playwright/test` e `npx playwright install chromium`.
- `playwright.config.ts`: `testDir: 'tests/e2e'`, `workers: 1`, `retries: 1`, `use.baseURL: 'http://localhost:5173'`,
  `webServer: { command: 'npx vite --mode e2e', url: 'http://localhost:5173', reuseExistingServer: true }`,
  projetos `desktop` (1366x768) e `celular` (390x844) apenas para o cenário 6.
- Ler `.env.e2e` (por exemplo com `dotenv` carregado no config) e falhar com mensagem clara se faltar algo.
- `tests/e2e/helpers.ts`: `entrar(page, email, senha)`, `criarGalpaoDeTeste(page)` (nome
  `E2E <AAAA-MM-DD HH:mm:ss>`), `excluirGalpao(page, nome)` (digita o nome no prompt de confirmação),
  `registrarClienteComItem(page, ...)`.
- Seletores: preferir `getByRole`/`getByLabel`/texto visível. Rótulos já existentes: botões "Receber",
  "Verificar código", tooltips/aria-label "Ver recibo", "Cancelar pagamento", "Verificar autenticidade",
  campo "Senha", "Motivo do cancelamento". Se faltar um rótulo estável, adicionar `aria-label` (nunca
  `data-testid` espalhado).

**Cenários (cada um é um arquivo `tests/e2e/NN-nome.spec.ts`):**
1. **01-login:** senha errada → mensagem "E-mail ou senha inválidos."; senha certa → título "Cobranças".
2. **02-fluxo-completo** (o principal; usa o galpão de teste e apaga no final):
   1. Entrar como super; Configurações → Galpões → "Novo galpão" com nome e endereço.
   2. Liberar o galpão para o usuário comum (aba Usuários).
   3. Clientes → "Novo cliente" (dia **sábado** ou o dia que faça o cliente estar em atraso hoje; usar
      sempre um cliente criado "no passado" é impossível pela UI: então registrar a cobrança pela lista
      de "Todos" com "Receber"), com 1 item de um tipo existente.
   4. Cobranças → "Receber" → confirmar → recibo abre com **Referente a: <item>** e **Autenticação**
      (16 caracteres em 4 grupos). Guardar o código.
   5. **Sem login** (novo contexto do navegador): abrir `/verificar?c=<código>` → "Válido", cliente abreviado.
   6. Voltar ao sistema: Pagamentos → cancelar: botão desativado sem motivo; **senha errada** → "Senha
      incorreta." e o pagamento continua pago; **senha certa** → toast de sucesso e situação "Cancelado".
   7. Passar o mouse na situação "Cancelado" → tooltip com quem cancelou e o motivo.
   8. Recarregar `/verificar?c=<código>` → "Cancelado".
   9. Configurações → Histórico: aparecem "Pagamento registrado", "Pagamento cancelado" e "Cliente criado".
   10. Fechamento do dia (depois da Parte 1.4): total do dia = 0 e 1 cancelado.
   11. Excluir o galpão de teste (limpeza).
3. **03-busca-whatsapp-csv** (depois das Partes 1.1 a 1.3): busca por parte do nome filtra; cliente em
   atraso mostra o botão de WhatsApp com `href` iniciando em `https://wa.me/55`; exportar Pagamentos baixa
   um `.csv` que começa com o BOM, usa `;` e contém o cabeçalho esperado.
4. **04-tipos-precos:** editar um tipo no modal com preço próprio em um galpão; a tabela mostra o valor; esvaziar
   o campo volta ao padrão.
5. **05-seguranca:** usuário **comum**: o menu não leva a nada de super (Configurações mostra o aviso, sem aba
   Histórico); deslogado, abrir `/pagamentos` redireciona para `/login`; `/verificar` abre sem login.
6. **06-celular** (projeto `celular`): menu hambúrguer abre; Cobranças, Pagamentos e Clientes **sem rolagem
   horizontal** (`document.documentElement.scrollWidth <= innerWidth`); alternar tema claro/escuro sem erros
   no console.

**Regras dos testes:** dados criados sempre com prefixo `E2E`; limpeza no `afterAll`; nunca depender de
dados pré-existentes; sem `waitForTimeout` fixo (esperar por elementos/respostas); `workers: 1` por causa do
limite de tentativas de login do Supabase.

**Limite honesto:** sem o `.env.e2e`, só dá para conferir que os testes compilam (`npx tsc`) e que o app sobe.
Se o usuário criar o projeto de teste e o `.env.e2e`, o Claude pode rodar `npm run test:e2e` e corrigir o
que falhar. **Não pedir que o usuário cole chaves na conversa**: ele só precisa criar o arquivo.

**Pronto quando:** `npm run test:e2e` passa em sequência, sem deixar galpões `E2E` no projeto de teste.

## 2.3 Roteiro manual (`docs/ROTEIRO_DE_TESTES.md`)

Documento curto para o usuário repetir no sistema real depois de publicar. Formato: tabela "Passo | O que
fazer | O que deve acontecer". Cobrir, nesta ordem:
1. Entrar com cada um dos 3 usuários; sair; "Esqueci a senha" (e-mail chega e a nova senha funciona).
2. Cobranças: ver quem está em dia e em atraso; buscar cliente; "Receber" (valor sugerido certo); recibo com item e código.
3. Recibo: Imprimir, Baixar PDF, Enviar WhatsApp.
4. Verificação: digitar o código no botão "Verificar código" e em `/verificar` (também de fora do sistema).
5. Cancelar pagamento: senha errada recusa; senha certa cancela; motivo obrigatório; aparece no Histórico.
6. Clientes: criar, editar itens (adicionar, diminuir quantidade, remover), salvar, cancelar com confirmação.
7. Mudar o preço de um tipo e conferir que pagamentos já feitos não mudam.
8. Pagamentos e Recibos: buscar, filtrar, período, paginar, exportar.
9. Relatórios: períodos, pendências, WhatsApp de cobrança.
10. Fechamento do dia: conferir o dinheiro com o que está em mãos; imprimir.
11. Configurações: criar galpão com endereço, liberar acesso, Tipos e preços, Histórico (só super).
12. Celular: tudo acima navegável, sem rolagem lateral; tema escuro.
13. Fechar a aba, reabrir e conferir que continua logado; esperar a sessão e conferir o aviso.

---

# PARTE 3: Entrega

## 3.1 Checklist (`docs/ENTREGA.md`)
Marcar cada item (caixas `[ ]`) e anotar quem fez e quando.

**Banco e Supabase (produção)**
- [ ] Migrações `0001` a `0013` aplicadas na ordem, uma vez cada; consulta de teste de cada uma conferida.
- [ ] Authentication → Providers → Email: **desligar "Allow new users to sign up"**; manter "Confirm email" ligado.
- [ ] Authentication → URL Configuration: cadastrar a URL final do sistema (usada no link de "esqueci a senha").
- [ ] Backups ativos (plano com backup diário/ponto no tempo) **e uma restauração testada** em projeto à parte.
- [ ] Confirmar que a chave `service_role` não existe em nenhum arquivo do front nem no `.env` publicado
      (só a URL e a chave `anon`).
- [ ] Criar as 3 contas reais pelo painel (Authentication → Users → Add user) com senhas fortes;
      marcar o super usuário (`update public.profiles set is_super = true where email = '...'`);
      liberar os galpões na tela Usuários.
- [ ] Verificar no app que o cancelamento com senha funciona (se o app disser "Confirme sua senha" mesmo com a
      senha certa, o token do Supabase não traz `amr`: ver Parte 4, risco 1).

**Dados**
- [ ] **Apagar os dados de teste** (clientes, itens e pagamentos usados em testes). Cliente com pagamento não
      se exclui pela tela: usar SQL no Supabase ou recriar o galpão de teste e excluí-lo (apaga em cascata).
- [ ] Conferir tipos de item e preços de cada galpão com o usuário.
- [ ] Preencher o endereço dos 3 galpões.

**Publicação**
- [ ] `npm run build` e publicar a pasta `dist` em hospedagem com **HTTPS** (a escolha da hospedagem ainda
      está **em aberto**; opções simples: Netlify, Vercel, Cloudflare Pages). Configurar a regra de
      "reescrever tudo para `index.html`" (o sistema usa rotas como `/pagamentos` e `/verificar`).
- [ ] Variáveis de ambiente de produção: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do projeto real.
- [ ] Testar de fora: abrir a URL no celular, entrar, abrir `/verificar?c=...` sem login.

**Qualidade**
- [ ] `npm test`, `npm run test:db` e `npm run test:e2e` passando.
- [ ] Roteiro manual (2.3) feito no sistema publicado.
- [ ] `npm audit` sem vulnerabilidades.

**Documentos a entregar**
- [ ] `docs/MANUAL.md`: manual curto de uso para os 3 usuários (como cobrar, emitir e reenviar recibo,
      cancelar, verificar, fechar o dia, esqueci a senha). Linguagem simples, com os nomes exatos dos botões.
- [ ] Lista de contas e acessos (e-mails; **sem** senhas no documento) e quem é super usuário.
- [ ] Onde estão: o código, o projeto Supabase, a hospedagem e como restaurar um backup.

## 3.2 "Criar conta" na tela de login
Depois de desligar o cadastro público no Supabase, **remover** o botão "Criar conta" e o modo de cadastro de
`src/features/auth/LoginPage.tsx` (e `signUp` de `AuthContext.tsx` se ficar sem uso), mantendo "Esqueceu a
senha?". Confirmar com o usuário antes (ele precisa ter desligado a opção). Ajustar o texto da aba Usuários
("Novos usuários criam a conta pela tela de login..." passa a "As contas são criadas pelo painel do Supabase.").

## 3.3 Itens do levantamento por tela que ficaram para depois
(Aprovados como ideia, **não** fazem parte desta etapa. Só fazer se o usuário pedir.)
- **Proteção de dados:** arquivar galpão/cliente em vez de excluir (hoje excluir galpão apaga tudo em
  cascata); senha ao excluir e ao dar/remover super usuário (reaproveitar `ConfirmarSenhaModal`); sair
  sozinho após X minutos sem uso.
- **Caixa e conferência:** valor diferente do esperado exige motivo; relatório "por quem recebeu".
- **Preços:** histórico de preços com data de vigência (resolve também o preço de semanas em atraso);
  não deixar excluir tipo em uso.
- **Relatórios:** exportar PDF; todos os galpões juntos; atraso por faixa; comparar períodos.
- **Recibos:** marcar "2ª via" nas reimpressões.
- **Clientes:** histórico do cliente dentro do modal; avisar cliente repetido.
- **Infra:** monitoramento de erros; política de privacidade (LGPD).

---

# PARTE 4: Riscos, armadilhas e decisões em aberto

**Riscos**
1. **Cancelar com senha depende do token do Supabase trazer `amr`** (data do login por senha). Foi testado
   só num Postgres local com token simulado. Se no Supabase real o app recusar com a senha certa, a causa é
   o token; a função já cai para `iat`; se ainda assim falhar, ajustar a regra em `cancelar_pagamento`
   (migração nova).
2. **Cada migração roda uma vez.** Rodar a `0011` depois da `0012` volta funções antigas e quebra telas.
3. **Quem não rodou as migrações** vê erro nas telas novas (Pagamentos, Recibos, Relatórios, Cobranças).
4. **E2E depende do projeto de teste**; sem ele, não há como executar.
5. **Exportar muitas linhas:** limite de 20.000 por arquivo; acima disso, orientar a filtrar por período.
6. **Fuso horário:** datas de pagamento são "dia de Fortaleza" (gravadas pelo servidor); o fechamento usa
   `data_pagamento`, então vale o dia de Fortaleza, não o do computador do usuário.

**Decisões ainda em aberto (perguntar só quando chegar na parte)**
- Nome do item de menu: "Fechamento" (sugerido) ou "Caixa".
- Texto final da mensagem de cobrança por WhatsApp (rascunho na Parte 1.2).
- Botão de exportar também no Histórico e em Relatórios?
- Onde será publicado o sistema (hospedagem) e qual será o endereço.
- Se o "Criar conta" já pode sair (depende do cadastro público estar desligado).

**Armadilhas conhecidas ao editar o código**
- `Table` em modo `serverSide` exige `total`, `page`, `pageSize` e `onPageChange`.
- `Modal` desmonta o conteúdo ao fechar: o estado do formulário nasce de novo a cada abertura (padrão usado
  em `TipoModal`, `ClienteModal`, `ConfirmarSenhaModal`).
- Funções SQL novas precisam de `revoke`/`grant` explícitos.
- `GalpaoDadosContext.recarregar()` invalida listas, relatórios e resumo dos galpões: chamar depois de gravar.
- Em PowerShell/Bash, textos com aspas e acentos em comandos longos quebram: escrever arquivos com a
  ferramenta de escrita e rodar scripts Python para edições grandes.

---

# 9. Como pedir (frases e o que o Claude faz)

| O usuário diz | O Claude faz |
|---|---|
| "Faça a Parte 1.1" | Busca e filtro "Em atraso" nas Cobranças, com testes. |
| "Faça a Parte 1.2" | Botão de cobrança por WhatsApp (Cobranças e Relatórios) e `mensagemCobranca`, com testes. Mostra a mensagem para o usuário aprovar. |
| "Faça a Parte 1.3" | Exportar CSV (Pagamentos, Recibos, Clientes), `csv.ts` e testes. |
| "Faça a Parte 1.4" | Migração `0013`, função `fechamento_dia`, página `/fechamento`, impressão, CSV, testes do banco. O usuário precisa rodar a `0013` no Supabase. |
| "Faça a Parte 1" | 1.1 a 1.4 em sequência. |
| "Faça os testes do banco" | Parte 2.1 (`npm run test:db`). |
| "Faça os testes de tela" | Parte 2.2: instala o Playwright, escreve os cenários e a documentação; roda se o usuário já criou o `.env.e2e`. |
| "Faça o roteiro e o checklist" | Cria `docs/ROTEIRO_DE_TESTES.md`, `docs/ENTREGA.md`, `docs/TESTES.md` e `docs/MANUAL.md`. |
| "Tire o Criar conta" | Parte 3.2 (perguntar se o cadastro público já foi desligado). |
| "Faça tudo" | Ordem: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3 (documentos). Pausar quando precisar de algo do usuário (rodar migração, criar projeto de teste). |

**Verificação final de tudo:** `npx tsc -b`, `npx oxlint`, `npm test`, `npm run test:db`, `npm run build`
sem erros; `npm run test:e2e` passando com o projeto de teste; roteiro manual feito no sistema publicado.
