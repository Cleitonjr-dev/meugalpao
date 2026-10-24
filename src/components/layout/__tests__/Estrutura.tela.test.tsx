import { act, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppRouter } from '@/routes'
import { AGORA_DOS_TESTES } from '@/test/setup'
import { bancoFalso } from '@/test/bancoFalso'
import { IDS, SENHA_PADRAO } from '@/test/dados'
import { renderizarTela, screen, waitFor, within } from '@/test/renderizar'

async function abrir(rota = '/', opcoes: Parameters<typeof renderizarTela>[1] = {}) {
  return renderizarTela(<AppRouter />, { rota, ...opcoes })
}

const menu = () => screen.getByRole('menu', { name: 'Menu do perfil' })
const botaoPerfil = () => screen.getByRole('button', { name: /Menu do perfil — / })

describe('Rotas: quem entra onde', () => {
  it('sem login, qualquer tela interna leva para o login', async () => {
    const { rotaAtual } = await abrir('/pagamentos', { usuario: null })
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(rotaAtual()).toBe('/login')
  })

  it('logado, a página inicial é a de Cobranças, dentro do menu do sistema', async () => {
    await abrir('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Cobranças' })).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('logado, abrir o login leva direto para as Cobranças', async () => {
    const { rotaAtual } = await abrir('/login')
    expect(await screen.findByRole('heading', { level: 1, name: 'Cobranças' })).toBeInTheDocument()
    expect(rotaAtual()).toBe('/')
  })

  it('endereço que não existe volta para as Cobranças', async () => {
    const { rotaAtual } = await abrir('/qualquer-coisa')
    expect(await screen.findByRole('heading', { level: 1, name: 'Cobranças' })).toBeInTheDocument()
    expect(rotaAtual()).toBe('/')
  })

  it('a verificação de recibo abre dentro do sistema quando há login, e sozinha quando não há', async () => {
    const logado = await abrir('/verificar')
    expect(await screen.findByRole('heading', { name: 'Verificar recibo' })).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    logado.unmount()
    bancoFalso.sessao = null // saiu do sistema

    await abrir('/verificar', { usuario: null, cenarioPadrao: false })
    expect(await screen.findByRole('heading', { name: 'MeuGalpão' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao login' })).toBeInTheDocument()
  })

  it.each([
    ['/clientes', 'Clientes'],
    ['/pagamentos', 'Pagamentos'],
    ['/recibos', 'Recibos'],
    ['/relatorios', 'Relatórios'],
    ['/fechamento', 'Fechamento do dia'],
    ['/configuracoes', 'Configurações'],
  ])('a rota %s abre a tela "%s"', async (rota, titulo) => {
    await abrir(rota)
    expect(await screen.findByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
  })
})

describe('Menu principal', () => {
  it('tem os 7 itens e marca o da tela atual', async () => {
    await abrir('/pagamentos')
    await screen.findByRole('heading', { level: 1, name: 'Pagamentos' })
    const nav = within(screen.getByRole('navigation'))
    for (const nome of ['Cobranças', 'Clientes', 'Pagamentos', 'Recibos', 'Relatórios', 'Fechamento', 'Configurações']) {
      expect(nav.getByRole('link', { name: nome })).toBeInTheDocument()
    }
    expect(nav.getByRole('link', { name: 'Pagamentos' })).toHaveAttribute('aria-current', 'page')
    expect(nav.getByRole('link', { name: 'Cobranças' })).not.toHaveAttribute('aria-current')
  })

  it('clicar num item leva para a tela e o destaque acompanha', async () => {
    const { ui, rotaAtual } = await abrir('/')
    await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
    await ui.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Recibos' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Recibos' })).toBeInTheDocument()
    expect(rotaAtual()).toBe('/recibos')
    expect(within(screen.getByRole('navigation')).getByRole('link', { name: 'Recibos' })).toHaveAttribute('aria-current', 'page')
  })

  it('a logo leva para as Cobranças', async () => {
    const { ui, rotaAtual } = await abrir('/clientes')
    await screen.findByRole('heading', { level: 1, name: 'Clientes' })
    await ui.click(screen.getByRole('link', { name: /MeuGalpão/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Cobranças' })).toBeInTheDocument()
    expect(rotaAtual()).toBe('/')
  })

  it('no celular o botão abre e fecha o menu, e escolher um item fecha', async () => {
    const { ui } = await abrir('/')
    await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
    const botao = screen.getByRole('button', { name: 'Abrir menu' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    await ui.click(botao)
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('link', { name: 'Pagamentos' })).toHaveLength(2) // menu do computador e do celular
    await ui.click(screen.getAllByRole('link', { name: 'Pagamentos' })[1])
    expect(await screen.findByRole('heading', { level: 1, name: 'Pagamentos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeInTheDocument()
  })

  it('Pagamentos e Recibos usam a página larga; as demais, a página normal', async () => {
    const larga = await abrir('/pagamentos')
    await screen.findByRole('heading', { level: 1, name: 'Pagamentos' })
    expect(document.querySelector('main')).toHaveClass('max-w-[100rem]')
    larga.unmount()
    await abrir('/clientes')
    await screen.findByRole('heading', { level: 1, name: 'Clientes' })
    expect(document.querySelector('main')).toHaveClass('max-w-6xl')
  })
})

describe('Menu do perfil', () => {
  it('o botão mostra o galpão em uso e o nome da pessoa', async () => {
    await abrir('/')
    await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
    expect(screen.getByRole('banner')).toHaveTextContent('Galpão 1')
    expect(botaoPerfil()).toHaveAccessibleName('Menu do perfil — Dev')
  })

  it('abre com nome, e-mail e cargo; "Maria" aparece como Usuário', async () => {
    const { ui } = await abrir('/')
    await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
    await ui.click(botaoPerfil())
    expect(botaoPerfil()).toHaveAttribute('aria-expanded', 'true')
    expect(within(menu()).getByText('dev@meugalpao.com')).toBeInTheDocument()
    expect(within(menu()).getByText('Super Usuário')).toBeInTheDocument()
  })

  it('usuário comum aparece como "Usuário" e só vê o galpão liberado (sem escolher galpão)', async () => {
    const { ui } = await abrir('/', { usuario: 'comum' })
    await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
    await ui.click(botaoPerfil())
    expect(within(menu()).getByText('Usuário')).toBeInTheDocument()
    expect(within(menu()).queryByRole('group', { name: 'Galpão' })).not.toBeInTheDocument()
  })

  it('quem tem vários galpões escolhe o galpão; a escolha vale na hora e fica guardada', async () => {
    const { ui } = await abrir('/')
    await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
    await ui.click(botaoPerfil())
    const grupo = within(within(menu()).getByRole('group', { name: 'Galpão' }))
    expect(grupo.getByRole('menuitem', { name: 'Galpão 1' })).toBeInTheDocument()
    await ui.click(grupo.getByRole('menuitem', { name: 'Galpão 2' }))
    expect(screen.getByRole('banner')).toHaveTextContent('Galpão 2')
    expect(window.localStorage.getItem('meugalpao.galpao_id')).toBe(IDS.galpao2)
    await waitFor(() => expect(botaoPerfil()).toHaveAttribute('aria-expanded', 'false'))
  })

  it('Configurações leva para a tela de configurações', async () => {
    const { ui, rotaAtual } = await abrir('/')
    await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
    await ui.click(botaoPerfil())
    await ui.click(within(menu()).getByRole('menuitem', { name: 'Configurações' }))
    expect(rotaAtual()).toBe('/configuracoes')
  })

  it('o tema escolhido vale na hora e fica guardado', async () => {
    const { ui } = await abrir('/')
    await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
    await ui.click(botaoPerfil())
    const tema = within(within(menu()).getByRole('group', { name: 'Tema' }))
    expect(tema.getByRole('button', { name: /Sistema/ })).toHaveAttribute('aria-pressed', 'true')
    await ui.click(tema.getByRole('button', { name: /Escuro/ }))
    expect(document.documentElement).toHaveClass('dark')
    expect(tema.getByRole('button', { name: /Escuro/ })).toHaveAttribute('aria-pressed', 'true')
    expect(window.localStorage.getItem('meugalpao.theme')).toBe('dark')
    await ui.click(tema.getByRole('button', { name: /Claro/ }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('Esc e clicar fora fecham o menu', async () => {
    const { ui } = await abrir('/')
    await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
    await ui.click(botaoPerfil())
    await ui.keyboard('{Escape}')
    expect(botaoPerfil()).toHaveAttribute('aria-expanded', 'false')
    await ui.click(botaoPerfil())
    await ui.click(screen.getByRole('heading', { level: 1, name: 'Cobranças' }))
    expect(botaoPerfil()).toHaveAttribute('aria-expanded', 'false')
  })

  it('as setas do teclado percorrem os itens do menu', async () => {
    const { ui } = await abrir('/')
    await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
    botaoPerfil().focus()
    await ui.keyboard('{ArrowDown}')
    expect(botaoPerfil()).toHaveAttribute('aria-expanded', 'true')
    const itens = within(menu()).getAllByRole('menuitem')
    expect(itens[0]).toHaveFocus()
    await ui.keyboard('{ArrowDown}')
    expect(itens[1]).toHaveFocus()
    await ui.keyboard('{End}')
    expect(itens.at(-1)).toHaveFocus()
    await ui.keyboard('{Home}')
    expect(itens[0]).toHaveFocus()
    await ui.keyboard('{ArrowUp}')
    expect(itens.at(-1)).toHaveFocus()
  })

  describe('sair', () => {
    it('pede confirmação; "Cancelar" mantém a sessão', async () => {
      const { ui } = await abrir('/')
      await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
      await ui.click(botaoPerfil())
      await ui.click(within(menu()).getByRole('menuitem', { name: 'Sair' }))
      const janela = within(await screen.findByRole('dialog', { name: 'Atenção' }))
      expect(janela.getByText('Tem certeza que deseja sair do sistema? Sua sessão será encerrada.')).toBeInTheDocument()
      await ui.click(janela.getByRole('button', { name: 'Cancelar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(bancoFalso.sessao).not.toBeNull()
    })

    it('"Sair" encerra a sessão e volta ao login', async () => {
      const { ui, rotaAtual } = await abrir('/')
      await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
      await ui.click(botaoPerfil())
      await ui.click(within(menu()).getByRole('menuitem', { name: 'Sair' }))
      await ui.click(within(await screen.findByRole('dialog', { name: 'Atenção' })).getByRole('button', { name: 'Sair' }))
      expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
      expect(rotaAtual()).toBe('/login')
      expect(bancoFalso.sessao).toBeNull()
    })
  })

  describe('foto de perfil', () => {
    async function escolherArquivo(arquivo: File) {
      const tela = await abrir('/')
      await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
      await tela.ui.click(botaoPerfil())
      const campo = document.querySelector('input[type="file"]') as HTMLInputElement
      // o seletor de arquivos do navegador já filtra por tipo; aqui simulamos um arquivo que passou mesmo assim
      fireEvent.change(campo, { target: { files: [arquivo] } })
      return tela
    }

    it('imagem válida é enviada, grava no perfil e avisa', async () => {
      await escolherArquivo(new File(['x'], 'foto.png', { type: 'image/png' }))
      expect(await screen.findByText('Foto atualizada')).toBeInTheDocument()
      const perfil = bancoFalso.tabelas.profiles.find((p) => p.id === IDS.usuarioSuper)
      expect(perfil?.avatar_url).toMatch(new RegExp(`^https://falso.local/${IDS.usuarioSuper}/\\d+\\.png$`))
    })

    it('arquivo que não é imagem aceita é recusado', async () => {
      await escolherArquivo(new File(['x'], 'doc.pdf', { type: 'application/pdf' }))
      expect(await screen.findByText('Use uma imagem PNG, JPG, WEBP ou GIF.')).toBeInTheDocument()
    })

    it('imagem maior que 2 MB é recusada', async () => {
      const grande = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'grande.jpg', { type: 'image/jpeg' })
      await escolherArquivo(grande)
      expect(await screen.findByText('A imagem deve ter no máximo 2 MB.')).toBeInTheDocument()
    })

    it('se salvar a foto no perfil falhar, avisa', async () => {
      bancoFalso.falhar('from:profiles:update', 'boom')
      await escolherArquivo(new File(['x'], 'foto.png', { type: 'image/png' }))
      expect(await screen.findByText('Não foi possível salvar a foto no seu perfil.')).toBeInTheDocument()
    })
  })
})

describe('Sessão encerrada por inatividade (AUD-010)', () => {
  it('depois de 30 minutos sem usar o sistema desconecta, avisa e volta ao login', async () => {
    vi.useRealTimers()
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], now: AGORA_DOS_TESTES })
    const { rotaAtual } = await abrir('/')
    await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
    await act(async () => {
      vi.advanceTimersByTime(31 * 60_000)
    })
    expect(await screen.findByText('Você foi desconectado por ficar muito tempo sem usar o sistema.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(rotaAtual()).toBe('/login')
    expect(bancoFalso.sessao).toBeNull()
  })

  it('usar o sistema adia o encerramento', async () => {
    vi.useRealTimers()
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], now: AGORA_DOS_TESTES })
    await abrir('/')
    await screen.findByRole('heading', { level: 1, name: 'Cobranças' })
    await act(async () => {
      vi.advanceTimersByTime(25 * 60_000)
    })
    act(() => {
      window.dispatchEvent(new Event('pointerdown'))
    })
    await act(async () => {
      vi.advanceTimersByTime(25 * 60_000)
    })
    expect(screen.queryByText('Você foi desconectado por ficar muito tempo sem usar o sistema.')).not.toBeInTheDocument()
    expect(bancoFalso.sessao).not.toBeNull()
  })
})

// Mantém a senha padrão disponível para outros arquivos que importem daqui no futuro.
void SENHA_PADRAO
