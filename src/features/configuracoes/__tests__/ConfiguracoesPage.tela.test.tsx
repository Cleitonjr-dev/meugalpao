import { describe, expect, it, vi } from 'vitest'
import { ConfiguracoesPage } from '@/features/configuracoes'
import { bancoFalso } from '@/test/bancoFalso'
import { IDS, SENHA_PADRAO } from '@/test/dados'
import { reais, renderizarTela, screen, semNbsp, waitFor, within } from '@/test/renderizar'

async function abrir(opcoes: Parameters<typeof renderizarTela>[1] = {}) {
  const tela = renderizarTela(<ConfiguracoesPage />, { rota: '/configuracoes', ...opcoes })
  await screen.findByRole('heading', { level: 1, name: 'Configurações' })
  return tela
}

async function abrirAba(nome: string, opcoes: Parameters<typeof renderizarTela>[1] = {}) {
  const tela = await abrir(opcoes)
  await tela.ui.click(await screen.findByRole('button', { name: nome }))
  return tela
}

const senha = () => screen.getByLabelText('Senha')

describe('Configurações: quem pode entrar', () => {
  it('usuário comum vê só o aviso e nenhuma aba', async () => {
    await abrir({ usuario: 'comum' })
    expect(screen.getByText('Apenas o super usuário pode gerenciar galpões e usuários.')).toBeInTheDocument()
    for (const aba of ['Galpões', 'Usuários', 'Tipos e Preços', 'Histórico']) {
      expect(screen.queryByRole('button', { name: aba })).not.toBeInTheDocument()
    }
  })

  it('super usuário vê as 4 abas e começa em Galpões', async () => {
    await abrir()
    for (const aba of ['Galpões', 'Usuários', 'Tipos e Preços', 'Histórico']) {
      expect(await screen.findByRole('button', { name: aba })).toBeInTheDocument()
    }
    expect(await screen.findByRole('heading', { name: 'Galpões' })).toBeInTheDocument()
  })

  it('trocar de aba mostra o conteúdo de cada uma', async () => {
    const { ui } = await abrir()
    await ui.click(await screen.findByRole('button', { name: 'Usuários' }))
    expect(await screen.findByRole('heading', { name: 'Usuários' })).toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: 'Tipos e Preços' }))
    expect(await screen.findByRole('heading', { name: 'Tipos e preços' })).toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: 'Histórico' }))
    expect(await screen.findByRole('heading', { name: 'Histórico' })).toBeInTheDocument()
  })
})

describe('Configurações: Galpões', () => {
  const cartao = (nome: string) => {
    const li = screen.getByRole('heading', { level: 3, name: nome }).closest('li')
    return within(li as HTMLElement)
  }

  it('mostra um cartão por galpão com endereço, clientes ativos e usuários', async () => {
    await abrir()
    await screen.findByRole('heading', { level: 3, name: 'Galpão 1' })
    const g1 = cartao('Galpão 1')
    expect(g1.getByText('Rua A, 10 - Centro')).toBeInTheDocument()
    await waitFor(() => expect(g1.getByText('6 clientes ativos')).toBeInTheDocument())
    expect(g1.getByText('2 usuários')).toBeInTheDocument() // o super usuário e a Maria
    const g2 = cartao('Galpão 2')
    expect(g2.getByText('Sem endereço cadastrado')).toBeInTheDocument()
    await waitFor(() => expect(g2.getByText('1 cliente ativo')).toBeInTheDocument())
    expect(g2.getByText('1 usuário')).toBeInTheDocument() // só o super usuário
  })

  it('sem galpões mostra o convite para criar o primeiro', async () => {
    await abrir({ preparar: () => (bancoFalso.tabelas.galpoes = []) })
    expect(await screen.findByText('Nenhum galpão cadastrado')).toBeInTheDocument()
    expect(screen.getByText('Crie o primeiro galpão para começar.')).toBeInTheDocument()
  })

  describe('criar e editar', () => {
    it('Novo galpão: Salvar só com nome; grava nome e endereço sem espaços sobrando', async () => {
      const { ui } = await abrir()
      await ui.click(await screen.findByRole('button', { name: 'Novo galpão' }))
      const janela = within(screen.getByRole('dialog', { name: 'Novo galpão' }))
      expect(janela.getByRole('button', { name: 'Salvar' })).toBeDisabled()
      await ui.type(janela.getByLabelText('Nome'), '  Galpão 3  ')
      await ui.type(janela.getByLabelText('Endereço'), '  Rua C, 30  ')
      await ui.click(janela.getByRole('button', { name: 'Salvar' }))
      expect(await screen.findByText('Galpão criado.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.galpoes.find((g) => g.nome === 'Galpão 3')).toMatchObject({ endereco: 'Rua C, 30' })
      await screen.findByRole('heading', { level: 3, name: 'Galpão 3' })
    })

    it('endereço em branco é gravado como vazio', async () => {
      const { ui } = await abrir()
      await ui.click(await screen.findByRole('button', { name: 'Novo galpão' }))
      const janela = within(screen.getByRole('dialog', { name: 'Novo galpão' }))
      await ui.type(janela.getByLabelText('Nome'), 'Sem Rua')
      await ui.click(janela.getByRole('button', { name: 'Salvar' }))
      await screen.findByText('Galpão criado.')
      expect(bancoFalso.tabelas.galpoes.find((g) => g.nome === 'Sem Rua')?.endereco).toBeNull()
    })

    it('erro ao criar mostra o aviso e o formulário continua aberto', async () => {
      const { ui } = await abrir()
      bancoFalso.falhar('from:galpoes:insert', 'boom')
      await ui.click(await screen.findByRole('button', { name: 'Novo galpão' }))
      const janela = within(screen.getByRole('dialog', { name: 'Novo galpão' }))
      await ui.type(janela.getByLabelText('Nome'), 'Vai Falhar')
      await ui.click(janela.getByRole('button', { name: 'Salvar' }))
      expect(await screen.findByText('Erro ao criar o galpão.')).toBeInTheDocument()
      expect(screen.getByRole('dialog', { name: 'Novo galpão' })).toBeInTheDocument()
    })

    it('Editar: abre com os dados atuais e salva a mudança', async () => {
      const { ui } = await abrir()
      await screen.findByRole('heading', { level: 3, name: 'Galpão 1' })
      await ui.click(cartao('Galpão 1').getByRole('button', { name: 'Editar galpão' }))
      const janela = within(screen.getByRole('dialog', { name: 'Editar galpão' }))
      expect(janela.getByLabelText('Nome')).toHaveValue('Galpão 1')
      expect(janela.getByLabelText('Endereço')).toHaveValue('Rua A, 10 - Centro')
      await ui.clear(janela.getByLabelText('Nome'))
      await ui.type(janela.getByLabelText('Nome'), 'Galpão Principal')
      await ui.click(janela.getByRole('button', { name: 'Salvar' }))
      expect(await screen.findByText('Galpão atualizado.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.galpoes.find((g) => g.id === IDS.galpao1)?.nome).toBe('Galpão Principal')
    })

    it('erro ao editar mostra o aviso', async () => {
      const { ui } = await abrir()
      await screen.findByRole('heading', { level: 3, name: 'Galpão 1' })
      bancoFalso.falhar('from:galpoes:update', 'boom')
      await ui.click(cartao('Galpão 1').getByRole('button', { name: 'Editar galpão' }))
      await ui.click(within(screen.getByRole('dialog', { name: 'Editar galpão' })).getByRole('button', { name: 'Salvar' }))
      expect(await screen.findByText('Erro ao salvar o galpão.')).toBeInTheDocument()
    })

    it('Cancelar fecha sem gravar', async () => {
      const { ui } = await abrir()
      await ui.click(await screen.findByRole('button', { name: 'Novo galpão' }))
      const janela = within(screen.getByRole('dialog', { name: 'Novo galpão' }))
      await ui.type(janela.getByLabelText('Nome'), 'Rascunho')
      await ui.click(janela.getByRole('button', { name: 'Cancelar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(bancoFalso.tabelas.galpoes.some((g) => g.nome === 'Rascunho')).toBe(false)
    })
  })

  describe('excluir (AUD-001)', () => {
    async function abrirExclusao(nome = 'Galpão 2') {
      const tela = await abrir()
      await screen.findByRole('heading', { level: 3, name: nome })
      await tela.ui.click(cartao(nome).getByRole('button', { name: 'Excluir galpão' }))
      const janela = within(await screen.findByRole('dialog', { name: 'Excluir galpão' }))
      return { ...tela, janela }
    }

    it('explica o que acontece e avisa que galpão com pagamentos não pode ser excluído', async () => {
      const { janela } = await abrirExclusao()
      expect(janela.getByText(/não podem ser excluídos/)).toBeInTheDocument()
      expect(janela.getByText(/o histórico financeiro é preservado/)).toBeInTheDocument()
      expect(janela.getByLabelText('Digite o nome do galpão para confirmar')).toHaveValue('')
      expect(janela.getByRole('button', { name: 'Excluir galpão' })).toBeDisabled()
    })

    it('só libera o botão com o nome certo e a senha preenchida', async () => {
      const { ui, janela } = await abrirExclusao()
      const botao = janela.getByRole('button', { name: 'Excluir galpão' })
      await ui.type(senha(), SENHA_PADRAO)
      expect(botao).toBeDisabled()
      await ui.type(janela.getByLabelText('Digite o nome do galpão para confirmar'), 'Galpão 3')
      expect(botao).toBeDisabled()
      await ui.clear(janela.getByLabelText('Digite o nome do galpão para confirmar'))
      await ui.type(janela.getByLabelText('Digite o nome do galpão para confirmar'), 'Galpão 2')
      expect(botao).toBeEnabled()
    })

    it('senha errada não exclui', async () => {
      const { ui, janela } = await abrirExclusao()
      await ui.type(janela.getByLabelText('Digite o nome do galpão para confirmar'), 'Galpão 2')
      await ui.type(senha(), 'errada')
      await ui.click(janela.getByRole('button', { name: 'Excluir galpão' }))
      expect(await janela.findByText('Senha incorreta.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.galpoes.some((g) => g.id === IDS.galpao2)).toBe(true)
    })

    it('com nome e senha certos exclui, avisa e tira o cartão', async () => {
      const { ui, janela } = await abrirExclusao()
      await ui.type(janela.getByLabelText('Digite o nome do galpão para confirmar'), 'Galpão 2')
      await ui.type(senha(), SENHA_PADRAO)
      await ui.click(janela.getByRole('button', { name: 'Excluir galpão' }))
      expect(await screen.findByText('Galpão excluído.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.galpoes.some((g) => g.id === IDS.galpao2)).toBe(false)
      await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: 'Galpão 2' })).not.toBeInTheDocument())
    })

    it('galpão com pagamentos: a recusa do banco aparece na janela e o galpão continua', async () => {
      const { ui, janela } = await abrirExclusao('Galpão 1')
      bancoFalso.falhar(
        'from:galpoes:delete',
        'O galpão "Galpão 1" tem 7 pagamento(s) registrado(s) e não pode ser excluído. O histórico financeiro é preservado.',
        { code: 'P0001' },
      )
      await ui.type(janela.getByLabelText('Digite o nome do galpão para confirmar'), 'Galpão 1')
      await ui.type(senha(), SENHA_PADRAO)
      await ui.click(janela.getByRole('button', { name: 'Excluir galpão' }))
      expect(await janela.findByText(/tem 7 pagamento\(s\) registrado\(s\) e não pode ser excluído/)).toBeInTheDocument()
      expect(bancoFalso.tabelas.galpoes.some((g) => g.id === IDS.galpao1)).toBe(true)
    })

    it('erro inesperado mostra a mensagem genérica', async () => {
      const { ui, janela } = await abrirExclusao()
      bancoFalso.falhar('from:galpoes:delete', 'connection reset')
      await ui.type(janela.getByLabelText('Digite o nome do galpão para confirmar'), 'Galpão 2')
      await ui.type(senha(), SENHA_PADRAO)
      await ui.click(janela.getByRole('button', { name: 'Excluir galpão' }))
      expect(await janela.findByText('Erro ao excluir o galpão.')).toBeInTheDocument()
    })

    it('"Voltar" fecha sem excluir', async () => {
      const { ui, janela } = await abrirExclusao()
      await ui.click(janela.getByRole('button', { name: 'Voltar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(bancoFalso.tabelas.galpoes.some((g) => g.id === IDS.galpao2)).toBe(true)
    })
  })
})

describe('Configurações: Usuários', () => {
  const cartaoDe = (nome: string) => {
    const bloco = screen.getByText(nome, { selector: 'p' }).closest('div.rounded-lg')
    return within(bloco as HTMLElement)
  }

  it('lista as pessoas com e-mail, quem é super usuário e os galpões liberados', async () => {
    await abrirAba('Usuários')
    await screen.findByText('Maria', { selector: 'p' })
    const dev = cartaoDe('Dev')
    expect(dev.getByText('dev@meugalpao.com')).toBeInTheDocument()
    expect(dev.getByText('Super usuário tem acesso a todos os galpões.')).toBeInTheDocument()
    expect(dev.getByText('Você não pode remover seu próprio acesso de super usuário.')).toBeInTheDocument()
    expect(dev.getByLabelText('Super Usuário')).toBeChecked()
    expect(dev.getByLabelText('Super Usuário')).toBeDisabled()
    const maria = cartaoDe('Maria')
    expect(maria.getByText('maria@meugalpao.com')).toBeInTheDocument()
    expect(maria.getByLabelText('Super Usuário')).not.toBeChecked()
    expect(maria.getByLabelText('Galpão 1')).toBeChecked()
    expect(maria.getByLabelText('Galpão 2')).not.toBeChecked()
  })

  it('explica que as contas são criadas pelo painel', async () => {
    await abrirAba('Usuários')
    expect(await screen.findByText(/As contas são criadas pelo painel do Supabase/)).toBeInTheDocument()
  })

  describe('acesso aos galpões', () => {
    it('marcar um galpão libera o acesso', async () => {
      const { ui } = await abrirAba('Usuários')
      await screen.findByText('Maria', { selector: 'p' })
      await ui.click(cartaoDe('Maria').getByLabelText('Galpão 2'))
      expect(await screen.findByText('Acesso atualizado.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.galpao_membros.some((m) => m.profile_id === IDS.usuarioComum && m.galpao_id === IDS.galpao2)).toBe(true)
      await waitFor(() => expect(cartaoDe('Maria').getByLabelText('Galpão 2')).toBeChecked())
    })

    it('desmarcar tira o acesso', async () => {
      const { ui } = await abrirAba('Usuários')
      await screen.findByText('Maria', { selector: 'p' })
      await ui.click(cartaoDe('Maria').getByLabelText('Galpão 1'))
      expect(await screen.findByText('Acesso atualizado.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.galpao_membros.some((m) => m.profile_id === IDS.usuarioComum)).toBe(false)
    })

    it('erro mostra "Erro ao alterar acesso."', async () => {
      const { ui } = await abrirAba('Usuários')
      await screen.findByText('Maria', { selector: 'p' })
      bancoFalso.falhar('from:galpao_membros:insert', 'boom')
      await ui.click(cartaoDe('Maria').getByLabelText('Galpão 2'))
      expect(await screen.findByText('Erro ao alterar acesso.')).toBeInTheDocument()
    })
  })

  describe('super usuário pede senha (AUD-003)', () => {
    async function pedirSuper() {
      const tela = await abrirAba('Usuários')
      await screen.findByText('Maria', { selector: 'p' })
      await tela.ui.click(cartaoDe('Maria').getByLabelText('Super Usuário'))
      const janela = within(await screen.findByRole('dialog', { name: 'Tornar super usuário' }))
      return { ...tela, janela }
    }

    it('marcar a caixa NÃO muda nada de imediato: abre a confirmação de senha', async () => {
      const { janela } = await pedirSuper()
      expect(janela.getByText(/passará a ver todos os galpões/)).toBeInTheDocument()
      expect(bancoFalso.tabelas.profiles.find((p) => p.id === IDS.usuarioComum)?.is_super).toBe(false)
      expect(janela.getByRole('button', { name: 'Tornar super usuário' })).toBeDisabled()
    })

    it('senha errada não muda a permissão', async () => {
      const { ui, janela } = await pedirSuper()
      await ui.type(senha(), 'errada')
      await ui.click(janela.getByRole('button', { name: 'Tornar super usuário' }))
      expect(await janela.findByText('Senha incorreta.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.profiles.find((p) => p.id === IDS.usuarioComum)?.is_super).toBe(false)
    })

    it('senha certa torna a pessoa super usuário', async () => {
      const { ui, janela } = await pedirSuper()
      await ui.type(senha(), SENHA_PADRAO)
      await ui.click(janela.getByRole('button', { name: 'Tornar super usuário' }))
      expect(await screen.findByText('Permissão atualizada.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.profiles.find((p) => p.id === IDS.usuarioComum)?.is_super).toBe(true)
      await waitFor(() => expect(cartaoDe('Maria').getByText('Super usuário tem acesso a todos os galpões.')).toBeInTheDocument())
    })

    it('remover o super usuário também pede a senha', async () => {
      const { ui } = await abrirAba('Usuários', {
        preparar: () => {
          const maria = bancoFalso.tabelas.profiles.find((p) => p.id === IDS.usuarioComum)
          if (maria) maria.is_super = true
        },
      })
      await screen.findByText('Maria', { selector: 'p' })
      await ui.click(cartaoDe('Maria').getByLabelText('Super Usuário'))
      const janela = within(await screen.findByRole('dialog', { name: 'Remover super usuário' }))
      expect(janela.getByText(/deixará de ser super usuário/)).toBeInTheDocument()
      await ui.type(senha(), SENHA_PADRAO)
      await ui.click(janela.getByRole('button', { name: 'Remover permissão' }))
      expect(await screen.findByText('Permissão atualizada.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.profiles.find((p) => p.id === IDS.usuarioComum)?.is_super).toBe(false)
    })

    it('a recusa do banco por senha antiga aparece na janela', async () => {
      const { ui, janela } = await pedirSuper()
      bancoFalso.falhar('from:profiles:update', 'Confirme sua senha para alterar permissões.')
      await ui.type(senha(), SENHA_PADRAO)
      await ui.click(janela.getByRole('button', { name: 'Tornar super usuário' }))
      expect(await janela.findByText('Confirme sua senha para alterar permissões.')).toBeInTheDocument()
    })

    it('o banco impede remover o último super usuário e a mensagem aparece', async () => {
      const { ui } = await abrirAba('Usuários', {
        preparar: () => {
          const maria = bancoFalso.tabelas.profiles.find((p) => p.id === IDS.usuarioComum)
          if (maria) maria.is_super = true
        },
      })
      await screen.findByText('Maria', { selector: 'p' })
      bancoFalso.falhar('from:profiles:update', 'Não é possível remover o último super usuário.')
      await ui.click(cartaoDe('Maria').getByLabelText('Super Usuário'))
      await ui.type(senha(), SENHA_PADRAO)
      await ui.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remover permissão' }))
      expect(await screen.findByText('Não é possível remover o último super usuário.')).toBeInTheDocument()
    })

    it('erro inesperado mostra a mensagem genérica', async () => {
      const { ui, janela } = await pedirSuper()
      bancoFalso.falhar('from:profiles:update', 'boom')
      await ui.type(senha(), SENHA_PADRAO)
      await ui.click(janela.getByRole('button', { name: 'Tornar super usuário' }))
      expect(await janela.findByText('Erro ao alterar permissão.')).toBeInTheDocument()
    })

    it('"Voltar" fecha sem mudar nada', async () => {
      const { ui, janela } = await pedirSuper()
      await ui.click(janela.getByRole('button', { name: 'Voltar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(bancoFalso.tabelas.profiles.find((p) => p.id === IDS.usuarioComum)?.is_super).toBe(false)
    })
  })

  it('se a lista falha mostra o erro e deixa tentar de novo', async () => {
    const { ui } = await abrir()
    await screen.findByRole('button', { name: 'Usuários' }) // o perfil do próprio usuário já carregou
    bancoFalso.falhar('from:profiles:select', 'sem rede')
    await ui.click(screen.getByRole('button', { name: 'Usuários' }))
    expect(await screen.findByText('Erro ao carregar usuários.')).toBeInTheDocument()
    bancoFalso.falhas.clear()
    await ui.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Maria', { selector: 'p' })).toBeInTheDocument()
  })
})

describe('Configurações: Tipos e Preços', () => {
  const colunas = () => within(screen.getByRole('table')).getAllByRole('columnheader').map((c) => c.textContent)
  const linhaDoTipo = (nome: string) => {
    const tr = screen.getByText(nome, { selector: 'td span, td' }).closest('tr')
    return within(tr as HTMLElement)
  }
  const comPrecoProprio = () =>
    bancoFalso.tabelas.precos_galpao.push({
      id: 'pre-1',
      galpao_id: IDS.galpao1,
      tipo_item_id: IDS.tipoCarro,
      preco_semanal: 180,
      created_at: '2025-01-01T12:00:00Z',
    })

  it('tem uma coluna por galpão e mostra o preço padrão e o de cada galpão', async () => {
    await abrirAba('Tipos e Preços', { preparar: comPrecoProprio })
    await screen.findByRole('table')
    expect(colunas()).toEqual(['Tipo', 'Padrão', 'Galpão 1', 'Galpão 2', 'Ações'])
    const carro = linhaDoTipo('Carro')
    const celulas = carro.getAllByRole('cell').map((c) => semNbsp(c.textContent ?? ''))
    expect(celulas.slice(0, 4)).toEqual(['Carro', reais(200), reais(180), reais(200)])
  })

  it('busca por nome do tipo', async () => {
    const { ui } = await abrirAba('Tipos e Preços')
    await screen.findByRole('table')
    await ui.type(screen.getByPlaceholderText('Buscar tipo...'), 'comida')
    expect(screen.getByText('Carrinho de comida')).toBeInTheDocument()
    expect(screen.queryByText('Carro', { selector: 'td span, td' })).not.toBeInTheDocument()
  })

  it('o filtro "Com preço próprio" mostra só os tipos com preço próprio e o filtro de galpões limita as colunas', async () => {
    const { ui } = await abrirAba('Tipos e Preços', { preparar: comPrecoProprio })
    await screen.findByRole('table')
    await ui.click(screen.getByRole('button', { name: /Filtros/ }))
    let filtros = within(screen.getByRole('dialog', { name: 'Filtros' }))
    await ui.click(filtros.getByLabelText('Com preço próprio em algum galpão'))
    await ui.click(filtros.getByRole('button', { name: 'Aplicar' }))
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2) // cabeçalho + Carro
    await ui.click(screen.getByRole('button', { name: /Filtros/ }))
    filtros = within(screen.getByRole('dialog', { name: 'Filtros' }))
    await ui.click(filtros.getByLabelText('Galpão 2'))
    await ui.click(filtros.getByRole('button', { name: 'Aplicar' }))
    expect(colunas()).toEqual(['Tipo', 'Padrão', 'Galpão 2', 'Ações'])
  })

  describe('novo tipo', () => {
    async function abrirNovo(opcoes: Parameters<typeof renderizarTela>[1] = {}) {
      const tela = await abrirAba('Tipos e Preços', opcoes)
      await tela.ui.click(await screen.findByRole('button', { name: 'Novo tipo' }))
      const janela = within(await screen.findByRole('dialog', { name: 'Novo tipo' }))
      return { ...tela, janela }
    }

    it('pede nome e preço padrão válidos antes de gravar', async () => {
      const { ui, janela } = await abrirNovo()
      await ui.click(janela.getByRole('button', { name: 'Salvar' }))
      expect(await screen.findByText('Informe o nome do tipo.')).toBeInTheDocument()
      await ui.type(janela.getByLabelText('Nome'), 'Carrinho de pastel')
      await ui.click(janela.getByRole('button', { name: 'Salvar' }))
      expect(await screen.findByText('Informe um preço padrão válido, como 25,00.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.tipos_item.some((t) => t.nome === 'Carrinho de pastel')).toBe(false)
    })

    it('cria o tipo (sempre global) e os preços próprios dos galpões preenchidos', async () => {
      const { ui, janela } = await abrirNovo()
      await ui.type(janela.getByLabelText('Nome'), '  Carrinho de pastel  ')
      await ui.type(janela.getByLabelText('Preço padrão (semanal)'), '125,5')
      await ui.type(janela.getByLabelText('Galpão 2'), '90')
      await ui.click(janela.getByRole('button', { name: 'Salvar' }))
      expect(await screen.findByText('Tipo criado.')).toBeInTheDocument()
      const tipo = bancoFalso.tabelas.tipos_item.find((t) => t.nome === 'Carrinho de pastel')
      expect(tipo).toMatchObject({ galpao_id: null, preco_semanal: 125.5 })
      expect(bancoFalso.tabelas.precos_galpao.filter((p) => p.tipo_item_id === tipo?.id)).toMatchObject([
        { galpao_id: IDS.galpao2, preco_semanal: 90 },
      ])
    })

    it('a dica de cada galpão diz se usa o preço padrão ou um preço próprio', async () => {
      const { ui, janela } = await abrirNovo()
      expect(janela.getAllByText('Usa o preço padrão')).toHaveLength(2)
      await ui.type(janela.getByLabelText('Galpão 1'), '80')
      expect(janela.getByText('Preço próprio neste galpão')).toBeInTheDocument()
    })

    it('preço inválido em um galpão não grava nada', async () => {
      const { ui, janela } = await abrirNovo()
      await ui.type(janela.getByLabelText('Nome'), 'Novo Tipo')
      await ui.type(janela.getByLabelText('Preço padrão (semanal)'), '50')
      await ui.type(janela.getByLabelText('Galpão 1'), 'abc')
      await ui.click(janela.getByRole('button', { name: 'Salvar' }))
      expect(await screen.findByText('Preço inválido em Galpão 1. Use um valor como 25,00.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.tipos_item.some((t) => t.nome === 'Novo Tipo')).toBe(false)
    })

    it('erro ao criar o tipo mostra o aviso', async () => {
      const { ui, janela } = await abrirNovo()
      bancoFalso.falhar('from:tipos_item:insert', 'boom')
      await ui.type(janela.getByLabelText('Nome'), 'Novo Tipo')
      await ui.type(janela.getByLabelText('Preço padrão (semanal)'), '50')
      await ui.click(janela.getByRole('button', { name: 'Salvar' }))
      expect(await screen.findByText('Erro ao criar o tipo.')).toBeInTheDocument()
    })

    it('se o tipo é criado mas os preços falham, avisa para conferir', async () => {
      const { ui, janela } = await abrirNovo()
      bancoFalso.falhar('from:precos_galpao:insert', 'boom')
      await ui.type(janela.getByLabelText('Nome'), 'Meio Gravado')
      await ui.type(janela.getByLabelText('Preço padrão (semanal)'), '50')
      await ui.type(janela.getByLabelText('Galpão 1'), '40')
      await ui.click(janela.getByRole('button', { name: 'Salvar' }))
      expect(await screen.findByText(/O tipo foi salvo, mas não foi possível gravar todos os preços dos galpões/)).toBeInTheDocument()
    })
  })

  describe('editar tipo', () => {
    async function abrirEdicao(nome: string, opcoes: Parameters<typeof renderizarTela>[1] = {}) {
      const tela = await abrirAba('Tipos e Preços', opcoes)
      await screen.findByRole('table')
      await tela.ui.click(linhaDoTipo(nome).getByRole('button', { name: 'Editar tipo' }))
      const janela = within(await screen.findByRole('dialog', { name: 'Editar tipo' }))
      return { ...tela, janela }
    }

    it('abre com nome, preço padrão e preços próprios', async () => {
      const { janela } = await abrirEdicao('Carro', { preparar: comPrecoProprio })
      expect(janela.getByLabelText('Nome')).toHaveValue('Carro')
      expect(janela.getByLabelText('Preço padrão (semanal)')).toHaveValue('200,00')
      expect(janela.getByLabelText('Galpão 1')).toHaveValue('180,00')
      expect(janela.getByLabelText('Galpão 2')).toHaveValue('')
    })

    it('muda o preço padrão e cria, altera e apaga preços próprios de uma vez', async () => {
      const { ui, janela } = await abrirEdicao('Carro', { preparar: comPrecoProprio })
      const padrao = janela.getByLabelText('Preço padrão (semanal)')
      await ui.clear(padrao)
      await ui.type(padrao, '210')
      await ui.clear(janela.getByLabelText('Galpão 1')) // volta ao padrão: apaga o preço próprio
      await ui.type(janela.getByLabelText('Galpão 2'), '150') // novo preço próprio
      await ui.click(janela.getByRole('button', { name: 'Salvar' }))
      expect(await screen.findByText('Tipo atualizado.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.tipos_item.find((t) => t.id === IDS.tipoCarro)?.preco_semanal).toBe(210)
      const precos = bancoFalso.tabelas.precos_galpao.filter((p) => p.tipo_item_id === IDS.tipoCarro)
      expect(precos).toMatchObject([{ galpao_id: IDS.galpao2, preco_semanal: 150 }])
    })

    it('alterar um preço próprio existente atualiza em vez de criar outro', async () => {
      const { ui, janela } = await abrirEdicao('Carro', { preparar: comPrecoProprio })
      await ui.clear(janela.getByLabelText('Galpão 1'))
      await ui.type(janela.getByLabelText('Galpão 1'), '175,5')
      await ui.click(janela.getByRole('button', { name: 'Salvar' }))
      await screen.findByText('Tipo atualizado.')
      expect(bancoFalso.tabelas.precos_galpao.filter((p) => p.tipo_item_id === IDS.tipoCarro)).toMatchObject([
        { id: 'pre-1', preco_semanal: 175.5 },
      ])
    })

    it('erro ao salvar o tipo mostra o aviso', async () => {
      const { ui, janela } = await abrirEdicao('Carro')
      bancoFalso.falhar('from:tipos_item:update', 'boom')
      await ui.click(janela.getByRole('button', { name: 'Salvar' }))
      expect(await screen.findByText('Erro ao salvar o tipo.')).toBeInTheDocument()
    })

    it('Cancelar fecha sem gravar', async () => {
      const { ui, janela } = await abrirEdicao('Carro')
      await ui.click(janela.getByRole('button', { name: 'Cancelar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
  })

  describe('desativar e excluir (AUD-015)', () => {
    async function abrirTabela() {
      const tela = await abrirAba('Tipos e Preços')
      await screen.findByRole('table')
      return tela
    }

    it('Desativar marca o tipo como Inativo e Ativar volta', async () => {
      const { ui } = await abrirTabela()
      await ui.click(linhaDoTipo('Carro').getByRole('button', { name: 'Desativar tipo' }))
      expect(await screen.findByText('Tipo desativado.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.tipos_item.find((t) => t.id === IDS.tipoCarro)?.ativo).toBe(false)
      await waitFor(() => expect(linhaDoTipo('Carro').getByText('Inativo')).toBeInTheDocument())
      await ui.click(linhaDoTipo('Carro').getByRole('button', { name: 'Ativar tipo' }))
      expect(await screen.findByText('Tipo ativado.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.tipos_item.find((t) => t.id === IDS.tipoCarro)?.ativo).toBe(true)
    })

    it('erro ao desativar mostra o aviso', async () => {
      const { ui } = await abrirTabela()
      bancoFalso.falhar('from:tipos_item:update', 'boom')
      await ui.click(linhaDoTipo('Carro').getByRole('button', { name: 'Desativar tipo' }))
      expect(await screen.findByText('Erro ao alterar o tipo.')).toBeInTheDocument()
    })

    it('Excluir pergunta antes, avisando que tipo em uso não pode ser excluído', async () => {
      vi.mocked(window.confirm).mockReturnValue(false)
      const { ui } = await abrirTabela()
      await ui.click(linhaDoTipo('Carrinho de comida').getByRole('button', { name: 'Excluir tipo' }))
      const pergunta = vi.mocked(window.confirm).mock.calls[0][0] as string
      expect(pergunta).toContain('Excluir o tipo "Carrinho de comida"?')
      expect(pergunta).toContain('desative-os')
      expect(bancoFalso.tabelas.tipos_item.some((t) => t.id === IDS.tipoComida)).toBe(true)
    })

    it('tipo sem uso é excluído', async () => {
      const { ui } = await abrirTabela()
      await ui.click(linhaDoTipo('Carrinho de comida').getByRole('button', { name: 'Excluir tipo' }))
      expect(await screen.findByText('Tipo excluído.')).toBeInTheDocument()
      expect(bancoFalso.tabelas.tipos_item.some((t) => t.id === IDS.tipoComida)).toBe(false)
    })

    it('tipo em uso: a recusa do banco aparece explicando o motivo', async () => {
      const { ui } = await abrirTabela()
      bancoFalso.falhar(
        'from:tipos_item:delete',
        'O tipo "Carro" está em uso por 1 item(ns) e não pode ser excluído. Desative o tipo em vez de excluir.',
        { code: 'P0001' },
      )
      await ui.click(linhaDoTipo('Carro').getByRole('button', { name: 'Excluir tipo' }))
      expect(await screen.findByText(/está em uso por 1 item\(ns\) e não pode ser excluído/)).toBeInTheDocument()
      expect(bancoFalso.tabelas.tipos_item.some((t) => t.id === IDS.tipoCarro)).toBe(true)
    })

    it('erro inesperado mostra o aviso genérico', async () => {
      const { ui } = await abrirTabela()
      bancoFalso.falhar('from:tipos_item:delete', 'boom')
      await ui.click(linhaDoTipo('Carro').getByRole('button', { name: 'Excluir tipo' }))
      expect(await screen.findByText('Erro ao excluir tipo.')).toBeInTheDocument()
    })
  })

  it('se os tipos não carregam mostra o erro e deixa tentar de novo', async () => {
    const { ui } = await abrirAba('Tipos e Preços', { preparar: () => bancoFalso.falhar('from:tipos_item:select', 'sem rede') })
    expect(await screen.findByText('Não foi possível carregar os tipos e preços.')).toBeInTheDocument()
    bancoFalso.falhas.clear()
    await ui.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('com tipos mas sem galpões orienta a cadastrar um galpão', async () => {
    await abrirAba('Tipos e Preços', { preparar: () => (bancoFalso.tabelas.galpoes = []) })
    expect(await screen.findByText('Cadastre um galpão na aba Galpões para definir preços por galpão.')).toBeInTheDocument()
  })
})

describe('Configurações: Histórico', () => {
  const registro = (n: number, extra: Record<string, unknown> = {}) => ({
    id: `aud-${n}`,
    created_at: `2025-10-${String(Math.min(n, 28)).padStart(2, '0')}T15:00:00Z`,
    usuario_nome: 'Maria',
    galpao_nome: 'Galpão 1',
    acao: 'pagamento.registrado',
    entidade: 'pagamento',
    resumo: `Pagamento de R$ 110,00 registrado: cliente "Cliente ${n}", recibo nº ${n}`,
    detalhes: null,
    ...extra,
  })
  const comRegistros = (n = 3) => () => {
    for (let i = 1; i <= n; i += 1) bancoFalso.tabelas.auditoria.push(registro(i))
  }
  const linhas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

  it('mostra as colunas e os registros mais novos primeiro', async () => {
    await abrirAba('Histórico', { preparar: comRegistros(3) })
    await screen.findByRole('table')
    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Quando',
      'Quem',
      'Registro',
      'Galpão',
      'O que aconteceu',
    ])
    expect(linhas()).toHaveLength(3)
    expect(linhas()[0]).toHaveTextContent('Cliente 3')
    expect(linhas()[0]).toHaveTextContent('Maria')
    expect(linhas()[0]).toHaveTextContent('Pagamento registrado')
    expect(linhas()[0]).toHaveTextContent('Galpão 1')
  })

  it('registro de quem não tem nome ou galpão mostra "—" e tipo desconhecido mostra o código', async () => {
    await abrirAba('Histórico', {
      preparar: () =>
        bancoFalso.tabelas.auditoria.push(registro(1, { usuario_nome: null, galpao_nome: null, acao: 'coisa.nova' })),
    })
    await screen.findByRole('table')
    expect(linhas()[0].querySelectorAll('td')[1].textContent).toBe('—')
    expect(linhas()[0].querySelectorAll('td')[3].textContent).toBe('—')
    expect(linhas()[0]).toHaveTextContent('coisa.nova')
  })

  it('os registros de exclusão financeira têm rótulo próprio', async () => {
    await abrirAba('Histórico', {
      preparar: () =>
        bancoFalso.tabelas.auditoria.push(
          registro(1, { acao: 'pagamento.excluido', resumo: 'Pagamento EXCLUÍDO do banco' }),
          registro(2, { acao: 'recibo.excluido', resumo: 'Recibo EXCLUÍDO do banco' }),
        ),
    })
    await screen.findByRole('table')
    expect(screen.getByText('Pagamento excluído do banco')).toBeInTheDocument()
    expect(screen.getByText('Recibo excluído do banco')).toBeInTheDocument()
  })

  it('busca por pessoa ou texto', async () => {
    const { ui } = await abrirAba('Histórico', { preparar: comRegistros(3) })
    await screen.findByRole('table')
    await ui.type(screen.getByPlaceholderText('Buscar por pessoa ou texto...'), 'Cliente 2')
    await waitFor(() => expect(linhas()).toHaveLength(1))
    expect(linhas()[0]).toHaveTextContent('Cliente 2')
  })

  it('filtra por tipo de registro', async () => {
    const { ui } = await abrirAba('Histórico', {
      preparar: () => {
        comRegistros(2)()
        bancoFalso.tabelas.auditoria.push(registro(9, { acao: 'pagamento.cancelado', resumo: 'Pagamento cancelado' }))
      },
    })
    await screen.findByRole('table')
    await ui.click(screen.getByRole('button', { name: /Filtros/ }))
    const filtros = within(screen.getByRole('dialog', { name: 'Filtros' }))
    await ui.click(filtros.getByLabelText('Pagamento cancelado'))
    await ui.click(filtros.getByRole('button', { name: 'Aplicar' }))
    await waitFor(() => expect(linhas()).toHaveLength(1))
    expect(linhas()[0]).toHaveTextContent('Pagamento cancelado')
  })

  it('filtra por período', async () => {
    const { ui } = await abrirAba('Histórico', { preparar: comRegistros(3) })
    await screen.findByRole('table')
    await ui.click(screen.getByRole('button', { name: 'Hoje' }))
    expect(await screen.findByText('Nenhum registro encontrado')).toBeInTheDocument() // os registros são de outubro, antes de hoje
    await ui.click(screen.getByRole('button', { name: 'Limpar período' }))
    await waitFor(() => expect(linhas()).toHaveLength(3))
  })

  it('pagina de 25 em 25', async () => {
    const { ui } = await abrirAba('Histórico', { preparar: comRegistros(30) })
    await screen.findByRole('table')
    expect(linhas()).toHaveLength(25)
    expect(screen.getByText('Mostrando 1–25 de 30')).toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Mostrando 26–30 de 30')
    expect(linhas()).toHaveLength(5)
  })

  it('sem registros mostra a mensagem de vazio', async () => {
    await abrirAba('Histórico')
    expect(await screen.findByText('Nenhum registro encontrado')).toBeInTheDocument()
  })

  it('se o histórico falha mostra o erro e deixa tentar de novo', async () => {
    const { ui } = await abrirAba('Histórico', { preparar: () => bancoFalso.falhar('rpc:listar_auditoria', 'sem rede') })
    expect(await screen.findByText('Não foi possível carregar o histórico. Verifique a conexão e tente novamente.')).toBeInTheDocument()
    bancoFalso.falhas.clear()
    await ui.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})
