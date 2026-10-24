-- ============================================================
-- MeuGalpão — 0012_auditoria.sql (rode DEPOIS do 0011)
--
--  1) Histórico (auditoria) de tudo que muda no sistema: quem, o quê e quando.
--     Só o super usuário lê; ninguém grava, edita ou apaga direto.
--  2) Cancelar pagamento passa a exigir:
--       - senha confirmada nos últimos 2 minutos (conferido no servidor);
--       - motivo (mínimo 3 caracteres).
--  3) A lista de pagamentos mostra quem recebeu e quem cancelou.
--
-- Nenhum dado é apagado ou alterado.
-- ============================================================

-- ------------------------------------------------------------
-- Funções de apoio
-- ------------------------------------------------------------
create or replace function public.fmt_brl(p_valor numeric)
returns text
language sql
immutable
set search_path = public
as $$
  -- formatação própria (não depende do idioma configurado no servidor): 1.234,50
  select 'R$ '
         || case when coalesce(p_valor, 0) < 0 and t.c > 0 then '-' else '' end
         || regexp_replace(to_char(div(t.c, 100), 'FM999999999990'), '(\d)(?=(\d{3})+$)', '\1.', 'g')
         || ','
         || to_char(mod(t.c, 100), 'FM00')
  from (select round(abs(coalesce(p_valor, 0)) * 100) as c) t;
$$;

-- Nome de um usuário (só o nome, nunca e-mail): usado para mostrar "recebido por" a colegas do galpão.
create or replace function public.nome_usuario(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nome from public.profiles where id = p_id;
$$;

create or replace function public.rotulo_campo(p_campo text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_campo
    when 'nome' then 'nome'
    when 'telefone' then 'telefone'
    when 'whatsapp' then 'WhatsApp'
    when 'dia_pagamento' then 'dia de pagamento'
    when 'observacoes' then 'observações'
    when 'ativo' then 'situação (ativo)'
    when 'quantidade' then 'quantidade'
    when 'identificacao' then 'identificação'
    when 'tipo_item_id' then 'tipo'
    when 'preco_semanal' then 'preço semanal'
    when 'endereco' then 'endereço'
    else p_campo
  end;
$$;

-- Campos que mudaram entre duas versões de uma linha: { campos: [...], antes: {...}, depois: {...} }
create or replace function public.diff_json(p_antes jsonb, p_depois jsonb, p_ignorar text[] default array['created_at'])
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'campos', coalesce(jsonb_agg(t.k order by t.k), '[]'::jsonb),
    'antes', coalesce(jsonb_object_agg(t.k, p_antes -> t.k), '{}'::jsonb),
    'depois', coalesce(jsonb_object_agg(t.k, p_depois -> t.k), '{}'::jsonb)
  )
  from (
    select k
    from jsonb_object_keys(p_depois) k
    where k <> all (p_ignorar) and (p_antes -> k) is distinct from (p_depois -> k)
  ) t;
$$;

-- "dia de pagamento (quarta → sabado); situação (ativo) (true → false)"
create or replace function public.descrever_mudancas(p_diff jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select string_agg(
           public.rotulo_campo(c) || ' (' || coalesce(p_diff -> 'antes' ->> c, 'vazio')
             || ' → ' || coalesce(p_diff -> 'depois' ->> c, 'vazio') || ')',
           '; ' order by c)
  from jsonb_array_elements_text(p_diff -> 'campos') c;
$$;

-- ------------------------------------------------------------
-- Tabela de auditoria
-- ------------------------------------------------------------
create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  usuario_id uuid references public.profiles (id) on delete set null,
  usuario_nome text,
  galpao_id uuid references public.galpoes (id) on delete set null,
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  resumo text not null,
  detalhes jsonb
);

create index if not exists idx_auditoria_data on public.auditoria (created_at desc, id desc);
create index if not exists idx_auditoria_galpao on public.auditoria (galpao_id, created_at desc);

alter table public.auditoria enable row level security;

drop policy if exists "auditoria_select" on public.auditoria;
create policy "auditoria_select" on public.auditoria
  for select using ((select public.is_super()));

-- Sem policy de escrita e sem privilégio: só as funções internas gravam.
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;

create or replace function public.registrar_auditoria(
  p_acao text,
  p_entidade text,
  p_entidade_id uuid,
  p_galpao uuid,
  p_resumo text,
  p_detalhes jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  select nome into v_nome from public.profiles where id = auth.uid();
  insert into public.auditoria (usuario_id, usuario_nome, galpao_id, acao, entidade, entidade_id, resumo, detalhes)
  values (auth.uid(), coalesce(v_nome, 'Sistema'), p_galpao, p_acao, p_entidade, p_entidade_id, p_resumo, p_detalhes);
end;
$$;

-- ------------------------------------------------------------
-- Gatilhos: registram sozinhos as mudanças de cadastro
-- ------------------------------------------------------------
create or replace function public.auditar_clientes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_diff jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.registrar_auditoria('cliente.criado', 'cliente', new.id, new.galpao_id,
      format('Cliente "%s" criado', new.nome), to_jsonb(new) - 'created_at');
  elsif tg_op = 'UPDATE' then
    v_diff := public.diff_json(to_jsonb(old), to_jsonb(new), array['created_at', 'criado_por']);
    if jsonb_array_length(v_diff -> 'campos') > 0 then
      perform public.registrar_auditoria('cliente.alterado', 'cliente', new.id, new.galpao_id,
        format('Cliente "%s" alterado: %s', new.nome, public.descrever_mudancas(v_diff)), v_diff);
    end if;
  else
    -- exclusão em cascata (galpão apagado): o próprio galpão já registra
    if exists (select 1 from public.galpoes g where g.id = old.galpao_id) then
      perform public.registrar_auditoria('cliente.excluido', 'cliente', old.id, old.galpao_id,
        format('Cliente "%s" excluído', old.nome), to_jsonb(old) - 'created_at');
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.auditar_itens()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.itens_guardados;
  v_tipo text;
  v_cliente text;
  v_nome_item text;
  v_diff jsonb;
begin
  v_item := case when tg_op = 'DELETE' then old else new end;
  select nome into v_tipo from public.tipos_item where id = v_item.tipo_item_id;
  select nome into v_cliente from public.clientes where id = v_item.cliente_id;
  v_nome_item := coalesce(v_tipo, 'Item')
    || coalesce(' — ' || nullif(btrim(v_item.identificacao), ''), '')
    || case when v_item.quantidade > 1 then ' (x' || v_item.quantidade || ')' else '' end;

  if tg_op = 'INSERT' then
    perform public.registrar_auditoria('item.adicionado', 'item', new.id, new.galpao_id,
      format('Item "%s" adicionado ao cliente "%s"', v_nome_item, coalesce(v_cliente, '?')), to_jsonb(new) - 'created_at');
  elsif tg_op = 'UPDATE' then
    v_diff := public.diff_json(to_jsonb(old), to_jsonb(new), array['created_at']);
    if jsonb_array_length(v_diff -> 'campos') > 0 then
      perform public.registrar_auditoria('item.alterado', 'item', new.id, new.galpao_id,
        format('Item "%s" do cliente "%s" alterado: %s', coalesce(v_tipo, 'Item'), coalesce(v_cliente, '?'), public.descrever_mudancas(v_diff)), v_diff);
    end if;
  else
    -- remoção em cascata (cliente apagado): o cliente já registra
    if v_cliente is not null then
      perform public.registrar_auditoria('item.removido', 'item', old.id, old.galpao_id,
        format('Item "%s" removido do cliente "%s"', v_nome_item, v_cliente), to_jsonb(old) - 'created_at');
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.auditar_tipos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_diff jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.registrar_auditoria('tipo.criado', 'tipo', new.id, new.galpao_id,
      format('Tipo "%s" criado (preço padrão %s)', new.nome, public.fmt_brl(new.preco_semanal)), to_jsonb(new) - 'created_at');
  elsif tg_op = 'UPDATE' then
    v_diff := public.diff_json(to_jsonb(old), to_jsonb(new), array['created_at']);
    if jsonb_array_length(v_diff -> 'campos') > 0 then
      perform public.registrar_auditoria('tipo.alterado', 'tipo', new.id, new.galpao_id,
        format('Tipo "%s" alterado: %s', new.nome, public.descrever_mudancas(v_diff)), v_diff);
    end if;
  else
    perform public.registrar_auditoria('tipo.excluido', 'tipo', old.id, old.galpao_id,
      format('Tipo "%s" excluído', old.nome), to_jsonb(old) - 'created_at');
  end if;
  return null;
end;
$$;

create or replace function public.auditar_precos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preco public.precos_galpao;
  v_tipo text;
  v_galpao text;
begin
  v_preco := case when tg_op = 'DELETE' then old else new end;
  select nome into v_tipo from public.tipos_item where id = v_preco.tipo_item_id;
  select nome into v_galpao from public.galpoes where id = v_preco.galpao_id;

  if tg_op = 'INSERT' then
    perform public.registrar_auditoria('preco.definido', 'preco', new.id, new.galpao_id,
      format('Preço de "%s" no galpão "%s" definido: %s', coalesce(v_tipo, '?'), coalesce(v_galpao, '?'), public.fmt_brl(new.preco_semanal)),
      jsonb_build_object('preco_semanal', new.preco_semanal));
  elsif tg_op = 'UPDATE' then
    if old.preco_semanal is distinct from new.preco_semanal then
      perform public.registrar_auditoria('preco.alterado', 'preco', new.id, new.galpao_id,
        format('Preço de "%s" no galpão "%s": %s → %s', coalesce(v_tipo, '?'), coalesce(v_galpao, '?'),
               public.fmt_brl(old.preco_semanal), public.fmt_brl(new.preco_semanal)),
        jsonb_build_object('antes', old.preco_semanal, 'depois', new.preco_semanal));
    end if;
  else
    -- remoção em cascata (tipo ou galpão apagado): quem apagou já registra
    if v_tipo is not null and v_galpao is not null then
      perform public.registrar_auditoria('preco.removido', 'preco', old.id, old.galpao_id,
        format('Preço próprio de "%s" no galpão "%s" removido (volta ao padrão)', v_tipo, v_galpao),
        jsonb_build_object('preco_semanal', old.preco_semanal));
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.auditar_galpoes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_diff jsonb;
begin
  if tg_op = 'INSERT' then
    perform public.registrar_auditoria('galpao.criado', 'galpao', new.id, new.id,
      format('Galpão "%s" criado', new.nome), to_jsonb(new) - 'created_at');
  elsif tg_op = 'UPDATE' then
    v_diff := public.diff_json(to_jsonb(old), to_jsonb(new), array['created_at']);
    if jsonb_array_length(v_diff -> 'campos') > 0 then
      perform public.registrar_auditoria('galpao.alterado', 'galpao', new.id, new.id,
        format('Galpão "%s" alterado: %s', new.nome, public.descrever_mudancas(v_diff)), v_diff);
    end if;
  else
    -- o galpão já não existe: o registro não pode apontar para ele
    perform public.registrar_auditoria('galpao.excluido', 'galpao', old.id, null,
      format('Galpão "%s" excluído (com todos os clientes, pagamentos e recibos)', old.nome), to_jsonb(old) - 'created_at');
  end if;
  return null;
end;
$$;

create or replace function public.auditar_membros()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membro public.galpao_membros;
  v_usuario text;
  v_galpao text;
begin
  v_membro := case when tg_op = 'DELETE' then old else new end;
  select nome into v_usuario from public.profiles where id = v_membro.profile_id;
  select nome into v_galpao from public.galpoes where id = v_membro.galpao_id;

  if tg_op = 'INSERT' then
    perform public.registrar_auditoria('acesso.liberado', 'acesso', new.id, new.galpao_id,
      format('Acesso de "%s" ao galpão "%s" liberado', coalesce(v_usuario, '?'), coalesce(v_galpao, '?')), null);
  elsif tg_op = 'DELETE' then
    if v_usuario is not null and v_galpao is not null then
      perform public.registrar_auditoria('acesso.removido', 'acesso', old.id, old.galpao_id,
        format('Acesso de "%s" ao galpão "%s" removido', v_usuario, v_galpao), null);
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.auditar_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.registrar_auditoria('usuario.criado', 'usuario', new.id, null,
      format('Nova conta criada: "%s" (%s)', new.nome, coalesce(new.email, 'sem e-mail')), null);
  elsif old.is_super is distinct from new.is_super then
    perform public.registrar_auditoria('usuario.super_alterado', 'usuario', new.id, null,
      case when new.is_super
        then format('"%s" passou a ser super usuário', new.nome)
        else format('"%s" deixou de ser super usuário', new.nome) end,
      jsonb_build_object('antes', old.is_super, 'depois', new.is_super));
  end if;
  return null;
end;
$$;

drop trigger if exists auditar_clientes on public.clientes;
create trigger auditar_clientes after insert or update or delete on public.clientes
  for each row execute function public.auditar_clientes();

drop trigger if exists auditar_itens on public.itens_guardados;
create trigger auditar_itens after insert or update or delete on public.itens_guardados
  for each row execute function public.auditar_itens();

drop trigger if exists auditar_tipos on public.tipos_item;
create trigger auditar_tipos after insert or update or delete on public.tipos_item
  for each row execute function public.auditar_tipos();

drop trigger if exists auditar_precos on public.precos_galpao;
create trigger auditar_precos after insert or update or delete on public.precos_galpao
  for each row execute function public.auditar_precos();

drop trigger if exists auditar_galpoes on public.galpoes;
create trigger auditar_galpoes after insert or update or delete on public.galpoes
  for each row execute function public.auditar_galpoes();

drop trigger if exists auditar_membros on public.galpao_membros;
create trigger auditar_membros after insert or delete on public.galpao_membros
  for each row execute function public.auditar_membros();

drop trigger if exists auditar_profiles on public.profiles;
create trigger auditar_profiles after insert or update of is_super on public.profiles
  for each row execute function public.auditar_profiles();

-- ------------------------------------------------------------
-- Cancelar pagamento: senha confirmada há pouco + motivo obrigatório + histórico
-- ------------------------------------------------------------
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
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_login bigint;
  v_num integer;
  v_cliente text;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada. Entre novamente.';
  end if;

  -- Quando a senha foi digitada pela última vez: o token traz a data do login por senha (amr).
  -- Se o token não trouxer essa informação, vale a data de emissão do token (iat).
  select max((a ->> 'timestamp')::bigint)
  into v_login
  from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
  where a ->> 'method' = 'password';
  if jsonb_array_length(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) = 0 then
    v_login := (auth.jwt() ->> 'iat')::bigint;
  end if;

  if v_login is null or v_login < extract(epoch from now())::bigint - 120 then
    raise exception 'Confirme sua senha para cancelar o pagamento.';
  end if;

  if v_motivo is null or char_length(v_motivo) < 3 then
    raise exception 'Informe o motivo do cancelamento (mínimo 3 caracteres).';
  end if;
  if char_length(v_motivo) > 500 then
    raise exception 'Motivo muito longo (máx. 500 caracteres).';
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

  update public.pagamentos
  set status = 'cancelado',
      cancelado_em = now(),
      cancelado_por = auth.uid(),
      motivo_cancelamento = v_motivo
  where id = p_pagamento_id
  returning * into v_pag;

  select numero into v_num from public.recibos where pagamento_id = v_pag.id;
  select nome into v_cliente from public.clientes where id = v_pag.cliente_id;

  perform public.registrar_auditoria(
    'pagamento.cancelado', 'pagamento', v_pag.id, v_pag.galpao_id,
    format('Pagamento de %s cancelado (recibo nº %s, cliente "%s"). Motivo: %s',
           public.fmt_brl(v_pag.valor), coalesce(v_num::text, '—'), coalesce(v_cliente, '?'), v_motivo),
    jsonb_build_object('valor', v_pag.valor, 'recibo', v_num, 'semana', v_pag.semana_referencia, 'motivo', v_motivo)
  );

  return to_jsonb(v_pag);
end;
$$;

-- ------------------------------------------------------------
-- Pagamentos: registrar passa a deixar rastro
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

  perform public.registrar_auditoria(
    'pagamento.registrado', 'pagamento', v_pag.id, p_galpao_id,
    format('Pagamento de %s registrado: cliente "%s", recibo nº %s', public.fmt_brl(v_pag.valor), v_cliente.nome, v_num),
    jsonb_build_object(
      'valor', v_pag.valor, 'forma', v_pag.forma_pagamento, 'semana', v_pag.semana_referencia,
      'recibo', v_num, 'codigo', v_rec.codigo, 'descricao', v_pag.descricao
    )
  );

  return jsonb_build_object('pagamento', to_jsonb(v_pag), 'recibo', to_jsonb(v_rec));
end;
$$;

-- ------------------------------------------------------------
-- Lista de pagamentos: agora também com quem recebeu e quem cancelou
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
           p.cancelado_em, p.motivo_cancelamento, p.descricao,
           p.criado_por, p.cancelado_por,
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
                  || jsonb_build_object(
                       'recebido_por_nome', public.nome_usuario(pg.criado_por),
                       'cancelado_por_nome', public.nome_usuario(pg.cancelado_por))
                order by (case when p_por_recibo then pg.recibo_numero end) desc nulls last,
                         pg.created_at desc, pg.id desc)
       from pagina pg),
      '[]'::jsonb)
  into v_total, v_itens;

  return jsonb_build_object('total', v_total, 'itens', v_itens);
end;
$$;

-- ------------------------------------------------------------
-- Lista do histórico (só super usuário: as regras de acesso da tabela garantem)
-- ------------------------------------------------------------
create or replace function public.listar_auditoria(
  p_busca text default null,
  p_acoes text[] default null,
  p_de date default null,
  p_ate date default null,
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
  v_padrao text;
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_desloc integer := greatest(coalesce(p_deslocamento, 0), 0);
  v_total bigint;
  v_itens jsonb;
begin
  if nullif(btrim(coalesce(p_busca, '')), '') is not null then
    v_padrao := '%' || replace(replace(replace(btrim(p_busca), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with filtrado as (
    select a.id, a.created_at, a.usuario_nome, a.acao, a.entidade, a.resumo, a.detalhes,
           g.nome as galpao_nome
    from public.auditoria a
    left join public.galpoes g on g.id = a.galpao_id
    where (p_acoes is null or cardinality(p_acoes) = 0 or a.acao = any (p_acoes))
      and (p_de is null or (a.created_at at time zone 'America/Fortaleza')::date >= p_de)
      and (p_ate is null or (a.created_at at time zone 'America/Fortaleza')::date <= p_ate)
      and (v_padrao is null or a.resumo ilike v_padrao or a.usuario_nome ilike v_padrao)
  ),
  pagina as (
    select f.* from filtrado f order by f.created_at desc, f.id desc limit v_limite offset v_desloc
  )
  select
    (select count(*) from filtrado),
    coalesce(
      (select jsonb_agg(to_jsonb(pg) order by pg.created_at desc, pg.id desc) from pagina pg),
      '[]'::jsonb)
  into v_total, v_itens;

  return jsonb_build_object('total', v_total, 'itens', v_itens);
end;
$$;

-- ------------------------------------------------------------
-- Permissões
-- ------------------------------------------------------------
revoke all on function public.fmt_brl(numeric) from public, anon;
revoke all on function public.rotulo_campo(text) from public, anon;
revoke all on function public.diff_json(jsonb, jsonb, text[]) from public, anon;
revoke all on function public.descrever_mudancas(jsonb) from public, anon;
revoke all on function public.registrar_auditoria(text, text, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.nome_usuario(uuid) from public, anon;
revoke all on function public.listar_auditoria(text, text[], date, date, integer, integer) from public, anon;
revoke all on function public.cancelar_pagamento(uuid, text) from public, anon;
revoke all on function public.registrar_pagamento(uuid, uuid, numeric, text, date, text) from public, anon;
revoke all on function public.listar_pagamentos(uuid, text, text[], text[], date, date, boolean, integer, integer) from public, anon;

grant execute on function public.fmt_brl(numeric) to authenticated;
grant execute on function public.nome_usuario(uuid) to authenticated;
grant execute on function public.listar_auditoria(text, text[], date, date, integer, integer) to authenticated;
grant execute on function public.cancelar_pagamento(uuid, text) to authenticated;
grant execute on function public.registrar_pagamento(uuid, uuid, numeric, text, date, text) to authenticated;
grant execute on function public.listar_pagamentos(uuid, text, text[], text[], date, date, boolean, integer, integer) to authenticated;
