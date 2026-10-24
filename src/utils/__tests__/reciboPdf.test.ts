import { describe, expect, it, vi } from 'vitest'
import { baixarReciboPdf } from '@/utils/reciboPdf'
import type { DadosRecibo } from '@/features/pagamentos/recibo'

// O jsPDF de verdade monta o PDF; só interceptamos o "salvar" (que no navegador baixa o arquivo)
// para ficar com o nome e os bytes do documento.
const salvos = vi.hoisted(() => [] as { nome: string; bytes: ArrayBuffer }[])

vi.mock('jspdf', async (original) => {
  const modulo = await original<typeof import('jspdf')>()
  class JsPdfEspiao extends modulo.jsPDF {
    constructor(...argumentos: ConstructorParameters<typeof modulo.jsPDF>) {
      super(...argumentos)
      // no jsPDF o "save" é gravado em cada documento ao criá-lo: por isso trocamos aqui, depois do super()
      Object.defineProperty(this, 'save', {
        value: (nome?: string) => {
          salvos.push({ nome: nome ?? '', bytes: this.output('arraybuffer') })
          return this
        },
      })
    }
  }
  return { ...modulo, jsPDF: JsPdfEspiao }
})

const DADOS: DadosRecibo = {
  galpaoNome: 'Galpão 1',
  numero: 7,
  codigo: 'A3F927C15DE00007',
  clienteNome: 'Ana Souza',
  clienteWhatsapp: '(85) 98888-0001',
  valor: 'R$ 110,00',
  data: '11/10/2025',
  referente: '11/10/2025',
  itens: 'Carrinho de roupa',
  forma: 'Dinheiro',
  observacoes: null,
  cancelado: false,
}

async function gerar(dados: DadosRecibo) {
  salvos.length = 0
  await baixarReciboPdf(dados)
  const { nome, bytes } = salvos[0]
  return { nome, tamanho: bytes.byteLength, texto: new TextDecoder('latin1').decode(bytes) }
}

describe('baixarReciboPdf', () => {
  it('gera um arquivo chamado recibo-NNNN.pdf que começa como um PDF de verdade', async () => {
    const r = await gerar(DADOS)
    expect(r.nome).toBe('recibo-0007.pdf')
    expect(r.texto.startsWith('%PDF-')).toBe(true)
    expect(r.tamanho).toBeGreaterThan(500)
  })

  it('recibo sem número usa "----" no nome do arquivo', async () => {
    expect((await gerar({ ...DADOS, numero: null })).nome).toBe('recibo-----.pdf')
  })

  it('o recibo traz marca, galpão, número, cliente, valor, item e forma de pagamento', async () => {
    const { texto } = await gerar(DADOS)
    for (const trecho of ['MeuGalp', 'Galp', 'RECIBO N', '0007', 'Ana Souza', 'R$ 110,00', 'Carrinho de roupa', 'Dinheiro', '11/10/2025']) {
      expect(texto, `faltou "${trecho}" no PDF`).toContain(trecho)
    }
  })

  it('o recibo traz o código de autenticação formatado; sem código traz a linha de assinatura', async () => {
    const comCodigo = await gerar(DADOS)
    expect(comCodigo.texto).toContain('A3F9-27C1-5DE0-0007')
    expect(comCodigo.texto).not.toContain('Assinatura:')
    const semCodigo = await gerar({ ...DADOS, codigo: null })
    expect(semCodigo.texto).toContain('Assinatura:')
    expect(semCodigo.texto).not.toContain('A3F9-27C1')
  })

  it('recibo cancelado sai com a marca CANCELADO; o normal não', async () => {
    expect((await gerar({ ...DADOS, cancelado: true })).texto).toContain('CANCELADO')
    expect((await gerar(DADOS)).texto).not.toContain('CANCELADO')
  })

  it('as observações aparecem quando existem', async () => {
    expect((await gerar({ ...DADOS, observacoes: 'Pagou adiantado' })).texto).toContain('Pagou adiantado')
    expect((await gerar(DADOS)).texto).not.toContain('Obs:')
  })

  it('a página cresce junto com o conteúdo (observação longa e vários itens)', async () => {
    const curto = await gerar({ ...DADOS, itens: null, codigo: null })
    const longo = await gerar({
      ...DADOS,
      observacoes: 'Pagou adiantado e pediu para guardar o carrinho no fundo do galpão por duas semanas inteiras, avisar antes de mexer',
      itens: 'Carrinho de roupa; Carro — ABC-1234 (x2); Carrinho de comida; Carrinho de bebida',
    })
    expect(longo.tamanho).toBeGreaterThan(curto.tamanho)
  })

  it('caracteres que as fontes do PDF não têm viram "?" em vez de corromper o arquivo', async () => {
    const r = await gerar({ ...DADOS, clienteNome: 'Zé 😀 Silva' })
    expect(r.texto).toContain('Z')
    expect(r.texto).toContain('Silva')
    expect(r.texto).not.toContain('😀')
    expect(r.texto.startsWith('%PDF-')).toBe(true)
  })

  it('nome de galpão muito grande quebra em linhas (não estoura a largura)', async () => {
    const r = await gerar({ ...DADOS, galpaoNome: 'Galpão da Feira da José Avelino — Setor de Roupas e Calçados, Rua Principal' })
    expect(r.tamanho).toBeGreaterThan(500)
  })
})
