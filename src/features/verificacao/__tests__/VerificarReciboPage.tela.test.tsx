import { describe, expect, it } from 'vitest'
import { VerificarReciboPage } from '@/features/verificacao/VerificarReciboPage'
import { bancoFalso } from '@/test/bancoFalso'
import { IDS } from '@/test/dados'
import { reais, renderizarTela, screen, waitFor, within } from '@/test/renderizar'

const CODIGO_ANA = 'A3F927C15DE00001'
const CODIGO_BRUNO = 'A3F927C15DE00002'

async function abrir(rota = '/verificar', opcoes: Parameters<typeof renderizarTela>[1] = {}, embutido = false) {
  return renderizarTela(<VerificarReciboPage embutido={embutido} />, { rota, usuario: null, ...opcoes })
}

const campo = () => screen.getByLabelText('Código de autenticação')

describe('Verificação de recibo (página pública)', () => {
  it('mostra a marca, a explicação, o campo e os caminhos de volta ao login', async () => {
    await abrir()
    expect(await screen.findByRole('heading', { name: 'MeuGalpão' })).toBeInTheDocument()
    expect(screen.getByText('Digite o código de autenticação impresso no recibo para confirmar se ele é verdadeiro.')).toBeInTheDocument()
    expect(campo()).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Verificar' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Voltar ao login' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('button', { name: 'Tema do sistema' })).toBeInTheDocument()
  })

  it('código certo: mostra o recibo válido com os dados e o código no formato impresso', async () => {
    const { ui, rotaAtual } = await abrir()
    await ui.type(await screen.findByLabelText('Código de autenticação'), 'a3f9-27c1-5de0-0001')
    await ui.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByText('Válido')).toBeInTheDocument()
    const dados = within(screen.getByText('Recibo Nº 0001').closest('div.rounded-lg') as HTMLElement)
    expect(dados.getByText('Galpão 1')).toBeInTheDocument()
    expect(dados.getByText('Ana S.')).toBeInTheDocument() // nome abreviado
    expect(dados.getByText(reais(110))).toBeInTheDocument()
    expect(dados.getAllByText('11/10/2025')).toHaveLength(2) // data do pagamento e "Cobrança de"
    expect(dados.getByText('Dinheiro')).toBeInTheDocument()
    expect(dados.getByText('A3F9-27C1-5DE0-0001')).toBeInTheDocument()
    // o código vai para o endereço, assim o resultado pode ser compartilhado
    expect(rotaAtual()).toBe(`/verificar?c=${CODIGO_ANA}`)
  })

  it('o código vindo no endereço (?c=) já abre consultado', async () => {
    await abrir(`/verificar?c=${CODIGO_BRUNO}`)
    expect(await screen.findByText('Válido')).toBeInTheDocument()
    expect(screen.getByText('Recibo Nº 0002')).toBeInTheDocument()
    expect(screen.getByText('Bruno L.')).toBeInTheDocument()
    expect(screen.getByLabelText('Código de autenticação')).toHaveValue(CODIGO_BRUNO)
  })

  it('o botão vira "Verificar outro código" e limpa tudo, inclusive o endereço', async () => {
    const { ui, rotaAtual } = await abrir(`/verificar?c=${CODIGO_ANA}`)
    await screen.findByText('Válido')
    await ui.click(screen.getByRole('button', { name: 'Verificar outro código' }))
    expect(campo()).toHaveValue('')
    expect(screen.queryByText('Válido')).not.toBeInTheDocument()
    expect(rotaAtual()).toBe('/verificar')
    expect(screen.getByRole('button', { name: 'Verificar' })).toBeInTheDocument()
  })

  it('código que não existe: "Recibo não encontrado" com aviso para desconfiar', async () => {
    await abrir('/verificar?c=0000111122223333')
    expect(await screen.findByText('Recibo não encontrado')).toBeInTheDocument()
    expect(screen.getByText(/Nenhum recibo tem o código 0000-1111-2222-3333\. Desconfie deste documento\./)).toBeInTheDocument()
  })

  it('código incompleto no endereço pede para conferir o que foi digitado', async () => {
    await abrir('/verificar?c=A3F9')
    expect(await screen.findByText(/O código tem 16 letras e números/)).toBeInTheDocument()
    expect(screen.queryByText('Recibo não encontrado')).not.toBeInTheDocument()
  })

  it('código incompleto digitado não consulta o servidor', async () => {
    const { ui } = await abrir()
    await ui.type(await screen.findByLabelText('Código de autenticação'), 'A3F9')
    await ui.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByText(/O código tem 16 letras e números/)).toBeInTheDocument()
    expect(bancoFalso.chamadas.some((c) => c.rpc === 'verificar_recibo')).toBe(false)
  })

  it('recibo cancelado: mostra "Cancelado" e que não tem validade', async () => {
    await abrir(`/verificar?c=${CODIGO_BRUNO}`, {
      preparar: () => {
        const p = bancoFalso.tabelas.pagamentos.find((x) => x.cliente_id === IDS.bruno)
        if (p) Object.assign(p, { status: 'cancelado', cancelado_em: '2025-10-06T15:00:00Z' })
      },
    })
    expect(await screen.findByText('Cancelado')).toBeInTheDocument()
    expect(screen.getByText(/Este recibo foi cancelado em 06\/10\/2025 e não\s+tem validade\./)).toBeInTheDocument()
  })

  it('editar o código depois de ver o resultado esconde o resultado antigo', async () => {
    const { ui } = await abrir(`/verificar?c=${CODIGO_ANA}`)
    await screen.findByText('Válido')
    await ui.type(campo(), '9')
    expect(screen.queryByText('Válido')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verificar' })).toBeInTheDocument()
  })

  it('se a consulta falha, avisa para tentar de novo', async () => {
    await abrir(`/verificar?c=${CODIGO_ANA}`, { preparar: () => bancoFalso.falhar('rpc:verificar_recibo', 'sem rede') })
    expect(await screen.findByText('Não foi possível consultar agora. Tente novamente em instantes.')).toBeInTheDocument()
  })

  it('enquanto consulta mostra "Carregando..."', async () => {
    await abrir(`/verificar?c=${CODIGO_ANA}`, { preparar: () => bancoFalso.atrasar('rpc:verificar_recibo', 400) })
    expect(await screen.findByText('Carregando...')).toBeInTheDocument()
    await screen.findByText('Válido')
  })

  it('funciona sem nenhum login e sem expor dados internos (só nome abreviado, valor e data)', async () => {
    await abrir(`/verificar?c=${CODIGO_ANA}`)
    await screen.findByText('Válido')
    expect(screen.queryByText(/Ana Souza/)).not.toBeInTheDocument()
    expect(screen.queryByText(/98888/)).not.toBeInTheDocument()
    expect(bancoFalso.sessao).toBeNull()
  })
})

describe('Verificação de recibo (dentro do sistema)', () => {
  it('não mostra a marca, o tema nem o "Voltar ao login"', async () => {
    await abrir('/verificar', { usuario: 'super' }, true)
    expect(await screen.findByRole('heading', { name: 'Verificar recibo' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Voltar ao login' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tema do sistema' })).not.toBeInTheDocument()
  })

  it('verifica do mesmo jeito', async () => {
    const { ui } = await abrir('/verificar', { usuario: 'super' }, true)
    await ui.type(await screen.findByLabelText('Código de autenticação'), CODIGO_ANA)
    await ui.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByText('Válido')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Recibo Nº 0001')).toBeInTheDocument())
  })
})
