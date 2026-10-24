# Manual de uso do MeuGalpão

Para quem trabalha no dia a dia nos galpões. Os nomes entre aspas são os nomes exatos dos botões e
das telas.

## Entrar e sair
- Abra o endereço do sistema, digite o **e-mail** e a **senha** e clique em **Entrar**.
- Esqueceu a senha? Clique em **Esqueceu a senha?**, digite o e-mail e siga o link que chega por e-mail.
- Para sair, clique no seu nome (canto superior direito) e em **Sair**.
- Se você tem mais de um galpão, escolha o galpão no mesmo menu. Tudo o que aparece (clientes,
  pagamentos, relatórios) é do galpão escolhido.

## Cobranças (tela inicial)
Mostra quem deve pagar. Os cartões do topo resumem o dia: **A receber hoje**, **Recebido hoje** e
**Em atraso hoje**.

- **Hoje**: clientes que pagam hoje (quarta ou sábado). **Em atraso**: todos os que estão devendo.
  **Todos**: todos os clientes ativos.
- Use o campo **Buscar** para achar alguém pelo nome ou telefone.
- Cada cliente mostra a situação: **Em dia**, **Em atraso** (e quantas semanas) ou **Adiantado**.

### Receber um pagamento
1. Clique em **Receber** na linha do cliente (ou em **Registrar pagamento**, no topo).
2. Confira o **valor**, a **forma de pagamento** (dinheiro, pix ou cartão) e a semana (**Referente a**).
3. Clique em **Confirmar pagamento**. O **recibo** abre na hora.

### Cobrar quem está em atraso
Na linha do cliente em atraso, o botão com o símbolo do WhatsApp abre a conversa com a mensagem de cobrança
pronta (nome, semanas em aberto e valor). Basta enviar. Se o botão estiver apagado, o cliente não tem um
WhatsApp válido cadastrado.

## O recibo
Mostra o número, o cliente, o item pago, o valor, a forma de pagamento e um **código de autenticação**.
Nele você pode **Imprimir**, **Baixar PDF** e **Enviar WhatsApp** para o cliente.

## Conferir se um recibo é verdadeiro
Qualquer pessoa pode conferir, mesmo sem login: abra `endereço-do-sistema/verificar` (ou, logado, clique em
**Verificar código** na tela **Recibos**) e digite o código do recibo. O sistema responde **Válido**,
**Cancelado** ou **Recibo não encontrado**.

## Clientes
- **Novo cliente**: preencha nome, telefone, WhatsApp e o dia de pagamento. Do lado direito, escolha o tipo
  do item guardado e clique em **Adicionar à lista** (pode adicionar vários). Clique em **Criar cliente**.
- Para mudar itens de um cliente que já existe, clique no lápis. As mudanças só valem quando você clica em
  **Salvar**; se fechar sem salvar, o sistema pergunta.
- Cliente que parou de guardar: marque como **inativo** (ele sai das cobranças, mas o histórico fica).
  Cliente que já tem pagamentos não pode ser excluído.
- **Exportar** baixa a lista em planilha (abre no Excel).

## Pagamentos e Recibos
- **Pagamentos**: histórico de tudo o que foi recebido, com quem recebeu. **Recibos**: os mesmos registros,
  na ordem do número do recibo, para reenviar ou reimprimir.
- Use a busca (nome, número do recibo ou código), os **Filtros** (forma e situação) e o **Período**.
- **Exportar** baixa em planilha exatamente o que está filtrado.

### Cancelar um pagamento
1. Em **Pagamentos**, clique no ícone de cancelar da linha.
2. Escreva o **motivo** e digite a **sua senha** (é de segurança: o sistema confere que é você).
3. Confirme. O pagamento fica **Cancelado**, a cobrança volta a ficar em aberto e o seu nome e o motivo
   ficam registrados. O recibo cancelado continua existindo, marcado como cancelado.

## Fechamento do dia
Use no fim do expediente para conferir o caixa.
- Escolha a data (hoje, por padrão).
- Veja o **Total recebido**, quantos pagamentos, e o **Dinheiro a conferir** (some o dinheiro físico e compare).
- A tabela **Por quem recebeu** mostra quanto cada pessoa recebeu, separado por dinheiro, pix e cartão.
- Pagamentos cancelados no dia aparecem à parte e não entram no total.
- **Imprimir** gera uma folha só com o fechamento. **Exportar CSV** baixa a lista do dia.

## Relatórios
Escolha o período (**Hoje**, **Últimos 7 dias**, **Este mês**, **Mês passado** ou datas) para ver o total
recebido, a arrecadação por dia e as **pendências** (quem está em atraso, com botão de WhatsApp).

## Configurações (quem é super usuário)
- **Galpões**: cadastrar galpões com endereço, renomear ou excluir (excluir apaga tudo do galpão, sem volta).
- **Usuários**: liberar a cada pessoa os galpões que ela pode ver.
- **Tipos e Preços**: tipos de item e o preço por semana, padrão ou próprio de cada galpão. Mudar um preço vale
  para as próximas cobranças; recibos antigos não mudam.
- **Histórico**: quem fez o quê e quando (pagamentos, cancelamentos, mudanças em clientes e preços).

## Dúvidas comuns
- **O cliente está em atraso mas diz que pagou:** procure em **Pagamentos** pelo nome. Se o pagamento está
  lá como cancelado, veja o motivo passando o mouse sobre "Cancelado".
- **Lancei um valor errado:** cancele o pagamento (com motivo) e registre de novo.
- **Esqueci a senha:** use **Esqueceu a senha?** na tela de login.
- **A tela não atualiza:** o sistema atualiza sozinho ao voltar para a aba; se precisar, recarregue a página (F5).
