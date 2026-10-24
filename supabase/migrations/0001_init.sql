-- ============================================================
-- MeuGalpão — 0001_init.sql (schema)
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Tabelas
-- ------------------------------------------------------------

create table if not exists public.galpoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  endereco text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  is_dono boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.galpao_membros (
  id uuid primary key default gen_random_uuid(),
  galpao_id uuid not null references public.galpoes (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint galpao_membros_unico unique (galpao_id, profile_id)
);

-- galpao_id NULL = tipo global (visível em todos os galpões)
create table if not exists public.tipos_item (
  id uuid primary key default gen_random_uuid(),
  galpao_id uuid references public.galpoes (id) on delete cascade,
  nome text not null,
  preco_semanal numeric(10, 2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  galpao_id uuid not null references public.galpoes (id) on delete cascade,
  nome text not null,
  telefone text,
  whatsapp text,
  dia_pagamento text not null default 'quarta' check (dia_pagamento in ('quarta', 'sabado')),
  observacoes text,
  ativo boolean not null default true,
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.itens_guardados (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  galpao_id uuid not null references public.galpoes (id) on delete cascade,
  tipo_item_id uuid references public.tipos_item (id) on delete set null,
  identificacao text,
  quantidade integer not null default 1 check (quantidade > 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  galpao_id uuid not null references public.galpoes (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  valor numeric(10, 2) not null default 0,
  data_pagamento date not null default current_date,
  semana_referencia date,
  forma_pagamento text not null default 'dinheiro' check (forma_pagamento in ('dinheiro', 'pix', 'cartao')),
  status text not null default 'pago',
  observacoes text,
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.recibos (
  id uuid primary key default gen_random_uuid(),
  galpao_id uuid not null references public.galpoes (id) on delete cascade,
  pagamento_id uuid not null references public.pagamentos (id) on delete cascade,
  numero integer not null,
  pdf_url text,
  enviado_whatsapp boolean not null default false,
  created_at timestamptz not null default now(),
  constraint recibos_pagamento_unico unique (pagamento_id)
);

-- Numeração sequencial de recibo por galpão
create table if not exists public.recibo_sequences (
  galpao_id uuid primary key references public.galpoes (id) on delete cascade,
  last_value integer not null default 0
);

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
create index if not exists idx_clientes_galpao on public.clientes (galpao_id);
create index if not exists idx_pagamentos_galpao on public.pagamentos (galpao_id);
create index if not exists idx_pagamentos_data on public.pagamentos (data_pagamento);
create index if not exists idx_itens_cliente on public.itens_guardados (cliente_id);
create index if not exists idx_membros_profile on public.galpao_membros (profile_id);
create index if not exists idx_membros_galpao on public.galpao_membros (galpao_id);

-- ------------------------------------------------------------
-- Funções auxiliares (isolamento por galpão)
-- ------------------------------------------------------------

create or replace function public.auth_galpao_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select galpao_id from public.galpao_membros where profile_id = auth.uid();
$$;

create or replace function public.is_dono()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_dono = true);
$$;

create or replace function public.pode_acessar_galpao(g uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_dono() or g in (select public.auth_galpao_ids());
$$;

-- ------------------------------------------------------------
-- Trigger: cria profile automaticamente ao cadastrar usuário
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, is_dono)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
