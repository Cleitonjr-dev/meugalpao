import { vi, describe, expect, it } from 'vitest'
import { DashboardPage } from '@/pages/DashboardPage'
import {
  cartao,
  escolherOpcao,
  esperarTela,
  linhaDoCliente,
  reais,
  renderizarTela,
  semNbsp,
  screen,
  waitFor,
  within,
} from '@/test/renderizar'
import { bancoFalso } from '@/test/bancoFalso'
import { IDS } from '@/test/dados'

async function abrir(opcoes: Parameters<typeof renderizarTela>[1] = {}) {
  const tela = renderizarTela(<DashboardPage />, opcoes)
  await esperarTela('Cobranças')
  return tela
}

const nomesNaLista = () =>
  screen
    .getAllByRole('listitem')
    .map((li) => li.querySelector('p')?.textContent)
    .filter(Boolean)

describe('Cobranças: cabeçalho e resumo do dia', () => {
  it('mostra o título, a data de hoje por extenso e o botão Registrar pagamento', async () => {
    await abrir()
    expect(screen.getByText(/sábado, 11 de outubro de 2025/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar pagamento' })).toBeEnabled()
  })

  it('"A receber hoje" soma o que falta dos clientes de hoje em atraso (Bruno 200 + Carla 3x110 + Gabriela 2x110)', async () => {
    await abrir()
    expect(cartao('A receber hoje').getByText(reais(750))).toBeInTheDocument()
  })

  it('"Recebido hoje" soma os pagamentos feitos hoje (Ana pagou 110)', async () => {
    await abrir()
    expect(cartao('Recebido hoje').getByText(reais(110))).toBeInTheDocument()
  })

  it('"Em atraso hoje" conta os clientes de hoje em atraso', async () => {
    await abrir()
    expect(cartao('Em atraso hoje').getByText('3')).toBeInTheDocument()
  })

  it('pagamento cancelado hoje não entra em "Recebido hoje" e a cobrança volta a ficar em aberto', async () => {
    await abrir({
      preparar: () => {
        const ana = bancoFalso.tabelas.pagamentos.find((p) => p.cliente_id === IDS.ana)
        if (ana) Object.assign(ana, { status: 'cancelado', motivo_cancelamento: 'erro de lançamento' })
      },
    })
    expect(cartao('Recebido hoje').getByText(reais(0))).toBeInTheDocument()
    expect(linhaDoCliente('Ana Souza').getByText('Em atraso')).toBeInTheDocument()
    expect(cartao('A receber hoje').getByText(reais(860))).toBeInTheDocument()
    expect(cartao('Em atraso hoje').getByText('4')).toBeInTheDocument()
  })

  it('não mostra o aviso de "não é dia de cobrança" em um sábado', async () => {
    await abrir()
    expect(screen.queryByText(/Hoje não é dia de cobrança/)).not.toBeInTheDocument()
  })

  it('numa quinta-feira avisa que não é dia de cobrança e mostra "Hoje (0)"', async () => {
    vi.setSystemTime(new Date(2025, 9, 9, 10, 0, 0))
    await abrir()
    expect(
      screen.getByText(/Hoje não é dia de cobrança \(quarta ou sábado\)\. Você ainda pode registrar pagamentos na aba "Todos"\./),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hoje (0)' })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma cobrança para hoje')).toBeInTheDocument()
  })
})

describe('Cobranças: filtros Hoje, Em atraso e Todos', () => {
  it('mostra as três abas com a quantidade de clientes de cada uma', async () => {
    await abrir()
    expect(screen.getByRole('button', { name: 'Hoje (4)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Em atraso (3)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todos (6)' })).toBeInTheDocument()
  })

  it('começa em "Hoje": só os clientes de sábado, com os atrasados primeiro', async () => {
    await abrir()
    expect(nomesNaLista()).toEqual(['Bruno Lima', 'Carla Mendes', 'Gabriela Sem Zap', 'Ana Souza'])
  })

  it('"Todos" mostra todos os ativos (sem o inativo e sem clientes de outro galpão)', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Todos (6)' }))
    expect(nomesNaLista()).toEqual([
      'Bruno Lima',
      'Carla Mendes',
      'Gabriela Sem Zap',
      'Ana Souza',
      'Diego Alves',
      'Eduarda Reis',
    ])
    expect(screen.queryByText('Fábio Inativo')).not.toBeInTheDocument()
    expect(screen.queryByText('Cliente do Galpão 2')).not.toBeInTheDocument()
  })

  it('"Em atraso" mostra só quem está devendo', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Em atraso (3)' }))
    expect(nomesNaLista()).toEqual(['Bruno Lima', 'Carla Mendes', 'Gabriela Sem Zap'])
  })

  it('"Em atraso" sem ninguém devendo mostra "Nenhum cliente em atraso"', async () => {
    const { ui } = await abrir({
      preparar: () => {
        bancoFalso.tabelas.clientes = bancoFalso.tabelas.clientes.filter((c) =>
          [IDS.ana, IDS.diego, IDS.eduarda].includes(c.id),
        )
      },
    })
    await ui.click(screen.getByRole('button', { name: 'Em atraso (0)' }))
    expect(screen.getByText('Nenhum cliente em atraso')).toBeInTheDocument()
    expect(screen.getByText('Todos os clientes estão em dia.')).toBeInTheDocument()
  })
})

describe('Cobranças: situação de cada cliente', () => {
  it('etiquetas: Em dia, Em atraso e Em atraso (n semanas)', async () => {
    await abrir()
    expect(linhaDoCliente('Ana Souza').getByText('Em dia')).toBeInTheDocument()
    expect(linhaDoCliente('Bruno Lima').getByText('Em atraso')).toBeInTheDocument()
    expect(linhaDoCliente('Carla Mendes').getByText('Em atraso (3 semanas)')).toBeInTheDocument()
    expect(linhaDoCliente('Gabriela Sem Zap').getByText('Em atraso (2 semanas)')).toBeInTheDocument()
  })

  it('cliente que pagou semanas à frente aparece como "Adiantado até qua 15/10"', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Todos (6)' }))
    expect(linhaDoCliente('Diego Alves').getByText('Adiantado até qua 15/10')).toBeInTheDocument()
    expect(linhaDoCliente('Eduarda Reis').getByText('Em dia')).toBeInTheDocument()
  })

  it('cada cliente mostra o dia de pagamento', async () => {
    const { ui } = await abrir()
    expect(linhaDoCliente('Ana Souza').getByText('Sábado')).toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: 'Todos (6)' }))
    expect(linhaDoCliente('Diego Alves').getByText('Quarta-feira')).toBeInTheDocument()
  })

  it('as fichas das semanas mostram ✓ para pago, ○ para aberto e marcam a cobrança atual', async () => {
    await abrir()
    const ana = linhaDoCliente('Ana Souza')
    expect(ana.getByRole('button', { name: /✓ sáb 11\/10 \(atual\)/ })).toBeInTheDocument()
    expect(ana.getByText(/○ sáb 18\/10/)).toBeInTheDocument()
    const carla = linhaDoCliente('Carla Mendes')
    expect(carla.getByText(/○ sáb 11\/10 \(atual\)/)).toBeInTheDocument()
    // ficha em aberto não é botão
    expect(carla.queryByRole('button', { name: /○/ })).not.toBeInTheDocument()
  })

  it('clicar numa ficha paga abre o recibo daquela semana', async () => {
    const { ui } = await abrir()
    await ui.click(linhaDoCliente('Ana Souza').getByRole('button', { name: /✓ sáb 11\/10/ }))
    const recibo = await screen.findByRole('dialog', { name: 'Recibo' })
    expect(within(recibo).getByText(/Cliente: Ana Souza/)).toBeInTheDocument()
    expect(within(recibo).getByText(reais(110))).toBeInTheDocument()
  })
})

describe('Cobranças: valor mostrado em cada cliente', () => {
  it('cliente em atraso mostra o valor semanal atual dos itens', async () => {
    await abrir()
    expect(linhaDoCliente('Bruno Lima').getByText(reais(200))).toBeInTheDocument()
    expect(linhaDoCliente('Carla Mendes').getByText(reais(110))).toBeInTheDocument()
    expect(linhaDoCliente('Bruno Lima').queryByText('pago')).not.toBeInTheDocument()
  })

  it('cliente que já pagou a cobrança atual mostra o valor pago e "pago"', async () => {
    await abrir()
    const ana = linhaDoCliente('Ana Souza')
    expect(ana.getByText(reais(110))).toBeInTheDocument()
    expect(ana.getByText('pago')).toBeInTheDocument()
    expect(ana.queryByText(/Próximas:/)).not.toBeInTheDocument()
  })

  it('se o preço dos itens mudou depois do pagamento, mostra o valor pago e "Próximas: R$ novo"', async () => {
    await abrir({
      preparar: () => {
        // Ana passou a guardar um Carro (R$ 200) depois de ter pago R$ 110
        const item = bancoFalso.tabelas.itens_guardados.find((i) => i.cliente_id === IDS.ana)
        if (item) item.tipo_item_id = IDS.tipoCarro
      },
    })
    const ana = linhaDoCliente('Ana Souza')
    expect(ana.getByText(reais(110))).toBeInTheDocument()
    expect(ana.getByText('pago')).toBeInTheDocument()
    expect(ana.getByText(`Próximas: ${reais(200)}`)).toBeInTheDocument()
  })
})

describe('Cobranças: busca', () => {
  it('filtra por parte do nome, sem diferenciar maiúsculas', async () => {
    const { ui } = await abrir()
    await ui.type(screen.getByLabelText('Buscar cliente'), 'ANA')
    expect(nomesNaLista()).toEqual(['Ana Souza'])
  })

  it('acha pelo telefone, com ou sem máscara', async () => {
    const { ui } = await abrir()
    const busca = screen.getByLabelText('Buscar cliente')
    await ui.type(busca, '88880002')
    expect(nomesNaLista()).toEqual(['Bruno Lima'])
    await ui.clear(busca)
    await ui.type(busca, '(85) 98888-0003')
    expect(nomesNaLista()).toEqual(['Carla Mendes'])
  })

  it('apagar a busca volta a lista completa', async () => {
    const { ui } = await abrir()
    const busca = screen.getByLabelText('Buscar cliente')
    await ui.type(busca, 'ana')
    await ui.clear(busca)
    expect(nomesNaLista()).toHaveLength(4)
  })

  it('sem resultado mostra "Nenhum cliente encontrado" e a dica', async () => {
    const { ui } = await abrir()
    await ui.type(screen.getByLabelText('Buscar cliente'), 'zzzz')
    expect(screen.getByText('Nenhum cliente encontrado')).toBeInTheDocument()
    expect(screen.getByText('Tente outro nome ou telefone.')).toBeInTheDocument()
  })

  it('a busca respeita a aba: quem não paga hoje só aparece em "Todos"', async () => {
    const { ui } = await abrir()
    const busca = screen.getByLabelText('Buscar cliente')
    await ui.type(busca, 'diego')
    expect(screen.getByText('Nenhum cliente encontrado')).toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: 'Todos (6)' }))
    expect(nomesNaLista()).toEqual(['Diego Alves'])
  })

  it('o campo de busca mantém o texto ao trocar de aba', async () => {
    const { ui } = await abrir()
    await ui.type(screen.getByLabelText('Buscar cliente'), 'a')
    await ui.click(screen.getByRole('button', { name: 'Em atraso (3)' }))
    expect(screen.getByLabelText('Buscar cliente')).toHaveValue('a')
  })
})

describe('Cobranças: mensagens quando a lista está vazia', () => {
  it('sem cliente ativo: "Nenhum cliente ativo" e o convite para cadastrar (aba Todos)', async () => {
    const { ui } = await abrir({
      preparar: () => {
        bancoFalso.tabelas.clientes = bancoFalso.tabelas.clientes.filter((c) => c.id === IDS.fabio)
      },
    })
    await ui.click(screen.getByRole('button', { name: 'Todos (0)' }))
    expect(screen.getByText('Nenhum cliente ativo')).toBeInTheDocument()
    expect(screen.getByText('Cadastre clientes neste galpão para começar a cobrar.')).toBeInTheDocument()
  })

  it('"Hoje" sem ninguém para cobrar mostra "Nenhuma cobrança para hoje"', async () => {
    await abrir({
      preparar: () => {
        bancoFalso.tabelas.clientes = bancoFalso.tabelas.clientes.filter((c) => c.id === IDS.eduarda)
      },
    })
    expect(screen.getByText('Nenhuma cobrança para hoje')).toBeInTheDocument()
    expect(screen.getByText('Não há clientes com cobrança marcada para hoje.')).toBeInTheDocument()
  })
})

describe('Cobranças: botão de cobrar pelo WhatsApp', () => {
  function linkDe(nome: string) {
    return linhaDoCliente(nome).getByRole('link', { name: 'Cobrar pelo WhatsApp' })
  }

  it('abre o WhatsApp do cliente com a mensagem pronta (uma semana em aberto)', async () => {
    await abrir()
    const link = linkDe('Bruno Lima')
    const href = link.getAttribute('href') ?? ''
    expect(href.startsWith('https://wa.me/5585988880002?text=')).toBe(true)
    const texto = semNbsp(decodeURIComponent(href.split('?text=')[1]))
    expect(texto).toContain('Olá, Bruno! Tudo bem?')
    expect(texto).toContain('existe 1 cobrança em aberto no Galpão 1')
    expect(texto).toContain('sáb 11/10')
    expect(texto).toContain(`Total: ${reais(200)}.`)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('várias semanas: lista as datas e soma o total', async () => {
    await abrir()
    const texto = semNbsp(decodeURIComponent((linkDe('Carla Mendes').getAttribute('href') ?? '').split('?text=')[1]))
    expect(texto).toContain('existem 3 cobranças em aberto')
    expect(texto).toContain('sáb 27/09, sáb 04/10, sáb 11/10')
    expect(texto).toContain(`Total: ${reais(330)}.`)
  })

  it('cliente sem WhatsApp válido tem o botão desativado', async () => {
    await abrir()
    const botao = linhaDoCliente('Gabriela Sem Zap').getByRole('button', {
      name: 'Cobrar pelo WhatsApp (cliente sem WhatsApp válido)',
    })
    expect(botao).toBeDisabled()
  })

  it('cliente em dia não tem botão de cobrar', async () => {
    await abrir()
    expect(linhaDoCliente('Ana Souza').queryByRole('link', { name: 'Cobrar pelo WhatsApp' })).not.toBeInTheDocument()
  })

  it('usa o telefone quando o cliente não tem WhatsApp cadastrado', async () => {
    await abrir({
      preparar: () => {
        const bruno = bancoFalso.tabelas.clientes.find((c) => c.id === IDS.bruno)
        if (bruno) bruno.whatsapp = null
      },
    })
    expect(linkDe('Bruno Lima').getAttribute('href')).toContain('https://wa.me/5585988880002')
  })
})

describe('Cobranças: botão de ver recibo', () => {
  it('cliente em dia tem o ícone de recibo e ele abre o último recibo', async () => {
    const { ui } = await abrir()
    await ui.click(linhaDoCliente('Ana Souza').getByRole('button', { name: 'Ver recibo' }))
    const recibo = await screen.findByRole('dialog', { name: 'Recibo' })
    expect(within(recibo).getByText(/Cliente: Ana Souza/)).toBeInTheDocument()
    expect(within(recibo).getByText(/Referente a: Carrinho de roupa/)).toBeInTheDocument()
  })

  it('cliente adiantado também abre o recibo da cobrança atual', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Todos (6)' }))
    await ui.click(linhaDoCliente('Diego Alves').getByRole('button', { name: 'Ver recibo' }))
    const recibo = await screen.findByRole('dialog', { name: 'Recibo' })
    expect(within(recibo).getByText(/Cobrança de: 08\/10\/2025/)).toBeInTheDocument()
  })

  it('cliente em atraso não mostra o ícone de recibo (mostra Receber)', async () => {
    await abrir()
    const bruno = linhaDoCliente('Bruno Lima')
    expect(bruno.queryByRole('button', { name: 'Ver recibo' })).not.toBeInTheDocument()
    expect(bruno.getByRole('button', { name: 'Receber' })).toBeEnabled()
  })

  it('o recibo aberto tem Imprimir, Baixar PDF, Enviar WhatsApp e Fechar', async () => {
    const { ui } = await abrir()
    await ui.click(linhaDoCliente('Ana Souza').getByRole('button', { name: 'Ver recibo' }))
    const recibo = await screen.findByRole('dialog', { name: 'Recibo' })
    expect(within(recibo).getByRole('button', { name: 'Imprimir' })).toBeInTheDocument()
    expect(within(recibo).getByRole('button', { name: 'Baixar PDF' })).toBeInTheDocument()
    const zap = within(recibo).getByRole('link', { name: 'Enviar WhatsApp' })
    expect(zap.getAttribute('href')).toContain('https://wa.me/5585988880001')
    await ui.click(within(recibo).getByRole('button', { name: 'Imprimir' }))
    expect(window.print).toHaveBeenCalled()
    const fechar = within(recibo).getAllByRole('button', { name: 'Fechar' })
    expect(fechar).toHaveLength(2) // o X do topo e o botão de baixo
    await ui.click(fechar[1])
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Recibo' })).not.toBeInTheDocument())
  })

  it('o recibo mostra o código de autenticação com traços', async () => {
    const { ui } = await abrir()
    await ui.click(linhaDoCliente('Ana Souza').getByRole('button', { name: 'Ver recibo' }))
    const recibo = await screen.findByRole('dialog', { name: 'Recibo' })
    expect(within(recibo).getByText('Autenticação:')).toBeInTheDocument()
    expect(within(recibo).getByText(/^A3F9-27C1-5DE0-[0-9A-F]{4}$/)).toBeInTheDocument()
  })
})

describe('Cobranças: registrar pagamento', () => {
  const modal = () => within(screen.getByRole('dialog', { name: 'Registrar pagamento' }))

  it('"Receber" abre o formulário já com o cliente, a semana mais antiga em aberto e o valor', async () => {
    const { ui } = await abrir()
    await ui.click(linhaDoCliente('Carla Mendes').getByRole('button', { name: 'Receber' }))
    expect(screen.getByLabelText('Cliente')).toHaveTextContent('Carla Mendes')
    expect(screen.getByLabelText('Referente a')).toHaveTextContent(`sáb 27/09 (atrasada) — ${reais(110)}`)
    expect(screen.getByLabelText('Valor (R$)')).toHaveValue('110,00')
    expect(screen.getByLabelText('Forma de pagamento')).toHaveTextContent('Dinheiro')
    expect(screen.getByLabelText('Observações')).toHaveValue('')
    expect(modal().getByRole('button', { name: 'Confirmar pagamento' })).toBeEnabled()
  })

  it('o botão do topo abre o formulário vazio', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Registrar pagamento' }))
    expect(screen.getByLabelText('Cliente')).toHaveTextContent('Selecione...')
    expect(screen.getByLabelText('Valor (R$)')).toHaveValue('')
    expect(screen.queryByLabelText('Referente a')).not.toBeInTheDocument()
  })

  it('a lista de clientes põe os atrasados primeiro e marca os demais "(em dia)", sem inativos', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Registrar pagamento' }))
    await ui.click(screen.getByLabelText('Cliente'))
    const opcoes = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(opcoes).toEqual([
      'Bruno Lima',
      'Carla Mendes',
      'Gabriela Sem Zap',
      'Ana Souza (em dia)',
      'Diego Alves (em dia)',
      'Eduarda Reis (em dia)',
    ])
  })

  it('a lista de clientes tem busca', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Registrar pagamento' }))
    await ui.click(screen.getByLabelText('Cliente'))
    const lista = within(await screen.findByRole('listbox'))
    await ui.type(lista.getByPlaceholderText('Buscar...'), 'carl')
    expect(lista.getAllByRole('option').map((o) => o.textContent)).toEqual(['Carla Mendes'])
  })

  it('escolher um cliente preenche a semana e o valor sugeridos', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Registrar pagamento' }))
    await escolherOpcao(ui, 'Cliente', 'Bruno Lima')
    expect(screen.getByLabelText('Referente a')).toHaveTextContent(`sáb 11/10 (atrasada) — ${reais(200)}`)
    expect(screen.getByLabelText('Valor (R$)')).toHaveValue('200,00')
  })

  it('cliente em dia: oferece a próxima cobrança (adiantar)', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Registrar pagamento' }))
    await escolherOpcao(ui, 'Cliente', 'Ana Souza (em dia)')
    expect(screen.getByLabelText('Referente a')).toHaveTextContent('sáb 18/10')
  })

  it('o campo "Referente a" lista as semanas em aberto, da mais antiga à mais nova', async () => {
    const { ui } = await abrir()
    await ui.click(linhaDoCliente('Carla Mendes').getByRole('button', { name: 'Receber' }))
    await ui.click(screen.getByLabelText('Referente a'))
    const opcoes = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .map((o) => semNbsp(o.textContent ?? ''))
    expect(opcoes.slice(0, 3)).toEqual([
      `sáb 27/09 (atrasada) — ${reais(110)}`,
      `sáb 04/10 (atrasada) — ${reais(110)}`,
      `sáb 11/10 (atrasada) — ${reais(110)}`,
    ])
  })

  it('sem escolher o cliente: "Selecione o cliente."', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Registrar pagamento' }))
    await ui.type(screen.getByLabelText('Valor (R$)'), '50')
    await ui.click(modal().getByRole('button', { name: 'Confirmar pagamento' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Selecione o cliente.')
  })

  it.each(['0', 'abc', '-5', '10,555'])('valor inválido "%s" mostra o aviso e não envia', async (valor) => {
    const { ui, banco } = await abrir()
    await ui.click(linhaDoCliente('Bruno Lima').getByRole('button', { name: 'Receber' }))
    const campo = screen.getByLabelText('Valor (R$)')
    await ui.clear(campo)
    await ui.type(campo, valor)
    await ui.click(modal().getByRole('button', { name: 'Confirmar pagamento' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Informe um valor válido, maior que zero (ex.: 25,00).',
    )
    expect(banco.chamadas.some((c) => c.rpc === 'registrar_pagamento')).toBe(false)
  })

  it('registra o pagamento, abre o recibo e atualiza a lista e os cartões', async () => {
    const { ui, banco } = await abrir()
    await ui.click(linhaDoCliente('Bruno Lima').getByRole('button', { name: 'Receber' }))
    await ui.click(modal().getByRole('button', { name: 'Confirmar pagamento' }))

    const recibo = await screen.findByRole('dialog', { name: 'Recibo' })
    expect(within(recibo).getByText(/Cliente: Bruno Lima/)).toBeInTheDocument()
    expect(within(recibo).getByText(/Cobrança de: 11\/10\/2025/)).toBeInTheDocument()
    expect(within(recibo).getByText(reais(200))).toBeInTheDocument()
    expect(within(recibo).getByText(/Referente a: Carro/)).toBeInTheDocument()
    expect(within(recibo).getByText(/Forma de pagamento: Dinheiro/)).toBeInTheDocument()
    expect(within(recibo).getByText(/^A3F9-27C1-5DE0-[0-9A-F]{4}$/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Registrar pagamento' })).not.toBeInTheDocument()

    // o servidor recebeu o que a tela mostrou
    const envio = banco.chamadas.find((c) => c.rpc === 'registrar_pagamento')?.args
    expect(envio).toMatchObject({
      p_galpao_id: IDS.galpao1,
      p_cliente_id: IDS.bruno,
      p_valor: 200,
      p_forma: 'dinheiro',
      p_semana: '2025-10-11',
      p_observacoes: null,
    })

    // a lista e os cartões refletem o novo pagamento
    await waitFor(() => expect(linhaDoCliente('Bruno Lima').getByText('Em dia')).toBeInTheDocument())
    expect(cartao('Recebido hoje').getByText(reais(310))).toBeInTheDocument()
    expect(cartao('A receber hoje').getByText(reais(550))).toBeInTheDocument()
    expect(cartao('Em atraso hoje').getByText('2')).toBeInTheDocument()
  })

  it('envia a forma de pagamento, as observações e o valor com vírgula e milhar', async () => {
    const { ui, banco } = await abrir()
    await ui.click(linhaDoCliente('Bruno Lima').getByRole('button', { name: 'Receber' }))
    await escolherOpcao(ui, 'Forma de pagamento', 'Pix')
    const valor = screen.getByLabelText('Valor (R$)')
    await ui.clear(valor)
    await ui.type(valor, '1.234,56')
    await ui.type(screen.getByLabelText('Observações'), '  pagou adiantado  ')
    await ui.click(modal().getByRole('button', { name: 'Confirmar pagamento' }))
    await screen.findByRole('dialog', { name: 'Recibo' })
    expect(banco.chamadas.find((c) => c.rpc === 'registrar_pagamento')?.args).toMatchObject({
      p_forma: 'pix',
      p_valor: 1234.56,
      p_observacoes: 'pagou adiantado',
    })
  })

  it('a forma de pagamento oferece Dinheiro, Pix e Cartão', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Registrar pagamento' }))
    await ui.click(screen.getByLabelText('Forma de pagamento'))
    const opcoes = within(await screen.findByRole('listbox')).getAllByRole('option').map((o) => o.textContent)
    expect(opcoes).toEqual(['Dinheiro', 'Pix', 'Cartão'])
  })

  it('as observações aceitam no máximo 500 caracteres', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Registrar pagamento' }))
    expect(screen.getByLabelText('Observações')).toHaveAttribute('maxLength', '500')
  })

  it('erro do banco (ex.: cobrança já paga) aparece no formulário, que continua aberto', async () => {
    const { ui, banco } = await abrir()
    banco.falhar('rpc:registrar_pagamento', 'Esta cobrança já foi paga.', { code: 'P0001' })
    await ui.click(linhaDoCliente('Bruno Lima').getByRole('button', { name: 'Receber' }))
    await ui.click(modal().getByRole('button', { name: 'Confirmar pagamento' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta cobrança já foi paga.')
    expect(screen.getByRole('dialog', { name: 'Registrar pagamento' })).toBeInTheDocument()
    expect(modal().getByRole('button', { name: 'Confirmar pagamento' })).toBeEnabled()
  })

  it('erro inesperado mostra a mensagem genérica', async () => {
    const { ui, banco } = await abrir()
    banco.falhar('rpc:registrar_pagamento', 'connection reset')
    await ui.click(linhaDoCliente('Bruno Lima').getByRole('button', { name: 'Receber' }))
    await ui.click(modal().getByRole('button', { name: 'Confirmar pagamento' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Erro ao registrar pagamento.')
  })

  it('enquanto salva, mostra "Salvando..." e trava o Cancelar', async () => {
    const { ui, banco } = await abrir()
    banco.atrasar('rpc:registrar_pagamento', 200)
    await ui.click(linhaDoCliente('Bruno Lima').getByRole('button', { name: 'Receber' }))
    await ui.click(modal().getByRole('button', { name: 'Confirmar pagamento' }))
    expect(await screen.findByRole('button', { name: 'Salvando...' })).toBeDisabled()
    expect(modal().getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    await screen.findByRole('dialog', { name: 'Recibo' })
  })

  it('"Cancelar" fecha o formulário sem registrar nada', async () => {
    const { ui, banco } = await abrir()
    await ui.click(linhaDoCliente('Bruno Lima').getByRole('button', { name: 'Receber' }))
    await ui.click(modal().getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(banco.chamadas.some((c) => c.rpc === 'registrar_pagamento')).toBe(false)
  })

  it('o X do formulário também fecha', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Registrar pagamento' }))
    await ui.click(modal().getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('clicar fora do formulário NÃO fecha (para não perder o que foi digitado)', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Registrar pagamento' }))
    const fundo = screen.getByRole('dialog').parentElement as HTMLElement
    await ui.pointer([{ target: fundo, keys: '[MouseLeft]' }])
    expect(screen.getByRole('dialog', { name: 'Registrar pagamento' })).toBeInTheDocument()
  })

  it('o formulário reabre limpo depois de fechado', async () => {
    const { ui } = await abrir()
    await ui.click(linhaDoCliente('Bruno Lima').getByRole('button', { name: 'Receber' }))
    await ui.type(screen.getByLabelText('Observações'), 'rascunho')
    await ui.click(modal().getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await ui.click(screen.getByRole('button', { name: 'Registrar pagamento' }))
    expect(screen.getByLabelText('Observações')).toHaveValue('')
    expect(screen.getByLabelText('Cliente')).toHaveTextContent('Selecione...')
  })
})

describe('Cobranças: estados da tela', () => {
  it('enquanto carrega mostra "Carregando..." e depois a tela', async () => {
    renderizarTela(<DashboardPage />, {
      preparar: () => bancoFalso.atrasar('from:clientes:select', 400),
    })
    expect(await screen.findByText('Carregando...')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Cobranças' })).toBeInTheDocument()
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
  })

  it('se a busca dos clientes falha, mostra o erro e "Tentar novamente" recupera', async () => {
    const tela = renderizarTela(<DashboardPage />, {
      preparar: () => bancoFalso.falhar('from:clientes:select', 'sem rede'),
    })
    expect(
      await screen.findByText('Não foi possível carregar os dados do galpão. Verifique a conexão e tente novamente.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Cobranças' })).not.toBeInTheDocument()
    tela.banco.falhas.clear()
    await tela.ui.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Cobranças' })).toBeInTheDocument()
  })

  it('usuário sem nenhum galpão liberado vê "Nenhum galpão disponível"', async () => {
    renderizarTela(<DashboardPage />, {
      usuario: 'comum',
      preparar: () => {
        bancoFalso.tabelas.galpao_membros = []
      },
    })
    expect(await screen.findByText('Nenhum galpão disponível')).toBeInTheDocument()
    expect(
      screen.getByText('Você ainda não tem acesso a nenhum galpão. Peça ao administrador para liberar seu acesso.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Cobranças' })).not.toBeInTheDocument()
  })

  it('usuário comum vê só os clientes do galpão liberado para ele', async () => {
    await abrir({ usuario: 'comum' })
    expect(nomesNaLista()).toEqual(['Bruno Lima', 'Carla Mendes', 'Gabriela Sem Zap', 'Ana Souza'])
    expect(screen.queryByText('Cliente do Galpão 2')).not.toBeInTheDocument()
  })

  it('o galpão escolhido antes é lembrado e mostra só os clientes dele', async () => {
    await abrir({ usuario: 'super', galpaoId: IDS.galpao2 })
    expect(nomesNaLista()).toEqual(['Cliente do Galpão 2'])
  })
})

