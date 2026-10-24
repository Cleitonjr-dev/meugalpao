-- ============================================================
-- MeuGalpão — 0006_integridade_indices.sql
-- Integridade (impede pagamento duplicado) + índices de consulta.
-- ============================================================

-- 1) ESSENCIAL: um cliente só pode pagar uma vez cada semana de referência.
create unique index if not exists pagamentos_cliente_semana_unico
  on public.pagamentos (cliente_id, semana_referencia);

-- 2) OPCIONAL: índices para consultas por galpão (desempenho).
create index if not exists idx_itens_galpao
  on public.itens_guardados (galpao_id);

create index if not exists idx_recibos_galpao
  on public.recibos (galpao_id);
