-- ============================================================
-- MeuGalpão — 0005_precos_galpao.sql
-- Tabela de preços específicos por galpão (override do preço global).
-- ============================================================

create table if not exists public.precos_galpao (
  id uuid primary key default gen_random_uuid(),
  galpao_id uuid not null references public.galpoes (id) on delete cascade,
  tipo_item_id uuid not null references public.tipos_item (id) on delete cascade,
  preco_semanal numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  constraint precos_galpao_unico unique (galpao_id, tipo_item_id)
);

create index if not exists idx_precos_galpao on public.precos_galpao (galpao_id);

alter table public.precos_galpao enable row level security;

drop policy if exists "precos_select" on public.precos_galpao;
create policy "precos_select" on public.precos_galpao
  for select using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "precos_insert" on public.precos_galpao;
create policy "precos_insert" on public.precos_galpao
  for insert with check (public.pode_acessar_galpao(galpao_id));

drop policy if exists "precos_update" on public.precos_galpao;
create policy "precos_update" on public.precos_galpao
  for update using (public.pode_acessar_galpao(galpao_id));

drop policy if exists "precos_delete" on public.precos_galpao;
create policy "precos_delete" on public.precos_galpao
  for delete using (public.pode_acessar_galpao(galpao_id));

grant all on table public.precos_galpao to anon, authenticated, service_role;
