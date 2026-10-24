# Roteiro de testes manual

Para repetir no sistema **publicado**, com calma, antes de começar a usar de verdade. Marque cada linha
quando der certo. Se algo não acontecer como descrito, anote o passo e a tela.

Use um galpão e clientes de teste (ex.: "Cliente Teste") e apague-os no final.

## 1. Acesso
| ✓ | O que fazer | O que deve acontecer |
|---|---|---|
| ☐ | Entrar com cada um dos 3 usuários | Abre a tela **Cobranças** |
| ☐ | Entrar com senha errada | Aparece "E-mail ou senha inválidos." |
| ☐ | "Esqueceu a senha?" com seu e-mail | Chega um e-mail; o link abre a tela de nova senha; a nova senha funciona |
| ☐ | Fechar a aba e abrir de novo | Continua logado |
| ☐ | Clicar no seu nome → Sair | Volta para o login |

## 2. Cobranças
| ✓ | O que fazer | O que deve acontecer |
|---|---|---|
| ☐ | Abrir **Cobranças** | Mostra os clientes do dia, "A receber hoje", "Recebido hoje" e "Em atraso hoje" |
| ☐ | Digitar parte de um nome na busca | A lista filtra na hora (sem importar acento ou maiúscula) |
| ☐ | Clicar em **Em atraso** | Mostra só os atrasados |
| ☐ | **Registrar pagamento** (ou **Receber**) → escolher cliente, forma → Confirmar | Abre o **recibo** |
| ☐ | Conferir o recibo | Tem número, cliente, "Referente a:" com o item, valor, forma, data e **código de autenticação** |
| ☐ | No recibo: **Imprimir**, **Baixar PDF**, **Enviar WhatsApp** | Cada um funciona (o WhatsApp abre com a mensagem pronta) |
| ☐ | Cliente em atraso: botão do **WhatsApp** (ao lado de Receber) | Abre a conversa com a mensagem de cobrança pronta; cliente sem WhatsApp fica desativado |

## 3. Verificação de recibo
| ✓ | O que fazer | O que deve acontecer |
|---|---|---|
| ☐ | Em **Recibos** → **Verificar código** → digitar o código do recibo | Mostra **Válido**, com galpão, cliente (nome abreviado), valor e data |
| ☐ | Sair do sistema e abrir o endereço `/verificar` | A tela abre sem login; o link **Voltar ao login** funciona |
| ☐ | Digitar um código inventado | Mostra "Recibo não encontrado" |

## 4. Cancelar pagamento
| ✓ | O que fazer | O que deve acontecer |
|---|---|---|
| ☐ | **Pagamentos** → ícone de cancelar | Pede o **motivo** e a **senha** |
| ☐ | Confirmar com a senha errada | "Senha incorreta."; o pagamento continua pago |
| ☐ | Confirmar com a senha certa e um motivo | O pagamento fica **Cancelado** e a cobrança volta a ficar em aberto |
| ☐ | Passar o mouse sobre "Cancelado" | Mostra quem cancelou, quando e o motivo |
| ☐ | Verificar o código do recibo cancelado | Mostra **Cancelado** |
| ☐ | **Configurações → Histórico** (super usuário) | Aparecem "Pagamento registrado" e "Pagamento cancelado" |

## 5. Clientes
| ✓ | O que fazer | O que deve acontecer |
|---|---|---|
| ☐ | **Novo cliente** com nome, WhatsApp, dia e um item → Criar cliente | O cliente aparece na lista com o valor semanal |
| ☐ | Editar: aumentar/diminuir a quantidade, remover um item, **Salvar** | As mudanças só valem depois de Salvar; fechar sem salvar pede confirmação |
| ☐ | **Exportar** | Baixa um arquivo que abre no Excel com os acentos certos |

## 6. Preços
| ✓ | O que fazer | O que deve acontecer |
|---|---|---|
| ☐ | **Configurações → Tipos e Preços** → editar o preço de um tipo num galpão | O novo valor aparece na tabela |
| ☐ | Conferir um recibo antigo | O valor do recibo **não muda** |

## 7. Pagamentos, Recibos, Relatórios
| ✓ | O que fazer | O que deve acontecer |
|---|---|---|
| ☐ | Buscar por cliente, número do recibo e código | Encontra |
| ☐ | Filtros (forma, situação) e período (Hoje, Últimos 7 dias, Este mês) | A lista muda; o calendário não deixa voltar além do primeiro pagamento nem passar de hoje |
| ☐ | Trocar de página | Funciona e mantém os filtros; F5 mantém a mesma tela |
| ☐ | **Exportar** em Pagamentos e em Recibos | Baixa o que está filtrado |
| ☐ | **Relatórios** | Totais do período, arrecadação por dia, pendências com botão de WhatsApp |

## 8. Fechamento do dia
| ✓ | O que fazer | O que deve acontecer |
|---|---|---|
| ☐ | Abrir **Fechamento** | Mostra a data de hoje, total recebido, quantidade e **Dinheiro a conferir** |
| ☐ | Conferir o dinheiro com o que está em mãos | Bate com a soma dos pagamentos em dinheiro |
| ☐ | Tabela **Por quem recebeu** | Cada pessoa com dinheiro, pix, cartão e total |
| ☐ | Um pagamento cancelado hoje | Aparece em "Cancelados" e **não** entra no total |
| ☐ | **Imprimir** | A folha sai só com o fechamento, sem menu |
| ☐ | **Exportar CSV** | Baixa a lista do dia |

## 9. Configurações (super usuário)
| ✓ | O que fazer | O que deve acontecer |
|---|---|---|
| ☐ | **Galpões** → Novo galpão com endereço | Aparece em cartão com o endereço |
| ☐ | **Usuários** → liberar um galpão para outra pessoa | Essa pessoa passa a ver o galpão (entre com ela para conferir) |
| ☐ | Entrar como usuário comum | Não vê a aba **Histórico** nem galpões que não são dele |

## 10. Celular e aparência
| ✓ | O que fazer | O que deve acontecer |
|---|---|---|
| ☐ | Abrir pelo celular e navegar por todas as telas | Nenhuma tela rola para o lado; o menu (três riscos) abre |
| ☐ | Trocar para o tema escuro e voltar | Tudo legível nos dois temas |

## 11. Limpeza
| ✓ | O que fazer | O que deve acontecer |
|---|---|---|
| ☐ | Apagar o galpão e os clientes de teste (ver `docs/ENTREGA.md`) | O sistema fica pronto para o uso de verdade |
