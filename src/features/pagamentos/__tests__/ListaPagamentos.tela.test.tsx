import { describe, expect, it, vi } from 'vitest'
import { PagamentosPage } from '@/pages/PagamentosPage'
import { RecibosPage } from '@/pages/RecibosPage'
import { baixarReciboPdf } from '@/utils/reciboPdf'
import {
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
import { IDS, SENHA_PADRAO, gerarPagamentos } from '@/test/dados'

vi.mock('@/utils/reciboPdf', () => ({ baixarReciboPdf: vi.fn().mockResolvedValue(undefined) }))

type Modo = 'pagamentos' | 'recibos'

async function abrir(modo: Modo = 'pagamentos', opcoes: Parameters<typeof renderizarTela>[1] = {}) {
  const tela = renderizarTela(modo === 'pagamentos' ? <PagamentosPage /> : <RecibosPage />, {
    rota: `/${modo}`,
    ...opcoes,
  })
  await esperarTela(modo === 'pagamentos' ? 'Pagamentos' : 'Recibos')
  await screen.findByRole('table')
  return tela
}

const tabela = () => screen.getByRole('table')
const linhas = () => within(tabela()).getAllByRole('row').slice(1)
const clientesNaTabela = (coluna = 0) => linhas().map((tr) => tr.querySelectorAll('td')[coluna]?.textContent)
const linhaDe = (texto: string | RegExp) => {
  const tr = linhas().find((l) => (typeof texto === 'string' ? l.textContent?.includes(texto) : texto.test(l.textContent ?? '')))
  if (!tr) throw new Error(`linha com "${texto}" não encontrada`)
  return within(tr)
}
const busca = () => screen.getByPlaceholderText('Buscar cliente, recibo ou código...')
const cancelarPagamentoDe = async (ui: Awaited<ReturnType<typeof abrir>>['ui'], texto: string) => {
  await ui.click(linhaDe(texto).getByRole('button', { name: 'Cancelar pagamento' }))
  return screen.findByRole('dialog', { name: 'Cancelar pagamento' })
}

describe('Pagamentos: a lista', () => {
  it('mostra o título, o galpão e o botão Exportar (sem "Verificar código")', async () => {
    await abrir()
    expect(screen.getByText('Histórico de Galpão 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Verificar código' })).not.toBeInTheDocument()
  })

  it('tem as colunas de pagamentos na ordem certa', async () => {
    await abrir()
    const cabecalho = within(tabela()).getAllByRole('columnheader').map((c) => c.textContent)
    expect(cabecalho).toEqual([
      'Cliente',
      'Referente a',
      'Pago em',
      'Forma',
      'Situação',
      'Recibo',
      'Autenticação',
      'Recebido por',
      'Valor',
      'Ações',
    ])
  })

  it('lista os 7 pagamentos do galpão, do mais novo para o mais antigo', async () => {
    await abrir()
    expect(linhas()).toHaveLength(7)
    expect(screen.getByText('Mostrando 1–7 de 7')).toBeInTheDocument()
    expect(clientesNaTabela(0)[0]).toBe('Ana Souza')
    expect(clientesNaTabela(0).filter((c) => c === 'Diego Alves')).toHaveLength(3)
  })

  it('cada linha mostra a semana, forma, situação, recibo, código, quem recebeu e o valor', async () => {
    await abrir()
    const bruno = linhaDe('Bruno Lima')
    expect(bruno.getByText('04/10/2025')).toBeInTheDocument()
    expect(bruno.getByText('Pix')).toBeInTheDocument()
    expect(bruno.getByText('Pago')).toBeInTheDocument()
    expect(bruno.getByText('Recibo 0002')).toBeInTheDocument()
    expect(bruno.getByText('A3F9-27C1-5DE0-0002')).toBeInTheDocument()
    expect(bruno.getByText('Dev')).toBeInTheDocument()
    expect(bruno.getByText(reais(200))).toBeInTheDocument()
    expect(linhaDe('Ana Souza').getByText('Maria')).toBeInTheDocument()
  })

  it('pagamento sem registro de quem recebeu mostra "—"', async () => {
    await abrir('pagamentos', {
      preparar: () => {
        const p = bancoFalso.tabelas.pagamentos.find((x) => x.cliente_id === IDS.bruno)
        if (p) p.criado_por = null
      },
    })
    expect(linhaDe('Bruno Lima').getAllByText('—').length).toBeGreaterThan(0)
  })

  it('pagamento cancelado mostra "Cancelado" e o tooltip diz quem cancelou, quando e por quê', async () => {
    const { ui } = await abrir('pagamentos', {
      preparar: () => {
        const p = bancoFalso.tabelas.pagamentos.find((x) => x.cliente_id === IDS.bruno)
        if (p) {
          Object.assign(p, {
            status: 'cancelado',
            cancelado_em: '2025-10-05T15:00:00Z',
            cancelado_por: IDS.usuarioComum,
            motivo_cancelamento: 'valor lançado errado',
          })
        }
      },
    })
    const selo = linhaDe('Bruno Lima').getByText('Cancelado')
    await ui.hover(selo)
    expect(await screen.findByText(/Cancelado por Maria em .* Motivo: valor lançado errado/)).toBeInTheDocument()
    // pagamento cancelado não pode ser cancelado de novo
    expect(linhaDe('Bruno Lima').queryByRole('button', { name: 'Cancelar pagamento' })).not.toBeInTheDocument()
  })

  it('todas as linhas têm as ações de recibo, de verificar e de cancelar', async () => {
    await abrir()
    const ana = linhaDe('Ana Souza')
    for (const nome of ['Imprimir', 'Baixar PDF', 'Enviar WhatsApp', 'Verificar autenticidade', 'Cancelar pagamento']) {
      expect(ana.getByRole('button', { name: nome })).toBeInTheDocument()
    }
  })

  it('pagamentos de outro galpão não aparecem', async () => {
    await abrir('pagamentos', { galpaoId: IDS.galpao2 })
    expect(screen.getByText('Histórico de Galpão 2')).toBeInTheDocument()
    expect(screen.getByText('Nenhum pagamento encontrado')).toBeInTheDocument()
  })

  it('sem nenhum pagamento mostra "Nenhum pagamento encontrado" e o Exportar fica desativado', async () => {
    renderizarTela(<PagamentosPage />, {
      rota: '/pagamentos',
      preparar: () => {
        bancoFalso.tabelas.pagamentos = []
        bancoFalso.tabelas.recibos = []
      },
    })
    await esperarTela('Pagamentos')
    expect(await screen.findByText('Nenhum pagamento encontrado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeDisabled()
  })
})

describe('Pagamentos: busca, filtros e período', () => {
  it('busca pelo nome do cliente e guarda a busca no endereço', async () => {
    const { ui, rotaAtual } = await abrir()
    await ui.type(busca(), 'diego')
    await waitFor(() => expect(clientesNaTabela(0)).toEqual(['Diego Alves', 'Diego Alves', 'Diego Alves']))
    expect(rotaAtual()).toBe('/pagamentos?q=diego')
    expect(screen.getByText('Mostrando 1–3 de 3')).toBeInTheDocument()
  })

  it('busca pelo número do recibo', async () => {
    const { ui } = await abrir()
    await ui.type(busca(), '6')
    await waitFor(() => expect(clientesNaTabela(0)).toEqual(['Eduarda Reis']))
    expect(linhas()[0]).toHaveTextContent('Recibo 0006')
  })

  it('busca pelo código de autenticação, com ou sem traços', async () => {
    const { ui } = await abrir()
    await ui.type(busca(), 'A3F9-27C1-5DE0-0003')
    await waitFor(() => expect(clientesNaTabela(0)).toEqual(['Diego Alves']))
    await ui.clear(busca())
    await ui.type(busca(), 'a3f927c15de00002')
    await waitFor(() => expect(clientesNaTabela(0)).toEqual(['Bruno Lima']))
  })

  it('sem resultado mostra "Nenhum pagamento encontrado"', async () => {
    const { ui } = await abrir()
    await ui.type(busca(), 'zzzzzz')
    expect(await screen.findByText('Nenhum pagamento encontrado')).toBeInTheDocument()
  })

  it('a busca da endereço já vem preenchida e filtrada ao abrir (F5 mantém a tela)', async () => {
    renderizarTela(<PagamentosPage />, { rota: '/pagamentos?q=bruno' })
    await esperarTela('Pagamentos')
    await waitFor(() => expect(clientesNaTabela(0)).toEqual(['Bruno Lima']))
    expect(busca()).toHaveValue('bruno')
  })

  it('o filtro de forma de pagamento mostra só Pix', async () => {
    const { ui, rotaAtual } = await abrir()
    await ui.click(screen.getByRole('button', { name: /Filtros/ }))
    const filtros = within(screen.getByRole('dialog', { name: 'Filtros' }))
    await ui.click(filtros.getByLabelText('Pix'))
    await ui.click(filtros.getByRole('button', { name: 'Aplicar' }))
    await waitFor(() => expect(linhas()).toHaveLength(2))
    expect(clientesNaTabela(0).sort()).toEqual(['Bruno Lima', 'Diego Alves'])
    expect(rotaAtual()).toBe('/pagamentos?forma=pix')
    expect(screen.getByRole('button', { name: /Filtros/ })).toHaveTextContent('1')
  })

  it('o filtro de situação "Cancelado" mostra só os cancelados', async () => {
    const { ui } = await abrir('pagamentos', {
      preparar: () => {
        const p = bancoFalso.tabelas.pagamentos.find((x) => x.cliente_id === IDS.ana)
        if (p) p.status = 'cancelado'
      },
    })
    await ui.click(screen.getByRole('button', { name: /Filtros/ }))
    const filtros = within(screen.getByRole('dialog', { name: 'Filtros' }))
    await ui.click(filtros.getByLabelText('Cancelado'))
    await ui.click(filtros.getByRole('button', { name: 'Aplicar' }))
    await waitFor(() => expect(clientesNaTabela(0)).toEqual(['Ana Souza']))
  })

  it('o filtro de forma lista Dinheiro, Pix e Cartão, e o de situação Pago e Cancelado', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: /Filtros/ }))
    const filtros = within(screen.getByRole('dialog', { name: 'Filtros' }))
    for (const rotulo of ['Dinheiro', 'Pix', 'Cartão', 'Pago', 'Cancelado']) {
      expect(filtros.getByLabelText(rotulo)).toBeInTheDocument()
    }
  })

  it('filtros e busca valem juntos', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: /Filtros/ }))
    const filtros = within(screen.getByRole('dialog', { name: 'Filtros' }))
    await ui.click(filtros.getByLabelText('Dinheiro'))
    await ui.click(filtros.getByRole('button', { name: 'Aplicar' }))
    await ui.type(busca(), 'diego')
    await waitFor(() => expect(linhas()).toHaveLength(2))
  })

  describe('período', () => {
    it('"Hoje" mostra só o que foi pago hoje e põe as datas no endereço', async () => {
      const { ui, rotaAtual } = await abrir()
      await ui.click(screen.getByRole('button', { name: 'Hoje' }))
      await waitFor(() => expect(clientesNaTabela(0)).toEqual(['Ana Souza']))
      expect(rotaAtual()).toBe('/pagamentos?de=2025-10-11&ate=2025-10-11')
    })

    it('"Últimos 7 dias" vai de 05/10 a 11/10', async () => {
      const { ui, rotaAtual } = await abrir()
      await ui.click(screen.getByRole('button', { name: 'Últimos 7 dias' }))
      await waitFor(() => expect(linhas()).toHaveLength(4))
      expect(rotaAtual()).toBe('/pagamentos?de=2025-10-05&ate=2025-10-11')
    })

    it('"Este mês" vai de 01/10 até hoje', async () => {
      const { ui, rotaAtual } = await abrir()
      await ui.click(screen.getByRole('button', { name: 'Este mês' }))
      await waitFor(() => expect(rotaAtual()).toBe('/pagamentos?de=2025-10-01&ate=2025-10-11'))
      expect(linhas()).toHaveLength(7)
    })

    it('"Mês passado" sem pagamentos mostra a lista vazia', async () => {
      const { ui } = await abrir()
      await ui.click(screen.getByRole('button', { name: 'Mês passado' }))
      expect(await screen.findByText('Nenhum pagamento encontrado')).toBeInTheDocument()
    })

    it('o atalho do período atual fica marcado', async () => {
      const { ui } = await abrir()
      await ui.click(screen.getByRole('button', { name: 'Hoje' }))
      expect(screen.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Este mês' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('"Limpar período" aparece só com período escolhido e traz tudo de volta', async () => {
      const { ui, rotaAtual } = await abrir()
      expect(screen.queryByRole('button', { name: 'Limpar período' })).not.toBeInTheDocument()
      await ui.click(screen.getByRole('button', { name: 'Hoje' }))
      await waitFor(() => expect(linhas()).toHaveLength(1))
      await ui.click(screen.getByRole('button', { name: 'Limpar período' }))
      await waitFor(() => expect(linhas()).toHaveLength(7))
      expect(rotaAtual()).toBe('/pagamentos')
    })

    it('o período vindo do endereço já abre aplicado e mostra as datas nos campos', async () => {
      renderizarTela(<PagamentosPage />, { rota: '/pagamentos?de=2025-10-01&ate=2025-10-04' })
      await esperarTela('Pagamentos')
      await waitFor(() => expect(linhas()).toHaveLength(3))
      expect(screen.getByLabelText('De')).toHaveTextContent('01/10/2025')
      expect(screen.getByLabelText('Até')).toHaveTextContent('04/10/2025')
    })
  })
})

describe('Pagamentos: páginas', () => {
  const com37 = { preparar: () => gerarPagamentos(bancoFalso, 30) }

  it('mostra 25 por página e o total', async () => {
    await abrir('pagamentos', com37)
    expect(linhas()).toHaveLength(25)
    expect(screen.getByText('Mostrando 1–25 de 37')).toBeInTheDocument()
  })

  it('"Próxima página" mostra o restante e põe a página no endereço', async () => {
    const { ui, rotaAtual } = await abrir('pagamentos', com37)
    await ui.click(screen.getByRole('button', { name: 'Próxima página' }))
    await waitFor(() => expect(screen.getByText('Mostrando 26–37 de 37')).toBeInTheDocument())
    expect(linhas()).toHaveLength(12)
    expect(rotaAtual()).toBe('/pagamentos?pagina=2')
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
  })

  it('"Página anterior" e "Primeira página" voltam', async () => {
    const { ui } = await abrir('pagamentos', com37)
    await ui.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Mostrando 26–37 de 37')
    await ui.click(screen.getByRole('button', { name: 'Página anterior' }))
    await screen.findByText('Mostrando 1–25 de 37')
    await ui.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Mostrando 26–37 de 37')
    await ui.click(screen.getByRole('button', { name: 'Primeira página' }))
    await screen.findByText('Mostrando 1–25 de 37')
    expect(screen.getByRole('button', { name: 'Primeira página' })).toBeDisabled()
  })

  it('o número da página também funciona', async () => {
    const { ui } = await abrir('pagamentos', com37)
    await ui.click(screen.getByRole('button', { name: '2' }))
    await screen.findByText('Mostrando 26–37 de 37')
  })

  it('abrir direto na página 2 pelo endereço mostra a página 2', async () => {
    renderizarTela(<PagamentosPage />, { rota: '/pagamentos?pagina=2', preparar: () => gerarPagamentos(bancoFalso, 30) })
    await esperarTela('Pagamentos')
    expect(await screen.findByText('Mostrando 26–37 de 37')).toBeInTheDocument()
  })

  it('página que não existe volta para a última', async () => {
    const { rotaAtual } = renderizarTela(<PagamentosPage />, {
      rota: '/pagamentos?pagina=99',
      preparar: () => gerarPagamentos(bancoFalso, 30),
    })
    await esperarTela('Pagamentos')
    expect(await screen.findByText('Mostrando 26–37 de 37')).toBeInTheDocument()
    // a correção do endereço acontece logo depois de a lista chegar
    await waitFor(() => expect(rotaAtual()).toBe('/pagamentos?pagina=2'))
  })

  it('mudar a busca volta para a primeira página', async () => {
    const { ui, rotaAtual } = await abrir('pagamentos', com37)
    await ui.click(screen.getByRole('button', { name: 'Próxima página' }))
    await screen.findByText('Mostrando 26–37 de 37')
    await ui.type(busca(), 'ana')
    await waitFor(() => expect(rotaAtual()).toBe('/pagamentos?q=ana'))
  })

  it('só mostra os botões de página quando há mais de uma', async () => {
    await abrir()
    expect(screen.queryByRole('button', { name: 'Próxima página' })).not.toBeInTheDocument()
  })
})

describe('Pagamentos: ações do recibo', () => {
  it('Imprimir abre a impressão do recibo da linha', async () => {
    const { ui } = await abrir()
    await ui.click(linhaDe('Ana Souza').getByRole('button', { name: 'Imprimir' }))
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1))
  })

  it('Baixar PDF gera o PDF com os dados do recibo', async () => {
    const { ui } = await abrir()
    await ui.click(linhaDe('Bruno Lima').getByRole('button', { name: 'Baixar PDF' }))
    expect(baixarReciboPdf).toHaveBeenCalledTimes(1)
    expect(vi.mocked(baixarReciboPdf).mock.calls[0][0]).toMatchObject({
      galpaoNome: 'Galpão 1',
      numero: 2,
      clienteNome: 'Bruno Lima',
      itens: 'Carro',
      codigo: 'A3F927C15DE00002',
    })
  })

  it('se o PDF falhar, avisa', async () => {
    vi.mocked(baixarReciboPdf).mockRejectedValueOnce(new Error('falhou'))
    const { ui } = await abrir()
    await ui.click(linhaDe('Ana Souza').getByRole('button', { name: 'Baixar PDF' }))
    expect(await screen.findByText('Não foi possível gerar o PDF.')).toBeInTheDocument()
  })

  it('Enviar WhatsApp abre o recibo só com o botão do WhatsApp', async () => {
    const { ui } = await abrir()
    await ui.click(linhaDe('Ana Souza').getByRole('button', { name: 'Enviar WhatsApp' }))
    const recibo = await screen.findByRole('dialog', { name: 'Recibo' })
    const zap = within(recibo).getByRole('link', { name: 'Enviar WhatsApp' })
    const texto = semNbsp(decodeURIComponent(zap.getAttribute('href') ?? ''))
    expect(zap.getAttribute('href')).toContain('https://wa.me/5585988880001')
    expect(texto).toContain('Galpão 1')
    expect(texto).toContain('A3F9-27C1-5DE0-0001')
    expect(within(recibo).queryByRole('button', { name: 'Imprimir' })).not.toBeInTheDocument()
    expect(within(recibo).queryByRole('button', { name: 'Baixar PDF' })).not.toBeInTheDocument()
  })

  it('cliente sem WhatsApp: o recibo explica que não dá para enviar', async () => {
    const { ui } = await abrir()
    await ui.click(linhaDe('Eduarda Reis').getByRole('button', { name: 'Enviar WhatsApp' }))
    const recibo = await screen.findByRole('dialog', { name: 'Recibo' })
    expect(within(recibo).getByText('Cliente sem WhatsApp cadastrado.')).toBeInTheDocument()
  })

  it('Verificar autenticidade mostra se o recibo é válido', async () => {
    const { ui } = await abrir()
    await ui.click(linhaDe('Ana Souza').getByRole('button', { name: 'Verificar autenticidade' }))
    const janela = await screen.findByRole('dialog', { name: 'Verificar autenticidade' })
    expect(await within(janela).findByText('Válido')).toBeInTheDocument()
    expect(within(janela).getByText('Recibo Nº 0001')).toBeInTheDocument()
    expect(within(janela).getByText('Ana S.')).toBeInTheDocument()
  })

  it('Verificar autenticidade de um recibo cancelado mostra "Cancelado"', async () => {
    const { ui } = await abrir('pagamentos', {
      preparar: () => {
        const p = bancoFalso.tabelas.pagamentos.find((x) => x.cliente_id === IDS.bruno)
        if (p) p.status = 'cancelado'
      },
    })
    await ui.click(linhaDe('Bruno Lima').getByRole('button', { name: 'Verificar autenticidade' }))
    const janela = await screen.findByRole('dialog', { name: 'Verificar autenticidade' })
    expect(await within(janela).findByText('Cancelado')).toBeInTheDocument()
  })
})

describe('Pagamentos: cancelar', () => {
  it('abre o pedido de confirmação com o nome e o valor, motivo e senha', async () => {
    const { ui } = await abrir()
    const janela = within(await cancelarPagamentoDe(ui, 'Bruno Lima'))
    expect(janela.getByText('Bruno Lima')).toBeInTheDocument()
    expect(janela.getByText(/R\$\s200,00/)).toBeInTheDocument()
    expect(janela.getByLabelText('Motivo do cancelamento')).toHaveValue('')
    expect(janela.getByLabelText('Senha')).toHaveValue('')
    expect(janela.getByText('Confirme com a sua senha')).toBeInTheDocument()
    expect(janela.getByRole('button', { name: 'Cancelar pagamento' })).toBeDisabled()
  })

  it('só habilita o botão com motivo de 3 letras ou mais e a senha preenchida', async () => {
    const { ui } = await abrir()
    const janela = within(await cancelarPagamentoDe(ui, 'Bruno Lima'))
    const botao = janela.getByRole('button', { name: 'Cancelar pagamento' })
    await ui.type(janela.getByLabelText('Senha'), SENHA_PADRAO)
    expect(botao).toBeDisabled()
    await ui.type(janela.getByLabelText('Motivo do cancelamento'), 'ab')
    expect(botao).toBeDisabled()
    await ui.type(janela.getByLabelText('Motivo do cancelamento'), 'c')
    expect(botao).toBeEnabled()
  })

  it('o motivo aceita até 500 caracteres e a dica explica que fica registrado', async () => {
    const { ui } = await abrir()
    const janela = within(await cancelarPagamentoDe(ui, 'Bruno Lima'))
    expect(janela.getByLabelText('Motivo do cancelamento')).toHaveAttribute('maxLength', '500')
    expect(janela.getByText('Obrigatório. Fica registrado junto com o seu nome.')).toBeInTheDocument()
  })

  it('o olho mostra e esconde a senha', async () => {
    const { ui } = await abrir()
    const janela = within(await cancelarPagamentoDe(ui, 'Bruno Lima'))
    await ui.type(janela.getByLabelText('Senha'), 'segredo')
    await ui.click(janela.getByRole('button', { name: 'Mostrar senha' }))
    expect(janela.getByLabelText('Senha')).toHaveAttribute('type', 'text')
    await ui.click(janela.getByRole('button', { name: 'Ocultar senha' }))
    expect(janela.getByLabelText('Senha')).toHaveAttribute('type', 'password')
  })

  it('senha errada mostra "Senha incorreta.", limpa a senha e NÃO cancela', async () => {
    const { ui } = await abrir()
    const janela = within(await cancelarPagamentoDe(ui, 'Bruno Lima'))
    await ui.type(janela.getByLabelText('Motivo do cancelamento'), 'lançado errado')
    await ui.type(janela.getByLabelText('Senha'), 'senha-errada')
    await ui.click(janela.getByRole('button', { name: 'Cancelar pagamento' }))
    expect(await janela.findByText('Senha incorreta.')).toBeInTheDocument()
    expect(janela.getByLabelText('Senha')).toHaveValue('')
    expect(bancoFalso.tabelas.pagamentos.find((p) => p.cliente_id === IDS.bruno)?.status).toBe('pago')
    expect(bancoFalso.chamadas.some((c) => c.rpc === 'cancelar_pagamento')).toBe(false)
  })

  it('muitas tentativas de senha mostram o aviso de espera', async () => {
    const { ui } = await abrir()
    const janela = within(await cancelarPagamentoDe(ui, 'Bruno Lima'))
    bancoFalso.falhar('auth:signIn', 'rate limit', { status: 429 })
    await ui.type(janela.getByLabelText('Motivo do cancelamento'), 'lançado errado')
    await ui.type(janela.getByLabelText('Senha'), SENHA_PADRAO)
    await ui.click(janela.getByRole('button', { name: 'Cancelar pagamento' }))
    expect(await janela.findByText('Muitas tentativas. Aguarde um instante e tente de novo.')).toBeInTheDocument()
  })

  it('senha certa cancela, avisa, fecha a janela e marca a linha como Cancelado', async () => {
    const { ui } = await abrir()
    const janela = within(await cancelarPagamentoDe(ui, 'Bruno Lima'))
    await ui.type(janela.getByLabelText('Motivo do cancelamento'), '  lançado errado  ')
    await ui.type(janela.getByLabelText('Senha'), SENHA_PADRAO)
    await ui.click(janela.getByRole('button', { name: 'Cancelar pagamento' }))

    expect(await screen.findByText('Pagamento cancelado. A cobrança voltou a ficar em aberto.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cancelar pagamento' })).not.toBeInTheDocument())
    await waitFor(() => expect(linhaDe('Bruno Lima').getByText('Cancelado')).toBeInTheDocument())
    expect(linhaDe('Bruno Lima').queryByRole('button', { name: 'Cancelar pagamento' })).not.toBeInTheDocument()

    const pedido = bancoFalso.chamadas.find((c) => c.rpc === 'cancelar_pagamento')?.args
    expect(pedido?.p_motivo).toBe('  lançado errado  ')
    const salvo = bancoFalso.tabelas.pagamentos.find((p) => p.cliente_id === IDS.bruno)
    expect(salvo).toMatchObject({ status: 'cancelado', cancelado_por: IDS.usuarioSuper, motivo_cancelamento: 'lançado errado' })
  })

  it('erro do servidor aparece no campo da senha e a janela continua aberta', async () => {
    const { ui } = await abrir()
    const janela = within(await cancelarPagamentoDe(ui, 'Bruno Lima'))
    bancoFalso.falhar('rpc:cancelar_pagamento', 'Confirme sua senha para cancelar o pagamento.', { code: 'P0001' })
    await ui.type(janela.getByLabelText('Motivo do cancelamento'), 'lançado errado')
    await ui.type(janela.getByLabelText('Senha'), SENHA_PADRAO)
    await ui.click(janela.getByRole('button', { name: 'Cancelar pagamento' }))
    expect(await janela.findByText('Confirme sua senha para cancelar o pagamento.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Cancelar pagamento' })).toBeInTheDocument()
  })

  it('"Voltar" fecha sem cancelar e o motivo digitado não fica para a próxima vez', async () => {
    const { ui } = await abrir()
    let janela = within(await cancelarPagamentoDe(ui, 'Bruno Lima'))
    await ui.type(janela.getByLabelText('Motivo do cancelamento'), 'algum motivo')
    await ui.click(janela.getByRole('button', { name: 'Voltar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bancoFalso.chamadas.some((c) => c.rpc === 'cancelar_pagamento')).toBe(false)
    janela = within(await cancelarPagamentoDe(ui, 'Ana Souza'))
    expect(janela.getByLabelText('Motivo do cancelamento')).toHaveValue('')
  })

  it('clicar fora da janela não fecha', async () => {
    const { ui } = await abrir()
    await cancelarPagamentoDe(ui, 'Bruno Lima')
    const fundo = screen.getByRole('dialog').parentElement as HTMLElement
    await ui.pointer([{ target: fundo, keys: '[MouseLeft]' }])
    expect(screen.getByRole('dialog', { name: 'Cancelar pagamento' })).toBeInTheDocument()
  })

  it('o usuário comum (com acesso ao galpão) também pode cancelar', async () => {
    const { ui } = await abrir('pagamentos', { usuario: 'comum' })
    const janela = within(await cancelarPagamentoDe(ui, 'Ana Souza'))
    await ui.type(janela.getByLabelText('Motivo do cancelamento'), 'cliente desistiu')
    await ui.type(janela.getByLabelText('Senha'), SENHA_PADRAO)
    await ui.click(janela.getByRole('button', { name: 'Cancelar pagamento' }))
    await screen.findByText('Pagamento cancelado. A cobrança voltou a ficar em aberto.')
    expect(bancoFalso.tabelas.pagamentos.find((p) => p.cliente_id === IDS.ana)?.cancelado_por).toBe(IDS.usuarioComum)
  })
})

describe('Pagamentos: exportar para planilha', () => {
  const com137 = { preparar: () => gerarPagamentos(bancoFalso, 130) }

  it('baixa tudo do filtro (não só a página) buscando em lotes de 100', async () => {
    const baixado = espiarDownload()
    const { ui } = await abrir('pagamentos', com137)
    await ui.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(await screen.findByText('137 linhas exportadas.')).toBeInTheDocument()
    expect(baixado.nomes).toEqual(['pagamentos-2025-10-11.csv'])
    const pedidos = bancoFalso.chamadas.filter((c) => c.rpc === 'listar_pagamentos' && c.args.p_limite === 100)
    expect(pedidos.map((p) => p.args.p_deslocamento)).toEqual([0, 100])
    const texto = await baixado.conteudo()
    expect(texto.replace('﻿', '').trim().split('\r\n')).toHaveLength(138)
  })

  it('o arquivo tem cabeçalho, ponto e vírgula, código com traços, valor em reais com vírgula e BOM', async () => {
    const baixado = espiarDownload()
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Exportar' }))
    await screen.findByText('7 linhas exportadas.')
    const texto = await baixado.conteudo()
    expect(texto.startsWith('﻿')).toBe(true)
    const [cabecalho, ...dados] = texto.replace('﻿', '').trim().split('\r\n')
    expect(cabecalho).toBe(
      'Recibo;Código de autenticação;Cliente;Cobrança de;Pago em;Forma;Situação;Valor;Item;Recebido por;Cancelado por;Motivo do cancelamento',
    )
    const bruno = dados.find((l) => l.includes('Bruno Lima')) ?? ''
    expect(bruno.startsWith('0002;A3F9-27C1-5DE0-0002;Bruno Lima;04/10/2025;')).toBe(true)
    expect(bruno).toContain(';Pix;Pago;200,00;Carro;Dev;;')
  })

  it('pagamento cancelado sai com quem cancelou e o motivo', async () => {
    const baixado = espiarDownload()
    const { ui } = await abrir('pagamentos', {
      preparar: () => {
        const p = bancoFalso.tabelas.pagamentos.find((x) => x.cliente_id === IDS.bruno)
        if (p) Object.assign(p, { status: 'cancelado', cancelado_por: IDS.usuarioComum, motivo_cancelamento: 'erro; de digitação' })
      },
    })
    await ui.click(screen.getByRole('button', { name: 'Exportar' }))
    await screen.findByText('7 linhas exportadas.')
    const texto = await baixado.conteudo()
    expect(texto).toContain(';Cancelado;200,00;Carro;Dev;Maria;"erro; de digitação"')
  })

  it('exporta só o que está filtrado e usa o singular quando é uma linha', async () => {
    const baixado = espiarDownload()
    const { ui } = await abrir()
    await ui.type(busca(), 'ana')
    await waitFor(() => expect(linhas()).toHaveLength(1))
    await ui.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(await screen.findByText('1 linha exportada.')).toBeInTheDocument()
    expect((await baixado.conteudo()).trim().split('\r\n')).toHaveLength(2)
  })

  it('enquanto baixa, o botão mostra "Exportando..." e fica desativado', async () => {
    espiarDownload()
    const { ui } = await abrir()
    bancoFalso.atrasar('rpc:listar_pagamentos', 250)
    await ui.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(await screen.findByRole('button', { name: 'Exportando...' })).toBeDisabled()
    await screen.findByText('7 linhas exportadas.')
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled()
  })

  it('se der erro, avisa e o botão volta ao normal', async () => {
    espiarDownload()
    const { ui } = await abrir()
    bancoFalso.falhar('rpc:listar_pagamentos', 'sem rede')
    await ui.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(await screen.findByText('Não foi possível exportar. Verifique a conexão e tente novamente.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled()
  })
})

describe('Pagamentos: estados da tela', () => {
  it('enquanto carrega mostra "Carregando..."', async () => {
    renderizarTela(<PagamentosPage />, {
      rota: '/pagamentos',
      preparar: () => bancoFalso.atrasar('rpc:listar_pagamentos', 500),
    })
    await esperarTela('Pagamentos')
    expect(await screen.findByText('Carregando...')).toBeInTheDocument()
    await screen.findByRole('table')
  })

  it('se a lista falha mostra o erro e "Tentar novamente" recupera', async () => {
    const tela = renderizarTela(<PagamentosPage />, {
      rota: '/pagamentos',
      preparar: () => bancoFalso.falhar('rpc:listar_pagamentos', 'sem rede'),
    })
    expect(
      await screen.findByText('Não foi possível carregar a lista. Verifique a conexão e tente novamente.'),
    ).toBeInTheDocument()
    bancoFalso.falhas.clear()
    await tela.ui.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('usuário sem galpão liberado vê o aviso de acesso', async () => {
    renderizarTela(<PagamentosPage />, {
      rota: '/pagamentos',
      usuario: 'comum',
      preparar: () => (bancoFalso.tabelas.galpao_membros = []),
    })
    expect(await screen.findByText('Nenhum galpão disponível')).toBeInTheDocument()
  })
})

describe('Recibos: a lista', () => {
  it('mostra o título, o subtítulo e os botões Exportar e Verificar código', async () => {
    await abrir('recibos')
    expect(screen.getByText('Reemitir e reenviar recibos de Galpão 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Verificar código' })).toBeEnabled()
  })

  it('começa pela coluna Recibo e ordena pelo número, do maior para o menor', async () => {
    await abrir('recibos')
    const cabecalho = within(tabela()).getAllByRole('columnheader').map((c) => c.textContent)
    expect(cabecalho.slice(0, 3)).toEqual(['Recibo', 'Cliente', 'Referente a'])
    expect(clientesNaTabela(0)).toEqual([
      'Recibo 0007',
      'Recibo 0006',
      'Recibo 0005',
      'Recibo 0004',
      'Recibo 0003',
      'Recibo 0002',
      'Recibo 0001',
    ])
  })

  it('não tem o botão de cancelar (cancelar é só em Pagamentos)', async () => {
    await abrir('recibos')
    expect(screen.queryByRole('button', { name: 'Cancelar pagamento' })).not.toBeInTheDocument()
    expect(linhaDe('Recibo 0001').getByRole('button', { name: 'Verificar autenticidade' })).toBeInTheDocument()
  })

  it('a busca placeholder aceita nome, recibo ou código', async () => {
    const { ui } = await abrir('recibos')
    await ui.type(busca(), 'carla')
    expect(await screen.findByText('Nenhum pagamento encontrado'.replace('pagamento', 'recibo'))).toBeInTheDocument()
  })

  it('o Exportar baixa recibos-AAAA-MM-DD.csv', async () => {
    const baixado = espiarDownload()
    const { ui } = await abrir('recibos')
    await ui.click(screen.getByRole('button', { name: 'Exportar' }))
    await screen.findByText('7 linhas exportadas.')
    expect(baixado.nomes).toEqual(['recibos-2025-10-11.csv'])
    const texto = await baixado.conteudo()
    // na tela Recibos a ordem é pelo número do recibo
    expect(texto.replace('﻿', '').split('\r\n')[1].startsWith('0007;')).toBe(true)
  })
})

describe('Recibos: verificar um código digitado', () => {
  async function abrirVerificacao() {
    const tela = await abrir('recibos')
    await tela.ui.click(screen.getByRole('button', { name: 'Verificar código' }))
    const janela = within(await screen.findByRole('dialog', { name: 'Verificar código' }))
    return { ...tela, janela }
  }

  it('abre pedindo o código, sem resultado e sem botão "Fechar"', async () => {
    const { janela } = await abrirVerificacao()
    expect(janela.getByText(/Digite o código de autenticação impresso no recibo/)).toBeInTheDocument()
    expect(janela.getByLabelText('Código de autenticação')).toHaveValue('')
    expect(janela.getByRole('button', { name: 'Verificar' })).toBeEnabled()
    expect(janela.queryByText('Válido')).not.toBeInTheDocument()
  })

  it('código certo mostra o recibo válido com os dados e o botão vira "Verificar outro código"', async () => {
    const { ui, janela } = await abrirVerificacao()
    await ui.type(janela.getByLabelText('Código de autenticação'), 'a3f927c15de00002')
    await ui.click(janela.getByRole('button', { name: 'Verificar' }))
    expect(await janela.findByText('Válido')).toBeInTheDocument()
    expect(janela.getByText('Recibo Nº 0002')).toBeInTheDocument()
    expect(janela.getByText('Bruno L.')).toBeInTheDocument()
    expect(janela.getByText(reais(200))).toBeInTheDocument()
    expect(janela.getByRole('button', { name: 'Verificar outro código' })).toBeInTheDocument()
  })

  it('"Verificar outro código" limpa o campo para uma nova consulta', async () => {
    const { ui, janela } = await abrirVerificacao()
    await ui.type(janela.getByLabelText('Código de autenticação'), 'A3F927C15DE00002')
    await ui.click(janela.getByRole('button', { name: 'Verificar' }))
    await janela.findByText('Válido')
    await ui.click(janela.getByRole('button', { name: 'Verificar outro código' }))
    expect(janela.getByLabelText('Código de autenticação')).toHaveValue('')
    expect(janela.queryByText('Válido')).not.toBeInTheDocument()
  })

  it('código que não existe mostra "Recibo não encontrado"', async () => {
    const { ui, janela } = await abrirVerificacao()
    await ui.type(janela.getByLabelText('Código de autenticação'), '0000111122223333')
    await ui.click(janela.getByRole('button', { name: 'Verificar' }))
    expect(await janela.findByText('Recibo não encontrado')).toBeInTheDocument()
  })

  it('código incompleto pede para conferir', async () => {
    const { ui, janela } = await abrirVerificacao()
    await ui.type(janela.getByLabelText('Código de autenticação'), 'A3F9')
    await ui.click(janela.getByRole('button', { name: 'Verificar' }))
    expect(await janela.findByText(/16/)).toBeInTheDocument()
  })

  it('recibo cancelado mostra "Cancelado"', async () => {
    const { ui } = await abrir('recibos', {
      preparar: () => {
        const p = bancoFalso.tabelas.pagamentos.find((x) => x.cliente_id === IDS.bruno)
        if (p) p.status = 'cancelado'
      },
    })
    await ui.click(screen.getByRole('button', { name: 'Verificar código' }))
    const janela = within(await screen.findByRole('dialog', { name: 'Verificar código' }))
    await ui.type(janela.getByLabelText('Código de autenticação'), 'A3F927C15DE00002')
    await ui.click(janela.getByRole('button', { name: 'Verificar' }))
    expect(await janela.findByText('Cancelado')).toBeInTheDocument()
  })

  it('editar o código depois do resultado esconde o resultado antigo', async () => {
    const { ui, janela } = await abrirVerificacao()
    await ui.type(janela.getByLabelText('Código de autenticação'), 'A3F927C15DE00002')
    await ui.click(janela.getByRole('button', { name: 'Verificar' }))
    await janela.findByText('Válido')
    await ui.type(janela.getByLabelText('Código de autenticação'), '1')
    expect(janela.queryByText('Válido')).not.toBeInTheDocument()
    expect(janela.getByRole('button', { name: 'Verificar' })).toBeInTheDocument()
  })
})
