# MeuGalpão

Sistema web de gestão de galpões para a Feira da José Avelino (Fortaleza).

- **React + Vite + TypeScript + Tailwind CSS v4**
- **Supabase** (Auth + Postgres + Row Level Security)
- Isolamento total por galpão: cada usuário só enxerga os galpões liberados para ele.

## Requisitos

- Node.js 20+ (testado com 24)
- Conta gratuita no [Supabase](https://supabase.com)

## Como rodar

```bash
npm install
```

Crie o arquivo `.env` a partir do exemplo e preencha com os dados do seu projeto Supabase
(**Settings → API → Project URL** e **anon public key**):

```bash
cp .env.example .env
```

Conteúdo do `.env`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

Rode em desenvolvimento:

```bash
npm run dev
```

Build de produção, testes e verificações:

```bash
npm run build       # tsc + vite build
npm test            # testes (vitest) das regras de cobrança, valores e WhatsApp
npm run typecheck   # só o TypeScript
npm run lint        # oxlint
```

## Configurar o banco no Supabase

Aplique as migrações na ordem abaixo usando o **SQL Editor** do painel do Supabase
(cole o conteúdo do arquivo e clique em **Run**):

1. `supabase/migrations/0001_init.sql` — tabelas, funções e trigger de perfil
2. `supabase/migrations/0002_rls.sql` — Row Level Security (isolamento por galpão)
3. `supabase/migrations/0003_seed.sql` — tipos de item padrão (lanche, bebida, roupa, carro)
4. `supabase/migrations/0004_profiles_email.sql` — coluna `email` em profiles + trigger
5. `supabase/migrations/0005_precos_galpao.sql` — preços específicos por galpão
6. `supabase/migrations/0006_integridade_indices.sql` — bloqueia pagamento duplicado + índices
7. `supabase/migrations/0007_super_usuario_avatar.sql` — "dono" vira super usuário + foto de perfil
8. `supabase/migrations/0008_hardening.sql` — correções de segurança e integridade (ver abaixo)

### O que a migração 0008 faz

- Impede que um usuário comum se torne super usuário (trigger em `profiles`).
- Fotos de perfil: cada usuário só mexe na própria pasta (`<id>/...`); limite de 2 MB e só PNG/JPG/WEBP/GIF.
- Registrar pagamento e gerar o recibo é uma operação única no banco (`registrar_pagamento`),
  sem pagamento sem recibo e sem número repetido. Cancelar usa `cancelar_pagamento`.
- Pagamentos e recibos não podem mais ser criados/alterados direto pelo navegador; só super usuário apaga.
- Cliente com pagamentos não pode ser excluído (deixe-o inativo).
- Constraints (valor/preço >= 0, status, número de recibo único por galpão) e FKs que garantem
  o mesmo galpão entre cliente, pagamento e recibo.

> Rode a `0008` e publique o front novo na mesma janela: o front antigo não consegue mais
> registrar pagamentos depois dela.

9. `supabase/migrations/0009_paginacao_codigo.sql` — código de autenticação nos recibos, paginação no servidor e verificação pública

### O que a migração 0009 faz

- **Código de autenticação:** todo recibo ganha um código aleatório de 16 caracteres
  (ex.: `A3F9-27C1-5DE0-B481`), gerado no banco, único e impossível de adivinhar. Ele aparece
  no recibo (tela, impressão, PDF) no lugar da linha de assinatura e na mensagem do WhatsApp.
- **Verificação:** a página `/verificar` (sem login) e a busca da tela Recibos confirmam se o código
  existe e se o recibo está válido ou cancelado. A página pública mostra só um resumo, com o nome do
  cliente abreviado ("Maria S."). Para clientes de fora usarem, o sistema precisa estar publicado
  em um endereço público.
- **Paginação no servidor:** as telas Pagamentos e Recibos buscam 25 linhas por vez
  (`listar_pagamentos`), com busca, filtros e período. Os Relatórios somam no banco
  (`relatorio_resumo`) e o Dashboard carrega só as últimas 9 semanas (`pagamentos_recentes`).
  O estado da lista fica na URL (página, busca, filtros).

> Rode a `0009` **antes** de publicar o front novo: ele depende das novas funções.

12. `supabase/migrations/0012_auditoria.sql` — histórico de alterações (aba Histórico, só super usuário) e cancelar pagamento com senha e motivo obrigatório
11. `supabase/migrations/0011_descricao_pagamento.sql` — o recibo mostra o item pago (gravado junto com o pagamento; recibos antigos não têm a linha)
10. `supabase/migrations/0010_codigo_sem_repeticao.sql` — o gerador confere todos os galpões e sorteia de novo se o código já existir (além da trava `UNIQUE` do banco)

## Criar o primeiro usuário (super usuário)

1. No painel do Supabase, vá em **Authentication → Users → Add user** e crie o usuário
   (email + senha). Se quiser testar sem confirmação de e-mail, desative
   **Auth → Providers → Email → Confirm email**.

2. Torne esse usuário **super usuário** e crie os galpões (cole no SQL Editor, trocando
   `<ID_DO_USUARIO>` pelo UUID mostrado na lista de usuários):

```sql
update public.profiles
set is_super = true
where id = '<ID_DO_USUARIO>';

insert into public.galpoes (nome, endereco) values
  ('Galpão Rua 1', null),
  ('Galpão Rua 2', null),
  ('Galpão Rua 3', null);
```

3. Para liberar o acesso de outro usuário a um galpão, use **Configurações → Usuários**
   dentro do sistema (ou o SQL abaixo):

```sql
insert into public.galpao_membros (galpao_id, profile_id)
values ('<ID_DO_GALPAO>', '<ID_DO_PERFIL>');
```

### Recomendações no painel do Supabase

- **Authentication → Providers → Email**: mantenha **Confirm email** ligado em produção e,
  se só você cria os usuários, desligue **Allow new users to sign up**.
- **Authentication → URL Configuration**: cadastre a URL do site (usada no link de "esqueci a senha").
- Ative backups (plano pago) ou exporte o banco periodicamente: aqui ficam os dados financeiros.

## Testes

| Comando | O que confere |
|---|---|
| `npm test` | Regras do sistema (testes rápidos, sem configuração) |
| `npm run test:db` | Banco de dados: roda todas as migrações num Postgres local e confere segurança e regras |
| `npm run test:e2e` | Sistema inteiro num navegador (precisa de um projeto Supabase de teste) |

Passo a passo completo em `docs/TESTES.md`. Entrega: `docs/ENTREGA.md`, `docs/ROTEIRO_DE_TESTES.md` e `docs/MANUAL.md`.

## Estrutura de pastas

```
src/
├── components/
│   ├── layout/     # Navbar, AppShell
│   ├── shared/     # ProfileDropdown, ErrorBoundary, useGuardaPagina, ThemeToggle...
│   └── ui/         # Button, Input, Select, Modal, Table, Toast...
├── config/         # constantes
├── context/        # ThemeContext, AuthContext, GalpaoContext, GalpaoDadosContext
├── features/       # módulos por funcionalidade (auth, clientes, pagamentos, configuracoes)
├── hooks/          # useHoje, useClickOutside, useMediaQuery
├── lib/            # cliente Supabase e utilitários
├── pages/          # páginas (rotas)
├── routes/         # rotas (carregadas sob demanda) e rota protegida
├── types/          # tipos do domínio
└── utils/          # regras puras (cobranças, valores, recibo) + testes em __tests__
supabase/migrations # SQL aplicado manualmente no SQL Editor
```
# meugalpao
