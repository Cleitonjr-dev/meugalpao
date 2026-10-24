-- ============================================================
-- MeuGalpão — 0010_codigo_sem_repeticao.sql (rode DEPOIS do 0009)
--
-- Garante que o código de autenticação do recibo NUNCA se repete, em nenhum galpão.
--
-- Já existia a trava `recibos_codigo_unico` (UNIQUE em toda a tabela, não por galpão):
-- o banco recusa guardar dois códigos iguais. Aqui o gerador passa a conferir antes,
-- em TODOS os galpões, e sorteia de novo se o código já existir. Assim nem chega a dar erro.
--
-- security definer: a conferência precisa enxergar os recibos de todos os galpões,
-- o que as regras de acesso (RLS) não permitiriam a um usuário comum.
-- ============================================================

create or replace function public.gerar_codigo_recibo()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_codigo text;
begin
  loop
    -- 16 caracteres hexadecimais aleatórios; pula a versão (13) e a variante (17) do UUID
    select upper(substr(h, 1, 12) || substr(h, 18, 4))
    into v_codigo
    from (select replace(gen_random_uuid()::text, '-', '') as h) t;

    exit when not exists (select 1 from public.recibos r where r.codigo = v_codigo);
  end loop;

  return v_codigo;
end;
$$;

revoke all on function public.gerar_codigo_recibo() from public, anon;
grant execute on function public.gerar_codigo_recibo() to authenticated;
