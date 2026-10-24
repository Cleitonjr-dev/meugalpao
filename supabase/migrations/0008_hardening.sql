-- ============================================================
-- MeuGalpão — 0008_hardening.sql
-- Correções de segurança e integridade (rode DEPOIS do 0007).
--
--  1) Impede escalada de privilégio em profiles (is_super)
--  2) Fotos de perfil: cada usuário só mexe na própria pasta
--  3) Integridade: constraints, FKs compostas, status do pagamento
--  4) Pagamento + recibo viram operações atômicas (funções RPC)
--  5) Histórico financeiro protegido (sem insert/update/delete direto)
--  6) Policies mais rápidas e índices
--
-- IMPORTANTE: o front antigo deixa de conseguir registrar pagamentos
-- depois desta migração. Publique o front novo junto.
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles: ninguém promove a si mesmo a super usuário
-- ------------------------------------------------------------
create or replace function public.proteger_colunas_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Triggers internos (cadastro) e SQL Editor não têm usuário JWT.
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'Não é permitido alterar o id do perfil.';
  end if;

  if (new.is_super is distinct from old.is_super
      or new.email is distinct from old.email)
     and not public.is_super() then
    raise exception 'Apenas super usuários podem alterar permissões.';
  end if;

  if old.is_super and not new.is_super
     and not exists (
       select 1 from public.profiles p where p.is_super and p.id <> old.id
     ) then
    raise exception 'Não é possível remover o último super usuário.';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_colunas_profile on public.profiles;
create trigger proteger_colunas_profile
  before update on public.profiles
  for each row execute function public.proteger_colunas_profile();

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update
  using (id = auth.uid() or (select public.is_super()))
  with check (id = auth.uid() or (select public.is_super()));

-- ------------------------------------------------------------
-- 2. Storage (avatars): só o dono mexe na própria pasta <uid>/...
-- ------------------------------------------------------------
drop policy if exists "avatars_auth_insert" on storage.objects;
drop policy if exists "avatars_auth_update" on storage.objects;
drop policy if exists "avatars_auth_delete" on storage.objects;
drop policy if exists "avatars_owner_insert" on storage.objects;
drop policy if exists "avatars_owner_update" on storage.objects;
drop policy if exists "avatars_owner_delete" on storage.objects;

create policy "avatars_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Limite de 2 MB e só imagens raster (sem SVG).
update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'avatars';

-- ------------------------------------------------------------
-- 3. Integridade
-- ------------------------------------------------------------
alter table public.pagamentos
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_por uuid references public.profiles (id) on delete set null,
  add column if not exists motivo_cancelamento text;

alter table public.pagamentos drop constraint if exists pagamentos_status_check;
alter table public.pagamentos
  add constraint pagamentos_status_check check (status in ('pago', 'cancelado'));

alter table public.pagamentos drop constraint if exists pagamentos_valor_check;
alter table public.pagamentos
  add constraint pagamentos_valor_check check (valor >= 0);

alter table public.tipos_item drop constraint if exists tipos_item_preco_check;
alter table public.tipos_item
  add constraint tipos_item_preco_check check (preco_semanal >= 0);

alter table public.precos_galpao drop constraint if exists precos_galpao_preco_check;
alter table public.precos_galpao
  add constraint precos_galpao_preco_check check (preco_semanal >= 0);

-- Uma cobrança paga por cliente/semana. Pagamentos cancelados liberam a semana.
drop index if exists public.pagamentos_cliente_semana_unico;
create unique index if not exists pagamentos_cliente_semana_ativo
  on public.pagamentos (cliente_id, semana_referencia)
  where status = 'pago';

-- semana_referencia obrigatória (só aplica se não houver linhas antigas sem ela)
do $$
begin
  if exists (select 1 from public.pagamentos where semana_referencia is null) then
    raise notice 'Existem pagamentos sem semana_referencia; coluna NÃO foi marcada como NOT NULL. Corrija-os e rode: alter table public.pagamentos alter column semana_referencia set not null;';
  else
    alter table public.pagamentos alter column semana_referencia set not null;
  end if;
end $$;

-- Número de recibo único por galpão (só aplica se não houver duplicados)
do $$
begin
  if exists (
    select 1 from public.recibos group by galpao_id, numero having count(*) > 1
  ) then
    raise notice 'Existem números de recibo duplicados; constraint recibos_galpao_numero_unico NÃO criada. Renumere os duplicados e crie-a manualmente.';
  elsif not exists (select 1 from pg_constraint where conname = 'recibos_galpao_numero_unico') then
    alter table public.recibos
      add constraint recibos_galpao_numero_unico unique (galpao_id, numero);
  end if;
end $$;

-- Mantém a sequência à frente do maior número já emitido
insert into public.recibo_sequences (galpao_id, last_value)
select galpao_id, max(numero) from public.recibos group by galpao_id
on conflict (galpao_id) do update
  set last_value = greatest(public.recibo_sequences.last_value, excluded.last_value);

-- FKs compostas: pagamento/item/recibo sempre no mesmo galpão do cliente/pagamento
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_id_galpao_unico') then
    alter table public.clientes add constraint clientes_id_galpao_unico unique (id, galpao_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pagamentos_id_galpao_unico') then
    alter table public.pagamentos add constraint pagamentos_id_galpao_unico unique (id, galpao_id);
  end if;

  -- pagamentos -> clientes (NO ACTION: cliente com pagamentos não pode ser apagado)
  if not exists (select 1 from pg_constraint where conname = 'pagamentos_cliente_galpao_fkey') then
    alter table public.pagamentos drop constraint if exists pagamentos_cliente_id_fkey;
    alter table public.pagamentos
      add constraint pagamentos_cliente_galpao_fkey
      foreign key (cliente_id, galpao_id)
      references public.clientes (id, galpao_id) on delete no action;
  end if;

  -- itens_guardados -> clientes
  if not exists (select 1 from pg_constraint where conname = 'itens_cliente_galpao_fkey') then
    alter table public.itens_guardados drop constraint if exists itens_guardados_cliente_id_fkey;
    alter table public.itens_guardados
      add constraint itens_cliente_galpao_fkey
      foreign key (cliente_id, galpao_id)
      references public.clientes (id, galpao_id) on delete cascade;
  end if;

  -- recibos -> pagamentos
  if not exists (select 1 from pg_constraint where conname = 'recibos_pagamento_galpao_fkey') then
    alter table public.recibos drop constraint if exists recibos_pagamento_id_fkey;
    alter table public.recibos
      add constraint recibos_pagamento_galpao_fkey
      foreign key (pagamento_id, galpao_id)
      references public.pagamentos (id, galpao_id) on delete cascade;
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. Funções atômicas: registrar e cancelar pagamento
-- ------------------------------------------------------------
create or replace function public.registrar_pagamento(
  p_galpao_id uuid,
  p_cliente_id uuid,
  p_valor numeric,
  p_forma text,
  p_semana date,
  p_observacoes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente public.clientes;
  v_pag public.pagamentos;
  v_rec public.recibos;
  v_num integer;
  v_dow integer;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada. Entre novamente.';
  end if;
  if not public.pode_acessar_galpao(p_galpao_id) then
    raise exception 'Sem acesso a este galpão.';
  end if;

  select * into v_cliente
  from public.clientes
  where id = p_cliente_id and galpao_id = p_galpao_id;
  if not found then
    raise exception 'Cliente não encontrado neste galpão.';
  end if;
  if not v_cliente.ativo then
    raise exception 'Cliente inativo.';
  end if;

  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor maior que zero.';
  end if;
  if p_forma is null or p_forma not in ('dinheiro', 'pix', 'cartao') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_semana is null then
    raise exception 'Informe a semana de referência.';
  end if;
  if char_length(coalesce(p_observacoes, '')) > 500 then
    raise exception 'Observações muito longas (máx. 500 caracteres).';
  end if;

  v_dow := extract(dow from p_semana);
  if (v_cliente.dia_pagamento = 'quarta' and v_dow <> 3)
     or (v_cliente.dia_pagamento = 'sabado' and v_dow <> 6) then
    raise exception 'A semana de referência não corresponde ao dia de pagamento do cliente.';
  end if;

  begin
    insert into public.pagamentos (
      galpao_id, cliente_id, valor, data_pagamento, semana_referencia,
      forma_pagamento, status, observacoes, criado_por
    )
    values (
      p_galpao_id, p_cliente_id, round(p_valor, 2),
      (now() at time zone 'America/Fortaleza')::date, p_semana,
      p_forma, 'pago', nullif(btrim(p_observacoes), ''), auth.uid()
    )
    returning * into v_pag;
  exception when unique_violation then
    raise exception 'Esta cobrança já foi paga.';
  end;

  -- Numeração atômica: o upsert trava a linha do galpão até o fim da transação.
  insert into public.recibo_sequences (galpao_id, last_value)
  values (p_galpao_id, 1)
  on conflict (galpao_id)
  do update set last_value = public.recibo_sequences.last_value + 1
  returning last_value into v_num;

  insert into public.recibos (galpao_id, pagamento_id, numero)
  values (p_galpao_id, v_pag.id, v_num)
  returning * into v_rec;

  return jsonb_build_object('pagamento', to_jsonb(v_pag), 'recibo', to_jsonb(v_rec));
end;
$$;

create or replace function public.cancelar_pagamento(
  p_pagamento_id uuid,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pag public.pagamentos;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada. Entre novamente.';
  end if;

  select * into v_pag from public.pagamentos where id = p_pagamento_id for update;
  if not found then
    raise exception 'Pagamento não encontrado.';
  end if;
  if not public.pode_acessar_galpao(v_pag.galpao_id) then
    raise exception 'Sem acesso a este galpão.';
  end if;
  if v_pag.status = 'cancelado' then
    raise exception 'Este pagamento já foi cancelado.';
  end if;
  if char_length(coalesce(p_motivo, '')) > 500 then
    raise exception 'Motivo muito longo (máx. 500 caracteres).';
  end if;

  update public.pagamentos
  set status = 'cancelado',
      cancelado_em = now(),
      cancelado_por = auth.uid(),
      motivo_cancelamento = nullif(btrim(p_motivo), '')
  where id = p_pagamento_id
  returning * into v_pag;

  return to_jsonb(v_pag);
end;
$$;

revoke all on function public.registrar_pagamento(uuid, uuid, numeric, text, date, text) from public, anon;
revoke all on function public.cancelar_pagamento(uuid, text) from public, anon;
grant execute on function public.registrar_pagamento(uuid, uuid, numeric, text, date, text) to authenticated;
grant execute on function public.cancelar_pagamento(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 5/6. Policies: histórico financeiro só pelas funções acima;
--      expressão otimizada (is_super avaliado uma vez por consulta)
-- ------------------------------------------------------------

-- clientes / itens_guardados / precos_galpao: CRUD dentro dos galpões liberados
do $$
declare
  par text;
  tabela text;
  prefixo text;
  acesso constant text :=
    '((select public.is_super()) or galpao_id in (select public.auth_galpao_ids()))';
begin
  foreach par in array array['clientes:clientes', 'itens_guardados:itens', 'precos_galpao:precos'] loop
    tabela := split_part(par, ':', 1);
    prefixo := split_part(par, ':', 2);

    execute format('drop policy if exists %I on public.%I', prefixo || '_select', tabela);
    execute format('drop policy if exists %I on public.%I', prefixo || '_insert', tabela);
    execute format('drop policy if exists %I on public.%I', prefixo || '_update', tabela);
    execute format('drop policy if exists %I on public.%I', prefixo || '_delete', tabela);

    execute format('create policy %I on public.%I for select using (%s)',
      prefixo || '_select', tabela, acesso);
    execute format('create policy %I on public.%I for insert with check (%s)',
      prefixo || '_insert', tabela, acesso);
    execute format('create policy %I on public.%I for update using (%s) with check (%s)',
      prefixo || '_update', tabela, acesso, acesso);
    execute format('create policy %I on public.%I for delete using (%s)',
      prefixo || '_delete', tabela, acesso);
  end loop;
end $$;

-- pagamentos: leitura para membros; escrita só via funções; exclusão só super usuário
drop policy if exists "pagamentos_select" on public.pagamentos;
drop policy if exists "pagamentos_insert" on public.pagamentos;
drop policy if exists "pagamentos_update" on public.pagamentos;
drop policy if exists "pagamentos_delete" on public.pagamentos;

create policy "pagamentos_select" on public.pagamentos
  for select using (
    (select public.is_super()) or galpao_id in (select public.auth_galpao_ids())
  );
create policy "pagamentos_delete" on public.pagamentos
  for delete using ((select public.is_super()));

-- recibos: idem
drop policy if exists "recibos_select" on public.recibos;
drop policy if exists "recibos_insert" on public.recibos;
drop policy if exists "recibos_update" on public.recibos;
drop policy if exists "recibos_delete" on public.recibos;

create policy "recibos_select" on public.recibos
  for select using (
    (select public.is_super()) or galpao_id in (select public.auth_galpao_ids())
  );
create policy "recibos_delete" on public.recibos
  for delete using ((select public.is_super()));

-- recibo_sequences: ninguém lê/escreve direto (a numeração é interna)
drop policy if exists "recibo_sequences_select" on public.recibo_sequences;
drop policy if exists "recibo_sequences_insert" on public.recibo_sequences;
drop policy if exists "recibo_sequences_update" on public.recibo_sequences;

-- Usuários anônimos não precisam de acesso às tabelas nem às funções
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;
revoke execute on function public.handle_new_user() from public, authenticated;

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
create index if not exists idx_tipos_galpao on public.tipos_item (galpao_id);
create index if not exists idx_pagamentos_cliente on public.pagamentos (cliente_id);
create index if not exists idx_pagamentos_galpao_data
  on public.pagamentos (galpao_id, data_pagamento desc);
