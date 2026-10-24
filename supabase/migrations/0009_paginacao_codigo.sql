-- ============================================================
-- MeuGalpão — 0009_paginacao_codigo.sql (rode DEPOIS do 0008)
--
--  1) Código de autenticação nos recibos (hash aleatório, ex.: A3F9-27C1-5DE0-B481)
--  2) Funções para paginar no servidor (pagamentos/recibos) e somar relatórios no banco
--  3) Verificação pública de recibo pelo código (sem login)
--
-- Nenhum dado é apagado. Os recibos antigos só ganham um código.
-- Publique o front novo DEPOIS de rodar este arquivo.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Código de autenticação do recibo
-- ------------------------------------------------------------

-- 16 caracteres hexadecimais aleatórios (64 bits), a partir de gen_random_uuid().
-- Pula o caractere da versão do UUID (posição 13) e o da variante (17), que não são aleatórios.
create or replace function public.gerar_codigo_recibo()
returns text
language sql
volatile
set search_path = public
as $$
  select upper(substr(h, 1, 12) || substr(h, 18, 4))
  from (select replace(gen_random_uuid()::text, '-', '') as h) t;
$$;

alter table public.recibos add column if not exists codigo text;

update public.recibos set codigo = public.gerar_codigo_recibo() where codigo is null;

alter table public.recibos alter column codigo set not null;
alter table public.recibos alter column codigo set default public.gerar_codigo_recibo();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recibos_codigo_unico') then
    alter table public.recibos add constraint recibos_codigo_unico unique (codigo);
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. Pagamentos recentes (Dashboard): janela de datas, com o recibo de cada um
--    Devolve várias linhas: o front busca em lotes (limite de 1000 por resposta).
-- ------------------------------------------------------------
create or replace function public.pagamentos_recentes(p_galpao uuid, p_desde date)
returns table (
  id uuid,
  galpao_id uuid,
  cliente_id uuid,
  valor numeric,
  data_pagamento date,
  semana_referencia date,
  forma_pagamento text,
  status text,
  observacoes text,
  criado_por uuid,
  cancelado_em timestamptz,
  cancelado_por uuid,
  motivo_cancelamento text,
  created_at timestamptz,
  recibo_numero integer,
  recibo_codigo text
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.galpao_id, p.cliente_id, p.valor, p.data_pagamento, p.semana_referencia,
         p.forma_pagamento, p.status, p.observacoes, p.criado_por, p.cancelado_em,
         p.cancelado_por, p.motivo_cancelamento, p.created_at,
         r.numero, r.codigo
  from public.pagamentos p
  left join public.recibos r on r.pagamento_id = p.id
  where p.galpao_id = p_galpao
    and (p.semana_referencia >= p_desde or p.data_pagamento >= p_desde)
  order by p.created_at desc, p.id desc;
$$;

-- ------------------------------------------------------------
-- 3. Lista paginada de pagamentos/recibos (telas Pagamentos e Recibos)
--    Retorna { "total": n, "itens": [ ... ] }
-- ------------------------------------------------------------
create or replace function public.listar_pagamentos(
  p_galpao uuid,
  p_busca text default null,
  p_formas text[] default null,
  p_status text[] default null,
  p_de date default null,
  p_ate date default null,
  p_por_recibo boolean default false,
  p_limite integer default 25,
  p_deslocamento integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_padrao text;
  v_codigo text;
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_desloc integer := greatest(coalesce(p_deslocamento, 0), 0);
  v_total bigint;
  v_itens jsonb;
begin
  if v_busca is not null then
    -- escapa os curingas do LIKE para que "50%" ou "a_b" sejam buscados literalmente
    v_padrao := '%' || replace(replace(replace(v_busca, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    -- aceita o código com ou sem traços; só vale a partir de 4 caracteres
    v_codigo := regexp_replace(upper(v_busca), '[^0-9A-F]', '', 'g');
    if length(v_codigo) < 4 then
      v_codigo := null;
    end if;
  end if;

  with filtrado as (
    select p.id, p.galpao_id, p.cliente_id, p.valor, p.data_pagamento, p.semana_referencia,
           p.forma_pagamento, p.status, p.observacoes, p.created_at,
           p.cancelado_em, p.motivo_cancelamento,
           c.nome as cliente_nome, c.whatsapp as cliente_whatsapp,
           r.numero as recibo_numero, r.codigo as recibo_codigo
    from public.pagamentos p
    join public.clientes c on c.id = p.cliente_id
    left join public.recibos r on r.pagamento_id = p.id
    where p.galpao_id = p_galpao
      and (p_formas is null or cardinality(p_formas) = 0 or p.forma_pagamento = any (p_formas))
      and (p_status is null or cardinality(p_status) = 0 or p.status = any (p_status))
      and (p_de is null or p.data_pagamento >= p_de)
      and (p_ate is null or p.data_pagamento <= p_ate)
      and (
        v_busca is null
        or c.nome ilike v_padrao
        or lpad(r.numero::text, 4, '0') ilike v_padrao
        or (v_codigo is not null and r.codigo like '%' || v_codigo || '%')
      )
  ),
  pagina as (
    select f.*
    from filtrado f
    order by (case when p_por_recibo then f.recibo_numero end) desc nulls last,
             f.created_at desc, f.id desc
    limit v_limite offset v_desloc
  )
  select
    (select count(*) from filtrado),
    coalesce(
      (select jsonb_agg(
                to_jsonb(pg)
                order by (case when p_por_recibo then pg.recibo_numero end) desc nulls last,
                         pg.created_at desc, pg.id desc)
       from pagina pg),
      '[]'::jsonb)
  into v_total, v_itens;

  return jsonb_build_object('total', v_total, 'itens', v_itens);
end;
$$;

-- ------------------------------------------------------------
-- 4. Resumo para a tela Relatórios (somas feitas no banco, ignora cancelados)
-- ------------------------------------------------------------
create or replace function public.relatorio_resumo(
  p_galpao uuid,
  p_de date,
  p_ate date,
  p_hoje date
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with validos as (
    select p.valor, p.forma_pagamento, p.data_pagamento
    from public.pagamentos p
    where p.galpao_id = p_galpao and p.status <> 'cancelado'
  )
  select jsonb_build_object(
    'total_geral', coalesce((select sum(valor) from validos), 0),
    'total_periodo',
      coalesce((select sum(valor) from validos where data_pagamento between p_de and p_ate), 0),
    'quantidade_periodo',
      (select count(*) from validos where data_pagamento between p_de and p_ate),
    'total_hoje', coalesce((select sum(valor) from validos where data_pagamento = p_hoje), 0),
    'por_forma', coalesce(
      (select jsonb_agg(jsonb_build_object('forma', f.forma_pagamento, 'total', f.total)
                        order by f.forma_pagamento)
       from (select forma_pagamento, sum(valor) as total
             from validos
             where data_pagamento between p_de and p_ate
             group by forma_pagamento) f),
      '[]'::jsonb),
    'por_dia', coalesce(
      (select jsonb_agg(jsonb_build_object('data', d.data_pagamento, 'total', d.total)
                        order by d.data_pagamento desc)
       from (select data_pagamento, sum(valor) as total
             from validos
             where data_pagamento between p_de and p_ate
             group by data_pagamento
             order by data_pagamento desc
             limit 31) d),
      '[]'::jsonb)
  );
$$;

-- ------------------------------------------------------------
-- 5. Verificação pública do recibo (sem login): só um resumo, e o cliente abreviado
-- ------------------------------------------------------------
create or replace function public.abreviar_nome(p_nome text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
           when coalesce(array_length(partes, 1), 0) = 0 then ''
           when array_length(partes, 1) = 1 then partes[1]
           else partes[1] || ' ' || upper(left(partes[array_length(partes, 1)], 1)) || '.'
         end
  from (select regexp_split_to_array(btrim(coalesce(p_nome, '')), '\s+') as partes) t;
$$;

create or replace function public.verificar_recibo(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_codigo text := regexp_replace(upper(coalesce(p_codigo, '')), '[^0-9A-F]', '', 'g');
  v_resultado jsonb;
begin
  if length(v_codigo) <> 16 then
    return null;
  end if;

  select jsonb_build_object(
           'numero', r.numero,
           'codigo', r.codigo,
           'galpao', g.nome,
           'cliente', public.abreviar_nome(c.nome),
           'valor', p.valor,
           'data', p.data_pagamento,
           'referente', p.semana_referencia,
           'forma', p.forma_pagamento,
           'situacao', case when p.status = 'cancelado' then 'cancelado' else 'valido' end,
           'cancelado_em', p.cancelado_em
         )
  into v_resultado
  from public.recibos r
  join public.pagamentos p on p.id = r.pagamento_id
  join public.galpoes g on g.id = r.galpao_id
  join public.clientes c on c.id = p.cliente_id
  where r.codigo = v_codigo;

  return v_resultado;
end;
$$;

-- ------------------------------------------------------------
-- 6. Permissões e índice
--    Funções novas são públicas por padrão: fechamos para anônimos,
--    exceto a verificação do recibo, que é pública de propósito.
-- ------------------------------------------------------------
revoke all on function public.gerar_codigo_recibo() from public, anon;
revoke all on function public.pagamentos_recentes(uuid, date) from public, anon;
revoke all on function public.listar_pagamentos(uuid, text, text[], text[], date, date, boolean, integer, integer) from public, anon;
revoke all on function public.relatorio_resumo(uuid, date, date, date) from public, anon;
revoke all on function public.abreviar_nome(text) from public, anon;
revoke all on function public.verificar_recibo(text) from public;

grant execute on function public.gerar_codigo_recibo() to authenticated;
grant execute on function public.pagamentos_recentes(uuid, date) to authenticated;
grant execute on function public.listar_pagamentos(uuid, text, text[], text[], date, date, boolean, integer, integer) to authenticated;
grant execute on function public.relatorio_resumo(uuid, date, date, date) to authenticated;
grant execute on function public.abreviar_nome(text) to authenticated;
grant execute on function public.verificar_recibo(text) to anon, authenticated;

create index if not exists idx_pagamentos_galpao_semana
  on public.pagamentos (galpao_id, semana_referencia);

-- ------------------------------------------------------------
-- Teste rápido (rode depois, trocando o id do galpão e o código de um recibo):
--   select public.listar_pagamentos('<id do galpão>', null, null, null, null, null, false, 25, 0);
--   select public.relatorio_resumo('<id do galpão>', date_trunc('month', current_date)::date, current_date, current_date);
--   select public.verificar_recibo('<código de um recibo>');
-- ------------------------------------------------------------
