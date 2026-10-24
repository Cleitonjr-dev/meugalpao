-- ============================================================
-- MeuGalpão — 0002_rls.sql (segurança em nível de linha)
-- ============================================================

-- ------------------------------------------------------------
-- Habilita RLS em todas as tabelas
-- ------------------------------------------------------------
alter table public.galpoes enable row level security;
alter table public.profiles enable row level security;
alter table public.galpao_membros enable row level security;
alter table public.tipos_item enable row level security;
alter table public.clientes enable row level security;
alter table public.itens_guardados enable row level security;
alter table public.pagamentos enable row level security;
alter table public.recibos enable row level security;
alter table public.recibo_sequences enable row level security;

-- ------------------------------------------------------------
-- profiles: cada um vê/edita o próprio; dono vê todos
-- ------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.is_dono());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid() or public.is_dono());

-- ------------------------------------------------------------
-- galpoes: dono gerencia; membro só vê os seus
-- ------------------------------------------------------------
drop policy if exists "galpoes_select" on public.galpoes;
create policy "galpoes_select" on public.galpoes
  for select using (public.pode_acessar_galpao(id));

drop policy if exists "galpoes_insert" on public.galpoes;
create policy "galpoes_insert" on public.galpoes
  for insert with check (public.is_dono());

drop policy if exists "galpoes_update" on public.galpoes;
create policy "galpoes_update" on public.galpoes
  for update using (public.is_dono());

drop policy if exists "galpoes_delete" on public.galpoes;
create policy "galpoes_delete" on public.galpoes
  for delete using (public.is_dono());

-- ------------------------------------------------------------
-- galpao_membros: dono gerencia; membro vê as próprias ligações
-- ------------------------------------------------------------
drop policy if exists "membros_select" on public.galpao_membros;
create policy "membros_select" on public.galpao_membros
  for select using (public.is_dono() or profile_id = auth.uid());

drop policy if exists "membros_insert" on public.galpao_membros;
create policy "membros_insert" on public.galpao_membros
  for insert with check (public.is_dono());

drop policy if exists "membros_update" on public.galpao_membros;
create policy "membros_update" on public.galpao_membros
  for update using (public.is_dono());

drop policy if exists "membros_delete" on public.galpao_membros;
create policy "membros_delete" on public.galpao_membros
  for delete using (public.is_dono());

-- ------------------------------------------------------------
-- tipos_item: globais visíveis a todos; por galpão, só com acesso
-- ------------------------------------------------------------
drop policy if exists "tipos_select" on public.tipos_item;
create policy "tipos_select" on public.tipos_item
  for select using (
    galpao_id is null or public.pode_acessar_galpao(galpao_id)
  );

drop policy if exists "tipos_insert" on public.tipos_item;
create policy "tipos_insert" on public.tipos_item
  for insert with check (
    public.is_dono() or (galpao_id is not null and public.pode_acessar_galpao(galpao_id))
  );

drop policy if exists "tipos_update" on public.tipos_item;
create policy "tipos_update" on public.tipos_item
  for update using (
    public.is_dono() or (galpao_id is not null and public.pode_acessar_galpao(galpao_id))
  );

drop policy if exists "tipos_delete" on public.tipos_item;
create policy "tipos_delete" on public.tipos_item
  for delete using (
    public.is_dono() or (galpao_id is not null and public.pode_acessar_galpao(galpao_id))
  );

-- ------------------------------------------------------------
-- clientes / itens_guardados / pagamentos / recibos:
-- acesso total apenas dentro dos galpões liberados
-- ------------------------------------------------------------
drop policy if exists "clientes_select" on public.clientes;
create policy "clientes_select" on public.clientes
  for select using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "clientes_insert" on public.clientes;
create policy "clientes_insert" on public.clientes
  for insert with check (public.pode_acessar_galpao(galpao_id));

drop policy if exists "clientes_update" on public.clientes;
create policy "clientes_update" on public.clientes
  for update using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "clientes_delete" on public.clientes;
create policy "clientes_delete" on public.clientes
  for delete using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "itens_select" on public.itens_guardados;
create policy "itens_select" on public.itens_guardados
  for select using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "itens_insert" on public.itens_guardados;
create policy "itens_insert" on public.itens_guardados
  for insert with check (public.pode_acessar_galpao(galpao_id));

drop policy if exists "itens_update" on public.itens_guardados;
create policy "itens_update" on public.itens_guardados
  for update using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "itens_delete" on public.itens_guardados;
create policy "itens_delete" on public.itens_guardados
  for delete using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "pagamentos_select" on public.pagamentos;
create policy "pagamentos_select" on public.pagamentos
  for select using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "pagamentos_insert" on public.pagamentos;
create policy "pagamentos_insert" on public.pagamentos
  for insert with check (public.pode_acessar_galpao(galpao_id));

drop policy if exists "pagamentos_update" on public.pagamentos;
create policy "pagamentos_update" on public.pagamentos
  for update using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "pagamentos_delete" on public.pagamentos;
create policy "pagamentos_delete" on public.pagamentos
  for delete using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "recibos_select" on public.recibos;
create policy "recibos_select" on public.recibos
  for select using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "recibos_insert" on public.recibos;
create policy "recibos_insert" on public.recibos
  for insert with check (public.pode_acessar_galpao(galpao_id));

drop policy if exists "recibos_update" on public.recibos;
create policy "recibos_update" on public.recibos
  for update using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "recibos_delete" on public.recibos;
create policy "recibos_delete" on public.recibos
  for delete using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "recibo_sequences_select" on public.recibo_sequences;
create policy "recibo_sequences_select" on public.recibo_sequences
  for select using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "recibo_sequences_insert" on public.recibo_sequences;
create policy "recibo_sequences_insert" on public.recibo_sequences
  for insert with check (public.pode_acessar_galpao(galpao_id));

drop policy if exists "recibo_sequences_update" on public.recibo_sequences;
create policy "recibo_sequences_update" on public.recibo_sequences
  for update using (public.pode_acessar_galpao(galpao_id));

-- ------------------------------------------------------------
-- Privilégios (equivalente ao "expor tabelas automaticamente")
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
