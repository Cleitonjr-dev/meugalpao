// Preparação comum dos testes do banco: um Postgres local (PGlite) que imita o que o Supabase
// fornece (papéis, schemas auth e storage) e roda TODAS as migrações de supabase/migrations em ordem.
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const PASTA = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))

export const db = new PGlite()

let falhas = 0
export function ok(cond, nome, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${nome}${extra ? ' -> ' + extra : ''}`)
  if (!cond) falhas++
}

/** Texto de uma migração, sem a linha de extensão que o PGlite não tem. */
export function lerMigracao(arquivo) {
  return readFileSync(PASTA + arquivo, 'utf8').replace('create extension if not exists pgcrypto;', '')
}

export const migracoes = readdirSync(PASTA).filter((a) => /^\d{4}_.*\.sql$/.test(a)).sort()

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select string_to_array(name, '/') $$;
`)

// O Supabase dá, por padrão, acesso total a anon/authenticated em tudo que nasce no schema public.
// Simular isso aqui faz os testes pegarem um "revoke" esquecido (que só apareceria em produção).
await db.exec(`
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`)

for (const arquivo of migracoes) {
  try {
    await db.exec(lerMigracao(arquivo))
    ok(true, `migração ${arquivo}`)
  } catch (e) {
    ok(false, `migração ${arquivo}`, e.message)
    process.exit(1)
  }
}

/** Fim do teste: resumo e código de saída (0 = tudo certo). */
export function terminar(titulo) {
  console.log(falhas === 0 ? `\nTODOS OS TESTES DE ${titulo} PASSARAM` : `\n${falhas} FALHA(S) em ${titulo}`)
  process.exit(falhas === 0 ? 0 : 1)
}
