import { act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoginPage } from '@/features/auth/LoginPage'
import { renderizarTela, screen, waitFor } from '@/test/renderizar'
import { SENHA_PADRAO } from '@/test/dados'

const PAINEL = <div>Painel de teste</div>

async function abrirLogin(opcoes: Parameters<typeof renderizarTela>[1] = {}) {
  const tela = renderizarTela(<LoginPage />, {
    rota: '/login',
    usuario: null,
    outrasRotas: { '/': PAINEL },
    ...opcoes,
  })
  // sem ninguém logado a tela de login aparece; logado, ela já leva direto ao painel
  if (!opcoes.usuario) await screen.findByRole('heading', { name: 'MeuGalpão' })
  return tela
}

const campoEmail = () => screen.getByLabelText('E-mail')
const campoSenha = () => screen.getByLabelText('Senha')

describe('Tela de login: o que aparece', () => {
  it('mostra o nome do sistema, o subtítulo, os dois campos e os botões', async () => {
    await abrirLogin()
    expect(await screen.findByRole('heading', { name: 'MeuGalpão' })).toBeInTheDocument()
    expect(screen.getByText('Entre para gerenciar seus galpões')).toBeInTheDocument()
    expect(campoEmail()).toHaveAttribute('type', 'email')
    expect(campoEmail()).toHaveAttribute('placeholder', 'voce@exemplo.com')
    expect(campoSenha()).toHaveAttribute('type', 'password')
    expect(campoSenha()).toHaveAttribute('placeholder', 'Sua senha')
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Esqueceu a senha?' })).toBeInTheDocument()
    expect(screen.getByLabelText('Lembrar usuário')).not.toBeChecked()
  })

  it('o botão de tema oferece Auto, Claro e Escuro e a escolha vale na hora e fica guardada', async () => {
    const { ui } = await abrirLogin()
    await ui.click(screen.getByRole('button', { name: 'Tema do sistema' }))
    for (const nome of ['Auto', 'Claro', 'Escuro']) {
      expect(screen.getByRole('button', { name: new RegExp(nome) })).toBeInTheDocument()
    }
    await ui.click(screen.getByRole('button', { name: /Escuro/ }))
    expect(document.documentElement).toHaveClass('dark')
    expect(window.localStorage.getItem('meugalpao.theme')).toBe('dark')
    await ui.click(screen.getByRole('button', { name: 'Tema do sistema' }))
    await ui.click(screen.getByRole('button', { name: /Claro/ }))
    expect(document.documentElement).not.toHaveClass('dark')
    expect(window.localStorage.getItem('meugalpao.theme')).toBe('light')
  })

  it('o link "Verificar a autenticidade de um recibo" leva para a verificação pública', async () => {
    const { ui, rotaAtual } = await abrirLogin()
    await ui.click(await screen.findByRole('link', { name: 'Verificar a autenticidade de um recibo' }))
    await waitFor(() => expect(rotaAtual()).toBe('/verificar'))
  })

  it('o botão do olho mostra e esconde a senha digitada', async () => {
    const { ui } = await abrirLogin()
    await ui.type(campoSenha(), 'segredo1')
    await ui.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(campoSenha()).toHaveAttribute('type', 'text')
    expect(campoSenha()).toHaveValue('segredo1')
    await ui.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(campoSenha()).toHaveAttribute('type', 'password')
  })

  it('quem já está logado e abre o login é levado direto para o painel', async () => {
    const { rotaAtual } = await abrirLogin({ usuario: 'super' })
    expect(await screen.findByText('Painel de teste')).toBeInTheDocument()
    expect(rotaAtual()).toBe('/')
  })
})

describe('Tela de login: entrar', () => {
  it('com e-mail e senha certos, abre o painel', async () => {
    const { ui, rotaAtual } = await abrirLogin()
    await ui.type(campoEmail(), 'dev@meugalpao.com')
    await ui.type(campoSenha(), SENHA_PADRAO)
    await ui.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Painel de teste')).toBeInTheDocument()
    expect(rotaAtual()).toBe('/')
  })

  it('aceita Enter para enviar o formulário', async () => {
    const { ui } = await abrirLogin()
    await ui.type(campoEmail(), 'dev@meugalpao.com')
    await ui.type(campoSenha(), `${SENHA_PADRAO}{Enter}`)
    expect(await screen.findByText('Painel de teste')).toBeInTheDocument()
  })

  it('ignora espaços sobrando no começo e no fim do e-mail', async () => {
    const { ui } = await abrirLogin()
    await ui.type(campoEmail(), '  dev@meugalpao.com  ')
    await ui.type(campoSenha(), SENHA_PADRAO)
    await ui.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Painel de teste')).toBeInTheDocument()
  })

  it('senha errada mostra "E-mail ou senha inválidos." e continua na tela de login', async () => {
    const { ui, rotaAtual } = await abrirLogin()
    await ui.type(campoEmail(), 'dev@meugalpao.com')
    await ui.type(campoSenha(), 'senha-errada')
    await ui.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
    expect(rotaAtual()).toBe('/login')
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
    expect(campoEmail()).toHaveValue('dev@meugalpao.com')
  })

  it('e-mail que não existe também mostra "E-mail ou senha inválidos." (não revela qual está errado)', async () => {
    const { ui } = await abrirLogin()
    await ui.type(campoEmail(), 'ninguem@meugalpao.com')
    await ui.type(campoSenha(), SENHA_PADRAO)
    await ui.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
  })

  it('e-mail ainda não confirmado mostra o aviso de confirmação', async () => {
    const { ui, banco } = await abrirLogin()
    banco.falhar('auth:signIn', 'Email not confirmed')
    await ui.type(campoEmail(), 'dev@meugalpao.com')
    await ui.type(campoSenha(), SENHA_PADRAO)
    await ui.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirme seu e-mail antes de entrar.')
  })

  it('qualquer outro erro mostra a mensagem genérica', async () => {
    const { ui, banco } = await abrirLogin()
    banco.falhar('auth:signIn', 'Network request failed')
    await ui.type(campoEmail(), 'dev@meugalpao.com')
    await ui.type(campoSenha(), SENHA_PADRAO)
    await ui.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível entrar. Tente novamente.')
  })

  it('enquanto envia, o botão fica "Entrando..." e desativado (não deixa enviar duas vezes)', async () => {
    const { ui, banco } = await abrirLogin()
    banco.atrasar('auth:signIn', 150)
    await ui.type(campoEmail(), 'dev@meugalpao.com')
    await ui.type(campoSenha(), SENHA_PADRAO)
    await ui.click(screen.getByRole('button', { name: 'Entrar' }))
    const botao = await screen.findByRole('button', { name: 'Entrando...' })
    expect(botao).toBeDisabled()
    expect(await screen.findByText('Painel de teste')).toBeInTheDocument()
  })

  it('campos vazios: o navegador impede o envio e nada é enviado', async () => {
    const { ui, banco } = await abrirLogin()
    await ui.click(await screen.findByRole('button', { name: 'Entrar' }))
    expect(banco.sessao).toBeNull()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Tela de login: lembrar usuário', () => {
  it('marcado: guarda o e-mail e preenche na próxima vez, já com a caixa marcada', async () => {
    const { ui, unmount, banco } = await abrirLogin()
    await ui.type(campoEmail(), 'dev@meugalpao.com')
    await ui.type(campoSenha(), SENHA_PADRAO)
    await ui.click(screen.getByLabelText('Lembrar usuário'))
    await ui.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByText('Painel de teste')
    expect(window.localStorage.getItem('meugalpao.lembrarEmail')).toBe('dev@meugalpao.com')
    unmount()
    banco.sessao = null // a pessoa saiu do sistema

    await abrirLogin({ cenarioPadrao: false, usuario: null })
    expect(await screen.findByLabelText('E-mail')).toHaveValue('dev@meugalpao.com')
    expect(screen.getByLabelText('Lembrar usuário')).toBeChecked()
  })

  it('desmarcado: esquece o e-mail que estava guardado', async () => {
    window.localStorage.setItem('meugalpao.lembrarEmail', 'dev@meugalpao.com')
    const { ui } = await abrirLogin()
    expect(campoEmail()).toHaveValue('dev@meugalpao.com')
    await ui.click(screen.getByLabelText('Lembrar usuário'))
    expect(screen.getByLabelText('Lembrar usuário')).not.toBeChecked()
    await ui.type(campoSenha(), SENHA_PADRAO)
    await ui.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByText('Painel de teste')
    expect(window.localStorage.getItem('meugalpao.lembrarEmail')).toBeNull()
  })

  it('login que falha não guarda o e-mail', async () => {
    const { ui } = await abrirLogin()
    await ui.type(campoEmail(), 'dev@meugalpao.com')
    await ui.type(campoSenha(), 'errada')
    await ui.click(screen.getByLabelText('Lembrar usuário'))
    await ui.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByRole('alert')
    expect(window.localStorage.getItem('meugalpao.lembrarEmail')).toBeNull()
  })
})

describe('Tela de login: esqueci a senha', () => {
  it('troca para o pedido de link, mantém o e-mail digitado e tem "Voltar ao login"', async () => {
    const { ui } = await abrirLogin()
    await ui.type(campoEmail(), 'dev@meugalpao.com')
    await ui.click(screen.getByRole('button', { name: 'Esqueceu a senha?' }))
    expect(screen.getByText('Informe seu e-mail para redefinir a senha')).toBeInTheDocument()
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument()
    expect(campoEmail()).toHaveValue('dev@meugalpao.com')
    expect(screen.getByRole('button', { name: 'Enviar link de redefinição' })).toBeInTheDocument()

    await ui.click(screen.getByRole('button', { name: 'Voltar ao login' }))
    expect(screen.getByText('Entre para gerenciar seus galpões')).toBeInTheDocument()
    expect(campoSenha()).toBeInTheDocument()
  })

  it('envia o link, mostra a confirmação (sem revelar se o e-mail existe) e o aviso na tela', async () => {
    const { ui, banco } = await abrirLogin()
    await ui.click(screen.getByRole('button', { name: 'Esqueceu a senha?' }))
    await ui.type(campoEmail(), 'alguem@exemplo.com')
    await ui.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }))
    expect(
      await screen.findByText('Se existir uma conta para este e-mail, enviaremos um link de redefinição.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Link de redefinição enviado. Verifique seu e-mail.')).toBeInTheDocument()
    expect(banco.autenticacao.resetEnviados).toEqual(['alguem@exemplo.com'])
  })

  it('se o envio falhar, mostra o erro', async () => {
    const { ui, banco } = await abrirLogin()
    banco.falhar('auth:reset', 'smtp')
    await ui.click(screen.getByRole('button', { name: 'Esqueceu a senha?' }))
    await ui.type(campoEmail(), 'alguem@exemplo.com')
    await ui.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível enviar o link de redefinição. Verifique o e-mail.',
    )
  })

  it('ao voltar para o login, a mensagem de sucesso some', async () => {
    const { ui } = await abrirLogin()
    await ui.click(screen.getByRole('button', { name: 'Esqueceu a senha?' }))
    await ui.type(campoEmail(), 'alguem@exemplo.com')
    await ui.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }))
    await screen.findByText(/enviaremos um link/)
    await ui.click(screen.getByRole('button', { name: 'Voltar ao login' }))
    expect(screen.queryByText(/enviaremos um link/)).not.toBeInTheDocument()
  })
})

describe('Tela de login: contas só pelo painel (AUD-005)', () => {
  it('não existe botão nem formulário para criar conta', async () => {
    await abrirLogin()
    expect(screen.queryByRole('button', { name: /Criar conta/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
    expect(screen.queryByText(/Crie sua conta/)).not.toBeInTheDocument()
  })
})

describe('Tela de login: definir nova senha (link do e-mail)', () => {
  async function abrirRedefinicao() {
    const tela = await abrirLogin()
    await screen.findByRole('heading', { name: 'MeuGalpão' })
    await act(async () => {
      tela.banco.emitir('PASSWORD_RECOVERY')
    })
    await screen.findByText('Defina sua nova senha')
    return tela
  }

  it('mostra só os campos de nova senha e confirmação', async () => {
    await abrirRedefinicao()
    expect(screen.getByLabelText('Nova senha')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar nova senha')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar conta' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar nova senha' })).toBeInTheDocument()
  })

  it('senhas diferentes: mostra "As senhas não conferem." e não altera nada', async () => {
    const { ui, banco } = await abrirRedefinicao()
    await ui.type(screen.getByLabelText('Nova senha'), 'abcdef')
    await ui.type(screen.getByLabelText('Confirmar nova senha'), 'abcdeg')
    await ui.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('As senhas não conferem.')
    expect(banco.autenticacao.senhasAlteradas).toEqual([])
  })

  it('senha curta: mostra o mínimo de caracteres', async () => {
    const { ui, banco } = await abrirRedefinicao()
    await ui.type(screen.getByLabelText('Nova senha'), 'abc')
    await ui.type(screen.getByLabelText('Confirmar nova senha'), 'abc')
    await ui.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(banco.autenticacao.senhasAlteradas).toEqual([])
  })

  it('senha nova certa: altera, avisa e abre o painel', async () => {
    const { ui, banco, rotaAtual } = await abrirRedefinicao()
    // o link do e-mail deixa a pessoa logada
    banco.entrarComo('usr-super')
    await ui.type(screen.getByLabelText('Nova senha'), 'nova-senha')
    await ui.type(screen.getByLabelText('Confirmar nova senha'), 'nova-senha')
    await ui.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(await screen.findByText('Senha alterada com sucesso!')).toBeInTheDocument()
    expect(banco.autenticacao.senhasAlteradas).toEqual(['nova-senha'])
    await waitFor(() => expect(rotaAtual()).toBe('/'))
  })

  it('erro do servidor pede um novo link', async () => {
    const { ui, banco } = await abrirRedefinicao()
    banco.falhar('auth:updateUser', 'expired')
    await ui.type(screen.getByLabelText('Nova senha'), 'nova-senha')
    await ui.type(screen.getByLabelText('Confirmar nova senha'), 'nova-senha')
    await ui.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível alterar a senha. Peça um novo link e tente de novo.',
    )
  })
})
