-- ============================================================
-- MeuGalpão — 0004_profiles_email.sql
-- Adiciona a coluna "email" em profiles (para listar usuários)
-- e atualiza o trigger de criação de perfil.
-- ============================================================

alter table public.profiles add column if not exists email text;

-- Preenche o e-mail dos perfis já existentes
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');

-- Atualiza o trigger para gravar o e-mail automaticamente
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, is_dono, email)
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
