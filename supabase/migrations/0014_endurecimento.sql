-- ============================================================
-- MeuGalpão — 0014_endurecimento.sql (rode DEPOIS da 0013, UMA vez)
--
-- Correções da auditoria de 17/10/2026 (docs/auditoria/):
--  AUD-001  Galpão com pagamentos não pode ser excluído
--  AUD-002  Pagamentos e recibos não podem ser apagados pela API; qualquer exclusão deixa rastro
--  AUD-003  Promover/remover super usuário exige senha digitada há pouco
--  AUD-004  "Senha recente" sem brecha: sem prova de login por senha, recusa
--  AUD-006  Fotos de perfil deixam de ser listáveis
--  AUD-007  Foto de perfil só pode apontar para a pasta do próprio usuário
--  AUD-008  Funções auxiliares fechadas para usuários sem login
--  AUD-011  Limites de tamanho para textos
--  AUD-012  Pagamento: valor máximo e semana não pode estar longe no futuro
--  AUD-015  Tipo de item em uso não pode ser excluído
--  AUD-024  Registro das migrações já aplicadas (tabela migracoes_aplicadas)
--
-- Nenhum dado é apagado ou alterado.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Registro das migrações aplicadas (AUD-024)
-- ------------------------------------------------------------
create table if not exists public.migracoes_aplicadas (
  nome text primary key,
  aplicada_em timestamptz not null default now()
);

alter table public.migracoes_aplicadas enable row level security;
revoke all on public.migracoes_aplicadas from anon, authenticated;

-- Quem usa o painel já tinha rodado de 0001 a 0013 até aqui.
insert into public.migracoes_aplicadas (nome) values
  ('0001_init'), ('0002_rls'), ('0003_seed'), ('0004_profiles_email'), ('0005_precos_galpao'),
  ('0006_integridade_indices'), ('0007_super_usuario_avatar'), ('0008_hardening'),
  ('0009_paginacao_codigo'), ('0010_codigo_sem_repeticao'), ('0011_descricao_pagamento'),
  ('0012_auditoria'), ('0013_fechamento_dia')
on conflict (nome) do nothing;

-- ------------------------------------------------------------
-- 1. Senha digitada há pouco (AUD-003, AUD-004)
--    O token do Supabase traz o "amr" (métodos de login, do mais recente ao mais antigo).
--    Sem prova de login por senha nos últimos segundos, a resposta é "não" (não há mais
--    o atalho de usar a data de emissão do token).
-- ------------------------------------------------------------
create or replace function public.senha_confirmada_recentemente(p_segundos integer default 120)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (select max((a ->> 'timestamp')::bigint)
       from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
      where a ->> 'method' = 'password')
    >= extract(epoch from now())::bigint - p_segundos,
    false);
$$;

revoke all on function public.senha_confirmada_recentemente(integer) from public, anon;
grant execute on function public.senha_confirmada_recentemente(integer) to authenticated;

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
  v_num integer;
  v_cliente text;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada. Entre novamente.';
  end if;

  if not public.senha_confirmada_recentemente() then
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
-- 2. profiles: super usuário só muda com senha recente; foto só da própria pasta (AUD-003, AUD-007)
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

  if new.is_super is distinct from old.is_super
     and not public.senha_confirmada_recentemente() then
    raise exception 'Confirme sua senha para alterar permissões.';
  end if;

  if old.is_super and not new.is_super
     and not exists (
       select 1 from public.profiles p where p.is_super and p.id <> old.id
     ) then
    raise exception 'Não é possível remover o último super usuário.';
  end if;

  -- A foto precisa estar na pasta do próprio usuário no bucket "avatars" (ou ser removida).
  if new.avatar_url is distinct from old.avatar_url
     and new.avatar_url is not null
     and new.avatar_url not like '%/storage/v1/object/public/avatars/' || new.id::text || '/%' then
    raise exception 'Foto de perfil inválida.';
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 3. Dados financeiros não se apagam (AUD-001, AUD-002)
-- ------------------------------------------------------------
drop policy if exists "pagamentos_delete" on public.pagamentos;
drop policy if exists "recibos_delete" on public.recibos;
revoke delete on public.pagamentos from anon, authenticated;
revoke delete on public.recibos from anon, authenticated;

-- Galpão com pagamentos não pode ser excluído.
create or replace function public.bloquear_exclusao_galpao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd bigint;
begin
  select count(*) into v_qtd from public.pagamentos where galpao_id = old.id;
  if v_qtd > 0 then
    raise exception 'O galpão "%" tem % pagamento(s) registrado(s) e não pode ser excluído. O histórico financeiro é preservado.',
      old.nome, v_qtd;
  end if;
  return old;
end;
$$;

drop trigger if exists bloquear_exclusao_galpao on public.galpoes;
create trigger bloquear_exclusao_galpao before delete on public.galpoes
  for each row execute function public.bloquear_exclusao_galpao();

-- Qualquer exclusão de pagamento ou recibo (SQL Editor, administrador) fica registrada
-- (a função auditar_exclusao_financeira é definida na seção 4b, mais abaixo).


-- ------------------------------------------------------------
-- 4. Tipo de item em uso não pode ser excluído (AUD-015)
--    pg_trigger_depth() > 1 = exclusão em cascata (ex.: galpão), que segue normal.
-- ------------------------------------------------------------
create or replace function public.bloquear_exclusao_tipo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd bigint;
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  select count(*) into v_qtd from public.itens_guardados where tipo_item_id = old.id;
  if v_qtd > 0 then
    raise exception 'O tipo "%" está em uso por % item(ns) e não pode ser excluído. Desative o tipo em vez de excluir.',
      old.nome, v_qtd;
  end if;
  return old;
end;
$$;

drop trigger if exists bloquear_exclusao_tipo on public.tipos_item;
create trigger bloquear_exclusao_tipo before delete on public.tipos_item
  for each row execute function public.bloquear_exclusao_tipo();

-- ------------------------------------------------------------
-- 4b. AUD-035 (achado durante a correção): excluir um galpão que tinha tipo de item próprio falhava,
--     porque o histórico tentava registrar o tipo apagado ligado ao galpão que também estava sendo apagado.
--     Agora, em exclusão em cascata, o galpão já registra tudo.
-- ------------------------------------------------------------
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
    -- tipo próprio de um galpão que está sendo apagado: o galpão já registra
    if old.galpao_id is null or exists (select 1 from public.galpoes g where g.id = old.galpao_id) then
      perform public.registrar_auditoria('tipo.excluido', 'tipo', old.id, old.galpao_id,
        format('Tipo "%s" excluído', old.nome), to_jsonb(old) - 'created_at');
    end if;
  end if;
  return null;
end;
$$;

-- A exclusão financeira também só aponta para o galpão se ele ainda existir.
create or replace function public.auditar_exclusao_financeira()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_galpao uuid := case when exists (select 1 from public.galpoes g where g.id = old.galpao_id) then old.galpao_id end;
begin
  if tg_table_name = 'pagamentos' then
    perform public.registrar_auditoria('pagamento.excluido', 'pagamento', old.id, v_galpao,
      format('Pagamento de %s EXCLUÍDO do banco (semana %s, status %s)',
             public.fmt_brl(old.valor), coalesce(old.semana_referencia::text, '?'), old.status),
      to_jsonb(old));
  else
    perform public.registrar_auditoria('recibo.excluido', 'recibo', old.id, v_galpao,
      format('Recibo nº %s EXCLUÍDO do banco', old.numero), to_jsonb(old));
  end if;
  return null;
end;
$$;

drop trigger if exists auditar_exclusao_pagamentos on public.pagamentos;
create trigger auditar_exclusao_pagamentos after delete on public.pagamentos
  for each row execute function public.auditar_exclusao_financeira();

drop trigger if exists auditar_exclusao_recibos on public.recibos;
create trigger auditar_exclusao_recibos after delete on public.recibos
  for each row execute function public.auditar_exclusao_financeira();

-- ------------------------------------------------------------
-- 5. Fotos de perfil: bucket público, mas sem listagem (AUD-006)
--    As URLs públicas continuam funcionando sem a política de leitura.
-- ------------------------------------------------------------
drop policy if exists "avatars_public_read" on storage.objects;

-- ------------------------------------------------------------
-- 6. Funções auxiliares fechadas para quem não fez login (AUD-008)
--    O papel "authenticated" continua com acesso (as regras de linha chamam estas funções).
-- ------------------------------------------------------------
revoke execute on function public.is_super() from public, anon;
revoke execute on function public.pode_acessar_galpao(uuid) from public, anon;
revoke execute on function public.auth_galpao_ids() from public, anon;
grant execute on function public.is_super() to authenticated;
grant execute on function public.pode_acessar_galpao(uuid) to authenticated;
grant execute on function public.auth_galpao_ids() to authenticated;

-- Funções de gatilho não precisam ser chamáveis por ninguém.
revoke execute on function public.proteger_colunas_profile() from public, anon, authenticated;
revoke execute on function public.auditar_clientes() from public, anon, authenticated;
revoke execute on function public.auditar_itens() from public, anon, authenticated;
revoke execute on function public.auditar_tipos() from public, anon, authenticated;
revoke execute on function public.auditar_precos() from public, anon, authenticated;
revoke execute on function public.auditar_galpoes() from public, anon, authenticated;
revoke execute on function public.auditar_membros() from public, anon, authenticated;
revoke execute on function public.auditar_profiles() from public, anon, authenticated;
revoke execute on function public.bloquear_exclusao_galpao() from public, anon, authenticated;
revoke execute on function public.bloquear_exclusao_tipo() from public, anon, authenticated;
revoke execute on function public.auditar_exclusao_financeira() from public, anon, authenticated;

-- Funções criadas daqui para frente nascem fechadas (cada migração concede o que for preciso).
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- ------------------------------------------------------------
-- 7. Limites de tamanho dos textos (AUD-011). NOT VALID: vale para o que for gravado daqui
--    para frente e não reclama de dados antigos.
-- ------------------------------------------------------------
alter table public.galpoes drop constraint if exists galpoes_tamanhos;
alter table public.galpoes add constraint galpoes_tamanhos
  check (char_length(nome) <= 120 and char_length(coalesce(endereco, '')) <= 200) not valid;

alter table public.clientes drop constraint if exists clientes_tamanhos;
alter table public.clientes add constraint clientes_tamanhos
  check (char_length(nome) <= 120
         and char_length(coalesce(telefone, '')) <= 30
         and char_length(coalesce(whatsapp, '')) <= 30
         and char_length(coalesce(observacoes, '')) <= 500) not valid;

alter table public.tipos_item drop constraint if exists tipos_item_tamanhos;
alter table public.tipos_item add constraint tipos_item_tamanhos
  check (char_length(nome) <= 120) not valid;

alter table public.itens_guardados drop constraint if exists itens_tamanhos;
alter table public.itens_guardados add constraint itens_tamanhos
  check (char_length(coalesce(identificacao, '')) <= 120) not valid;

alter table public.profiles drop constraint if exists profiles_tamanhos;
alter table public.profiles add constraint profiles_tamanhos
  check (char_length(nome) <= 120) not valid;

-- O nome vindo do cadastro nunca passa de 120 caracteres.
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
    left(coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)), 120),
    false,
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 8. registrar_pagamento: valor máximo e semana não pode estar longe no futuro (AUD-012)
--    (o resto é igual à versão da 0012)
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
  v_hoje date := (now() at time zone 'America/Fortaleza')::date;
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
  if p_valor > 100000 then
    raise exception 'Valor acima do limite permitido (R$ 100.000,00).';
  end if;
  if p_forma is null or p_forma not in ('dinheiro', 'pix', 'cartao') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_semana is null then
    raise exception 'Informe a semana de referência.';
  end if;
  if p_semana > v_hoje + 56 then
    raise exception 'A semana de referência está longe demais no futuro.';
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
      v_hoje, p_semana,
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

-- As funções recriadas mantêm as permissões da versão anterior; reafirmadas aqui por segurança.
revoke all on function public.cancelar_pagamento(uuid, text) from public, anon;
revoke all on function public.registrar_pagamento(uuid, uuid, numeric, text, date, text) from public, anon;
grant execute on function public.cancelar_pagamento(uuid, text) to authenticated;
grant execute on function public.registrar_pagamento(uuid, uuid, numeric, text, date, text) to authenticated;
revoke execute on function public.handle_new_user() from public, authenticated;

-- ------------------------------------------------------------
-- 9. Fim: registra esta migração
-- ------------------------------------------------------------
insert into public.migracoes_aplicadas (nome) values ('0014_endurecimento')
on conflict (nome) do nothing;

-- Conferência (rode depois, deve listar a 0014 no fim):
--   select nome, aplicada_em from public.migracoes_aplicadas order by nome;
