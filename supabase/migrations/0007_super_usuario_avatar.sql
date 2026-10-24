-- ============================================================
-- MeuGalpão — 0007_super_usuario_avatar.sql
-- 1) Renomeia "dono" -> "super usuário" (coluna, funções, RLS)
-- 2) Adiciona avatar_url (foto de perfil)
-- 3) Cria o bucket "avatars" no Storage
-- ============================================================

-- ------------------------------------------------------------
-- 1. Renomear coluna is_dono -> is_super (idempotente)
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_dono'
  ) then
    alter table public.profiles rename column is_dono to is_super;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. Funções (is_super e pode_acessar_galpao)
-- ------------------------------------------------------------
create or replace function public.is_super()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_super = true);
$$;

create or replace function public.pode_acessar_galpao(g uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super() or g in (select public.auth_galpao_ids());
$$;

-- ------------------------------------------------------------
-- 3. Trigger de perfil (usa is_super)
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, is_super, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    false,
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 4. Recriar políticas que usavam is_dono() -> is_super()
-- ------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.is_super());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid() or public.is_super());

drop policy if exists "galpoes_insert" on public.galpoes;
create policy "galpoes_insert" on public.galpoes
  for insert with check (public.is_super());

drop policy if exists "galpoes_update" on public.galpoes;
create policy "galpoes_update" on public.galpoes
  for update using (public.is_super());

drop policy if exists "galpoes_delete" on public.galpoes;
create policy "galpoes_delete" on public.galpoes
  for delete using (public.is_super());

drop policy if exists "membros_select" on public.galpao_membros;
create policy "membros_select" on public.galpao_membros
  for select using (public.is_super() or profile_id = auth.uid());

drop policy if exists "membros_insert" on public.galpao_membros;
create policy "membros_insert" on public.galpao_membros
  for insert with check (public.is_super());

drop policy if exists "membros_update" on public.galpao_membros;
create policy "membros_update" on public.galpao_membros
  for update using (public.is_super());

drop policy if exists "membros_delete" on public.galpao_membros;
create policy "membros_delete" on public.galpao_membros
  for delete using (public.is_super());

drop policy if exists "tipos_insert" on public.tipos_item;
create policy "tipos_insert" on public.tipos_item
  for insert with check (
    public.is_super() or (galpao_id is not null and public.pode_acessar_galpao(galpao_id))
  );

drop policy if exists "tipos_update" on public.tipos_item;
create policy "tipos_update" on public.tipos_item
  for update using (
    public.is_super() or (galpao_id is not null and public.pode_acessar_galpao(galpao_id))
  );

drop policy if exists "tipos_delete" on public.tipos_item;
create policy "tipos_delete" on public.tipos_item
  for delete using (
    public.is_super() or (galpao_id is not null and public.pode_acessar_galpao(galpao_id))
  );

-- ------------------------------------------------------------
-- 5. Remover a função antiga
-- ------------------------------------------------------------
drop function if exists public.is_dono();

-- ------------------------------------------------------------
-- 6. Permissão de execução na nova função
-- ------------------------------------------------------------
grant execute on function public.is_super() to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 7. Avatar
-- ------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;

-- ------------------------------------------------------------
-- 8. Bucket de fotos + políticas de storage
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_auth_insert" on storage.objects;
create policy "avatars_auth_insert" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "avatars_auth_update" on storage.objects;
create policy "avatars_auth_update" on storage.objects
  for update using (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "avatars_auth_delete" on storage.objects;
create policy "avatars_auth_delete" on storage.objects
  for delete using (bucket_id = 'avatars' and auth.role() = 'authenticated');
