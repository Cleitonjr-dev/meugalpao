# Segurança

Análise de 17/10/2026. Modelo de ameaça considerado: sistema interno de 3 usuários, dados financeiros e dados pessoais
de clientes (nome, telefone, WhatsApp), acesso por navegador (inclusive celular e computadores compartilhados na feira),
backend Supabase, verificação pública de recibos.

> Nenhum teste de invasão foi feito contra sistemas externos ou produção. As verificações foram leitura do código/SQL e
> consultas somente-leitura a um Postgres local descartável.

## Resumo

| Área | Situação |
|---|---|
| Isolamento entre galpões (RLS) | **Bom**: todas as tabelas com RLS; políticas por galpão; testes de banco cobrem usuário comum, super e anônimo |
| Escrita financeira | **Bom**: só `registrar_pagamento` e `cancelar_pagamento` (atômicas); sem insert/update direto |
| Cancelamento | **Bom**: exige senha digitada nos últimos 2 min (checado no servidor via `amr`) e motivo; ver AUD-004 |
| Escalada de privilégio | **Bom**: gatilho impede alterar `is_super`/`email` por quem não é super; último super usuário protegido |
| Segredos | **Bom**: só URL e chave `anon`; nenhuma `service_role`; `.env` ignorado |
| Injeção | **Bom**: sem SQL montado por texto no front; busca escapa `%` e `_`; React escapa saídas; sem HTML injetado |
| Dados destrutivos | **Atenção**: AUD-001, AUD-002 |
| Reautenticação em ações sensíveis | **Parcial**: só no cancelamento; faltam super usuário e exclusões (AUD-001, AUD-003) |
| Superfície pública | **Atenção**: AUD-005 (cadastro), AUD-006 (listagem de avatares), AUD-008 (funções), AUD-009 (sem CSP) |
| Sessão | **Atenção**: AUD-010 (sem logout por inatividade) |

## Autenticação e sessão

- Cliente `supabase-js` com padrões (`persistSession`, `autoRefreshToken`): token em `localStorage`. É o padrão do SDK; o risco
  real é XSS, mitigado hoje pela ausência de HTML injetado e que deve ser reforçado com CSP (AUD-009).
- Login por e-mail e senha (`signInWithPassword`); mensagens de erro não revelam se o e-mail existe
  (`E-mail ou senha inválidos.`). Troca de senha pelo link de recuperação (`PASSWORD_RECOVERY`).
- Mudança de usuário limpa todo o cache (`queryClient.clear()`), evitando mostrar dados de outra conta.
- Confirmação de senha para cancelar: o front refaz `signInWithPassword` (novo token com `amr` recente); o banco confere o
  `amr` (método `password`, até 120 s). **Documentação consultada (Context7, Supabase Auth/MFA e JWT fields):** o `amr` é um
  array do mais recente ao mais antigo com `method` e `timestamp`; a leitura do código está correta. Fragilidade: AUD-004.
- Política de senha, limite de tentativas e "proteção contra senhas vazadas" são configurações do painel (a última exige plano Pro,
  segundo a documentação consultada). **Não verificado.** Mínimo recomendado pela documentação: 8 caracteres; o front aceita 6 (`SENHA_MINIMA`).

## Autorização (servidor)

- `pode_acessar_galpao(g)` = super usuário ou membro do galpão; usada em todas as políticas e funções.
- Funções `security invoker` (`listar_pagamentos`, `relatorio_resumo`, `pagamentos_recentes`, `fechamento_dia`, `listar_auditoria`)
  respeitam a RLS de quem chama; as `security definer` (`registrar_pagamento`, `cancelar_pagamento`, `verificar_recibo`,
  `nome_usuario`, gatilhos) têm `search_path` fixo e checam acesso internamente.
- A documentação consultada (Context7, Supabase "Database functions" e "Row Level Security") recomenda `set search_path = ''`
  e colocar auxiliares `security definer` em schema não exposto. O projeto usa `search_path = public` (aceitável, tabelas
  citadas sem ambiguidade) e mantém os auxiliares em `public`; a revogação de `public` está incompleta nos auxiliares antigos (AUD-008).
- Verificação pública (`verificar_recibo`): devolve só número, galpão, nome abreviado ("Maria S."), valor, data, forma e situação.
  Código de 64 bits aleatórios (`gen_random_uuid`), único entre galpões. Sem limite de tentativas na API; o espaço de
  busca (2^64) torna a enumeração inviável.

## Dados pessoais (LGPD)

- Tratados: nome, telefone e WhatsApp de clientes; nomes de usuários; histórico de alterações com nomes de clientes
  (`auditoria.resumo`). Finalidade: cobrança e comprovante.
- Pontos a cumprir fora do código: informar a finalidade aos clientes, definir quem acessa, prazo de retenção, exclusão a
  pedido (hoje inviável para quem tem pagamentos; sugerido anonimizar nome em vez de apagar) e backups.
- A página pública de verificação expõe o mínimo; os recibos em PDF/WhatsApp contêm o nome completo (por desenho: o
  cliente recebe o próprio recibo).

## Storage (fotos de perfil)

- Escrita restrita à pasta `<id-do-usuário>/` (política com `storage.foldername`), limite de 2 MB e só PNG/JPG/WEBP/GIF (sem SVG).
- Leitura pública e **listável** (AUD-006) e `profiles.avatar_url` livre (AUD-007).

## Dependências

`npm audit`: 0 vulnerabilidades (17/10/2026). `jspdf` (README oficial, via Context7): *"sanitize user input before passing it to jsPDF"*;
o código passa nomes e observações para `doc.text`, que escapa, e troca caracteres fora do Latin-1 por `?` (função `limpar`).
Scripts de instalação bloqueados pelo npm: apenas `core-js` (aviso de doação), sem risco.

## Verificações pendentes (dependem do painel/ambiente)

1. Painel > Authentication: **Allow new users to sign up** (desligar), política de senha, limites de tentativa, URL do site.
2. Conferir o token real de um login: presença de `amr` com `method: password` (AUD-004).
3. Backups ativos e restauração testada.
4. Cabeçalhos de segurança na hospedagem escolhida (AUD-009) e HTTPS.
5. Rodar `npm run test:e2e` contra um projeto Supabase de teste.

## Recomendações priorizadas

1. AUD-001/002/003/004 (dinheiro e permissões): fase A do plano.
2. AUD-005/006/007/008/009/010/011: fase A (endurecimento) e passos manuais no painel.
3. Rotina: revisar `npm audit` e `npm outdated` a cada entrega; revisar a lista de super usuários a cada mudança de equipe.
