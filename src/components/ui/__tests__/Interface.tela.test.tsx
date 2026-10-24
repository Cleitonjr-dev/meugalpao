import { useRef, useState } from 'react'
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Search } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterModal, type FilterValues } from '@/components/ui/FilterModal'
import { Input } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Loading'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/PageLoader'
import { Select } from '@/components/ui/Select'
import { StatCard } from '@/components/ui/StatCard'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { Tooltip } from '@/components/ui/Tooltip'
import { contarFiltros } from '@/components/ui/contarFiltros'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useMediaQuery } from '@/hooks/useMediaQuery'

const ui = () => userEvent.setup({ delay: null })

describe('Botão', () => {
  it('chama a ação ao clicar e é do tipo "button" por padrão (não envia formulário sem querer)', async () => {
    const acao = vi.fn()
    render(<Button onClick={acao}>Salvar</Button>)
    const b = screen.getByRole('button', { name: 'Salvar' })
    expect(b).toHaveAttribute('type', 'button')
    await ui().click(b)
    expect(acao).toHaveBeenCalledTimes(1)
  })

  it('desativado não clica', async () => {
    const acao = vi.fn()
    render(<Button onClick={acao} disabled>Salvar</Button>)
    await ui().click(screen.getByRole('button', { name: 'Salvar' }))
    expect(acao).not.toHaveBeenCalled()
  })

  it('carregando fica desativado, marcado como ocupado e mostra o indicador', () => {
    render(<Button loading>Salvar</Button>)
    const b = screen.getByRole('button', { name: 'Salvar' })
    expect(b).toBeDisabled()
    expect(b).toHaveAttribute('aria-busy', 'true')
    expect(b.querySelector('svg')).not.toBeNull()
  })

  it('largura total e variantes', () => {
    const { rerender } = render(<Button fullWidth variant="danger">Excluir</Button>)
    expect(screen.getByRole('button', { name: 'Excluir' })).toHaveClass('w-full', 'bg-red-600')
    rerender(<Button variant="secondary" size="sm">Voltar</Button>)
    expect(screen.getByRole('button', { name: 'Voltar' })).toHaveClass('px-3')
  })

  it('o clique deixa o efeito de ondulação no ponto clicado (a remoção depende do evento de animação do navegador)', async () => {
    const { container } = render(<Button>Ok</Button>)
    expect(container.querySelector('.btn-ripple')).toBeNull()
    await ui().click(screen.getByRole('button', { name: 'Ok' }))
    expect(container.querySelector('.btn-ripple')).not.toBeNull()
  })
})

describe('Campo de texto', () => {
  it('liga o rótulo ao campo e repassa o que é digitado', async () => {
    const mudou = vi.fn()
    render(<Input label="Nome" onChange={mudou} />)
    await ui().type(screen.getByLabelText('Nome'), 'ab')
    expect(mudou).toHaveBeenCalledTimes(2)
  })

  it('mostra a dica; o erro tem prioridade e marca o campo como inválido', () => {
    const { rerender } = render(<Input label="Nome" hint="Como no documento" />)
    expect(screen.getByText('Como no documento')).toBeInTheDocument()
    rerender(<Input label="Nome" hint="Como no documento" error="Informe o nome" />)
    expect(screen.getByText('Informe o nome')).toBeInTheDocument()
    expect(screen.queryByText('Como no documento')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true')
  })

  it('mostra o item do lado direito (ex.: olho da senha)', () => {
    render(<Input label="Senha" endAdornment={<button type="button">olho</button>} />)
    expect(screen.getByRole('button', { name: 'olho' })).toBeInTheDocument()
  })
})

describe('Caixa de marcar', () => {
  it('muda o estado ao clicar no quadrado ou no texto', async () => {
    const mudou = vi.fn()
    function Exemplo() {
      const [marcado, setMarcado] = useState(false)
      return <Checkbox label="Ativo" checked={marcado} onChange={(v) => { setMarcado(v); mudou(v) }} />
    }
    render(<Exemplo />)
    await ui().click(screen.getByLabelText('Ativo'))
    expect(mudou).toHaveBeenLastCalledWith(true)
    await ui().click(screen.getByText('Ativo'))
    expect(mudou).toHaveBeenLastCalledWith(false)
  })

  it('desativada não muda; mostra erro ou dica', async () => {
    const mudou = vi.fn()
    const { rerender } = render(<Checkbox label="Ativo" checked={false} onChange={mudou} disabled hint="Dica" />)
    await ui().click(screen.getByLabelText('Ativo'))
    expect(mudou).not.toHaveBeenCalled()
    expect(screen.getByText('Dica')).toBeInTheDocument()
    rerender(<Checkbox label="Ativo" checked={false} onChange={mudou} error="Obrigatório" hint="Dica" />)
    expect(screen.getByText('Obrigatório')).toBeInTheDocument()
    expect(screen.queryByText('Dica')).not.toBeInTheDocument()
  })
})

describe('Selo, cartão de resumo, vazio e carregando', () => {
  it('Badge mostra o texto', () => {
    render(<Badge variant="danger">Cancelado</Badge>)
    expect(screen.getByText('Cancelado')).toHaveClass('bg-red-100')
  })

  it('StatCard mostra rótulo, valor e detalhe opcional', () => {
    const { rerender } = render(<StatCard icon={Search} label="Total" value="R$ 10,00" sub="2 itens" tone="success" />)
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('R$ 10,00')).toBeInTheDocument()
    expect(screen.getByText('2 itens')).toBeInTheDocument()
    rerender(<StatCard icon={Search} label="Total" value="R$ 10,00" />)
    expect(screen.queryByText('2 itens')).not.toBeInTheDocument()
  })

  it('EmptyState mostra título, descrição e ação', () => {
    render(<EmptyState title="Nada aqui" description="Tente de novo" action={<button type="button">Criar</button>} />)
    expect(screen.getByRole('heading', { name: 'Nada aqui' })).toBeInTheDocument()
    expect(screen.getByText('Tente de novo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument()
  })

  it('Loading mostra o indicador acessível e o texto', () => {
    render(<Loading label="Carregando..." />)
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument()
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('PageLoader só aparece depois de um instante (carregamento rápido não pisca) ou na hora com atraso 0', async () => {
    const { unmount } = render(<PageLoader />)
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    expect(await screen.findByText('Carregando...')).toBeInTheDocument()
    unmount()
    render(<PageLoader delay={0} fullScreen />)
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('contarFiltros conta quantas opções estão marcadas (é o número do botão Filtros)', () => {
    expect(contarFiltros({})).toBe(0)
    expect(contarFiltros({ forma: [], status: [] })).toBe(0)
    expect(contarFiltros({ forma: ['pix', 'dinheiro'], status: [], dia: ['quarta'] })).toBe(3)
  })
})

describe('Janela (Modal)', () => {
  function Exemplo({ fundo = true }: { fundo?: boolean }) {
    const [aberto, setAberto] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setAberto(true)}>Abrir</button>
        <Modal open={aberto} onClose={() => setAberto(false)} title="Título" closeOnBackdrop={fundo} footer={<span>Rodapé</span>}>
          <input aria-label="Primeiro" />
          <button type="button">Último</button>
        </Modal>
      </>
    )
  }

  it('abre com título, conteúdo e rodapé; fechada não existe na página', async () => {
    render(<Exemplo />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await ui().click(screen.getByRole('button', { name: 'Abrir' }))
    const janela = screen.getByRole('dialog', { name: 'Título' })
    expect(janela).toHaveAttribute('aria-modal', 'true')
    expect(within(janela).getByText('Rodapé')).toBeInTheDocument()
  })

  it('trava a rolagem da página enquanto está aberta e devolve ao fechar', async () => {
    render(<Exemplo />)
    await ui().click(screen.getByRole('button', { name: 'Abrir' }))
    expect(document.body.style.overflow).toBe('hidden')
    await ui().keyboard('{Escape}')
    expect(document.body.style.overflow).toBe('')
  })

  it('Esc e o X fecham, e o foco volta para o botão que abriu', async () => {
    const u = ui()
    render(<Exemplo />)
    await u.click(screen.getByRole('button', { name: 'Abrir' }))
    await u.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
  })

  it('clicar no fundo fecha (padrão) ou não fecha (closeOnBackdrop=false)', async () => {
    const u = ui()
    const { unmount } = render(<Exemplo />)
    await u.click(screen.getByRole('button', { name: 'Abrir' }))
    await u.pointer([{ target: screen.getByRole('dialog').parentElement as HTMLElement, keys: '[MouseLeft]' }])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()
    render(<Exemplo fundo={false} />)
    await u.click(screen.getByRole('button', { name: 'Abrir' }))
    await u.pointer([{ target: screen.getByRole('dialog').parentElement as HTMLElement, keys: '[MouseLeft]' }])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('arrastar um texto selecionado para fora não fecha (o clique tem que começar e terminar no fundo)', async () => {
    const u = ui()
    render(<Exemplo />)
    await u.click(screen.getByRole('button', { name: 'Abrir' }))
    const fundo = screen.getByRole('dialog').parentElement as HTMLElement
    await u.pointer([{ keys: '[MouseLeft>]', target: screen.getByLabelText('Primeiro') }, { target: fundo }, { keys: '[/MouseLeft]' }])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('o Tab fica preso dentro da janela', async () => {
    const u = ui()
    render(<Exemplo />)
    await u.click(screen.getByRole('button', { name: 'Abrir' }))
    const janela = screen.getByRole('dialog')
    const fechar = within(janela).getByRole('button', { name: 'Fechar' })
    const ultimo = within(janela).getByRole('button', { name: 'Último' })
    ultimo.focus()
    await u.tab()
    expect(fechar).toHaveFocus() // deu a volta
    await u.tab({ shift: true })
    expect(ultimo).toHaveFocus() // e voltou
  })
})

describe('Lista de escolha (Select)', () => {
  const opcoes = [
    { value: 'a', label: 'Ana' },
    { value: 'b', label: 'Bruno' },
    { value: 'c', label: 'Carla' },
  ]

  function Exemplo(props: { buscavel?: boolean; aoMudar?: (v: string) => void; inicial?: string } = {}) {
    const [valor, setValor] = useState(props.inicial ?? '')
    return (
      <Select
        label="Pessoa"
        options={opcoes}
        value={valor}
        searchable={props.buscavel}
        onChange={(v) => {
          setValor(v)
          props.aoMudar?.(v)
        }}
      />
    )
  }

  it('mostra o texto de exemplo ou a opção escolhida', () => {
    const { rerender } = render(<Select label="Pessoa" options={opcoes} placeholder="Escolha..." />)
    expect(screen.getByLabelText('Pessoa')).toHaveTextContent('Escolha...')
    rerender(<Select label="Pessoa" options={opcoes} value="b" />)
    expect(screen.getByLabelText('Pessoa')).toHaveTextContent('Bruno')
  })

  it('abre a lista, escolhe com o mouse, fecha e devolve o foco ao campo', async () => {
    const u = ui()
    const aoMudar = vi.fn()
    render(<Exemplo aoMudar={aoMudar} />)
    await u.click(screen.getByLabelText('Pessoa'))
    expect(screen.getByLabelText('Pessoa')).toHaveAttribute('aria-expanded', 'true')
    await u.click(screen.getByRole('option', { name: 'Carla' }))
    expect(aoMudar).toHaveBeenCalledWith('c')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Pessoa')).toHaveFocus()
    expect(screen.getByLabelText('Pessoa')).toHaveTextContent('Carla')
  })

  it('marca a opção atual', async () => {
    const u = ui()
    render(<Exemplo inicial="b" />)
    await u.click(screen.getByLabelText('Pessoa'))
    expect(screen.getByRole('option', { name: 'Bruno' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'Ana' })).toHaveAttribute('aria-selected', 'false')
  })

  it('teclado: seta para baixo abre, setas percorrem, Enter escolhe, Esc fecha', async () => {
    const u = ui()
    const aoMudar = vi.fn()
    render(<Exemplo aoMudar={aoMudar} />)
    screen.getByLabelText('Pessoa').focus()
    await u.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await u.keyboard('{ArrowDown}{ArrowDown}')
    await u.keyboard('{ArrowUp}')
    await u.keyboard('{Enter}')
    expect(aoMudar).toHaveBeenCalledWith('b')
    await u.keyboard('{ArrowDown}')
    await u.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('as setas dão a volta no começo e no fim da lista', async () => {
    const u = ui()
    const aoMudar = vi.fn()
    render(<Exemplo aoMudar={aoMudar} />)
    screen.getByLabelText('Pessoa').focus()
    await u.keyboard('{ArrowDown}{ArrowUp}{Enter}') // de Ana para trás: vai para Carla
    expect(aoMudar).toHaveBeenLastCalledWith('c')
    // abre em Ana; Bruno, Carla e de volta a Ana
    await u.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}')
    expect(aoMudar).toHaveBeenLastCalledWith('a')
  })

  it('com busca: filtra por qualquer parte do texto e mostra aviso quando nada combina', async () => {
    const u = ui()
    render(<Exemplo buscavel />)
    await u.click(screen.getByLabelText('Pessoa'))
    const lista = within(screen.getByRole('listbox'))
    await u.type(lista.getByPlaceholderText('Buscar...'), 'RL')
    expect(lista.getAllByRole('option').map((o) => o.textContent)).toEqual(['Carla'])
    await u.clear(lista.getByPlaceholderText('Buscar...'))
    await u.type(lista.getByPlaceholderText('Buscar...'), 'zzz')
    expect(lista.getByText('Nenhuma opção encontrada')).toBeInTheDocument()
  })

  it('clicar fora fecha a lista; desativado não abre', async () => {
    const u = ui()
    render(
      <>
        <p>fora</p>
        <Exemplo />
      </>,
    )
    await u.click(screen.getByLabelText('Pessoa'))
    await u.click(screen.getByText('fora'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    render(<Select label="Parado" options={opcoes} disabled />)
    expect(screen.getByLabelText('Parado')).toBeDisabled()
  })

  it('mostra erro ou dica', () => {
    const { rerender } = render(<Select label="Pessoa" options={opcoes} hint="Dica" />)
    expect(screen.getByText('Dica')).toBeInTheDocument()
    rerender(<Select label="Pessoa" options={opcoes} hint="Dica" error="Obrigatório" />)
    expect(screen.getByText('Obrigatório')).toBeInTheDocument()
    expect(screen.queryByText('Dica')).not.toBeInTheDocument()
  })
})

describe('Janela de filtros (FilterModal)', () => {
  const grupos = [
    { key: 'forma', label: 'Forma', options: [{ value: 'pix', label: 'Pix' }, { value: 'dinheiro', label: 'Dinheiro' }] },
    { key: 'status', label: 'Situação', options: [{ value: 'pago', label: 'Pago' }] },
  ]

  function Exemplo({ valores = {} as FilterValues, aplicar = vi.fn() }) {
    const [aberto, setAberto] = useState(true)
    return <FilterModal open={aberto} onClose={() => setAberto(false)} groups={grupos} values={valores} onApply={aplicar} />
  }

  it('mostra os grupos com as opções já marcadas', () => {
    render(<Exemplo valores={{ forma: ['pix'] }} />)
    expect(screen.getByText('Forma')).toBeInTheDocument()
    expect(screen.getByLabelText('Pix')).toBeChecked()
    expect(screen.getByLabelText('Dinheiro')).not.toBeChecked()
  })

  it('Aplicar entrega o que foi marcado e fecha', async () => {
    const u = ui()
    const aplicar = vi.fn()
    render(<Exemplo aplicar={aplicar} />)
    await u.click(screen.getByLabelText('Dinheiro'))
    await u.click(screen.getByLabelText('Pago'))
    await u.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(aplicar).toHaveBeenCalledWith({ forma: ['dinheiro'], status: ['pago'] })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('desmarcar tira a opção; Limpar desmarca tudo; Cancelar não aplica', async () => {
    const u = ui()
    const aplicar = vi.fn()
    render(<Exemplo valores={{ forma: ['pix', 'dinheiro'] }} aplicar={aplicar} />)
    await u.click(screen.getByLabelText('Pix'))
    expect(screen.getByLabelText('Pix')).not.toBeChecked()
    await u.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(screen.getByLabelText('Dinheiro')).not.toBeChecked()
    await u.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(aplicar).not.toHaveBeenCalled()
  })
})

describe('Avisos (Toast)', () => {
  function Disparo() {
    const toast = useToast()
    return (
      <>
        <button type="button" onClick={() => toast.success('Deu certo')}>ok</button>
        <button type="button" onClick={() => toast.error('Deu erro')}>erro</button>
        <button type="button" onClick={() => toast.warning('Cuidado')}>aviso</button>
        <button type="button" onClick={() => toast.info('Saiba', { action: { label: 'Desfazer', onClick: () => toast.success('Desfeito') } })}>info</button>
      </>
    )
  }
  const abrir = () =>
    render(
      <ToastProvider>
        <Disparo />
      </ToastProvider>,
    )

  it('mostra a mensagem de cada tipo; erro e aviso são "alert", sucesso e informação são "status"', async () => {
    const u = ui()
    abrir()
    await u.click(screen.getByRole('button', { name: 'ok' }))
    await u.click(screen.getByRole('button', { name: 'erro' }))
    await u.click(screen.getByRole('button', { name: 'aviso' }))
    await u.click(screen.getByRole('button', { name: 'info' }))
    expect(screen.getByText('Deu certo').closest('[role]')).toHaveAttribute('role', 'status')
    expect(screen.getByText('Deu erro').closest('[role]')).toHaveAttribute('role', 'alert')
    expect(screen.getByText('Cuidado').closest('[role]')).toHaveAttribute('role', 'alert')
    expect(screen.getByText('Saiba').closest('[role]')).toHaveAttribute('role', 'status')
  })

  it('o botão de ação do aviso executa a ação e fecha o aviso', async () => {
    const u = ui()
    abrir()
    await u.click(screen.getByRole('button', { name: 'info' }))
    await u.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(await screen.findByText('Desfeito')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Saiba')).not.toBeInTheDocument(), { timeout: 2000 })
  })

  it('o X fecha o aviso', async () => {
    const u = ui()
    abrir()
    await u.click(screen.getByRole('button', { name: 'ok' }))
    await u.click(screen.getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByText('Deu certo')).not.toBeInTheDocument(), { timeout: 2000 })
  })

  it('usar o aviso fora do provedor dá erro claro', () => {
    const console_ = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Disparo />)).toThrow(/ToastProvider/)
    console_.mockRestore()
  })
})

describe('Dica (Tooltip)', () => {
  it('aparece depois de um instante com o mouse e some ao sair', async () => {
    const u = ui()
    render(
      <Tooltip texto="Explicação" atraso={20}>
        <button type="button">alvo</button>
      </Tooltip>,
    )
    await u.hover(screen.getByRole('button', { name: 'alvo' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Explicação')
    await u.unhover(screen.getByRole('button', { name: 'alvo' }))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('não aparece se o mouse sai antes do tempo', async () => {
    const u = ui()
    render(
      <Tooltip texto="Explicação" atraso={200}>
        <button type="button">alvo</button>
      </Tooltip>,
    )
    await u.hover(screen.getByRole('button', { name: 'alvo' }))
    await u.unhover(screen.getByRole('button', { name: 'alvo' }))
    await new Promise((r) => setTimeout(r, 260))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('clicar esconde a dica e Esc também', async () => {
    const u = ui()
    render(
      <Tooltip texto="Explicação" atraso={10}>
        <button type="button">alvo</button>
      </Tooltip>,
    )
    await u.hover(screen.getByRole('button', { name: 'alvo' }))
    await screen.findByRole('tooltip')
    await u.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await u.hover(screen.getByRole('button', { name: 'alvo' }))
    await u.unhover(screen.getByRole('button', { name: 'alvo' }))
    await u.hover(screen.getByRole('button', { name: 'alvo' }))
    await screen.findByRole('tooltip')
    await u.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('button', { name: 'alvo' }) })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})

describe('Ganchos de apoio', () => {
  it('useClickOutside avisa quando se clica fora ou se aperta Esc, mas não ao clicar dentro', async () => {
    const u = ui()
    const fechar = vi.fn()
    function Exemplo() {
      const ref = useRef<HTMLDivElement | null>(null)
      useClickOutside(ref, fechar)
      return (
        <>
          <p>fora</p>
          <div ref={ref}>dentro</div>
        </>
      )
    }
    render(<Exemplo />)
    await u.click(screen.getByText('dentro'))
    expect(fechar).not.toHaveBeenCalled()
    await u.click(screen.getByText('fora'))
    expect(fechar).toHaveBeenCalledTimes(1)
    await u.keyboard('{Escape}')
    expect(fechar).toHaveBeenCalledTimes(2)
  })

  it('useMediaQuery devolve o estado atual e acompanha as mudanças', () => {
    const ouvintes = new Set<() => void>()
    let casa = false
    vi.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          get matches() {
            return casa
          },
          addEventListener: (_: string, f: () => void) => ouvintes.add(f),
          removeEventListener: (_: string, f: () => void) => ouvintes.delete(f),
        }) as unknown as MediaQueryList,
    )
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)
    casa = true
    act(() => ouvintes.forEach((f) => f()))
    expect(result.current).toBe(true)
  })
})
