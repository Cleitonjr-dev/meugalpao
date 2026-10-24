import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pencil } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { Table, type TableColumn } from '@/components/ui/Table'

interface Linha {
  id: string
  nome: string
  valor: number
}

const colunas: TableColumn<Linha>[] = [
  { key: 'nome', header: 'Nome', render: (l) => l.nome },
  { key: 'valor', header: 'Valor', align: 'right', render: (l) => String(l.valor) },
]

const dados = (n: number): Linha[] =>
  Array.from({ length: n }, (_, i) => ({ id: `l${i + 1}`, nome: `Pessoa ${i + 1}`, valor: i + 1 }))

describe('Tabela: busca sincronizada com o endereço (AUD-018)', () => {
  it('quando o texto de busca vindo de fora muda, o campo acompanha', () => {
    const { rerender } = render(
      <Table columns={colunas} data={dados(3)} rowKey={(l) => l.id} onSearch={() => {}} searchDefault="ana" />,
    )
    expect(screen.getByPlaceholderText('Buscar...')).toHaveValue('ana')
    rerender(<Table columns={colunas} data={dados(3)} rowKey={(l) => l.id} onSearch={() => {}} searchDefault="" />)
    expect(screen.getByPlaceholderText('Buscar...')).toHaveValue('')
    rerender(<Table columns={colunas} data={dados(3)} rowKey={(l) => l.id} onSearch={() => {}} searchDefault="bruno" />)
    expect(screen.getByPlaceholderText('Buscar...')).toHaveValue('bruno')
  })

  it('não apaga o espaço que a pessoa está digitando quando o valor de fora só difere por espaços', async () => {
    const ui = userEvent.setup({ delay: null })
    const { rerender } = render(
      <Table columns={colunas} data={dados(3)} rowKey={(l) => l.id} onSearch={() => {}} searchDefault="" />,
    )
    await ui.type(screen.getByPlaceholderText('Buscar...'), 'ana ')
    // o endereço guarda a busca sem o espaço final
    rerender(<Table columns={colunas} data={dados(3)} rowKey={(l) => l.id} onSearch={() => {}} searchDefault="ana" />)
    expect(screen.getByPlaceholderText('Buscar...')).toHaveValue('ana ')
  })
})

describe('Tabela: o básico', () => {
  it('mostra cabeçalhos, linhas e o total', () => {
    render(<Table columns={colunas} data={dados(3)} rowKey={(l) => l.id} />)
    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Nome', 'Valor'])
    expect(screen.getByText('Pessoa 2')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 1–3 de 3')).toBeInTheDocument()
  })

  it('sem dados mostra a mensagem de vazio (padrão ou a informada)', () => {
    const { rerender } = render(<Table columns={colunas} data={[]} rowKey={(l) => l.id} />)
    expect(screen.getByText('Nenhum registro encontrado')).toBeInTheDocument()
    rerender(<Table columns={colunas} data={[]} rowKey={(l) => l.id} emptyMessage="Nada por aqui" />)
    expect(screen.getByText('Nada por aqui')).toBeInTheDocument()
  })

  it('pagina no próprio navegador (10 por página) e volta para a primeira ao mudar a quantidade de resultados', async () => {
    const ui = userEvent.setup({ delay: null })
    const { rerender } = render(<Table columns={colunas} data={dados(25)} rowKey={(l) => l.id} />)
    expect(screen.getByText('Mostrando 1–10 de 25')).toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(screen.getByText('Mostrando 11–20 de 25')).toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(screen.getByText('Mostrando 21–25 de 25')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
    rerender(<Table columns={colunas} data={dados(12)} rowKey={(l) => l.id} />)
    expect(screen.getByText('Mostrando 1–10 de 12')).toBeInTheDocument()
  })

  it('"Primeira página" e "Página anterior" voltam', async () => {
    const ui = userEvent.setup({ delay: null })
    render(<Table columns={colunas} data={dados(25)} rowKey={(l) => l.id} />)
    await ui.click(screen.getByRole('button', { name: 'Próxima página' }))
    await ui.click(screen.getByRole('button', { name: 'Próxima página' }))
    await ui.click(screen.getByRole('button', { name: 'Página anterior' }))
    expect(screen.getByText('Mostrando 11–20 de 25')).toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: 'Primeira página' }))
    expect(screen.getByText('Mostrando 1–10 de 25')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Primeira página' })).toBeDisabled()
  })

  it('o modo do servidor usa o total, a página e o aviso de troca de página informados', async () => {
    const ui = userEvent.setup({ delay: null })
    const trocar = vi.fn()
    render(
      <Table columns={colunas} data={dados(5)} rowKey={(l) => l.id} serverSide total={42} page={2} pageSize={5} onPageChange={trocar} />,
    )
    expect(screen.getByText('Mostrando 6–10 de 42')).toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(trocar).toHaveBeenCalledWith(3)
    await ui.click(screen.getByRole('button', { name: 'Primeira página' }))
    expect(trocar).toHaveBeenCalledWith(1)
  })

  it('página pedida além do fim é mostrada como a última', () => {
    render(<Table columns={colunas} data={[]} rowKey={(l) => l.id} serverSide total={12} page={99} pageSize={5} />)
    expect(screen.getByText('Mostrando 11–12 de 12')).toBeInTheDocument()
  })

  it('mostra reticências quando há muitas páginas', () => {
    render(<Table columns={colunas} data={dados(5)} rowKey={(l) => l.id} serverSide total={500} page={50} pageSize={5} />)
    expect(screen.getAllByText('…').length).toBeGreaterThan(0)
  })

  it('a busca avisa o texto digitado e o botão Filtros mostra a contagem', async () => {
    const ui = userEvent.setup({ delay: null })
    const buscar = vi.fn()
    const filtrar = vi.fn()
    render(
      <Table
        columns={colunas}
        data={dados(3)}
        rowKey={(l) => l.id}
        onSearch={buscar}
        onFilter={filtrar}
        filterCount={2}
        searchPlaceholder="Buscar pessoa..."
      />,
    )
    await ui.type(screen.getByPlaceholderText('Buscar pessoa...'), 'ab')
    expect(buscar).toHaveBeenLastCalledWith('ab')
    const botao = screen.getByRole('button', { name: /Filtros/ })
    expect(botao).toHaveTextContent('2')
    await ui.click(botao)
    expect(filtrar).toHaveBeenCalledTimes(1)
  })

  it('o botão Filtros sem filtros não mostra número', () => {
    render(<Table columns={colunas} data={dados(1)} rowKey={(l) => l.id} onFilter={() => {}} filterCount={0} />)
    expect(screen.getByRole('button', { name: /Filtros/ }).textContent).toBe('Filtros')
  })

  it('ações da linha: aparecem com o nome acessível, chamam com a linha certa e podem ser escondidas por linha', async () => {
    const ui = userEvent.setup({ delay: null })
    const editar = vi.fn()
    render(
      <Table
        columns={colunas}
        data={dados(2)}
        rowKey={(l) => l.id}
        actions={[{ icon: Pencil, label: 'Editar', onClick: editar, hidden: (l) => l.id === 'l2' }]}
      />,
    )
    const botoes = screen.getAllByRole('button', { name: 'Editar' })
    expect(botoes).toHaveLength(1)
    await ui.click(botoes[0])
    expect(editar).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }))
    expect(screen.getByRole('columnheader', { name: 'Ações' })).toBeInTheDocument()
  })

  it('clicar na linha chama onRowClick', async () => {
    const ui = userEvent.setup({ delay: null })
    const abrir = vi.fn()
    render(<Table columns={colunas} data={dados(2)} rowKey={(l) => l.id} onRowClick={abrir} />)
    await ui.click(screen.getByText('Pessoa 2'))
    expect(abrir).toHaveBeenCalledWith(expect.objectContaining({ id: 'l2' }))
  })
})
