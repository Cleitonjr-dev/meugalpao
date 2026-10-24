export type TomAcao = 'sucesso' | 'perigo' | 'aviso' | 'neutro'

interface InfoAcao {
  rotulo: string
  tom: TomAcao
}

/** Nome legível de cada tipo de registro do histórico, e a cor da etiqueta na tela. */
export const ACOES: Record<string, InfoAcao> = {
  'pagamento.registrado': { rotulo: 'Pagamento registrado', tom: 'sucesso' },
  'pagamento.cancelado': { rotulo: 'Pagamento cancelado', tom: 'perigo' },
  'pagamento.excluido': { rotulo: 'Pagamento excluído do banco', tom: 'perigo' },
  'recibo.excluido': { rotulo: 'Recibo excluído do banco', tom: 'perigo' },
  'cliente.criado': { rotulo: 'Cliente criado', tom: 'sucesso' },
  'cliente.alterado': { rotulo: 'Cliente alterado', tom: 'neutro' },
  'cliente.excluido': { rotulo: 'Cliente excluído', tom: 'perigo' },
  'item.adicionado': { rotulo: 'Item adicionado', tom: 'sucesso' },
  'item.alterado': { rotulo: 'Item alterado', tom: 'neutro' },
  'item.removido': { rotulo: 'Item removido', tom: 'aviso' },
  'tipo.criado': { rotulo: 'Tipo criado', tom: 'sucesso' },
  'tipo.alterado': { rotulo: 'Tipo alterado', tom: 'neutro' },
  'tipo.excluido': { rotulo: 'Tipo excluído', tom: 'perigo' },
  'preco.definido': { rotulo: 'Preço definido', tom: 'sucesso' },
  'preco.alterado': { rotulo: 'Preço alterado', tom: 'aviso' },
  'preco.removido': { rotulo: 'Preço removido', tom: 'aviso' },
  'galpao.criado': { rotulo: 'Galpão criado', tom: 'sucesso' },
  'galpao.alterado': { rotulo: 'Galpão alterado', tom: 'neutro' },
  'galpao.excluido': { rotulo: 'Galpão excluído', tom: 'perigo' },
  'acesso.liberado': { rotulo: 'Acesso liberado', tom: 'sucesso' },
  'acesso.removido': { rotulo: 'Acesso removido', tom: 'aviso' },
  'usuario.criado': { rotulo: 'Conta criada', tom: 'neutro' },
  'usuario.super_alterado': { rotulo: 'Permissão alterada', tom: 'aviso' },
}

export function rotuloAcao(acao: string): string {
  return ACOES[acao]?.rotulo ?? acao
}

export function tomAcao(acao: string): TomAcao {
  return ACOES[acao]?.tom ?? 'neutro'
}

/** Todas as ações em ordem alfabética do nome, para o filtro da tela. */
export function opcoesDeAcao(): { value: string; label: string }[] {
  return Object.entries(ACOES)
    .map(([value, info]) => ({ value, label: info.rotulo }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
}
