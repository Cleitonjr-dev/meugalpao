# Achados técnicos

Auditoria de 17/10/2026. Todos os achados abaixo foram verificados por leitura do código e do SQL; quando houve
execução, está indicado. **Nenhum foi corrigido na fase de diagnóstico.**

**Legenda.** Severidade: crítica, alta, média, baixa, informativa. Confiança: alta, média, baixa.
Status: *reproduzido* (executado e observado), *confirmado por inspeção* (o código prova o comportamento),
*hipótese a validar* (depende de algo que não foi possível verificar).

## Resumo

| Severidade | Qtde | IDs |
|---|---|---|
| Crítica | 0 | |
| Alta | 2 | AUD-001, AUD-014 |
| Média | 9 | AUD-002, 003, 004, 005, 013, 015, 016, 024, 027 |
| Baixa | 18 | AUD-006 a 012, 017 a 021, 023, 025, 026, 028, 029, 033 |
| Informativa | 5 | AUD-022, 030, 031, 032, 034 |
| **Total** | **34** | |

---

## Segurança e integridade de dados

### AUD-001: Excluir galpão apaga todo o financeiro, protegido só por um `prompt`
- **Categoria:** segurança / perda de dados. **Severidade:** alta. **Confiança:** alta. **Status:** confirmado por inspeção.
- **Onde:** `src/features/configuracoes/GalpoesManager.tsx:84-100`; `supabase/migrations/0001_init.sql` (FKs `on delete cascade`); `0012_auditoria.sql` (`auditar_galpoes`).
- **Comportamento atual:** `window.prompt` pede o nome do galpão e então `supabase.from('galpoes').delete()`. As chaves
  estrangeiras em cascata apagam clientes, itens, **pagamentos e recibos**. A auditoria grava uma única linha de texto,
  sem a contagem do que foi destruído. Não há confirmação de senha nem alternativa de arquivar.
- **Esperado:** dado financeiro não deve poder ser destruído por uma ação de interface de um clique mais um texto digitado.
- **Causa raiz:** modelagem com cascata total e ausência de "arquivamento" (soft delete).
- **Impacto:** perda irreversível e sem rastro detalhado, por erro humano ou sessão sequestrada de um super usuário.
- **Verificação:** com o app aberto como super usuário, excluir um galpão com pagamentos.
- **Correção recomendada:** (1) gatilho `BEFORE DELETE` em `galpoes` que recusa quando existem pagamentos; (2) coluna
  `arquivado_em` + ação "Arquivar" na interface; (3) exigir senha (`ConfirmarSenhaModal`) para excluir galpão sem dados;
  (4) auditar com contagens.
- **Riscos da correção:** quem hoje usa a exclusão para limpar galpões de teste passará a precisar arquivar ou limpar antes.
- **Testes:** banco (exclusão recusada com pagamentos, permitida sem), tela (pede senha, mensagem clara).

### AUD-002: Super usuário (ou sessão dele) pode apagar pagamentos e recibos direto pela API, sem trilha
- **Categoria:** integridade / auditoria. **Severidade:** média. **Confiança:** alta. **Status:** reproduzido (consulta ao catálogo).
- **Onde:** `0008_hardening.sql:375-396` (`pagamentos_delete`, `recibos_delete`); `0012_auditoria.sql` (triggers).
- **Evidência (executada):** `pg_policy` lista `pagamentos_delete` e `recibos_delete`; `pg_trigger` não tem nenhum
  gatilho de auditoria em `pagamentos` nem em `recibos`.
- **Comportamento atual:** quem tem `is_super` consegue `DELETE /rest/v1/pagamentos` e a linha some sem registro no histórico.
- **Esperado:** pagamentos só mudam por `registrar_pagamento`/`cancelar_pagamento` (cancelar, nunca apagar).
- **Impacto:** fraude ou erro silencioso no caixa; numeração de recibos com buracos sem explicação.
- **Correção:** remover as duas políticas de `delete` (e `revoke delete`), e adicionar gatilho de auditoria para `delete`
  como defesa em profundidade (cobre `service_role`/SQL Editor).
- **Testes:** banco (delete por super usuário é recusado; delete administrativo gera linha em `auditoria`).

### AUD-003: Promover super usuário e liberar acessos não pedem a senha de novo
- **Severidade:** média. **Confiança:** alta. **Status:** confirmado por inspeção.
- **Onde:** `src/features/configuracoes/UsuariosManager.tsx:45-80`; `0008_hardening.sql:20-55` (`proteger_colunas_profile`).
- **Comportamento atual:** o checkbox "Super Usuário" faz `update profiles set is_super` na hora. O servidor só confere que quem
  chama já é super usuário.
- **Impacto:** quem pegar uma sessão aberta de um super usuário (computador compartilhado da feira) pode criar outro
  super usuário permanente e contornar a troca de senha.
- **Correção:** função `senha_confirmada_recentemente()` no banco (mesma regra do cancelamento) exigida pelo gatilho
  quando `is_super` muda; na tela, `ConfirmarSenhaModal` antes de alterar.
- **Testes:** banco (alteração sem senha recente é recusada); tela (pede a senha).

### AUD-004: "Senha recente" cai para o `iat` quando o token não traz `amr`
- **Severidade:** média. **Confiança:** média. **Status:** hipótese a validar.
- **Onde:** `0012_auditoria.sql:408-420`.
- **Documentação consultada (Context7, Supabase `/websites/supabase`, página Auth/MFA e JWT fields):** o `amr` é um array
  ordenado do mais recente para o mais antigo, com `method` e `timestamp`; o tipo oficial declara `amr?` (opcional).
- **Comportamento atual:** com `amr` vazio, vale o `iat` do token. Um token **renovado** (refresh) tem `iat` recente sem que
  a senha tenha sido digitada, o que liberaria o cancelamento por 2 minutos.
- **Esperado:** falhar fechado: sem prova de login por senha recente, recusar.
- **Verificação pendente:** abrir um token real do projeto e conferir se `amr` está presente após `signInWithPassword`
  (esperado que sim, pela documentação).
- **Correção:** remover o *fallback* e usar a mesma função da AUD-003. Risco: se o token real não trouxer `amr`, o
  cancelamento deixa de funcionar (por isso a verificação acima antes de publicar).

### AUD-005: Cadastro público de contas
- **Severidade:** média. **Confiança:** média. **Status:** hipótese a validar (depende do painel do Supabase).
- **Onde:** `src/features/auth/LoginPage.tsx` (modo `register`, `signUp`); `src/context/AuthContext.tsx:121-135`.
- **Comportamento atual:** o botão "Criar conta" chama `supabase.auth.signUp`. Se **Allow new users to sign up** estiver
  ligado no painel, qualquer pessoa na internet cria conta. Ela não vê dados (RLS), mas consome a cota do projeto,
  suja `profiles` e passa a poder chamar funções para usuários logados.
- **Decisão do dono do projeto:** contas só pelo painel (3 usuários).
- **Correção:** remover o modo de cadastro do front e desligar a opção no painel (passo manual, documentado).

### AUD-006: Bucket `avatars` permite listar todos os arquivos
- **Severidade:** baixa. **Confiança:** alta. **Status:** confirmado por inspeção.
- **Onde:** `0007_super_usuario_avatar.sql:145-147` (`avatars_public_read`, `for select using (bucket_id = 'avatars')`).
- **Documentação (Context7, Supabase advisors "Public bucket listing"):** buckets públicos não precisam de política
  `SELECT`; ela só torna o conteúdo enumerável e as URLs públicas continuam funcionando sem ela.
- **Impacto:** qualquer pessoa lista os arquivos (`<id-do-usuário>/<data>.png`), expondo identificadores de usuários.
- **Correção:** `drop policy "avatars_public_read"`.

### AUD-007: `profiles.avatar_url` aceita qualquer endereço
- **Severidade:** baixa. **Confiança:** alta. **Status:** confirmado por inspeção.
- **Onde:** `0002_rls.sql`/`0008_hardening.sql` (update do próprio perfil) e `src/components/shared/UserAvatar.tsx` (`<img src>`).
- **Impacto:** um usuário aponta o avatar para um servidor externo; quando um super usuário abre **Usuários**, o navegador
  dele busca essa URL (vaza IP, serve de pixel de rastreio).
- **Correção:** gatilho que exige que `avatar_url` pertença ao bucket do próprio usuário (ou seja nulo).

### AUD-008: Funções auxiliares no schema `public` sem `revoke ... from public`
- **Severidade:** baixa. **Confiança:** alta. **Status:** reproduzido.
- **Evidência (executada em Postgres local):** `has_function_privilege('anon', ...)` é verdadeiro para `is_super`,
  `pode_acessar_galpao`, `auth_galpao_ids` e para as funções de gatilho `auditar_*`/`proteger_colunas_profile`.
  As funções novas (0009 em diante) estão corretas (`fechamento_dia`, `listar_pagamentos`... só para logados).
- **Documentação (Context7, Supabase "Database functions"):** recomenda `revoke execute ... from public` e usar
  `set search_path = ''`; funções em schema exposto ficam chamáveis pela API.
- **Impacto:** baixo (retornam `false`/vazio para anônimos e gatilhos não podem ser chamados diretamente), mas amplia a
  superfície sem necessidade.
- **Correção:** migração que revoga `public`/`anon` dessas funções (o papel `authenticated` continua, pois as políticas RLS
  as chamam) e teste no `test:db` que falha se surgir função chamável por anônimo fora da lista permitida.

### AUD-009: Sem Content-Security-Policy nem cabeçalhos de segurança
- **Severidade:** baixa. **Confiança:** alta. **Status:** confirmado por inspeção.
- **Onde:** `index.html`, `public/`; a hospedagem ainda não foi escolhida.
- **Impacto:** o token da sessão fica em `localStorage` (padrão do `supabase-js`); uma falha de XSS futura teria acesso a ele.
  Não há hoje `dangerouslySetInnerHTML`, `eval` nem HTML injetado (verificado por busca em todo `src`).
- **Correção:** arquivos de cabeçalhos para as hospedagens prováveis (`public/_headers` e `vercel.json`) com CSP,
  `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`, e documentação.

### AUD-010: Sem encerramento da sessão por inatividade
- **Severidade:** baixa. **Confiança:** alta. **Status:** confirmado por inspeção.
- **Contexto:** computadores/celulares compartilhados na feira; a sessão renova sozinha (`autoRefreshToken`).
- **Correção:** `useInatividade` no `AppShell` (padrão 30 min) que chama `signOut` e avisa.

### AUD-011: Textos sem limite de tamanho no banco
- **Severidade:** baixa. **Confiança:** alta. **Status:** confirmado por inspeção.
- **Onde:** `0001_init.sql` (`nome text`, `endereco text`, `observacoes text`, `telefone text`).
- **Impacto:** um nome de 1 MB quebra layouts, exportações e PDFs. O nome do perfil vem do cadastro (`raw_user_meta_data`).
- **Correção:** `CHECK (char_length(...) <= N) NOT VALID` (não falha com dados antigos) e `maxLength` nos campos.

---

## Regras de negócio e bugs

### AUD-012: `registrar_pagamento` aceita qualquer semana e qualquer valor
- **Severidade:** baixa. **Confiança:** alta. **Status:** confirmado por inspeção.
- **Onde:** `0012_auditoria.sql:469-580` (e `0011`).
- **Comportamento atual:** só valida valor > 0 e dia da semana. Semana de 2030 ou R$ 99.999.999,00 são aceitos pela API.
  A interface limita as semanas, o servidor não.
- **Correção:** limitar a semana (ex.: 1 ano para trás, 2 meses para frente) e o valor (ex.: até R$ 100.000,00) no servidor.

### AUD-013: "Hoje" vem do relógio do dispositivo, o pagamento é datado no servidor em Fortaleza
- **Severidade:** média. **Confiança:** alta. **Status:** confirmado por inspeção.
- **Onde:** `src/utils/recibo.ts:8` (`dataLocalISO`), `src/hooks/useHoje.ts`, `src/context/GalpaoDadosContext.tsx:60`;
  `0012_auditoria.sql` grava `data_pagamento` com `now() at time zone 'America/Fortaleza'`.
- **Cenário:** computador com fuso/horário errado, ou uso perto da meia-noite: "Recebido hoje" compara a data do servidor
  com a do aparelho; as pendências e o dia de cobrança (`diaSemanaKey`) mudam de um dia para o outro; o Fechamento abre
  na data errada.
- **Correção:** calcular "agora" sempre no fuso `America/Fortaleza` (função única), usada por `useHoje`, janela de dados e testes.

### AUD-014: Atrasos com mais de 8 semanas somem da tela e não dá para cobrá-los
- **Severidade:** alta. **Confiança:** alta. **Status:** confirmado por inspeção.
- **Onde:** `src/utils/pagamentos.ts:7` (`SEMANAS_RETROATIVAS_MAX = 8`), `:87-101` (`pendenciasCliente`), `:181-184`.
- **Comportamento atual:** a lista de pendências começa em `max(primeira cobrança, últimas 8 semanas)`. Um cliente que
  deve 12 semanas aparece como "Em atraso (8 semanas)"; "A receber hoje", Relatórios e a mensagem de WhatsApp subestimam a
  dívida; `referenciasDisponiveis` não oferece as semanas mais antigas para receber.
- **Esperado:** nunca esconder dívida; no mínimo avisar que há semanas anteriores.
- **Correção:** ampliar a janela (26 semanas, com a janela de dados acompanhando) e sinalizar claramente quando ainda houver
  corte ("26+ semanas").
- **Testes:** unidade (cliente com 30 semanas em aberto), tela (etiqueta "26+ semanas").

### AUD-015: Excluir um tipo de item zera o valor semanal de quem o usa
- **Severidade:** média. **Confiança:** alta. **Status:** confirmado por inspeção.
- **Onde:** `src/features/configuracoes/TiposPrecosManager.tsx:106-120`; `0001_init.sql:60` (`tipo_item_id ... on delete set null`);
  `src/utils/valor.ts:3-6` (`precoEfetivo(null) = 0`).
- **Comportamento atual:** só um `window.confirm`; os itens ficam "Sem tipo" e valem R$ 0,00. O banco já tem a coluna `ativo`,
  mas a tela não oferece "desativar".
- **Impacto:** cobrança semanal de vários clientes cai para zero sem aviso na hora de cobrar.
- **Correção:** recusar a exclusão quando o tipo está em uso (tela e gatilho no banco) e oferecer Desativar/Ativar.

### AUD-016: Gravações em várias etapas, sem transação
- **Severidade:** média. **Confiança:** alta. **Status:** confirmado por inspeção.
- **Onde:** `src/features/clientes/ClienteModal.tsx:150-250` (cliente, remoções, quantidades, novos itens: 4 chamadas);
  `src/features/configuracoes/TipoModal.tsx:78-125`.
- **Comportamento atual:** uma falha no meio deixa estado parcial. O código trata e orienta ("cliente salvo, itens não;
  tente salvar de novo"), e as repetições são seguras, então o risco é de **inconsistência temporária**, não de perda.
- **Correção recomendada (estrutural):** funções transacionais no banco (`salvar_cliente`, `salvar_tipo`). Fica como fase própria
  por exigir reescrever dois fluxos já testados.

### AUD-017: Gráfico "Arrecadação por dia" mostra no máximo 31 dias sem avisar
- **Severidade:** baixa. **Confiança:** alta. **Status:** confirmado por inspeção.
- **Onde:** `0009_paginacao_codigo.sql:207` (`limit 31`); `src/pages/RelatoriosPage.tsx`.
- **Impacto:** em período maior, o gráfico omite os dias mais antigos enquanto os totais incluem tudo.
- **Correção:** aviso na tela quando o período passa de 31 dias.

### AUD-018: A caixa de busca da tabela não acompanha o endereço
- **Severidade:** baixa. **Confiança:** média. **Status:** confirmado por inspeção.
- **Onde:** `src/components/ui/Table.tsx:88` (`useState(searchDefault)` só lê o valor na montagem).
- **Cenário:** buscar "ana" (endereço `?q=ana`), ir a outra tela e usar o botão Voltar do navegador: a lista volta filtrada
  de acordo com a URL, mas o campo pode mostrar outro texto.
- **Correção:** sincronizar o campo quando `searchDefault` mudar, sem apagar espaços digitados.

### AUD-019: Exportação com paginação por deslocamento
- **Severidade:** baixa. **Confiança:** média. **Status:** confirmado por inspeção.
- **Onde:** `src/features/pagamentos/exportarPagamentos.ts:56`.
- **Cenário:** se alguém registra um pagamento durante a exportação de muitas páginas, as linhas deslocam e uma pode repetir.
- **Correção:** remover duplicados por `id` e conferir a contagem final.

### AUD-020: Menu diz "Dashboard", a tela se chama "Cobranças"
- **Severidade:** baixa. **Status:** confirmado por inspeção. **Onde:** `src/components/layout/Navbar.tsx:9`.
- **Correção:** renomear o item do menu.

### AUD-021: Avisos de erro usam `role="status"`
- **Severidade:** baixa. **Status:** confirmado por inspeção. **Onde:** `src/components/ui/Toast.tsx:139`.
- **Impacto:** leitores de tela anunciam erros de forma educada em vez de assertiva.
- **Correção:** `role="alert"` para erro e aviso.

### AUD-022: `react-router-dom` é pacote de transição
- **Severidade:** informativa. **Status:** confirmado por documentação.
- **Documentação (Context7, React Router `/websites/reactrouter`, guia "Upgrading to v7" e changelog):** no v7 tudo foi
  para `react-router`; `react-router-dom` foi mantido só por conveniência e **será removido no v8**.
- **Onde:** 9 arquivos importam de `react-router-dom`.
- **Correção:** trocar os imports para `react-router` e remover a dependência (mudança mecânica).

### AUD-023: Nome do sistema repetido como texto em vez da constante
- **Severidade:** baixa. **Onde:** `src/utils/recibo.ts:64` (`'MeuGalpão'`) em vez de `APP_NAME`. **Correção:** usar a constante.

---

## Operação, testes e documentação

### AUD-024: Migrações do banco sem controle de versão aplicada
- **Severidade:** média. **Confiança:** alta. **Status:** confirmado por inspeção.
- **Onde:** `supabase/migrations/*` (cada arquivo diz "rode uma vez"); aplicadas à mão no SQL Editor.
- **Risco:** rodar fora de ordem ou repetir desfaz funções (a `0011` repetida depois da `0012` volta uma versão antiga de
  `registrar_pagamento`). Não há como saber, olhando o banco, até qual migração ele foi.
- **Correção:** tabela `migracoes_aplicadas` (registrada pela própria migração) + roteiro de verificação + documentação do
  fluxo; futuramente adotar o Supabase CLI.

### AUD-025: Sem integração contínua e sem Git
- **Severidade:** baixa. **Status:** confirmado por inspeção (`git rev-parse` falha; não há `.github/`).
- **Correção:** fluxo de CI pronto (`.github/workflows/ci.yml`) para quando o repositório existir.

### AUD-026: Documentação desatualizada
- **Severidade:** baixa. **Status:** confirmado por inspeção.
- **Exemplos:** `README.md` lista migrações fora de ordem e sem a `0013`; `docs/PLANO_ENTREGA.md` cita `docs/anexos/testes-db`
  (já movido para `tests/db`). Falta documento de arquitetura, decisões e operação.
- **Correção:** reorganização da pasta `docs/` (ver `PLANO_DE_CORRECAO.md`).

### AUD-027: Telas importantes ainda sem teste automatizado
- **Severidade:** média. **Confiança:** alta. **Status:** reproduzido (cobertura medida).
- **Evidência (executada, `vitest --coverage`):** 65,3% das linhas. Zeradas: Relatórios, Fechamento, Navbar, ProfileDropdown,
  rotas, App; Configurações 9,4%; `reciboPdf` 4,4%. Cobrança, Clientes, Pagamentos, Recibos e regras (`utils`) estão em 95-100%.
- **Correção:** completar os testes de tela das áreas acima (plano em `TESTES_E_VALIDACAO.md`).

### AUD-028: Testes de navegador nunca rodaram contra um Supabase
- **Severidade:** baixa. **Status:** confirmado. Só os 3 cenários que não precisam de login foram executados.
- **Correção:** criar o projeto Supabase de teste (ação do dono do projeto) e executar `npm run test:e2e`.

### AUD-029: O teste de banco não reproduz os privilégios padrão do Supabase
- **Severidade:** baixa. **Status:** confirmado por inspeção (`tests/db/_base.mjs`).
- **Impacto:** no Supabase real, tabelas/funções novas recebem *default privileges* para `anon`/`authenticated`; no Postgres
  local do teste, não. Uma falha de `revoke` só apareceria em produção.
- **Correção:** o `_base.mjs` passa a aplicar os mesmos *default privileges* e um teste lista toda função chamável por
  anônimo, que deve ser só `verificar_recibo`.

### AUD-030: Teste de tela instável (corrigido durante a auditoria)
- **Severidade:** informativa. **Status:** reproduzido (2 de 3 execuções completas falhavam) e corrigido na hora.
- **Onde:** `src/features/pagamentos/__tests__/ListaPagamentos.tela.test.tsx` ("página que não existe volta para a última").
- **Causa:** o teste lia o endereço antes de a correção da página terminar. Agora usa `waitFor`; 5 execuções seguidas passaram.
- **Observação:** é alteração de código de teste, feita no trabalho paralelo de testes; nenhum arquivo de implementação foi tocado.

### AUD-031: Atualizações de dependência
- **Severidade:** informativa. `npm outdated`: `@tanstack/react-query` 5.104.3 → 5.104.4 (correção); `@types/node` 24 → 26
  **não recomendado** (o Node de execução é o 24). `npm audit`: 0 vulnerabilidades.

### AUD-032: `ErrorBoundary` só escreve no console
- **Severidade:** informativa. **Onde:** `src/components/shared/ErrorBoundary.tsx:21`. Sem telemetria, falhas de produção
  ficam invisíveis. Sugestão futura (Sentry ou similar), não necessária para a entrega.

### AUD-033: Funções de data duplicadas
- **Severidade:** baixa. `parseISO` existe em `src/utils/pagamentos.ts` e em `src/components/ui/DatePicker.tsx` (duas versões).
  **Correção:** uma única em `src/utils/data.ts`.

### AUD-034: Componentes extensos
- **Severidade:** informativa. `DatePicker.tsx` (435 linhas), `DashboardPage.tsx` (409), `ClienteModal.tsx` (364), `Table.tsx` (363).
  Funcionam e estão cobertos; extrair subcomponentes só se forem mexer neles de novo (não vale uma refatoração isolada).
