// Supabase falso, em memória, para os testes de tela. Imita só o que o sistema usa:
// tabelas (select/insert/update/delete encadeáveis), funções do banco (rpc) e login.
// As regras de verdade do banco continuam testadas em tests/db (npm run test:db).
export type Linha = Record<string, any>
export type NomeTabela =
  | 'galpoes'
  | 'clientes'
  | 'itens_guardados'
  | 'tipos_item'
  | 'precos_galpao'
  | 'profiles'
  | 'galpao_membros'
  | 'pagamentos'
  | 'recibos'
  | 'auditoria'

interface ErroFalso {
  message: string
  code?: string
  status?: number
}

interface Resposta {
  data: unknown
  error: ErroFalso | null
  count?: number | null
}

type Operacao = 'select' | 'insert' | 'update' | 'delete'

interface UsuarioFalso {
  id: string
  email: string
  senha: string
}

let contadorId = 0
export function novoId(prefixo = 'id'): string {
  contadorId += 1
  return `${prefixo}-${String(contadorId).padStart(4, '0')}`
}

function agoraISO(): string {
  return new Date().toISOString()
}

function dataISO(data: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`
}

function abreviarNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ''
  if (partes.length === 1) return partes[0]
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// ---------------------------------------------------------------------------------------------
// Construtor de consultas encadeável (select/insert/update/delete)
// ---------------------------------------------------------------------------------------------
type Filtro = (linha: Linha) => boolean

class Consulta implements PromiseLike<Resposta> {
  private operacao: Operacao = 'select'
  private filtros: Filtro[] = []
  private ordens: { coluna: string; asc: boolean }[] = []
  private faixa: [number, number] | null = null
  private limite: number | null = null
  private modo: 'lista' | 'unico' | 'talvez' = 'lista'
  private valores: Linha | Linha[] | null = null
  private devolverLinhas = false
  private contar = false
  private soCabecalho = false

  private banco: BancoFalso
  private origem: { tabela: NomeTabela } | { fonte: () => unknown; rotulo: string }

  constructor(
    banco: BancoFalso,
    origem: { tabela: NomeTabela } | { fonte: () => unknown; rotulo: string },
  ) {
    this.banco = banco
    this.origem = origem
  }

  select(_colunas?: string, opcoes?: { count?: string; head?: boolean }): this {
    this.devolverLinhas = true
    this.contar = opcoes?.count === 'exact'
    this.soCabecalho = opcoes?.head === true
    return this
  }
  insert(valores: Linha | Linha[]): this {
    this.operacao = 'insert'
    this.valores = valores
    return this
  }
  update(valores: Linha): this {
    this.operacao = 'update'
    this.valores = valores
    return this
  }
  delete(): this {
    this.operacao = 'delete'
    return this
  }
  eq(coluna: string, valor: unknown): this {
    this.filtros.push((l) => l[coluna] === valor)
    return this
  }
  neq(coluna: string, valor: unknown): this {
    this.filtros.push((l) => l[coluna] !== valor)
    return this
  }
  in(coluna: string, valores: unknown[]): this {
    this.filtros.push((l) => valores.includes(l[coluna]))
    return this
  }
  is(coluna: string, valor: unknown): this {
    this.filtros.push((l) => (valor === null ? l[coluna] == null : l[coluna] === valor))
    return this
  }
  // Formato usado pelo sistema: "galpao_id.is.null,galpao_id.eq.<id>"
  or(texto: string): this {
    const partes = texto.split(',').map((p) => p.split('.'))
    this.filtros.push((l) =>
      partes.some(([coluna, op, ...resto]) => {
        const valor = resto.join('.')
        if (op === 'is') return valor === 'null' ? l[coluna] == null : String(l[coluna]) === valor
        if (op === 'eq') return String(l[coluna]) === valor
        return false
      }),
    )
    return this
  }
  order(coluna: string, opcoes?: { ascending?: boolean }): this {
    this.ordens.push({ coluna, asc: opcoes?.ascending !== false })
    return this
  }
  range(de: number, ate: number): this {
    this.faixa = [de, ate]
    return this
  }
  limit(n: number): this {
    this.limite = n
    return this
  }
  single(): this {
    this.modo = 'unico'
    return this
  }
  maybeSingle(): this {
    this.modo = 'talvez'
    return this
  }

  private ordenar(linhas: Linha[]): Linha[] {
    if (this.ordens.length === 0) return linhas
    return [...linhas].sort((a, b) => {
      for (const { coluna, asc } of this.ordens) {
        const x = a[coluna]
        const y = b[coluna]
        if (x === y) continue
        const r = x == null ? -1 : y == null ? 1 : x < y ? -1 : 1
        return asc ? r : -r
      }
      return 0
    })
  }

  private executar(): Resposta {
    const chave =
      'tabela' in this.origem
        ? `from:${this.origem.tabela}:${this.operacao}`
        : `rpc:${this.origem.rotulo}`
    const falha = this.banco.falhas.get(chave)
    if (falha) return { data: null, error: falha }

    // Funções do banco (rpc): a fonte devolve o resultado pronto
    if ('fonte' in this.origem) {
      try {
        let dados = this.origem.fonte()
        if (Array.isArray(dados) && this.faixa) dados = dados.slice(this.faixa[0], this.faixa[1] + 1)
        return { data: dados, error: null }
      } catch (e) {
        const erro = e as ErroFalso
        return { data: null, error: { message: erro.message, code: erro.code ?? 'P0001' } }
      }
    }

    const nomeTabela = this.origem.tabela
    const tabela = this.banco.tabelas[nomeTabela]
    // Segurança por linha (RLS): quem não é super usuário só enxerga os galpões liberados para ele.
    const visivel = (l: Linha) => {
      if (nomeTabela === 'galpoes') return this.banco.podeVer(l.id)
      if (['clientes', 'itens_guardados', 'precos_galpao', 'pagamentos', 'recibos', 'galpao_membros'].includes(nomeTabela)) {
        return nomeTabela === 'galpao_membros' ? this.banco.podeVer(l.galpao_id) || l.profile_id === this.banco.usuarioAtual() : this.banco.podeVer(l.galpao_id)
      }
      if (nomeTabela === 'tipos_item') return l.galpao_id == null || this.banco.podeVer(l.galpao_id)
      return true
    }
    const casam = (l: Linha) => visivel(l) && this.filtros.every((f) => f(l))

    let afetadas: Linha[] = []
    if (this.operacao === 'insert') {
      const lista = Array.isArray(this.valores) ? this.valores : [this.valores as Linha]
      for (const v of lista) {
        const nova: Linha = {
          id: novoId(this.origem.tabela.slice(0, 3)),
          created_at: agoraISO(),
          ...(['clientes', 'itens_guardados', 'tipos_item'].includes(this.origem.tabela)
            ? { ativo: true }
            : {}),
          ...v,
        }
        tabela.push(nova)
        afetadas.push(nova)
      }
    } else if (this.operacao === 'update') {
      afetadas = tabela.filter(casam)
      for (const l of afetadas) Object.assign(l, this.valores)
    } else if (this.operacao === 'delete') {
      afetadas = tabela.filter(casam)
      this.banco.tabelas[this.origem.tabela] = tabela.filter((l) => !casam(l))
    } else {
      afetadas = tabela.filter(casam)
    }

    const totalSemFaixa = afetadas.length
    let linhas = this.ordenar(afetadas)
    if (this.faixa) linhas = linhas.slice(this.faixa[0], this.faixa[1] + 1)
    if (this.limite !== null) linhas = linhas.slice(0, this.limite)
    const copia = linhas.map((l) => ({ ...l }))

    if (this.soCabecalho) return { data: null, error: null, count: totalSemFaixa }
    if (this.operacao !== 'select' && !this.devolverLinhas) return { data: null, error: null }
    if (this.modo === 'unico') {
      return copia.length === 1
        ? { data: copia[0], error: null }
        : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } }
    }
    if (this.modo === 'talvez') return { data: copia[0] ?? null, error: null }
    return { data: copia, error: null, ...(this.contar ? { count: totalSemFaixa } : {}) }
  }

  then<R1 = Resposta, R2 = never>(
    aoResolver?: ((v: Resposta) => R1 | PromiseLike<R1>) | null,
    aoRejeitar?: ((m: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const chave =
      'tabela' in this.origem
        ? `from:${this.origem.tabela}:${this.operacao}`
        : `rpc:${this.origem.rotulo}`
    const espera = this.banco.atrasos.get(chave) ?? 0
    const promessa = new Promise<Resposta>((resolver) => {
      if (espera > 0) setTimeout(() => resolver(this.executar()), espera)
      else queueMicrotask(() => resolver(this.executar()))
    })
    return promessa.then(aoResolver, aoRejeitar)
  }
}

// ---------------------------------------------------------------------------------------------
// O banco
// ---------------------------------------------------------------------------------------------
export class BancoFalso {
  tabelas!: Record<NomeTabela, Linha[]>
  falhas = new Map<string, ErroFalso>()
  atrasos = new Map<string, number>()
  usuarios: UsuarioFalso[] = []
  sessao: { user: { id: string; email: string; identities: unknown[] }; access_token: string } | null = null
  private ouvintes = new Set<(evento: string, sessao: unknown) => void>()
  /** Chamadas feitas, para conferir o que a tela enviou ao servidor */
  chamadas: { rpc: string; args: Linha }[] = []
  autenticacao = {
    resetEnviados: [] as string[],
    senhasAlteradas: [] as string[],
    cadastros: [] as { nome: string; email: string }[],
  }
  /** Usuário logado (perfil) quando a sessão existe */
  private proximoCodigo = 1

  constructor() {
    this.reiniciar()
  }

  reiniciar(): void {
    this.tabelas = {
      galpoes: [],
      clientes: [],
      itens_guardados: [],
      tipos_item: [],
      precos_galpao: [],
      profiles: [],
      galpao_membros: [],
      pagamentos: [],
      recibos: [],
      auditoria: [],
    }
    this.falhas.clear()
    this.atrasos.clear()
    this.usuarios = []
    this.sessao = null
    this.ouvintes.clear()
    this.chamadas = []
    this.autenticacao = { resetEnviados: [], senhasAlteradas: [], cadastros: [] }
    this.proximoCodigo = 1
    contadorId = 0
  }

  /** Faz a próxima operação dar erro. Chaves: "from:clientes:insert", "rpc:listar_pagamentos"... */
  falhar(chave: string, mensagem = 'Falha simulada', extra: Partial<ErroFalso> = {}): void {
    this.falhas.set(chave, { message: mensagem, ...extra })
  }
  atrasar(chave: string, ms: number): void {
    this.atrasos.set(chave, ms)
  }

  // ---- autenticação ----
  cadastrarUsuario(u: UsuarioFalso): void {
    this.usuarios.push(u)
  }
  emitir(evento: string): void {
    for (const o of this.ouvintes) o(evento, this.sessao)
  }
  entrarComo(id: string): void {
    const u = this.usuarios.find((x) => x.id === id)
    if (!u) throw new Error(`usuário ${id} não cadastrado no banco falso`)
    this.sessao = { user: { id: u.id, email: u.email, identities: [{}] }, access_token: 'token' }
  }

  auth = {
    getSession: async () => ({ data: { session: this.sessao }, error: null }),
    onAuthStateChange: (cb: (evento: string, sessao: unknown) => void) => {
      this.ouvintes.add(cb)
      return { data: { subscription: { unsubscribe: () => this.ouvintes.delete(cb) } } }
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const espera = this.atrasos.get('auth:signIn')
      if (espera) await new Promise((r) => setTimeout(r, espera))
      const falha = this.falhas.get('auth:signIn')
      if (falha) return { data: null, error: falha }
      const u = this.usuarios.find((x) => x.email === email && x.senha === password)
      if (!u) return { data: null, error: { message: 'Invalid login credentials', status: 400 } }
      const jaLogado = this.sessao?.user.id === u.id
      this.entrarComo(u.id)
      if (!jaLogado) this.emitir('SIGNED_IN')
      return { data: { session: this.sessao }, error: null }
    },
    signUp: async ({ email, options }: { email: string; password: string; options?: { data?: { nome?: string } } }) => {
      const falha = this.falhas.get('auth:signUp')
      if (falha) return { data: { user: null, session: null }, error: falha }
      this.autenticacao.cadastros.push({ nome: options?.data?.nome ?? '', email })
      const existente = this.usuarios.some((x) => x.email === email)
      return {
        data: {
          user: { id: novoId('usr'), email, identities: existente ? [] : [{}] },
          session: null,
        },
        error: null,
      }
    },
    resetPasswordForEmail: async (email: string) => {
      const falha = this.falhas.get('auth:reset')
      if (falha) return { data: null, error: falha }
      this.autenticacao.resetEnviados.push(email)
      return { data: {}, error: null }
    },
    updateUser: async ({ password }: { password: string }) => {
      const falha = this.falhas.get('auth:updateUser')
      if (falha) return { data: null, error: falha }
      this.autenticacao.senhasAlteradas.push(password)
      return { data: {}, error: null }
    },
    signOut: async () => {
      this.sessao = null
      this.emitir('SIGNED_OUT')
      return { error: null }
    },
  }

  storage = {
    from: () => ({
      upload: async () => ({ data: {}, error: null }),
      getPublicUrl: (caminho: string) => ({ data: { publicUrl: `https://falso.local/${caminho}` } }),
      remove: async () => ({ data: [], error: null }),
    }),
  }

  from(tabela: NomeTabela): Consulta {
    return new Consulta(this, { tabela })
  }

  rpc(nome: string, args: Linha = {}): Consulta {
    this.chamadas.push({ rpc: nome, args })
    return new Consulta(this, { fonte: () => this.executarRpc(nome, args), rotulo: nome })
  }

  // ---- auxiliares de leitura ----
  private nomeDe(profileId: string | null): string | null {
    if (!profileId) return null
    return this.tabelas.profiles.find((p) => p.id === profileId)?.nome ?? null
  }
  private reciboDe(pagamentoId: string): Linha | undefined {
    return this.tabelas.recibos.find((r) => r.pagamento_id === pagamentoId)
  }
  usuarioAtual(): string | null {
    return this.sessao?.user.id ?? null
  }
  /** O usuário logado pode ver este galpão? (super usuário vê todos; os demais, só os liberados) */
  podeVer(galpaoId: string | null): boolean {
    const id = this.usuarioAtual()
    if (!id) return false
    if (this.tabelas.profiles.find((p) => p.id === id)?.is_super) return true
    return this.tabelas.galpao_membros.some((m) => m.profile_id === id && m.galpao_id === galpaoId)
  }

  private pagamentoComRecibo(p: Linha): Linha {
    const r = this.reciboDe(p.id)
    return { ...p, recibo_numero: r?.numero ?? null, recibo_codigo: r?.codigo ?? null }
  }

  private linhaPagamento(p: Linha): Linha {
    const c = this.tabelas.clientes.find((x) => x.id === p.cliente_id)
    return {
      ...this.pagamentoComRecibo(p),
      cliente_nome: c?.nome ?? '',
      cliente_whatsapp: c?.whatsapp ?? null,
      recebido_por_nome: this.nomeDe(p.criado_por ?? null),
      cancelado_por_nome: this.nomeDe(p.cancelado_por ?? null),
    }
  }

  // ---- funções do banco ----
  private executarRpc(nome: string, a: Linha): unknown {
    const galpaoDaChamada = a.p_galpao ?? a.p_galpao_id
    if (galpaoDaChamada && nome !== 'verificar_recibo' && !this.podeVer(galpaoDaChamada)) {
      if (nome === 'registrar_pagamento') throw Object.assign(new Error('Sem acesso a este galpão.'), { code: 'P0001' })
      if (nome === 'pagamentos_recentes') return []
      if (nome === 'listar_pagamentos') return { total: 0, itens: [] }
    }
    switch (nome) {
      case 'pagamentos_recentes':
        return this.tabelas.pagamentos
          .filter((p) => p.galpao_id === a.p_galpao && p.data_pagamento >= a.p_desde)
          .sort((x, y) => (x.created_at < y.created_at ? 1 : -1))
          .map((p) => this.pagamentoComRecibo(p))
      case 'listar_pagamentos':
        return this.listarPagamentos(a)
      case 'registrar_pagamento':
        return this.registrarPagamento(a)
      case 'cancelar_pagamento':
        return this.cancelarPagamento(a)
      case 'relatorio_resumo':
        return this.relatorioResumo(a)
      case 'fechamento_dia':
        return this.fechamentoDia(a)
      case 'verificar_recibo':
        return this.verificarRecibo(a)
      case 'listar_auditoria':
        return this.listarAuditoria(a)
      default:
        throw Object.assign(new Error(`rpc ${nome} não existe no banco falso`), { code: 'PGRST202' })
    }
  }

  private listarPagamentos(a: Linha): Linha {
    const busca = a.p_busca ? normalizar(String(a.p_busca)) : null
    const codigoBusca = busca ? busca.replace(/[^0-9a-f]/g, '').toUpperCase() : ''
    let linhas = this.tabelas.pagamentos
      .filter((p) => p.galpao_id === a.p_galpao)
      .map((p) => this.linhaPagamento(p))
    if (busca) {
      linhas = linhas.filter(
        (l) =>
          normalizar(l.cliente_nome).includes(busca) ||
          (l.recibo_numero !== null && String(l.recibo_numero).includes(busca)) ||
          (codigoBusca.length >= 4 && String(l.recibo_codigo ?? '').includes(codigoBusca)),
      )
    }
    if (a.p_formas) linhas = linhas.filter((l) => a.p_formas.includes(l.forma_pagamento))
    if (a.p_status) linhas = linhas.filter((l) => a.p_status.includes(l.status))
    if (a.p_de) linhas = linhas.filter((l) => l.data_pagamento >= a.p_de)
    if (a.p_ate) linhas = linhas.filter((l) => l.data_pagamento <= a.p_ate)
    linhas.sort((x, y) => {
      if (a.p_por_recibo) {
        const d = (y.recibo_numero ?? -1) - (x.recibo_numero ?? -1)
        if (d !== 0) return d
      }
      return x.created_at < y.created_at ? 1 : x.created_at > y.created_at ? -1 : 0
    })
    const limite = Math.min(Math.max(a.p_limite ?? 25, 1), 100)
    const desloc = Math.max(a.p_deslocamento ?? 0, 0)
    return { total: linhas.length, itens: linhas.slice(desloc, desloc + limite) }
  }

  private registrarPagamento(a: Linha): Linha {
    const erro = (m: string) => Object.assign(new Error(m), { code: 'P0001' })
    const usuario = this.usuarioAtual()
    if (!usuario) throw erro('Sessão expirada. Entre novamente.')
    const cliente = this.tabelas.clientes.find((c) => c.id === a.p_cliente_id && c.galpao_id === a.p_galpao_id)
    if (!cliente) throw erro('Cliente não encontrado neste galpão.')
    if (!cliente.ativo) throw erro('Cliente inativo.')
    if (!(Number(a.p_valor) > 0)) throw erro('Informe um valor maior que zero.')
    if (!['dinheiro', 'pix', 'cartao'].includes(a.p_forma)) throw erro('Forma de pagamento inválida.')
    if (!a.p_semana) throw erro('Informe a semana de referência.')
    if (a.p_observacoes && String(a.p_observacoes).length > 500) throw erro('Observações muito longas (máx. 500 caracteres).')
    const repetido = this.tabelas.pagamentos.some(
      (p) => p.cliente_id === a.p_cliente_id && p.semana_referencia === a.p_semana && p.status !== 'cancelado',
    )
    if (repetido) throw erro('Esta cobrança já foi paga.')

    const itens = this.tabelas.itens_guardados
      .filter((i) => i.cliente_id === cliente.id && i.ativo)
      .map((i) => {
        const tipo = this.tabelas.tipos_item.find((t) => t.id === i.tipo_item_id)
        const nomeTipo = tipo?.nome ?? 'Item'
        return `${i.quantidade > 1 ? `${i.quantidade}x ` : ''}${nomeTipo}`
      })
    const pagamento: Linha = {
      id: novoId('pag'),
      galpao_id: a.p_galpao_id,
      cliente_id: a.p_cliente_id,
      valor: Number(a.p_valor),
      data_pagamento: dataISO(new Date()),
      semana_referencia: a.p_semana,
      forma_pagamento: a.p_forma,
      status: 'pago',
      observacoes: a.p_observacoes ?? null,
      criado_por: usuario,
      cancelado_em: null,
      cancelado_por: null,
      motivo_cancelamento: null,
      descricao: itens.length > 0 ? itens.join(', ') : null,
      created_at: agoraISO(),
    }
    this.tabelas.pagamentos.push(pagamento)
    const numero =
      Math.max(0, ...this.tabelas.recibos.filter((r) => r.galpao_id === a.p_galpao_id).map((r) => r.numero)) + 1
    const recibo: Linha = {
      id: novoId('rec'),
      galpao_id: a.p_galpao_id,
      pagamento_id: pagamento.id,
      numero,
      codigo: `A3F927C15DE0${(this.proximoCodigo++).toString(16).toUpperCase().padStart(4, '0')}`,
      pdf_url: null,
      enviado_whatsapp: false,
      created_at: agoraISO(),
    }
    this.tabelas.recibos.push(recibo)
    this.registrarAuditoria('pagamento.registrado', 'pagamento', `Pagamento registrado: ${cliente.nome}`, a.p_galpao_id)
    return { pagamento: { ...pagamento }, recibo: { ...recibo } }
  }

  private cancelarPagamento(a: Linha): Linha {
    const erro = (m: string) => Object.assign(new Error(m), { code: 'P0001' })
    const usuario = this.usuarioAtual()
    if (!usuario) throw erro('Sessão expirada. Entre novamente.')
    const motivo = String(a.p_motivo ?? '').trim()
    if (motivo.length < 3) throw erro('Informe o motivo do cancelamento (mínimo 3 caracteres).')
    if (motivo.length > 500) throw erro('Motivo muito longo (máx. 500 caracteres).')
    const pagamento = this.tabelas.pagamentos.find((p) => p.id === a.p_pagamento_id)
    if (!pagamento) throw erro('Pagamento não encontrado.')
    if (pagamento.status === 'cancelado') throw erro('Este pagamento já foi cancelado.')
    Object.assign(pagamento, {
      status: 'cancelado',
      cancelado_em: agoraISO(),
      cancelado_por: usuario,
      motivo_cancelamento: motivo,
    })
    this.registrarAuditoria('pagamento.cancelado', 'pagamento', 'Pagamento cancelado', pagamento.galpao_id)
    return { ...pagamento }
  }

  private registrarAuditoria(acao: string, entidade: string, resumo: string, galpaoId: string): void {
    this.tabelas.auditoria.push({
      id: novoId('aud'),
      created_at: agoraISO(),
      usuario_nome: this.nomeDe(this.usuarioAtual()),
      galpao_nome: this.tabelas.galpoes.find((g) => g.id === galpaoId)?.nome ?? null,
      acao,
      entidade,
      resumo,
      detalhes: null,
    })
  }

  private relatorioResumo(a: Linha): Linha {
    const validos = this.tabelas.pagamentos.filter((p) => p.galpao_id === a.p_galpao && p.status !== 'cancelado')
    const soma = (ls: Linha[]) => ls.reduce((t, p) => t + Number(p.valor), 0)
    const doPeriodo = validos.filter((p) => p.data_pagamento >= a.p_de && p.data_pagamento <= a.p_ate)
    const porForma = new Map<string, number>()
    const porDia = new Map<string, number>()
    for (const p of doPeriodo) {
      porForma.set(p.forma_pagamento, (porForma.get(p.forma_pagamento) ?? 0) + Number(p.valor))
      porDia.set(p.data_pagamento, (porDia.get(p.data_pagamento) ?? 0) + Number(p.valor))
    }
    return {
      total_geral: soma(validos),
      total_periodo: soma(doPeriodo),
      quantidade_periodo: doPeriodo.length,
      total_hoje: soma(validos.filter((p) => p.data_pagamento === a.p_hoje)),
      por_forma: [...porForma].map(([forma, total]) => ({ forma, total })),
      // como no banco: do dia mais recente para o mais antigo, no máximo 31 dias
      por_dia: [...porDia]
        .sort(([x], [y]) => (x < y ? 1 : -1))
        .slice(0, 31)
        .map(([data, total]) => ({ data, total })),
    }
  }

  private fechamentoDia(a: Linha): Linha {
    const dia = this.tabelas.pagamentos
      .filter((p) => p.galpao_id === a.p_galpao && p.data_pagamento === a.p_data)
      .sort((x, y) => (x.created_at < y.created_at ? -1 : 1))
    const validos = dia.filter((p) => p.status !== 'cancelado')
    const soma = (ls: Linha[]) => ls.reduce((t, p) => t + Number(p.valor), 0)
    const formas = new Map<string, Linha>()
    for (const p of validos) {
      const f = formas.get(p.forma_pagamento) ?? { forma: p.forma_pagamento, total: 0, quantidade: 0 }
      f.total += Number(p.valor)
      f.quantidade += 1
      formas.set(p.forma_pagamento, f)
    }
    const usuarios = new Map<string | null, Linha>()
    for (const p of validos) {
      const chave = p.criado_por ?? null
      const u = usuarios.get(chave) ?? {
        usuario_id: chave,
        nome: this.nomeDe(chave) ?? 'Não informado',
        total: 0,
        quantidade: 0,
        dinheiro: 0,
        pix: 0,
        cartao: 0,
      }
      u.total += Number(p.valor)
      u.quantidade += 1
      u[p.forma_pagamento] += Number(p.valor)
      usuarios.set(chave, u)
    }
    return {
      data: a.p_data,
      total: soma(validos),
      quantidade: validos.length,
      cancelados: {
        quantidade: dia.length - validos.length,
        total: soma(dia.filter((p) => p.status === 'cancelado')),
      },
      por_forma: [...formas.values()].sort((x, y) => y.total - x.total),
      por_usuario: [...usuarios.values()].sort((x, y) => y.total - x.total),
      pagamentos: dia.slice(0, 500).map((p) => ({
        id: p.id,
        hora: p.created_at,
        cliente: this.tabelas.clientes.find((c) => c.id === p.cliente_id)?.nome ?? '',
        valor: Number(p.valor),
        forma: p.forma_pagamento,
        status: p.status,
        recibo: this.reciboDe(p.id)?.numero ?? null,
        descricao: p.descricao,
        recebido_por: this.nomeDe(p.criado_por ?? null),
      })),
      truncado: dia.length > 500,
    }
  }

  private verificarRecibo(a: Linha): Linha | null {
    const codigo = String(a.p_codigo ?? '').replace(/[^0-9a-fA-F]/g, '').toUpperCase()
    const r = this.tabelas.recibos.find((x) => x.codigo === codigo)
    if (!r) return null
    const p = this.tabelas.pagamentos.find((x) => x.id === r.pagamento_id) as Linha
    const c = this.tabelas.clientes.find((x) => x.id === p.cliente_id)
    return {
      numero: r.numero,
      codigo: r.codigo,
      galpao: this.tabelas.galpoes.find((g) => g.id === r.galpao_id)?.nome ?? '',
      cliente: abreviarNome(c?.nome ?? ''),
      valor: Number(p.valor),
      data: p.data_pagamento,
      referente: p.semana_referencia,
      forma: p.forma_pagamento,
      situacao: p.status === 'cancelado' ? 'cancelado' : 'valido',
      cancelado_em: p.cancelado_em,
    }
  }

  private listarAuditoria(a: Linha): Linha {
    const perfil = this.tabelas.profiles.find((p) => p.id === this.usuarioAtual())
    if (!perfil?.is_super) return { total: 0, itens: [] }
    const busca = a.p_busca ? normalizar(String(a.p_busca)) : null
    let linhas = [...this.tabelas.auditoria]
    if (busca) linhas = linhas.filter((l) => normalizar(`${l.resumo} ${l.usuario_nome ?? ''}`).includes(busca))
    if (a.p_acoes) linhas = linhas.filter((l) => a.p_acoes.includes(l.acao))
    if (a.p_de) linhas = linhas.filter((l) => String(l.created_at).slice(0, 10) >= a.p_de)
    if (a.p_ate) linhas = linhas.filter((l) => String(l.created_at).slice(0, 10) <= a.p_ate)
    linhas.sort((x, y) => (x.created_at < y.created_at ? 1 : -1))
    const limite = a.p_limite ?? 25
    const desloc = a.p_deslocamento ?? 0
    return { total: linhas.length, itens: linhas.slice(desloc, desloc + limite) }
  }
}

export const bancoFalso = new BancoFalso()

/** O que `@/lib/supabase` passa a exportar durante os testes. */
export function moduloSupabaseFalso() {
  return {
    supabase: {
      from: (tabela: NomeTabela) => bancoFalso.from(tabela),
      rpc: (nome: string, args?: Linha) => bancoFalso.rpc(nome, args),
      auth: bancoFalso.auth,
      storage: bancoFalso.storage,
    },
  }
}
