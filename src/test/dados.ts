// Dados de teste. "Hoje" nos testes é sábado, 11/10/2025 (ver setup.ts).
//
// Cenário padrão (Galpão 1):
//   Ana Souza ........ sábado   em dia (pagou a cobrança de hoje), 1 Carrinho de roupa (R$ 110)
//   Bruno Lima ....... sábado   em atraso, 1 semana (11/10), 1 Carro (R$ 200)
//   Carla Mendes ..... sábado   em atraso, 3 semanas (27/09, 04/10, 11/10), 1 Carrinho de roupa
//   Diego Alves ...... quarta   adiantado até 15/10, 1 Carrinho de roupa
//   Eduarda Reis ..... quarta   em dia (pagou 08/10), 1 Carrinho de roupa
//   Fábio Inativo .... quarta   inativo
//   Gabriela Sem Zap . sábado   em atraso, 2 semanas (04/10 e 11/10), sem telefone nem WhatsApp
import type { BancoFalso, Linha } from '@/test/bancoFalso'

export const SENHA_PADRAO = 'Senha@123'

export const IDS = {
  usuarioSuper: 'usr-super',
  usuarioComum: 'usr-comum',
  galpao1: 'gal-1',
  galpao2: 'gal-2',
  tipoRoupa: 'tip-roupa',
  tipoCarro: 'tip-carro',
  tipoComida: 'tip-comida',
  ana: 'cli-ana',
  bruno: 'cli-bruno',
  carla: 'cli-carla',
  diego: 'cli-diego',
  eduarda: 'cli-eduarda',
  fabio: 'cli-fabio',
  gabriela: 'cli-gabriela',
  clienteOutroGalpao: 'cli-outro',
} as const

export function criarGalpao(extra: Partial<Linha> = {}): Linha {
  return { id: IDS.galpao1, nome: 'Galpão 1', endereco: 'Rua A, 10 - Centro', created_at: '2025-01-01T12:00:00Z', ...extra }
}

export function criarPerfil(extra: Partial<Linha> = {}): Linha {
  return {
    id: IDS.usuarioSuper,
    nome: 'Dev',
    email: 'dev@meugalpao.com',
    is_super: true,
    avatar_url: null,
    created_at: '2025-01-01T12:00:00Z',
    ...extra,
  }
}

export function criarTipo(extra: Partial<Linha> = {}): Linha {
  return {
    id: IDS.tipoRoupa,
    galpao_id: null,
    nome: 'Carrinho de roupa',
    preco_semanal: 110,
    ativo: true,
    created_at: '2025-01-01T12:00:00Z',
    ...extra,
  }
}

export function criarCliente(extra: Partial<Linha> = {}): Linha {
  return {
    id: IDS.ana,
    galpao_id: IDS.galpao1,
    nome: 'Ana Souza',
    telefone: '(85) 98888-0001',
    whatsapp: '(85) 98888-0001',
    dia_pagamento: 'sabado',
    observacoes: null,
    ativo: true,
    criado_por: IDS.usuarioSuper,
    created_at: '2025-09-01T12:00:00Z',
    ...extra,
  }
}

export function criarItem(extra: Partial<Linha> = {}): Linha {
  return {
    id: `ite-${extra.cliente_id ?? 'x'}`,
    cliente_id: IDS.ana,
    galpao_id: IDS.galpao1,
    tipo_item_id: IDS.tipoRoupa,
    identificacao: null,
    quantidade: 1,
    ativo: true,
    created_at: '2025-09-01T12:00:00Z',
    ...extra,
  }
}

let seqPagamento = 0

/** Pagamento já com o recibo, direto no banco falso. */
export function lancarPagamento(
  banco: BancoFalso,
  p: {
    cliente: string
    semana: string
    valor?: number
    forma?: 'dinheiro' | 'pix' | 'cartao'
    dia?: string
    por?: string | null
    galpao?: string
    cancelado?: { por: string; motivo: string }
    descricao?: string | null
    criadoEm?: string
  },
): { pagamento: Linha; recibo: Linha } {
  seqPagamento += 1
  const galpao = p.galpao ?? IDS.galpao1
  const dia = p.dia ?? p.semana
  const pagamento: Linha = {
    id: `pag-${String(seqPagamento).padStart(4, '0')}`,
    galpao_id: galpao,
    cliente_id: p.cliente,
    valor: p.valor ?? 110,
    data_pagamento: dia,
    semana_referencia: p.semana,
    forma_pagamento: p.forma ?? 'dinheiro',
    status: p.cancelado ? 'cancelado' : 'pago',
    observacoes: null,
    criado_por: p.por === undefined ? IDS.usuarioSuper : p.por,
    cancelado_em: p.cancelado ? `${dia}T15:00:00Z` : null,
    cancelado_por: p.cancelado?.por ?? null,
    motivo_cancelamento: p.cancelado?.motivo ?? null,
    descricao: p.descricao === undefined ? 'Carrinho de roupa' : p.descricao,
    created_at: p.criadoEm ?? `${dia}T14:00:00Z`,
  }
  banco.tabelas.pagamentos.push(pagamento)
  const numero = Math.max(0, ...banco.tabelas.recibos.filter((r) => r.galpao_id === galpao).map((r) => r.numero)) + 1
  const recibo: Linha = {
    id: `rec-${String(seqPagamento).padStart(4, '0')}`,
    galpao_id: galpao,
    pagamento_id: pagamento.id,
    numero,
    codigo: `A3F927C15DE0${seqPagamento.toString(16).toUpperCase().padStart(4, '0')}`,
    pdf_url: null,
    enviado_whatsapp: false,
    created_at: pagamento.created_at,
  }
  banco.tabelas.recibos.push(recibo)
  return { pagamento, recibo }
}

/** Dois usuários (super e comum), dois galpões e o cenário de clientes descrito no topo do arquivo. */
export function popularCenarioPadrao(banco: BancoFalso): void {
  seqPagamento = 0
  const t = banco.tabelas

  t.profiles.push(
    criarPerfil(),
    criarPerfil({ id: IDS.usuarioComum, nome: 'Maria', email: 'maria@meugalpao.com', is_super: false }),
  )
  banco.cadastrarUsuario({ id: IDS.usuarioSuper, email: 'dev@meugalpao.com', senha: SENHA_PADRAO })
  banco.cadastrarUsuario({ id: IDS.usuarioComum, email: 'maria@meugalpao.com', senha: SENHA_PADRAO })

  t.galpoes.push(
    criarGalpao(),
    criarGalpao({ id: IDS.galpao2, nome: 'Galpão 2', endereco: null }),
  )
  t.galpao_membros.push({ id: 'mem-1', galpao_id: IDS.galpao1, profile_id: IDS.usuarioComum, created_at: '2025-01-01T12:00:00Z' })

  t.tipos_item.push(
    criarTipo(),
    criarTipo({ id: IDS.tipoCarro, nome: 'Carro', preco_semanal: 200 }),
    criarTipo({ id: IDS.tipoComida, nome: 'Carrinho de comida', preco_semanal: 150 }),
  )

  const cli = (id: string, nome: string, dia: 'quarta' | 'sabado', criado: string, extra: Partial<Linha> = {}) =>
    t.clientes.push(criarCliente({ id, nome, dia_pagamento: dia, created_at: `${criado}T12:00:00Z`, ...extra }))
  cli(IDS.ana, 'Ana Souza', 'sabado', '2025-10-11')
  cli(IDS.bruno, 'Bruno Lima', 'sabado', '2025-10-01', { telefone: '(85) 98888-0002', whatsapp: '(85) 98888-0002' })
  cli(IDS.carla, 'Carla Mendes', 'sabado', '2025-09-24', { telefone: '(85) 98888-0003', whatsapp: '(85) 98888-0003' })
  cli(IDS.diego, 'Diego Alves', 'quarta', '2025-10-01', { telefone: '(85) 98888-0004', whatsapp: '(85) 98888-0004' })
  cli(IDS.eduarda, 'Eduarda Reis', 'quarta', '2025-10-01', { telefone: '(85) 98888-0005', whatsapp: null })
  cli(IDS.fabio, 'Fábio Inativo', 'quarta', '2025-10-01', { ativo: false, telefone: null, whatsapp: null })
  cli(IDS.gabriela, 'Gabriela Sem Zap', 'sabado', '2025-10-04', { telefone: null, whatsapp: null })
  cli(IDS.clienteOutroGalpao, 'Cliente do Galpão 2', 'sabado', '2025-10-01', { galpao_id: IDS.galpao2 })

  for (const id of [IDS.ana, IDS.carla, IDS.diego, IDS.eduarda, IDS.fabio, IDS.gabriela]) {
    t.itens_guardados.push(criarItem({ id: `ite-${id}`, cliente_id: id }))
  }
  t.itens_guardados.push(criarItem({ id: `ite-${IDS.bruno}`, cliente_id: IDS.bruno, tipo_item_id: IDS.tipoCarro }))
  t.itens_guardados.push(
    criarItem({ id: 'ite-outro', cliente_id: IDS.clienteOutroGalpao, galpao_id: IDS.galpao2 }),
  )

  const maria = IDS.usuarioComum
  lancarPagamento(banco, { cliente: IDS.ana, semana: '2025-10-11', por: maria })
  lancarPagamento(banco, { cliente: IDS.bruno, semana: '2025-10-04', valor: 200, forma: 'pix', descricao: 'Carro' })
  lancarPagamento(banco, { cliente: IDS.diego, semana: '2025-10-01' })
  lancarPagamento(banco, { cliente: IDS.diego, semana: '2025-10-08', por: maria })
  lancarPagamento(banco, { cliente: IDS.diego, semana: '2025-10-15', dia: '2025-10-08', por: maria, forma: 'pix' })
  lancarPagamento(banco, { cliente: IDS.eduarda, semana: '2025-10-01', forma: 'cartao' })
  lancarPagamento(banco, { cliente: IDS.eduarda, semana: '2025-10-08', por: maria })
}

/** Acrescenta `quantidade` pagamentos antigos (semanas diferentes) para testar paginação e exportação. */
export function gerarPagamentos(banco: BancoFalso, quantidade: number, cliente: string = IDS.ana): void {
  const inicio = new Date(2024, 0, 3) // quarta-feira
  for (let i = 0; i < quantidade; i += 1) {
    const dia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i * 7)
    const p = (n: number) => String(n).padStart(2, '0')
    const iso = `${dia.getFullYear()}-${p(dia.getMonth() + 1)}-${p(dia.getDate())}`
    lancarPagamento(banco, { cliente, semana: iso })
  }
}
