import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DatePicker, type DatePickerProps } from '@/components/ui/DatePicker'

// "Hoje" nos testes é sábado, 11/10/2025 (ver src/test/setup.ts).

function Caixa(props: Partial<DatePickerProps> & { inicial?: string; aoMudar?: (v: string) => void }) {
  const { inicial = '', aoMudar, ...resto } = props
  const [valor, setValor] = useState(inicial)
  return (
    <DatePicker
      label="Data"
      value={valor}
      onChange={(v) => {
        setValor(v)
        aoMudar?.(v)
      }}
      {...resto}
    />
  )
}

const ui = () => userEvent.setup({ delay: null })
const calendario = () => within(screen.getByRole('dialog', { name: 'Selecionar data' }))

async function abrir(usuario: ReturnType<typeof ui>) {
  await usuario.click(screen.getByLabelText('Data'))
  return calendario()
}

describe('Calendário: o campo', () => {
  it('sem valor mostra o texto de exemplo; com valor mostra a data em dd/mm/aaaa', () => {
    const { rerender } = render(<DatePicker label="Data" value="" onChange={() => {}} placeholder="dd/mm/aaaa" />)
    expect(screen.getByLabelText('Data')).toHaveTextContent('dd/mm/aaaa')
    rerender(<DatePicker label="Data" value="2025-10-04" onChange={() => {}} placeholder="dd/mm/aaaa" />)
    expect(screen.getByLabelText('Data')).toHaveTextContent('04/10/2025')
  })

  it('mostra erro ou dica abaixo do campo (o erro tem prioridade)', () => {
    const { rerender } = render(<DatePicker label="Data" value="" onChange={() => {}} hint="Escolha o dia" />)
    expect(screen.getByText('Escolha o dia')).toBeInTheDocument()
    rerender(<DatePicker label="Data" value="" onChange={() => {}} hint="Escolha o dia" error="Data obrigatória" />)
    expect(screen.getByText('Data obrigatória')).toBeInTheDocument()
    expect(screen.queryByText('Escolha o dia')).not.toBeInTheDocument()
  })

  it('desativado não abre o calendário', async () => {
    render(<DatePicker label="Data" value="" onChange={() => {}} disabled />)
    expect(screen.getByLabelText('Data')).toBeDisabled()
  })
})

describe('Calendário: escolher o dia', () => {
  it('abre no mês do valor atual, com os dias da semana e os dias do mês', async () => {
    const u = ui()
    render(<Caixa inicial="2025-09-15" />)
    const cal = await abrir(u)
    expect(cal.getByRole('button', { name: 'Setembro 2025' })).toBeInTheDocument()
    for (const dia of ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) expect(cal.getByText(dia)).toBeInTheDocument()
    expect(cal.getByRole('button', { name: '30' })).toBeInTheDocument()
    expect(cal.queryByRole('button', { name: '31' })).not.toBeInTheDocument() // setembro tem 30 dias
  })

  it('sem valor abre no mês de hoje', async () => {
    const u = ui()
    render(<Caixa />)
    expect(await abrir(u)).toBeDefined()
    expect(calendario().getByRole('button', { name: 'Outubro 2025' })).toBeInTheDocument()
  })

  it('clicar num dia escolhe a data e fecha', async () => {
    const u = ui()
    const aoMudar = vi.fn()
    render(<Caixa aoMudar={aoMudar} />)
    const cal = await abrir(u)
    await u.click(cal.getByRole('button', { name: '8' }))
    expect(aoMudar).toHaveBeenCalledWith('2025-10-08')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Data')).toHaveTextContent('08/10/2025')
  })

  it('"Hoje" escolhe a data de hoje', async () => {
    const u = ui()
    const aoMudar = vi.fn()
    render(<Caixa aoMudar={aoMudar} inicial="2025-09-01" />)
    const cal = await abrir(u)
    await u.click(cal.getByRole('button', { name: 'Hoje' }))
    expect(aoMudar).toHaveBeenCalledWith('2025-10-11')
  })

  it('"Limpar" apaga a data', async () => {
    const u = ui()
    const aoMudar = vi.fn()
    render(<Caixa aoMudar={aoMudar} inicial="2025-09-01" placeholder="dd/mm/aaaa" />)
    const cal = await abrir(u)
    await u.click(cal.getByRole('button', { name: 'Limpar' }))
    expect(aoMudar).toHaveBeenCalledWith('')
    expect(screen.getByLabelText('Data')).toHaveTextContent('dd/mm/aaaa')
  })

  it('as setas mudam de mês, inclusive na virada do ano', async () => {
    const u = ui()
    render(<Caixa inicial="2025-12-10" />)
    const cal = await abrir(u)
    await u.click(cal.getByRole('button', { name: 'Próximo mês' }))
    expect(cal.getByRole('button', { name: 'Janeiro 2026' })).toBeInTheDocument()
    await u.click(cal.getByRole('button', { name: 'Mês anterior' }))
    await u.click(cal.getByRole('button', { name: 'Mês anterior' }))
    expect(cal.getByRole('button', { name: 'Novembro 2025' })).toBeInTheDocument()
  })

  it('Esc fecha sem escolher nada', async () => {
    const u = ui()
    const aoMudar = vi.fn()
    render(<Caixa aoMudar={aoMudar} />)
    await abrir(u)
    await u.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(aoMudar).not.toHaveBeenCalled()
  })

  it('reabrir mostra de novo o mês do valor escolhido', async () => {
    const u = ui()
    render(<Caixa inicial="2025-03-05" />)
    let cal = await abrir(u)
    await u.click(cal.getByRole('button', { name: 'Próximo mês' }))
    await u.keyboard('{Escape}')
    cal = await abrir(u)
    expect(cal.getByRole('button', { name: 'Março 2025' })).toBeInTheDocument()
  })
})

describe('Calendário: meses e anos', () => {
  it('clicar no mês abre a escolha de anos; o ano abre os meses; o mês volta aos dias', async () => {
    const u = ui()
    render(<Caixa inicial="2025-10-11" />)
    const cal = await abrir(u)
    await u.click(cal.getByRole('button', { name: 'Outubro 2025' }))
    expect(cal.getByText('2016 – 2027')).toBeInTheDocument()
    await u.click(cal.getByRole('button', { name: '2023' }))
    expect(cal.getByRole('button', { name: '2023' })).toBeInTheDocument() // cabeçalho dos meses
    await u.click(cal.getByRole('button', { name: 'Mar' }))
    expect(cal.getByRole('button', { name: 'Março 2023' })).toBeInTheDocument()
  })

  it('na escolha de meses as setas mudam o ano', async () => {
    const u = ui()
    render(<Caixa inicial="2025-10-11" />)
    const cal = await abrir(u)
    await u.click(cal.getByRole('button', { name: 'Outubro 2025' }))
    await u.click(cal.getByRole('button', { name: '2025' }))
    await u.click(cal.getByRole('button', { name: 'Ano anterior' }))
    expect(cal.getByRole('button', { name: '2024' })).toBeInTheDocument()
    await u.click(cal.getByRole('button', { name: 'Próximo ano' }))
    await u.click(cal.getByRole('button', { name: 'Próximo ano' }))
    expect(cal.getByRole('button', { name: '2026' })).toBeInTheDocument()
  })

  it('na escolha de anos as setas andam de 12 em 12', async () => {
    const u = ui()
    render(<Caixa inicial="2025-10-11" />)
    const cal = await abrir(u)
    await u.click(cal.getByRole('button', { name: 'Outubro 2025' }))
    await u.click(cal.getByRole('button', { name: 'Década anterior' }))
    expect(cal.getByText('2004 – 2015')).toBeInTheDocument()
    await u.click(cal.getByRole('button', { name: 'Próxima década' }))
    await u.click(cal.getByRole('button', { name: 'Próxima década' }))
    expect(cal.getByText('2028 – 2039')).toBeInTheDocument()
  })
})

describe('Calendário: limites mínimo e máximo', () => {
  it('dias fora do limite ficam desativados, os de dentro não', async () => {
    const u = ui()
    render(<Caixa inicial="2025-10-08" min="2025-10-03" max="2025-10-20" />)
    const cal = await abrir(u)
    expect(cal.getByRole('button', { name: '2' })).toBeDisabled()
    expect(cal.getByRole('button', { name: '3' })).toBeEnabled()
    expect(cal.getByRole('button', { name: '20' })).toBeEnabled()
    expect(cal.getByRole('button', { name: '21' })).toBeDisabled()
  })

  it('as setas de mês param no limite', async () => {
    const u = ui()
    render(<Caixa inicial="2025-10-08" min="2025-09-10" max="2025-11-20" />)
    const cal = await abrir(u)
    await u.click(cal.getByRole('button', { name: 'Mês anterior' }))
    expect(cal.getByRole('button', { name: 'Mês anterior' })).toBeDisabled()
    await u.click(cal.getByRole('button', { name: 'Próximo mês' }))
    await u.click(cal.getByRole('button', { name: 'Próximo mês' }))
    expect(cal.getByRole('button', { name: 'Novembro 2025' })).toBeInTheDocument()
    expect(cal.getByRole('button', { name: 'Próximo mês' })).toBeDisabled()
  })

  it('"Hoje" fica desativado quando hoje está fora do limite', async () => {
    const u = ui()
    render(<Caixa inicial="2025-10-01" max="2025-10-05" />)
    const cal = await abrir(u)
    expect(cal.getByRole('button', { name: 'Hoje' })).toBeDisabled()
  })

  it('só aparecem os anos que dá para escolher e os meses fora do limite ficam desativados', async () => {
    const u = ui()
    render(<Caixa inicial="2025-10-08" min="2024-06-01" max="2025-10-11" />)
    const cal = await abrir(u)
    await u.click(cal.getByRole('button', { name: 'Outubro 2025' }))
    expect(cal.getByText('2024 – 2025')).toBeInTheDocument()
    expect(cal.queryByRole('button', { name: '2023' })).not.toBeInTheDocument()
    expect(cal.queryByRole('button', { name: '2026' })).not.toBeInTheDocument()
    await u.click(cal.getByRole('button', { name: '2024' }))
    expect(cal.getByRole('button', { name: 'Mai' })).toBeDisabled()
    expect(cal.getByRole('button', { name: 'Jun' })).toBeEnabled()
    await u.click(cal.getByRole('button', { name: 'Próximo ano' }))
    expect(cal.getByRole('button', { name: 'Nov' })).toBeDisabled()
    expect(cal.getByRole('button', { name: 'Out' })).toBeEnabled()
  })

  it('com só um ano disponível, o título mostra apenas esse ano', async () => {
    const u = ui()
    render(<Caixa inicial="2025-10-08" min="2025-01-01" max="2025-12-31" />)
    const cal = await abrir(u)
    await u.click(cal.getByRole('button', { name: 'Outubro 2025' }))
    expect(cal.getByText('2025', { selector: 'span' })).toBeInTheDocument() // título
    expect(cal.getAllByRole('button', { name: /^20\d\d$/ })).toHaveLength(1) // só 2025 para escolher
    expect(cal.getByRole('button', { name: 'Década anterior' })).toBeDisabled()
    expect(cal.getByRole('button', { name: 'Próxima década' })).toBeDisabled()
  })

  it('abre num mês permitido mesmo que o valor atual esteja fora do limite', async () => {
    const u = ui()
    render(<Caixa inicial="2020-01-10" min="2025-09-01" max="2025-10-11" />)
    const cal = await abrir(u)
    expect(cal.getByRole('button', { name: 'Setembro 2025' })).toBeInTheDocument()
  })
})
