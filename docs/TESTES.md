# Como testar o MeuGalpão

Há três níveis de teste. Os dois primeiros rodam sozinhos, sem nenhuma configuração. O terceiro precisa de um
projeto Supabase só para testes.

| Comando | O que confere | Precisa de |
|---|---|---|
| `npm test` | Regras do sistema (cálculo de atraso, valores, recibo, CSV, busca...) | Nada |
| `npm run test:db` | O banco de dados de verdade (Postgres local): migrações, segurança, cancelamento, fechamento do dia | Nada |
| `npm run test:e2e` | O sistema inteiro num navegador: entrar, cobrar, recibo, cancelar, histórico, celular | Projeto Supabase de teste |

Antes de entregar uma mudança, rode também: `npx tsc -b`, `npx oxlint` e `npm run build`.

## 1. Testes das regras (`npm test`)
Rápidos (poucos segundos). Ficam em `src/**/__tests__`.

## 2. Testes do banco (`npm run test:db`)
Sobem um Postgres de verdade dentro do computador (PGlite), rodam **todas** as migrações de
`supabase/migrations` em ordem e conferem o comportamento. Não tocam no seu Supabase.

O que cobrem (arquivos em `tests/db`):
- `01-codigo-paginacao`: código do recibo, numeração, listas paginadas, busca, verificação pública.
- `02-acesso-rls`: quem pode ver o quê (galpões isolados, anônimo só verifica recibo).
- `03-descricao-recibo`: o item pago fica gravado no recibo.
- `04-auditoria`: histórico, cancelamento só com senha recente e motivo.
- `05-fechamento`: fechamento do dia (totais, por forma, por pessoa, cancelados fora, isolamento).

Quando criar uma migração nova, ela entra automaticamente nos testes (o arquivo é lido da pasta).

## 3. Testes de tela (`npm run test:e2e`)
Abrem o sistema num navegador (Chromium) e fazem o que uma pessoa faria. **Gravam dados de verdade**, por
isso usam um projeto Supabase **separado do real**. Os testes criam galpões chamados `E2E <data e hora>` e os
apagam no final (a exclusão leva junto clientes, pagamentos e recibos).

### Montando o ambiente de teste (uma vez só)
1. Entre em supabase.com e crie um projeto novo, por exemplo `meugalpao-teste`.
2. No **SQL Editor**, rode as migrações de `supabase/migrations`, **uma vez cada e em ordem**
   (`0001` até a última).
3. **Authentication → Providers → Email**: desligue **Confirm email** (só neste projeto de teste).
4. **Authentication → Users → Add user**: crie dois usuários com senha, por exemplo
   `e2e-super@teste.com` e `e2e-comum@teste.com`.
5. No SQL Editor, torne o primeiro super usuário:
   ```sql
   update public.profiles set is_super = true where email = 'e2e-super@teste.com';
   ```
6. Na raiz do projeto, crie o arquivo **`.env.e2e`** (ele não vai para o git):
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO-DE-TESTE.supabase.co
   VITE_SUPABASE_ANON_KEY=chave-anon-do-projeto-de-teste
   E2E_EMAIL_SUPER=e2e-super@teste.com
   E2E_SENHA_SUPER=a-senha-que-voce-criou
   E2E_EMAIL_COMUM=e2e-comum@teste.com
   E2E_SENHA_COMUM=a-senha-que-voce-criou
   ```
   A URL e a chave `anon` estão em **Project Settings → API**. **Nunca** use aqui as chaves do projeto real.

### Rodando
```
npm run test:e2e
```
O comando sobe o sistema sozinho (porta 5199) e abre o relatório se algo falhar:
`npx playwright show-report`. Para ver o navegador funcionando: `npx playwright test --headed`.

### Cenários
1. **Login**: senha errada mostra erro; senha certa abre as Cobranças; a tela de verificação volta para o login.
2. **Fluxo completo**: cria galpão e cliente, recebe o pagamento, confere o recibo (item e código), verifica o
   código sem login, cancela (senha errada falha; senha certa cancela, com motivo), confere o histórico e o
   fechamento do dia.
3. **Busca, WhatsApp e CSV**: busca nas Cobranças; botão de cobrar atrasados (só nas quartas e sábados, quando
   o cliente novo fica em atraso); exportação para Excel.
4. **Tipos e preços**: a tabela abre e o modal de edição também.
5. **Segurança**: sem login volta para a tela de login; usuário comum não vê o Histórico.
6. **Celular** (390 px): nenhuma tela rola para o lado; o menu abre.

### Se algo falhar
- *"Arquivo .env.e2e não encontrado"*: crie o arquivo (passo 6).
- Erros de login em todos os testes: confira se **Confirm email** está desligado e se a senha está certa.
- Sobrou um galpão `E2E ...` no projeto de teste (teste interrompido): exclua-o em Configurações → Galpões.
- O Supabase limita tentativas de login seguidas; por isso os testes rodam um de cada vez.
- Os testes de tela foram escritos lendo as telas, mas ainda **não foram executados contra um Supabase**
  (só os cenários que não precisam de login foram confirmados). Na primeira execução, ajustes nos nomes de
  botões e campos podem ser necessários.
