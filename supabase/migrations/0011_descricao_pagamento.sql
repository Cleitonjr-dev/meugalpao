-- ============================================================
-- MeuGalpão — 0011_descricao_pagamento.sql (rode DEPOIS do 0010)
--
-- O recibo passa a mostrar o item pago (ex.: "Carrinho de roupa").
-- A descrição é gravada junto com o pagamento, como era no momento de pagar:
-- se os itens do cliente mudarem depois, os recibos antigos continuam iguais.
--
-- Pagamentos anteriores a esta migração ficam sem descrição (o recibo simplesmente
-- não mostra a linha do item). Nenhum dado é apagado.
-- ============================================================

alter table public.pagamentos add column if not exists descricao text;

-- 1) registrar_pagamento guarda a descrição dos itens
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
  v_descricao text;
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

  -- Foto dos itens do cliente neste momento: o recibo continua certo mesmo se os itens mudarem depois.
  select string_agg(
           coalesce(t.nome, 'Item')
             || coalesce(' — ' || nullif(btrim(i.identificacao), ''), '')
             || case when i.quantidade > 1 then ' (x' || i.quantidade || ')' else '' end,
           '; '
           order by t.nome, i.identificacao nulls first, i.created_at
         )
  into v_descricao
  from public.itens_guardados i
  left join public.tipos_item t on t.id = i.tipo_item_id
  where i.cliente_id = p_cliente_id and i.ativo;

  begin
    insert into public.pagamentos (
      galpao_id, cliente_id, valor, data_pagamento, semana_referencia,
      forma_pagamento, status, observacoes, criado_por, descricao
    )
    values (
      p_galpao_id, p_cliente_id, round(p_valor, 2),
      (now() at time zone 'America/Fortaleza')::date, p_semana,
      p_forma, 'pago', nullif(btrim(p_observacoes), ''), auth.uid(), v_descricao
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

-- 2) pagamentos_recentes devolve a descrição
drop function if exists public.pagamentos_recentes(uuid, date);
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
  descricao text,
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
         p.cancelado_por, p.motivo_cancelamento, p.descricao, p.created_at,
         r.numero, r.codigo
  from public.pagamentos p
  left join public.recibos r on r.pagamento_id = p.id
  where p.galpao_id = p_galpao
    and (p.semana_referencia >= p_desde or p.data_pagamento >= p_desde)
  order by p.created_at desc, p.id desc;
$$;

-- 3) listar_pagamentos devolve a descrição
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
           p.cancelado_em, p.motivo_cancelamento, p.descricao,
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

-- pagamentos_recentes muda de colunas: é preciso recriar a função (e liberar de novo o acesso).
revoke all on function public.pagamentos_recentes(uuid, date) from public, anon;
grant execute on function public.pagamentos_recentes(uuid, date) to authenticated;
revoke all on function public.listar_pagamentos(uuid, text, text[], text[], date, date, boolean, integer, integer) from public, anon;
grant execute on function public.listar_pagamentos(uuid, text, text[], text[], date, date, boolean, integer, integer) to authenticated;
revoke all on function public.registrar_pagamento(uuid, uuid, numeric, text, date, text) from public, anon;
grant execute on function public.registrar_pagamento(uuid, uuid, numeric, text, date, text) to authenticated;
