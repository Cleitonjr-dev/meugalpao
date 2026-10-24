# Checklist de entrega do MeuGalpão

Marque cada item e anote quem fez e quando.

## 1. Banco de dados e Supabase (projeto de produção)
- [ ] Migrações de `supabase/migrations` aplicadas **na ordem, uma vez cada**, do `0001` ao `0013`
      (SQL Editor do Supabase). Rodar uma migração antiga depois de uma nova pode desfazer funções.
- [ ] **Authentication → Providers → Email**: desligar **Allow new users to sign up** (as contas passam a ser
      criadas só pelo painel). Manter **Confirm email** ligado.
- [ ] **Authentication → URL Configuration**: cadastrar o endereço final do sistema (usado no link de
      "esqueci a senha").
- [ ] **Backups** ativos e **uma restauração testada** num projeto à parte (um backup que nunca foi restaurado
      não é garantia).
- [ ] Conferir que a chave **`service_role`** não está em nenhum arquivo do projeto nem na hospedagem. Só
      a URL e a chave **anon** são usadas pelo sistema.
- [ ] Cancelar um pagamento de teste e conferir que **funciona com a senha certa**. Se o sistema pedir
      "Confirme sua senha" mesmo com a senha certa, avise: é um ajuste na regra de senha recente.

## 2. Contas
- [ ] Criar as 3 contas reais em **Authentication → Users → Add user**, com senhas fortes.
- [ ] Marcar o super usuário:
      `update public.profiles set is_super = true where email = 'EMAIL-DO-DONO';`
- [ ] Em **Configurações → Usuários**, liberar os galpões de cada pessoa.
- [ ] Depois de desligar o cadastro público, o botão **Criar conta** da tela de login não serve mais.
      Peça para removê-lo (Parte 3.2 de `docs/PLANO_ENTREGA.md`).

## 3. Dados
- [ ] Apagar os dados de teste. Clientes com pagamento não se excluem pela tela; para limpar tudo de um galpão
      de teste, **exclua o galpão** em Configurações → Galpões (apaga clientes, pagamentos e recibos dele,
      sem volta).
- [ ] Conferir os **tipos de item e os preços** de cada galpão.
- [ ] Preencher o **endereço** dos 3 galpões.

## 4. Publicação
- [ ] `npm run build` e publicar a pasta `dist` numa hospedagem com **HTTPS** (Netlify, Vercel ou Cloudflare
      Pages, por exemplo). Hospedagem escolhida: ______________________
- [ ] Configurar a regra de "reescrever tudo para `index.html`" (o sistema usa endereços como `/pagamentos`
      e `/verificar`; sem a regra, atualizar a página dá erro 404).
- [ ] Variáveis de ambiente de produção: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do projeto **real**.
- [ ] Abrir o endereço pelo celular, entrar, e abrir `/verificar?c=CODIGO` sem login.

## 5. Qualidade
- [ ] `npm test`, `npm run test:db`, `npx tsc -b`, `npx oxlint` e `npm run build` sem erros.
- [ ] `npm run test:e2e` passando no projeto de teste (ver `docs/TESTES.md`).
- [ ] `npm audit` sem vulnerabilidades.
- [ ] Dependências atualizadas em 17/10/2026 (React 19.3.1, Vite 8.3.4, Vitest 5.0.5, Supabase 2.118, TanStack Query 5.104.3, lucide 1.59, oxlint 1.88, TypeScript 7.0.2). `@types/node` fica na série 24, igual ao Node instalado.
- [ ] **Roteiro manual** (`docs/ROTEIRO_DE_TESTES.md`) feito no sistema publicado.

## 6. O que entregar junto
- [ ] `docs/MANUAL.md`: manual de uso para as 3 pessoas.
- [ ] Lista de contas e acessos (e-mails, quem é super usuário; **sem senhas** no papel).
- [ ] Onde estão: o código, o projeto Supabase, a hospedagem e o domínio; quem paga o quê.
- [ ] Como restaurar um backup (passo a passo do Supabase) e quem pode fazer isso.
