import { describe, expect, it } from 'vitest'
import { FechamentoPage } from '@/pages/FechamentoPage'
import { bancoFalso } from '@/test/bancoFalso'
import { IDS, lancarPagamento } from '@/test/dados'
import { espiarDownload, reais, renderizarTela, screen, semNbsp, waitFor, within } from '@/test/renderizar'

async function abrir(opcoes: Parameters<typeof renderizarTela>[1] = {}) {
  const tela = renderizarTela(<FechamentoPage />, { rota: '/fechamento', ...opcoes })
  await screen.findByRole('heading', { level: 1, name: 'Fechamento do dia' })
  await screen.findByText('Total recebido')
  return tela
}

const cartao = (rotulo: string) => {
  const alvo = screen.getByText(rotulo).closest('div.rounded-xl')
  return within(alvo as HTMLElement)
}
const tabelas = () => screen.getAllByRole('table')
const linhasDa = (tabela: HTMLElement) => within(tabela).getAllByRole('row').slice(1)

async function escolherDia(ui: Awaited<ReturnType<typeof abrir>>['ui'], dia: string) {
  await ui.click(screen.getByLabelText('Data'))
  const calendario = within(await screen.findByRole('dialog', { name: 'Selecionar data' }))
  await ui.click(calendario.getByRole('button', { name: dia }))
}

describe('Fechamento do dia: o resumo de hoje', () => {
  it('mostra o título, o galpão e a data de hoje', async () => {
    await abrir()
    expect(screen.getByText('Galpão 1 · 11/10/2025')).toBeInTheDocument()
    expect(screen.getByLabelText('Data')).toHaveTextContent('11/10/2025')
  })

  it('os cartões somam o que foi recebido hoje (Ana pagou R$ 110 em dinheiro)', async () => {
    await abrir()
    expect(cartao('Total recebido').getByText(reais(110))).toBeInTheDocument()
    expect(cartao('Pagamentos').getByText('1')).toBeInTheDocument()
    const dinheiro = cartao('Dinheiro a conferir')
    expect(dinheiro.getByText(reais(110))).toBeInTheDocument()
    expect(dinheiro.getByText('Soma dos pagamentos em dinheiro')).toBeInTheDocument()
    const cancelados = cartao('Cancelados')
    expect(cancelados.getByText(reais(0))).toBeInTheDocument()
    expect(cancelados.getByText('0 pagamentos (fora do total)')).toBeInTheDocument()
  })

  it('"Por forma de pagamento" mostra Dinheiro, Pix e Cartão com seus totais', async () => {
    await abrir()
    const bloco = screen.getByRole('heading', { name: 'Por forma de pagamento' }).closest('div.rounded-xl') as HTMLElement
    const forma = (nome: string) => within(bloco).getByText(nome).closest('li') as HTMLElement
    expect(within(forma('Dinheiro')).getByText(reais(110))).toBeInTheDocument()
    expect(within(forma('Pix')).getByText(reais(0))).toBeInTheDocument()
    expect(within(forma('Cartão')).getByText(reais(0))).toBeInTheDocument()
  })

  it('"Por quem recebeu" mostra cada pessoa com dinheiro, pix, cartão e total', async () => {
    await abrir()
    const [porPessoa] = tabelas()
    expect(within(porPessoa).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Pessoa',
      'Dinheiro',
      'Pix',
      'Cartão',
      'Total',
    ])
    const maria = linhasDa(porPessoa)[0]
    expect(maria.querySelectorAll('td')[0].textContent).toBe('Maria')
    expect(semNbsp(maria.querySelectorAll('td')[1].textContent ?? '')).toBe(reais(110))
    expect(semNbsp(maria.querySelectorAll('td')[4].textContent ?? '')).toBe(reais(110))
  })

  it('"Pagamentos do dia" lista hora, cliente, forma, recibo, quem recebeu, situação e valor', async () => {
    await abrir()
    const [, lista] = tabelas()
    expect(within(lista).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Hora',
      'Cliente',
      'Forma',
      'Recibo',
      'Recebido por',
      'Situação',
      'Valor',
    ])
    const celulas = linhasDa(lista)[0].querySelectorAll('td')
    expect(celulas[0].textContent).toBe('11:00') // 14:00 UTC em Fortaleza
    expect(celulas[1].textContent).toBe('Ana Souza')
    expect(celulas[2].textContent).toBe('Dinheiro')
    expect(celulas[3].textContent).toBe('Recibo 0001')
    expect(celulas[4].textContent).toBe('Maria')
    expect(celulas[5].textContent).toBe('Pago')
  })

  it('pagamento sem registro de quem recebeu entra como "Não informado"', async () => {
    await abrir({
      preparar: () => {
        const p = bancoFalso.tabelas.pagamentos.find((x) => x.cliente_id === IDS.ana)
        if (p) p.criado_por = null
      },
    })
    const [porPessoa] = tabelas()
    expect(linhasDa(porPessoa)[0].querySelectorAll('td')[0].textContent).toBe('Não informado')
  })
})

describe('Fechamento do dia: cancelados, outros dias e muitos pagamentos', () => {
  it('pagamento cancelado não entra no total, aparece em "Cancelados" e na lista', async () => {
    await abrir({
      preparar: () => {
        const p = bancoFalso.tabelas.pagamentos.find((x) => x.cliente_id === IDS.ana)
        if (p) p.status = 'cancelado'
      },
    })
    expect(cartao('Total recebido').getByText(reais(0))).toBeInTheDocument()
    expect(cartao('Dinheiro a conferir').getByText(reais(0))).toBeInTheDocument()
    const cancelados = cartao('Cancelados')
    expect(cancelados.getByText(reais(110))).toBeInTheDocument()
    expect(cancelados.getByText('1 pagamento (fora do total)')).toBeInTheDocument()
    const lista = tabelas().at(-1) as HTMLElement
    expect(linhasDa(lista)[0].querySelectorAll('td')[5].textContent).toBe('Cancelado')
  })

  it('escolher outro dia no calendário mostra o fechamento daquele dia (08/10: 3 pagamentos, R$ 330)', async () => {
    const { ui } = await abrir()
    await escolherDia(ui, '8')
    await waitFor(() => expect(screen.getByText('Galpão 1 · 08/10/2025')).toBeInTheDocument())
    await waitFor(() => expect(cartao('Total recebido').getByText(reais(330))).toBeInTheDocument())
    expect(cartao('Pagamentos').getByText('3')).toBeInTheDocument()
    expect(cartao('Dinheiro a conferir').getByText(reais(220))).toBeInTheDocument()
    expect(linhasDa(tabelas().at(-1) as HTMLElement)).toHaveLength(3)
  })

  it('o calendário não deixa escolher dia futuro nem antes do primeiro pagamento', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByLabelText('Data'))
    const calendario = within(await screen.findByRole('dialog', { name: 'Selecionar data' }))
    expect(calendario.getByRole('button', { name: '12' })).toBeDisabled() // amanhã
    expect(calendario.getByRole('button', { name: '11' })).toBeEnabled() // hoje
    expect(calendario.getByRole('button', { name: '1' })).toBeEnabled() // 01/10: primeiro pagamento
  })

  it('"Limpar" no calendário volta para hoje', async () => {
    const { ui } = await abrir()
    await escolherDia(ui, '8')
    await waitFor(() => expect(screen.getByText('Galpão 1 · 08/10/2025')).toBeInTheDocument())
    await ui.click(screen.getByLabelText('Data'))
    await ui.click(within(await screen.findByRole('dialog', { name: 'Selecionar data' })).getByRole('button', { name: 'Limpar' }))
    await waitFor(() => expect(screen.getByText('Galpão 1 · 11/10/2025')).toBeInTheDocument())
  })

  it('dia sem pagamentos mostra o aviso e desativa a exportação', async () => {
    const { ui } = await abrir()
    await escolherDia(ui, '9')
    expect(await screen.findByText('Nenhum pagamento neste dia')).toBeInTheDocument()
    expect(screen.getByText('Escolha outra data para ver o fechamento.')).toBeInTheDocument()
    expect(cartao('Total recebido').getByText(reais(0))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled()
  })

  it('com mais de 500 pagamentos no dia, a lista é limitada e o aviso explica; os totais continuam completos', async () => {
    await abrir({
      preparar: () => {
        for (let i = 0; i < 520; i += 1) {
          lancarPagamento(bancoFalso, {
            cliente: IDS.ana,
            semana: `2020-01-${String((i % 28) + 1).padStart(2, '0')}-x${i}`.slice(0, 10),
            dia: '2025-10-11',
            valor: 1,
            forma: 'pix',
          })
        }
      },
    })
    expect(await screen.findByText('Lista limitada aos primeiros 500 pagamentos; os totais acima consideram todos.')).toBeInTheDocument()
    expect(cartao('Pagamentos').getByText('521')).toBeInTheDocument()
    // a tabela mostra 10 por vez; o total da lista é limitado a 500
    expect(screen.getByText('Mostrando 1–10 de 500')).toBeInTheDocument()
  })
})

describe('Fechamento do dia: exportar e imprimir', () => {
  it('Exportar CSV baixa fechamento-AAAA-MM-DD.csv com a lista do dia', async () => {
    const baixado = espiarDownload()
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    expect(baixado.nomes).toEqual(['fechamento-2025-10-11.csv'])
    const texto = await baixado.conteudo()
    const linhas = texto.replace('﻿', '').trim().split('\r\n')
    expect(linhas[0]).toBe('Hora;Cliente;Forma;Recibo;Item;Recebido por;Situação;Valor')
    expect(linhas[1]).toBe('11:00;Ana Souza;Dinheiro;0001;Carrinho de roupa;Maria;Pago;110,00')
  })

  it('Imprimir abre a impressão do navegador', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Imprimir' }))
    expect(window.print).toHaveBeenCalledTimes(1)
  })

  it('a página tem a área de impressão e os botões não saem na folha', async () => {
    await abrir()
    expect(document.getElementById('fechamento-print')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Imprimir' }).closest('div')).toHaveClass('print:hidden')
  })
})

describe('Fechamento do dia: estados da tela', () => {
  it('enquanto carrega mostra "Carregando..."', async () => {
    renderizarTela(<FechamentoPage />, { preparar: () => bancoFalso.atrasar('rpc:fechamento_dia', 500) })
    await screen.findByRole('heading', { level: 1, name: 'Fechamento do dia' })
    expect(await screen.findByText('Carregando...')).toBeInTheDocument()
    await screen.findByText('Total recebido')
  })

  it('se o fechamento falha mostra o erro e "Tentar novamente" recupera', async () => {
    const tela = renderizarTela(<FechamentoPage />, { preparar: () => bancoFalso.falhar('rpc:fechamento_dia', 'sem rede') })
    expect(await screen.findByText('Não foi possível carregar o fechamento. Verifique a conexão e tente novamente.')).toBeInTheDocument()
    bancoFalso.falhas.clear()
    await tela.ui.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Total recebido')).toBeInTheDocument()
  })

  it('usuário sem galpão liberado vê o aviso de acesso', async () => {
    renderizarTela(<FechamentoPage />, { usuario: 'comum', preparar: () => (bancoFalso.tabelas.galpao_membros = []) })
    expect(await screen.findByText('Nenhum galpão disponível')).toBeInTheDocument()
  })

  it('usuário comum vê só o fechamento do galpão liberado para ele', async () => {
    await abrir({ usuario: 'comum' })
    expect(screen.getByText('Galpão 1 · 11/10/2025')).toBeInTheDocument()
    expect(cartao('Total recebido').getByText(reais(110))).toBeInTheDocument()
  })
})
