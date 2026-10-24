import { describe, expect, it, vi } from 'vitest'
import { ClientesPage } from '@/features/clientes'
import {
  escolherOpcao,
  esperarTela,
  espiarDownload,
  reais,
  renderizarTela,
  screen,
  semNbsp,
  waitFor,
  within,
} from '@/test/renderizar'
import { bancoFalso } from '@/test/bancoFalso'
import { IDS } from '@/test/dados'

async function abrir(opcoes: Parameters<typeof renderizarTela>[1] = {}) {
  const tela = renderizarTela(<ClientesPage />, { rota: '/clientes', ...opcoes })
  await esperarTela('Clientes')
  return tela
}

const linha = (nome: string) => {
  const tr = screen.getByText(nome, { selector: 'td' }).closest('tr')
  if (!tr) throw new Error(`linha de ${nome} não encontrada`)
  return within(tr as HTMLElement)
}
const nomesNaTabela = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((tr) => tr.querySelector('td')?.textContent)
const modal = (titulo: string) => within(screen.getByRole('dialog', { name: titulo }))

describe('Clientes: a lista', () => {
  it('mostra o título, o galpão e os botões Exportar e Novo cliente', async () => {
    await abrir()
    expect(screen.getByText('Galpão: Galpão 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Novo cliente' })).toBeEnabled()
  })

  it('tem as colunas na ordem certa', async () => {
    await abrir()
    const cabecalho = within(screen.getByRole('table')).getAllByRole('columnheader').map((c) => c.textContent)
    expect(cabecalho.slice(0, 7)).toEqual([
      'Nome',
      'Telefone',
      'WhatsApp',
      'Dia de pagamento',
      'Status',
      'Data de cadastro',
      'Valor semanal',
    ])
  })

  it('lista todos os clientes do galpão por ordem alfabética, inclusive o inativo, e nenhum de outro galpão', async () => {
    await abrir()
    expect(nomesNaTabela()).toEqual([
      'Ana Souza',
      'Bruno Lima',
      'Carla Mendes',
      'Diego Alves',
      'Eduarda Reis',
      'Fábio Inativo',
      'Gabriela Sem Zap',
    ])
    expect(screen.getByText('Mostrando 1–7 de 7')).toBeInTheDocument()
  })

  it('cada linha mostra telefone, WhatsApp, dia, situação, data de cadastro e valor semanal', async () => {
    await abrir()
    const ana = linha('Ana Souza')
    expect(ana.getAllByText('(85) 98888-0001')).toHaveLength(2)
    expect(ana.getByText('Sábado')).toBeInTheDocument()
    expect(ana.getByText('Ativo')).toBeInTheDocument()
    expect(ana.getByText('11/10/2025')).toBeInTheDocument()
    expect(ana.getByText(reais(110))).toBeInTheDocument()
    expect(linha('Bruno Lima').getByText(reais(200))).toBeInTheDocument()
    expect(linha('Diego Alves').getByText('Quarta-feira')).toBeInTheDocument()
  })

  it('campos vazios aparecem como "—" e o inativo como "Inativo"', async () => {
    await abrir()
    expect(linha('Gabriela Sem Zap').getAllByText('—')).toHaveLength(2)
    expect(linha('Fábio Inativo').getByText('Inativo')).toBeInTheDocument()
  })

  it('o valor semanal soma todos os itens e usa o preço próprio do galpão quando existe', async () => {
    await abrir({
      preparar: () => {
        bancoFalso.tabelas.precos_galpao.push({
          id: 'pre-1',
          galpao_id: IDS.galpao1,
          tipo_item_id: IDS.tipoRoupa,
          preco_semanal: 90,
          created_at: '2025-01-01T12:00:00Z',
        })
        bancoFalso.tabelas.itens_guardados.push({
          id: 'ite-extra',
          cliente_id: IDS.ana,
          galpao_id: IDS.galpao1,
          tipo_item_id: IDS.tipoRoupa,
          identificacao: null,
          quantidade: 2,
          ativo: true,
          created_at: '2025-09-01T12:00:00Z',
        })
      },
    })
    // 1 item + 2 itens, a R$ 90 cada
    expect(linha('Ana Souza').getByText(reais(270))).toBeInTheDocument()
  })

  it('cada linha tem os botões Editar e Excluir', async () => {
    await abrir()
    const ana = linha('Ana Souza')
    expect(ana.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(ana.getByRole('button', { name: 'Excluir' })).toBeInTheDocument()
  })

  it('sem nenhum cliente mostra "Nenhum cliente encontrado"', async () => {
    await abrir({ preparar: () => (bancoFalso.tabelas.clientes = []) })
    expect(screen.getByText('Nenhum cliente encontrado')).toBeInTheDocument()
  })

  it('usuário sem galpão liberado vê o aviso de acesso', async () => {
    renderizarTela(<ClientesPage />, {
      usuario: 'comum',
      preparar: () => (bancoFalso.tabelas.galpao_membros = []),
    })
    expect(await screen.findByText('Nenhum galpão disponível')).toBeInTheDocument()
  })

  it('se os dados não carregam, mostra o erro e deixa tentar de novo', async () => {
    const tela = renderizarTela(<ClientesPage />, {
      preparar: () => bancoFalso.falhar('from:clientes:select', 'sem rede'),
    })
    expect(await screen.findByText(/Não foi possível carregar os dados do galpão/)).toBeInTheDocument()
    bancoFalso.falhas.clear()
    await tela.ui.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await esperarTela('Clientes')
  })
})

describe('Clientes: busca e filtros', () => {
  const busca = () => screen.getByPlaceholderText('Buscar nome, telefone ou WhatsApp...')

  it('busca por parte do nome, sem diferenciar maiúsculas', async () => {
    const { ui } = await abrir()
    await ui.type(busca(), 'GABRIELA')
    expect(nomesNaTabela()).toEqual(['Gabriela Sem Zap'])
  })

  it('busca ignorando acentos ("fabio" acha "Fábio")', async () => {
    const { ui } = await abrir()
    await ui.type(busca(), 'fabio')
    expect(nomesNaTabela()).toEqual(['Fábio Inativo'])
  })

  it('busca pelo telefone, com ou sem máscara', async () => {
    const { ui } = await abrir()
    await ui.type(busca(), '88880004')
    expect(nomesNaTabela()).toEqual(['Diego Alves'])
    await ui.clear(busca())
    await ui.type(busca(), '(85) 98888-0002')
    expect(nomesNaTabela()).toEqual(['Bruno Lima'])
  })

  it('sem resultado mostra "Nenhum cliente encontrado"', async () => {
    const { ui } = await abrir()
    await ui.type(busca(), 'zzzz')
    expect(screen.getByText('Nenhum cliente encontrado')).toBeInTheDocument()
  })

  it('o filtro "Dia de pagamento" mostra só quem paga naquele dia', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: /Filtros/ }))
    const filtros = modal('Filtros')
    await ui.click(filtros.getByLabelText('Quarta-feira'))
    await ui.click(filtros.getByRole('button', { name: 'Aplicar' }))
    expect(nomesNaTabela()).toEqual(['Diego Alves', 'Eduarda Reis', 'Fábio Inativo'])
    expect(screen.getByRole('button', { name: /Filtros/ })).toHaveTextContent('1')
  })

  it('o filtro "Status" separa ativos e inativos', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: /Filtros/ }))
    await ui.click(modal('Filtros').getByLabelText('Inativo'))
    await ui.click(modal('Filtros').getByRole('button', { name: 'Aplicar' }))
    expect(nomesNaTabela()).toEqual(['Fábio Inativo'])
  })

  it('marcar Ativo e Inativo juntos não filtra nada', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: /Filtros/ }))
    await ui.click(modal('Filtros').getByLabelText('Ativo'))
    await ui.click(modal('Filtros').getByLabelText('Inativo'))
    await ui.click(modal('Filtros').getByRole('button', { name: 'Aplicar' }))
    expect(nomesNaTabela()).toHaveLength(7)
  })

  it('filtros e busca trabalham juntos', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: /Filtros/ }))
    await ui.click(modal('Filtros').getByLabelText('Sábado'))
    await ui.click(modal('Filtros').getByRole('button', { name: 'Aplicar' }))
    await ui.type(busca(), 'a')
    expect(nomesNaTabela()).toEqual(['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Gabriela Sem Zap'])
  })

  it('"Limpar" desmarca tudo e "Cancelar" não aplica o que foi marcado', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: /Filtros/ }))
    await ui.click(modal('Filtros').getByLabelText('Quarta-feira'))
    await ui.click(modal('Filtros').getByRole('button', { name: 'Cancelar' }))
    expect(nomesNaTabela()).toHaveLength(7)

    await ui.click(screen.getByRole('button', { name: /Filtros/ }))
    await ui.click(modal('Filtros').getByLabelText('Quarta-feira'))
    await ui.click(modal('Filtros').getByRole('button', { name: 'Aplicar' }))
    expect(nomesNaTabela()).toHaveLength(3)

    await ui.click(screen.getByRole('button', { name: /Filtros/ }))
    expect(modal('Filtros').getByLabelText('Quarta-feira')).toBeChecked()
    await ui.click(modal('Filtros').getByRole('button', { name: 'Limpar' }))
    await ui.click(modal('Filtros').getByRole('button', { name: 'Aplicar' }))
    expect(nomesNaTabela()).toHaveLength(7)
  })
})

describe('Clientes: novo cliente', () => {
  async function abrirNovo() {
    const tela = await abrir()
    await tela.ui.click(screen.getByRole('button', { name: 'Novo cliente' }))
    return tela
  }
  const form = () => modal('Novo cliente')

  it('abre o formulário vazio, com Quarta-feira, ativo marcado e sem itens', async () => {
    await abrirNovo()
    expect(form().getByLabelText('Nome')).toHaveValue('')
    expect(form().getByLabelText('Telefone')).toHaveValue('')
    expect(form().getByLabelText('WhatsApp')).toHaveValue('')
    expect(form().getByLabelText('Dia de pagamento')).toHaveTextContent('Quarta-feira')
    expect(form().getByLabelText('Observações')).toHaveValue('')
    expect(form().getByLabelText(/Cliente ativo/)).toBeChecked()
    expect(form().getByText('Nenhum item cadastrado ainda.')).toBeInTheDocument()
    expect(form().getByRole('button', { name: 'Criar cliente' })).toBeEnabled()
  })

  it('o tipo do item mostra o nome e o preço de cada tipo', async () => {
    const { ui } = await abrirNovo()
    await ui.click(form().getByLabelText('Tipo do item'))
    const opcoes = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .map((o) => semNbsp(o.textContent ?? ''))
    expect(opcoes).toEqual([
      `Carrinho de comida (${reais(150)})`,
      `Carrinho de roupa (${reais(110)})`,
      `Carro (${reais(200)})`,
    ])
  })

  it('o preço do tipo mostra o preço próprio do galpão quando há', async () => {
    const { ui } = await abrir({
      preparar: () =>
        bancoFalso.tabelas.precos_galpao.push({
          id: 'pre-1',
          galpao_id: IDS.galpao1,
          tipo_item_id: IDS.tipoCarro,
          preco_semanal: 180,
          created_at: '2025-01-01T12:00:00Z',
        }),
    })
    await ui.click(screen.getByRole('button', { name: 'Novo cliente' }))
    await ui.click(form().getByLabelText('Tipo do item'))
    expect(await screen.findByRole('option', { name: /^Carro \(R\$\s180,00\)$/ })).toBeInTheDocument()
  })

  it('só cria com nome: espaços em branco mostram "Informe o nome do cliente."', async () => {
    const { ui } = await abrirNovo()
    await ui.type(form().getByLabelText('Nome'), '   ')
    await ui.click(form().getByRole('button', { name: 'Criar cliente' }))
    expect(await form().findByRole('alert')).toHaveTextContent('Informe o nome do cliente.')
    expect(bancoFalso.tabelas.clientes.some((c) => c.nome.trim() === '')).toBe(false)
  })

  it('WhatsApp inválido não deixa criar', async () => {
    const { ui } = await abrirNovo()
    await ui.type(form().getByLabelText('Nome'), 'Novo Cliente')
    await ui.type(form().getByLabelText('WhatsApp'), '123')
    await ui.click(form().getByRole('button', { name: 'Criar cliente' }))
    expect(await form().findByRole('alert')).toHaveTextContent(
      'WhatsApp inválido. Informe DDD + número, ex.: (85) 99999-9999.',
    )
  })

  it('cria o cliente só com os dados, sem itens', async () => {
    const { ui } = await abrirNovo()
    await ui.type(form().getByLabelText('Nome'), '  Hugo Teste  ')
    await ui.type(form().getByLabelText('Telefone'), '(85) 97777-0001')
    await ui.type(form().getByLabelText('WhatsApp'), '(85) 97777-0001')
    await escolherOpcao(ui, 'Dia de pagamento', 'Sábado')
    await ui.type(form().getByLabelText('Observações'), 'cliente novo')
    await ui.click(form().getByRole('button', { name: 'Criar cliente' }))

    expect(await screen.findByText('Cliente criado.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const criado = bancoFalso.tabelas.clientes.find((c) => c.nome === 'Hugo Teste')
    expect(criado).toMatchObject({
      galpao_id: IDS.galpao1,
      telefone: '(85) 97777-0001',
      whatsapp: '(85) 97777-0001',
      dia_pagamento: 'sabado',
      observacoes: 'cliente novo',
      ativo: true,
      criado_por: IDS.usuarioSuper,
    })
    expect(await screen.findByText('Hugo Teste', { selector: 'td' })).toBeInTheDocument()
    expect(linha('Hugo Teste').getByText(reais(0))).toBeInTheDocument()
  })

  it('campos em branco são gravados como vazios (não como texto)', async () => {
    const { ui } = await abrirNovo()
    await ui.type(form().getByLabelText('Nome'), 'Sem Contato')
    await ui.click(form().getByRole('button', { name: 'Criar cliente' }))
    await screen.findByText('Cliente criado.')
    expect(bancoFalso.tabelas.clientes.find((c) => c.nome === 'Sem Contato')).toMatchObject({
      telefone: null,
      whatsapp: null,
      observacoes: null,
    })
  })

  it('pode criar o cliente já inativo', async () => {
    const { ui } = await abrirNovo()
    await ui.type(form().getByLabelText('Nome'), 'Cliente Parado')
    await ui.click(form().getByLabelText(/Cliente ativo/))
    await ui.click(form().getByRole('button', { name: 'Criar cliente' }))
    await screen.findByText('Cliente criado.')
    expect(bancoFalso.tabelas.clientes.find((c) => c.nome === 'Cliente Parado')?.ativo).toBe(false)
  })

  describe('itens guardados', () => {
    async function comTipo(nome: RegExp = /^Carrinho de roupa/) {
      const tela = await abrirNovo()
      await escolherOpcao(tela.ui, 'Tipo do item', nome)
      return tela
    }

    it('"Adicionar à lista" só funciona depois de escolher o tipo', async () => {
      const { ui } = await abrirNovo()
      expect(form().getByRole('button', { name: 'Adicionar à lista' })).toBeDisabled()
      await escolherOpcao(ui, 'Tipo do item', /^Carro \(/)
      expect(form().getByRole('button', { name: 'Adicionar à lista' })).toBeEnabled()
    })

    it('o item entra na lista como "Novo", com quantidade 1 e o valor do preço', async () => {
      const { ui } = await comTipo()
      await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
      const lista = within(form().getByRole('list'))
      expect(lista.getByText('Carrinho de roupa')).toBeInTheDocument()
      expect(lista.getByText('Novo')).toBeInTheDocument()
      expect(lista.getByText(reais(110))).toBeInTheDocument()
      expect(form().queryByText('Nenhum item cadastrado ainda.')).not.toBeInTheDocument()
      // o formulário do item volta ao início
      expect(form().getByLabelText('Tipo do item')).toHaveTextContent('Selecione o tipo...')
      expect(form().getByLabelText('Qtd.')).toHaveValue(1)
    })

    it('a identificação (ex.: placa) aparece junto do nome', async () => {
      const { ui } = await comTipo(/^Carro \(/)
      await ui.type(form().getByLabelText('Identificação'), 'ABC-1234')
      await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
      expect(form().getByText('Carro — ABC-1234')).toBeInTheDocument()
    })

    it('a quantidade digitada multiplica o valor', async () => {
      const { ui } = await comTipo()
      const qtd = form().getByLabelText('Qtd.')
      await ui.clear(qtd)
      await ui.type(qtd, '3')
      await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
      expect(within(form().getByRole('list')).getByText(reais(330))).toBeInTheDocument()
    })

    it('quantidade zero não adiciona (o campo só aceita números a partir de 1)', async () => {
      const { ui } = await comTipo()
      const qtd = form().getByLabelText('Qtd.')
      expect(qtd).toHaveAttribute('min', '1')
      await ui.clear(qtd)
      await ui.type(qtd, '0')
      await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
      expect(form().getByText('Nenhum item cadastrado ainda.')).toBeInTheDocument()
    })

    it('item igual a outro da lista só soma a quantidade (não repete a linha)', async () => {
      const { ui } = await comTipo()
      await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
      await escolherOpcao(ui, 'Tipo do item', /^Carrinho de roupa/)
      await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
      const lista = within(form().getByRole('list'))
      expect(lista.getAllByRole('listitem')).toHaveLength(1)
      expect(lista.getByText(reais(220))).toBeInTheDocument()
    })

    it('mesmo tipo com identificação diferente vira outra linha', async () => {
      const { ui } = await comTipo(/^Carro \(/)
      await ui.type(form().getByLabelText('Identificação'), 'AAA-1111')
      await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
      await escolherOpcao(ui, 'Tipo do item', /^Carro \(/)
      await ui.type(form().getByLabelText('Identificação'), 'BBB-2222')
      await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
      expect(within(form().getByRole('list')).getAllByRole('listitem')).toHaveLength(2)
    })

    it('os botões + e − mudam a quantidade, e − não deixa passar de 1 em item novo', async () => {
      const { ui } = await comTipo()
      await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
      const item = within(form().getByRole('list'))
      expect(item.getByRole('button', { name: 'Diminuir quantidade' })).toBeDisabled()
      await ui.click(item.getByRole('button', { name: 'Aumentar quantidade' }))
      await ui.click(item.getByRole('button', { name: 'Aumentar quantidade' }))
      expect(item.getByText(reais(330))).toBeInTheDocument()
      await ui.click(item.getByRole('button', { name: 'Diminuir quantidade' }))
      expect(item.getByText(reais(220))).toBeInTheDocument()
    })

    it('a lixeira tira o item novo da lista', async () => {
      const { ui } = await comTipo()
      await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
      await ui.click(within(form().getByRole('list')).getByRole('button', { name: 'Remover item' }))
      expect(form().getByText('Nenhum item cadastrado ainda.')).toBeInTheDocument()
    })

    it('só grava os itens ao criar: nada vai para o banco antes', async () => {
      const { ui } = await comTipo()
      await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
      expect(bancoFalso.tabelas.itens_guardados.filter((i) => i.galpao_id === IDS.galpao1)).toHaveLength(7)
      await ui.type(form().getByLabelText('Nome'), 'Com Item')
      await ui.click(form().getByRole('button', { name: 'Criar cliente' }))
      expect(await screen.findByText('Cliente criado. 1 item adicionado.')).toBeInTheDocument()
      const cliente = bancoFalso.tabelas.clientes.find((c) => c.nome === 'Com Item')
      expect(bancoFalso.tabelas.itens_guardados.filter((i) => i.cliente_id === cliente?.id)).toMatchObject([
        { tipo_item_id: IDS.tipoRoupa, quantidade: 1, galpao_id: IDS.galpao1 },
      ])
      await screen.findByText('Com Item', { selector: 'td' })
      expect(linha('Com Item').getByText(reais(110))).toBeInTheDocument()
    })

    it('o item escolhido e não adicionado entra junto no Criar cliente', async () => {
      const { ui } = await comTipo(/^Carro \(/)
      await ui.type(form().getByLabelText('Nome'), 'Rascunho')
      await ui.click(form().getByRole('button', { name: 'Criar cliente' }))
      expect(await screen.findByText('Cliente criado. 1 item adicionado.')).toBeInTheDocument()
      const cliente = bancoFalso.tabelas.clientes.find((c) => c.nome === 'Rascunho')
      expect(bancoFalso.tabelas.itens_guardados.find((i) => i.cliente_id === cliente?.id)?.tipo_item_id).toBe(IDS.tipoCarro)
    })

    it('rascunho de item com quantidade inválida impede de criar e explica', async () => {
      const { ui } = await comTipo()
      const qtd = form().getByLabelText('Qtd.')
      await ui.clear(qtd)
      await ui.type(qtd, 'x')
      await ui.type(form().getByLabelText('Nome'), 'Rascunho Ruim')
      await ui.click(form().getByRole('button', { name: 'Criar cliente' }))
      expect(await form().findByRole('alert')).toHaveTextContent('Item em preenchimento:')
      expect(bancoFalso.tabelas.clientes.some((c) => c.nome === 'Rascunho Ruim')).toBe(false)
    })

    it('resume o total de unidades adicionadas', async () => {
      const { ui } = await comTipo()
      const qtd = form().getByLabelText('Qtd.')
      await ui.clear(qtd)
      await ui.type(qtd, '2')
      await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
      await ui.type(form().getByLabelText('Nome'), 'Dois Itens')
      await ui.click(form().getByRole('button', { name: 'Criar cliente' }))
      expect(await screen.findByText('Cliente criado. 2 itens adicionados.')).toBeInTheDocument()
    })
  })

  describe('fechar sem salvar', () => {
    it('sem alterações, fecha direto (sem perguntar)', async () => {
      const { ui } = await abrirNovo()
      await ui.click(form().getByRole('button', { name: 'Cancelar' }))
      expect(window.confirm).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('com alterações, pergunta; "não" mantém o formulário', async () => {
      vi.mocked(window.confirm).mockReturnValue(false)
      const { ui } = await abrirNovo()
      await ui.type(form().getByLabelText('Nome'), 'Em andamento')
      await ui.click(form().getByRole('button', { name: 'Cancelar' }))
      expect(window.confirm).toHaveBeenCalledWith('Descartar as alterações que ainda não foram salvas?')
      expect(screen.getByRole('dialog', { name: 'Novo cliente' })).toBeInTheDocument()
      expect(form().getByLabelText('Nome')).toHaveValue('Em andamento')
    })

    it('com alterações, "sim" descarta e não grava nada', async () => {
      const { ui } = await abrirNovo()
      await ui.type(form().getByLabelText('Nome'), 'Descartado')
      await ui.click(form().getByRole('button', { name: 'Cancelar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(bancoFalso.tabelas.clientes.some((c) => c.nome === 'Descartado')).toBe(false)
    })

    it('o X do topo também pergunta quando há alterações', async () => {
      const { ui } = await abrirNovo()
      await ui.type(form().getByLabelText('Observações'), 'algo')
      await ui.click(form().getByRole('button', { name: 'Fechar' }))
      expect(window.confirm).toHaveBeenCalled()
    })

    it('clicar fora do formulário não fecha', async () => {
      const { ui } = await abrirNovo()
      const fundo = screen.getByRole('dialog').parentElement as HTMLElement
      await ui.pointer([{ target: fundo, keys: '[MouseLeft]' }])
      expect(screen.getByRole('dialog', { name: 'Novo cliente' })).toBeInTheDocument()
    })
  })

  describe('erros ao salvar', () => {
    it('falha ao criar o cliente: aviso no formulário e na tela, e nada é perdido', async () => {
      const { ui } = await abrirNovo()
      bancoFalso.falhar('from:clientes:insert', 'boom')
      await ui.type(form().getByLabelText('Nome'), 'Vai Falhar')
      await ui.click(form().getByRole('button', { name: 'Criar cliente' }))
      expect(await form().findByRole('alert')).toHaveTextContent('Erro ao criar cliente.')
      expect(await screen.findByText('Não foi possível criar o cliente.')).toBeInTheDocument()
      expect(form().getByLabelText('Nome')).toHaveValue('Vai Falhar')
      expect(form().getByRole('button', { name: 'Criar cliente' })).toBeEnabled()
    })

    it('cliente criado mas itens não: avisa e o botão passa a ser "Salvar" (tentar de novo não duplica o cliente)', async () => {
      const { ui } = await abrirNovo()
      await escolherOpcao(ui, 'Tipo do item', /^Carrinho de roupa/)
      await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
      bancoFalso.falhar('from:itens_guardados:insert', 'boom')
      await ui.type(form().getByLabelText('Nome'), 'Parcial')
      await ui.click(form().getByRole('button', { name: 'Criar cliente' }))
      expect(await form().findByRole('alert')).toHaveTextContent(
        'O cliente foi salvo, mas não foi possível gravar os itens. Tente salvar de novo.',
      )
      expect(form().getByRole('button', { name: 'Salvar' })).toBeEnabled()
      bancoFalso.falhas.clear()
      await ui.click(form().getByRole('button', { name: 'Salvar' }))
      expect(await screen.findByText('Cliente salvo. 1 item adicionado.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.clientes.filter((c) => c.nome === 'Parcial')).toHaveLength(1)
    })

    it('enquanto salva, o Cancelar fica desativado', async () => {
      const { ui } = await abrirNovo()
      bancoFalso.atrasar('from:clientes:insert', 200)
      await ui.type(form().getByLabelText('Nome'), 'Devagar')
      await ui.click(form().getByRole('button', { name: 'Criar cliente' }))
      await waitFor(() => expect(form().getByRole('button', { name: 'Cancelar' })).toBeDisabled())
      await screen.findByText('Cliente criado.')
    })
  })
})

describe('Clientes: editar', () => {
  async function abrirEdicao(nome = 'Ana Souza') {
    const tela = await abrir()
    await tela.ui.click(linha(nome).getByRole('button', { name: 'Editar' }))
    return tela
  }
  const form = () => modal('Editar cliente')

  it('abre com os dados do cliente e os itens já guardados', async () => {
    await abrirEdicao()
    expect(form().getByLabelText('Nome')).toHaveValue('Ana Souza')
    expect(form().getByLabelText('Telefone')).toHaveValue('(85) 98888-0001')
    expect(form().getByLabelText('WhatsApp')).toHaveValue('(85) 98888-0001')
    expect(form().getByLabelText('Dia de pagamento')).toHaveTextContent('Sábado')
    expect(form().getByLabelText(/Cliente ativo/)).toBeChecked()
    const lista = within(form().getByRole('list'))
    expect(lista.getByText('Carrinho de roupa')).toBeInTheDocument()
    expect(lista.getByText(reais(110))).toBeInTheDocument()
    expect(form().getByRole('button', { name: 'Salvar' })).toBeEnabled()
  })

  it('cliente inativo abre com a caixa "ativo" desmarcada', async () => {
    await abrirEdicao('Fábio Inativo')
    expect(form().getByLabelText(/Cliente ativo/)).not.toBeChecked()
  })

  it('salva as mudanças nos dados', async () => {
    const { ui } = await abrirEdicao()
    const nome = form().getByLabelText('Nome')
    await ui.clear(nome)
    await ui.type(nome, 'Ana Souza Lima')
    await escolherOpcao(ui, 'Dia de pagamento', 'Quarta-feira')
    await ui.click(form().getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Cliente salvo.')).toBeInTheDocument()
    expect(bancoFalso.tabelas.clientes.find((c) => c.id === IDS.ana)).toMatchObject({
      nome: 'Ana Souza Lima',
      dia_pagamento: 'quarta',
    })
    expect(await screen.findByText('Ana Souza Lima', { selector: 'td' })).toBeInTheDocument()
  })

  it('desmarcar "ativo" deixa o cliente inativo', async () => {
    const { ui } = await abrirEdicao()
    await ui.click(form().getByLabelText(/Cliente ativo/))
    await ui.click(form().getByRole('button', { name: 'Salvar' }))
    await screen.findByText('Cliente salvo.')
    await waitFor(() => expect(linha('Ana Souza').getByText('Inativo')).toBeInTheDocument())
  })

  it('o + aumenta a quantidade, mostra "1 → 2" e o novo valor; só grava ao salvar', async () => {
    const { ui } = await abrirEdicao()
    const item = within(form().getByRole('list'))
    await ui.click(item.getByRole('button', { name: 'Aumentar quantidade' }))
    expect(item.getByText('1 → 2')).toBeInTheDocument()
    expect(item.getByText(reais(220))).toBeInTheDocument()
    expect(bancoFalso.tabelas.itens_guardados.find((i) => i.id === `ite-${IDS.ana}`)?.quantidade).toBe(1)
    await ui.click(form().getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Cliente salvo. 1 item adicionado.')).toBeInTheDocument()
    expect(bancoFalso.tabelas.itens_guardados.find((i) => i.id === `ite-${IDS.ana}`)?.quantidade).toBe(2)
  })

  it('"Desfazer a mudança de quantidade" volta ao valor original', async () => {
    const { ui } = await abrirEdicao()
    const item = within(form().getByRole('list'))
    await ui.click(item.getByRole('button', { name: 'Aumentar quantidade' }))
    await ui.click(item.getByRole('button', { name: 'Desfazer a mudança de quantidade' }))
    expect(item.queryByText('1 → 2')).not.toBeInTheDocument()
    expect(item.getByText(reais(110))).toBeInTheDocument()
  })

  it('o − em item de quantidade 1 marca o item como "Será removido", e "Manter item" desfaz', async () => {
    const { ui } = await abrirEdicao()
    const item = within(form().getByRole('list'))
    // com quantidade 1 o − vira "Remover item" (além da lixeira)
    const botoes = item.getAllByRole('button', { name: 'Remover item' })
    expect(botoes).toHaveLength(2)
    await ui.click(botoes[0])
    expect(item.getByText('Será removido')).toBeInTheDocument()
    await ui.click(item.getByRole('button', { name: 'Manter item' }))
    expect(item.queryByText('Será removido')).not.toBeInTheDocument()
  })

  it('remover um item e salvar apaga o item do banco', async () => {
    const { ui } = await abrirEdicao()
    const item = within(form().getByRole('list'))
    await ui.click(item.getAllByRole('button', { name: 'Remover item' })[1])
    await ui.click(form().getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Cliente salvo. 1 item removido.')).toBeInTheDocument()
    expect(bancoFalso.tabelas.itens_guardados.some((i) => i.cliente_id === IDS.ana)).toBe(false)
    await waitFor(() => expect(linha('Ana Souza').getByText(reais(0))).toBeInTheDocument())
  })

  it('adicionar e remover juntos resume os dois', async () => {
    const { ui } = await abrirEdicao()
    await ui.click(within(form().getByRole('list')).getAllByRole('button', { name: 'Remover item' })[1])
    await escolherOpcao(ui, 'Tipo do item', /^Carro \(/)
    await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
    await ui.click(form().getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Cliente salvo. 1 item adicionado e 1 item removido.')).toBeInTheDocument()
  })

  it('item igual a um já guardado soma na linha existente em vez de criar outra', async () => {
    const { ui } = await abrirEdicao()
    await escolherOpcao(ui, 'Tipo do item', /^Carrinho de roupa/)
    await ui.click(form().getByRole('button', { name: 'Adicionar à lista' }))
    const lista = within(form().getByRole('list'))
    expect(lista.getAllByRole('listitem')).toHaveLength(1)
    expect(lista.getByText('1 → 2')).toBeInTheDocument()
  })

  it('fechar com a quantidade alterada pergunta antes de descartar', async () => {
    const { ui } = await abrirEdicao()
    await ui.click(within(form().getByRole('list')).getByRole('button', { name: 'Aumentar quantidade' }))
    await ui.click(form().getByRole('button', { name: 'Cancelar' }))
    expect(window.confirm).toHaveBeenCalled()
  })

  it('erro ao salvar o cliente mostra o aviso', async () => {
    const { ui } = await abrirEdicao()
    bancoFalso.falhar('from:clientes:update', 'boom')
    await ui.click(form().getByLabelText(/Cliente ativo/))
    await ui.click(form().getByRole('button', { name: 'Salvar' }))
    expect(await form().findByRole('alert')).toHaveTextContent('Erro ao salvar cliente.')
    expect(await screen.findByText('Não foi possível salvar o cliente.')).toBeInTheDocument()
  })

  it('erro ao remover itens avisa que o cliente foi salvo', async () => {
    const { ui } = await abrirEdicao()
    bancoFalso.falhar('from:itens_guardados:delete', 'boom')
    await ui.click(within(form().getByRole('list')).getAllByRole('button', { name: 'Remover item' })[1])
    await ui.click(form().getByRole('button', { name: 'Salvar' }))
    expect(await form().findByRole('alert')).toHaveTextContent(
      'O cliente foi salvo, mas não foi possível remover os itens. Tente salvar de novo.',
    )
  })

  it('erro ao atualizar quantidades avisa que o cliente foi salvo', async () => {
    const { ui } = await abrirEdicao()
    bancoFalso.falhar('from:itens_guardados:update', 'boom')
    await ui.click(within(form().getByRole('list')).getByRole('button', { name: 'Aumentar quantidade' }))
    await ui.click(form().getByRole('button', { name: 'Salvar' }))
    expect(await form().findByRole('alert')).toHaveTextContent(
      'O cliente foi salvo, mas não foi possível atualizar as quantidades. Tente salvar de novo.',
    )
  })
})

describe('Clientes: excluir', () => {
  it('pede confirmação citando o cliente e avisa que os itens também serão apagados', async () => {
    vi.mocked(window.confirm).mockReturnValue(false)
    const { ui } = await abrir()
    await ui.click(linha('Fábio Inativo').getByRole('button', { name: 'Excluir' }))
    const pergunta = vi.mocked(window.confirm).mock.calls[0][0] as string
    expect(pergunta).toContain('Excluir "Fábio Inativo"?')
    expect(pergunta).toContain('apaga também os itens guardados')
    expect(pergunta).toContain('deixe-os inativos')
    expect(bancoFalso.tabelas.clientes.some((c) => c.id === IDS.fabio)).toBe(true)
  })

  it('confirmando, apaga o cliente e tira da lista', async () => {
    const { ui } = await abrir()
    await ui.click(linha('Fábio Inativo').getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Cliente excluído.')).toBeInTheDocument()
    expect(bancoFalso.tabelas.clientes.some((c) => c.id === IDS.fabio)).toBe(false)
    await waitFor(() => expect(screen.queryByText('Fábio Inativo', { selector: 'td' })).not.toBeInTheDocument())
  })

  it('cliente que já tem pagamentos não é excluído e o aviso sugere deixar inativo', async () => {
    const { ui } = await abrir()
    bancoFalso.falhar('from:clientes:delete', 'violates foreign key', { code: '23503' })
    await ui.click(linha('Ana Souza').getByRole('button', { name: 'Excluir' }))
    expect(
      await screen.findByText('Este cliente tem pagamentos registrados e não pode ser excluído. Marque-o como inativo.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Ana Souza', { selector: 'td' })).toBeInTheDocument()
  })

  it('outro erro mostra o aviso genérico', async () => {
    const { ui } = await abrir()
    bancoFalso.falhar('from:clientes:delete', 'boom')
    await ui.click(linha('Ana Souza').getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Não foi possível excluir o cliente.')).toBeInTheDocument()
  })
})

describe('Clientes: exportar para planilha', () => {
  it('baixa um arquivo com o nome clientes-AAAA-MM-DD.csv e avisa quantos foram', async () => {
    const baixados = espiarDownload()
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(baixados.nomes).toEqual(['clientes-2025-10-11.csv'])
    expect(await screen.findByText('7 clientes exportados.')).toBeInTheDocument()
  })

  it('o arquivo tem o cabeçalho, os dados certos e abre com acentos no Excel (BOM e ponto e vírgula)', async () => {
    const baixados = espiarDownload()
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Exportar' }))
    const bruto = await baixados.conteudo()
    expect(bruto.startsWith('\uFEFF')).toBe(true)
    const linhas = bruto.replace('\uFEFF', '').replace(/\u00a0/g, ' ').trim().split('\r\n')
    expect(linhas[0]).toBe('Nome;Telefone;WhatsApp;Dia de pagamento;Situação;Valor semanal;Observações;Cadastro')
    expect(linhas[1]).toBe('Ana Souza;(85) 98888-0001;(85) 98888-0001;Sábado;Ativo;110,00;;11/10/2025')
    expect(linhas).toHaveLength(8)
    expect(linhas.find((l) => l.startsWith('Fábio Inativo'))).toContain(';Inativo;')
  })

  it('exporta só o que está filtrado na tela', async () => {
    const baixados = espiarDownload()
    const { ui } = await abrir()
    await ui.type(screen.getByPlaceholderText('Buscar nome, telefone ou WhatsApp...'), 'carla')
    await ui.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(await screen.findByText('1 cliente exportado.')).toBeInTheDocument()
    const texto = await baixados.conteudo()
    expect(texto.trim().split('\r\n')).toHaveLength(2)
  })

  it('protege contra fórmulas de planilha: nome começando com = vira texto', async () => {
    const baixados = espiarDownload()
    const { ui } = await abrir({
      preparar: () => {
        const ana = bancoFalso.tabelas.clientes.find((c) => c.id === IDS.ana)
        if (ana) ana.nome = '=1+1'
      },
    })
    await ui.click(screen.getByRole('button', { name: 'Exportar' }))
    const texto = await baixados.conteudo()
    expect(texto).toContain("'=1+1;")
  })

  it('sem nenhum cliente na busca o botão fica desativado', async () => {
    const { ui } = await abrir()
    await ui.type(screen.getByPlaceholderText('Buscar nome, telefone ou WhatsApp...'), 'zzzz')
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeDisabled()
  })
})
