import { supabase } from '@/lib/supabase'
import type { PaginaAuditoria } from '@/types'

export const TAMANHO_PAGINA_AUDITORIA = 25

export interface ParametrosAuditoria {
  busca: string
  acoes: string[]
  /** AAAA-MM-DD */
  de: string | null
  ate: string | null
  pagina: number
}

/** Uma página do histórico, filtrada e ordenada no banco (só o super usuário recebe linhas). */
export async function listarAuditoria(p: ParametrosAuditoria): Promise<PaginaAuditoria> {
  const { data, error } = await supabase.rpc('listar_auditoria', {
    p_busca: p.busca || null,
    p_acoes: p.acoes.length > 0 ? p.acoes : null,
    p_de: p.de,
    p_ate: p.ate,
    p_limite: TAMANHO_PAGINA_AUDITORIA,
    p_deslocamento: (p.pagina - 1) * TAMANHO_PAGINA_AUDITORIA,
  })
  if (error) throw new Error(error.message)
  return data as PaginaAuditoria
}
