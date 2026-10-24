import { describe, expect, it } from 'vitest'
import { RelatoriosPage } from '@/pages/RelatoriosPage'
import { bancoFalso } from '@/test/bancoFalso'
import { IDS, lancarPagamento } from '@/test/dados'
import { reais, renderizarTela, screen, waitFor, within } from '@/test/renderizar'

async function abrir(opcoes: Parameters<typeof renderizarTela>[1] = {}) {
  const tela = renderizarTela(<RelatoriosPage />, { rota: '/relatorios', ...opcoes })
  await screen.findByRole('heading', { level: 1, name: 'Relatórios' })
  await screen.findByText('Recebido no período')
  return tela
}

const cartao = (rotulo: string) => {
  const alvo = screen.getByText(rotulo).closest('div.rounded-xl')
  return within(alvo as HTMLElement)
}
const bloco = (titulo: string) => within(screen.getByRole('heading', { name: titulo }).closest('div.rounded-xl') as HTMLElement)

describe('Relatórios: o período e os cartões', () => {
  it('começa em "Este mês" e mostra o galpão e as datas', async () => {
    await abrir()
    expect(screen.getByText('Galpão 1 · 01/10/2025 a 11/10/2025')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Este mês' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('os cartões trazem recebido no período, hoje, geral, atraso e previsão mensal', async () => {
    await abrir()
    const periodo = cartao('Recebido no período')
    expect(periodo.getByText(reais(860))).toBeInTheDocument()
    expect(periodo.getByText('7 pagamentos')).toBeInTheDocument()
    expect(cartao('Recebido hoje').getByText(reais(110))).toBeInTheDocument()
    expect(cartao('Recebido (geral)').getByText(reais(860))).toBeInTheDocument()
    const atraso = cartao('Em atraso')
    expect(atraso.getByText('3')).toBeInTheDocument()
    expect(atraso.getByText(`${reais(750)} em aberto`)).toBeInTheDocument()
    expect(cartao('Previsão mensal').getByText(reais(3250))).toBeInTheDocument() // 750 por semana x 52/12
  })

  it('"Hoje" mostra só o que entrou hoje, no singular', async () => {
    const { ui, rotaAtual } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Hoje' }))
    await waitFor(() => expect(cartao('Recebido no período').getByText('1 pagamento')).toBeInTheDocument())
    expect(cartao('Recebido no período').getByText(reais(110))).toBeInTheDocument()
    expect(rotaAtual()).toBe('/relatorios?de=2025-10-11&ate=2025-10-11')
  })

  it('"Mês passado" sem pagamentos mostra o aviso de período vazio', async () => {
    const { ui } = await abrir()
    await ui.click(screen.getByRole('button', { name: 'Mês passado' }))
    expect(await screen.findByText('Nenhum pagamento no período')).toBeInTheDocument()
    expect(screen.getByText('Os pagamentos registrados nestas datas aparecerão aqui.')).toBeInTheDocument()
    expect(cartao('Recebido no período').getByText(reais(0))).toBeInTheDocument()
    // o total geral e o atraso não dependem do período
    expect(cartao('Recebido (geral)').getByText(reais(860))).toBeInTheDocument()
  })

  it('o período vindo do endereço já abre aplicado', async () => {
    renderizarTela(<RelatoriosPage />, { rota: '/relatorios?de=2025-10-01&ate=2025-10-04' })
    await screen.findByText('Galpão 1 · 01/10/2025 a 04/10/2025')
    // 01/10: Diego e Eduarda; 04/10: Bruno
    await waitFor(() => expect(cartao('Recebido no período').getByText('3 pagamentos')).toBeInTheDocument())
    expect(cartao('Recebido no período').getByText(reais(420))).toBeInTheDocument()
  })

  it('pagamento cancelado não conta nos totais', async () => {
    await abrir({
      preparar: () => {
        const p = bancoFalso.tabelas.pagamentos.find((x) => x.cliente_id === IDS.bruno)
        if (p) p.status = 'cancelado'
      },
    })
    expect(cartao('Recebido no período').getByText(reais(660))).toBeInTheDocument()
    expect(cartao('Recebido (geral)').getByText(reais(660))).toBeInTheDocument()
  })
})

describe('Relatórios: arrecadação por dia e por forma', () => {
  it('lista os dias do mais novo ao mais antigo com o total de cada um e uma barra proporcional', async () => {
    await abrir()
    const dias = bloco('Arrecadação por dia').getAllByRole('listitem')
    expect(dias.map((li) => li.textContent?.replace(/\s/g, ' '))).toEqual([
      `sáb 11/10${reais(110)}`,
      `qua 08/10${reais(330)}`,
      `sáb 04/10${reais(200)}`,
      `qua 01/10${reais(220)}`,
    ])
    const barras = dias.map((li) => (li.querySelector('div > div') as HTMLElement).style.width)
    expect(barras[1]).toBe('100%') // o maior dia
    expect(barras[0]).toBe(`${(110 / 330) * 100}%`)
  })

  it('períodos com mais de 31 dias mostram só os 31 mais recentes e avisam', async () => {
    await abrir({
      rota: '/relatorios?de=2025-01-01&ate=2025-10-11',
      preparar: () => {
        for (let i = 0; i < 35; i += 1) {
          const dia = new Date(2025, 4, 1 + i)
          const iso = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`
          lancarPagamento(bancoFalso, { cliente: IDS.ana, semana: `2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`, dia: iso })
        }
      },
    })
    expect(await screen.findByText('Mostrando os 31 dias mais recentes do período.')).toBeInTheDocument()
    expect(bloco('Arrecadação por dia').getAllByRole('listitem')).toHaveLength(31)
  })

  it('"Recebido por forma de pagamento" mostra o total e a porcentagem de cada forma', async () => {
    await abrir()
    const forma = (nome: string) => bloco('Recebido por forma de pagamento').getByText(nome).closest('li') as HTMLElement
    expect(within(forma('Dinheiro')).getByText(reais(440))).toBeInTheDocument()
    expect(within(forma('Pix')).getByText(reais(310))).toBeInTheDocument()
    expect(within(forma('Cartão')).getByText(reais(110))).toBeInTheDocument()
    const largura = (nome: string) => (forma(nome).querySelector('.h-1\\.5 > div') as HTMLElement).style.width
    expect([largura('Dinheiro'), largura('Pix'), largura('Cartão')]).toEqual(['51%', '36%', '13%'])
  })

  it('formas sem pagamento aparecem zeradas', async () => {
    await abrir({
      preparar: () => {
        bancoFalso.tabelas.pagamentos = bancoFalso.tabelas.pagamentos.filter((p) => p.forma_pagamento === 'dinheiro')
      },
    })
    const forma = (nome: string) => bloco('Recebido por forma de pagamento').getByText(nome).closest('li') as HTMLElement
    expect(within(forma('Pix')).getByText(reais(0))).toBeInTheDocument()
    expect(within(forma('Cartão')).getByText(reais(0))).toBeInTheDocument()
  })
})

describe('Relatórios: pendências', () => {
  const itens = () => bloco('Pendências (em atraso)').getAllByRole('listitem')

  it('lista quem está em atraso com telefone, dia, valor e semanas em aberto', async () => {
    await abrir()
    const nomes = itens().map((li) => li.querySelector('p')?.textContent)
    expect(nomes).toEqual(['Bruno Lima', 'Carla Mendes', 'Gabriela Sem Zap'])
    const carla = itens()[1]
    expect(carla).toHaveTextContent('(85) 98888-0003')
    expect(carla).toHaveTextContent('Sábado')
    expect(carla.textContent?.replace(/\s/g, ' ')).toContain(`${reais(330)} (3 semanas)`)
    expect(itens()[0].textContent?.replace(/\s/g, ' ')).toContain(reais(200))
    expect(itens()[0].textContent).not.toContain('semanas')
    expect(itens()[2]).toHaveTextContent('Sem telefone')
  })

  it('o rodapé resume a quantidade de clientes e o valor em aberto', async () => {
    await abrir()
    expect(screen.getByText(`3 clientes · ${reais(750)} em aberto`.replace(/ /g, ' '), { exact: false })).toBeInTheDocument()
  })

  it('cada pendência tem o botão de cobrar pelo WhatsApp (desativado sem WhatsApp válido)', async () => {
    await abrir()
    const bruno = within(itens()[0]).getByRole('link', { name: 'Cobrar pelo WhatsApp' })
    expect(bruno.getAttribute('href')).toContain('https://wa.me/5585988880002')
    expect(within(itens()[2]).getByRole('button', { name: /cliente sem WhatsApp válido/ })).toBeDisabled()
  })

  it('cliente com atraso além da janela conferida mostra "26+ semanas" (AUD-014)', async () => {
    await abrir({
      preparar: () => {
        const carla = bancoFalso.tabelas.clientes.find((c) => c.id === IDS.carla)
        if (carla) carla.created_at = '2023-01-07T12:00:00Z'
      },
    })
    expect(itens()[1].textContent?.replace(/\s/g, ' ')).toContain('(26+ semanas)')
  })

  it('sem ninguém em atraso mostra a mensagem de tudo em dia', async () => {
    await abrir({
      preparar: () => {
        bancoFalso.tabelas.clientes = bancoFalso.tabelas.clientes.filter((c) => [IDS.ana, IDS.diego, IDS.eduarda].includes(c.id))
      },
    })
    expect(await screen.findByText('Nenhum cliente em pendência')).toBeInTheDocument()
    expect(screen.getByText('Todos os clientes estão em dia.')).toBeInTheDocument()
    expect(cartao('Em atraso').getByText('0')).toBeInTheDocument()
  })
})

describe('Relatórios: estados da tela', () => {
  it('enquanto carrega mostra "Carregando..."', async () => {
    renderizarTela(<RelatoriosPage />, { preparar: () => bancoFalso.atrasar('rpc:relatorio_resumo', 500) })
    await screen.findByRole('heading', { level: 1, name: 'Relatórios' })
    expect(await screen.findByText('Carregando...')).toBeInTheDocument()
    await screen.findByText('Recebido no período')
  })

  it('se o relatório falha mostra o erro e "Tentar novamente" recupera', async () => {
    const tela = renderizarTela(<RelatoriosPage />, { preparar: () => bancoFalso.falhar('rpc:relatorio_resumo', 'sem rede') })
    expect(await screen.findByText('Não foi possível carregar o relatório. Verifique a conexão e tente novamente.')).toBeInTheDocument()
    bancoFalso.falhas.clear()
    await tela.ui.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Recebido no período')).toBeInTheDocument()
  })

  it('usuário sem galpão liberado vê o aviso de acesso', async () => {
    renderizarTela(<RelatoriosPage />, { usuario: 'comum', preparar: () => (bancoFalso.tabelas.galpao_membros = []) })
    expect(await screen.findByText('Nenhum galpão disponível')).toBeInTheDocument()
  })

  it('trocar de período mantém o relatório anterior esmaecido até o novo chegar (sem piscar)', async () => {
    const { ui } = await abrir()
    bancoFalso.atrasar('rpc:relatorio_resumo', 300)
    await ui.click(screen.getByRole('button', { name: 'Últimos 7 dias' }))
    expect(screen.getByText('Recebido no período')).toBeInTheDocument()
    await waitFor(() => expect(cartao('Recebido no período').getByText(reais(110 * 4))).toBeInTheDocument())
  })
})
