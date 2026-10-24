-- ============================================================
-- 0013: Fechamento do dia
-- Resumo do caixa de um dia: total recebido, por forma de pagamento,
-- por quem recebeu e a lista de pagamentos. Cancelados ficam fora dos totais.
-- Roda sob as regras de acesso de quem chama (security invoker): quem não
-- tem acesso ao galpão recebe tudo zerado.
-- Rode UMA vez, depois da 0012.
-- ============================================================

create or replace function public.fechamento_dia(p_galpao uuid, p_data date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  with dia as (
    select p.id, p.cliente_id, p.valor, p.forma_pagamento, p.status, p.criado_por, p.created_at,
           p.descricao, c.nome as cliente_nome, r.numero as recibo_numero
    from public.pagamentos p
    join public.clientes c on c.id = p.cliente_id
    left join public.recibos r on r.pagamento_id = p.id
    where p.galpao_id = p_galpao
      and p.data_pagamento = p_data
  ),
  validos as (
    select * from dia where status <> 'cancelado'
  ),
  por_forma as (
    select forma_pagamento as forma, sum(valor) as total, count(*) as quantidade
    from validos
    group by forma_pagamento
  ),
  por_usuario as (
    select criado_por as usuario_id,
           coalesce(public.nome_usuario(criado_por), 'Não informado') as nome,
           sum(valor) as total,
           count(*) as quantidade,
           coalesce(sum(valor) filter (where forma_pagamento = 'dinheiro'), 0) as dinheiro,
           coalesce(sum(valor) filter (where forma_pagamento = 'pix'), 0) as pix,
           coalesce(sum(valor) filter (where forma_pagamento = 'cartao'), 0) as cartao
    from validos
    group by criado_por
  ),
  lista as (
    select * from dia order by created_at, id limit 500
  )
  select jsonb_build_object(
    'data', p_data,
    'total', coalesce((select sum(valor) from validos), 0),
    'quantidade', (select count(*) from validos),
    'cancelados', jsonb_build_object(
      'quantidade', (select count(*) from dia where status = 'cancelado'),
      'total', coalesce((select sum(valor) from dia where status = 'cancelado'), 0)
    ),
    'por_forma', coalesce(
      (select jsonb_agg(jsonb_build_object('forma', forma, 'total', total, 'quantidade', quantidade)
                        order by total desc) from por_forma),
      '[]'::jsonb),
    'por_usuario', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'usuario_id', usuario_id, 'nome', nome, 'total', total, 'quantidade', quantidade,
                'dinheiro', dinheiro, 'pix', pix, 'cartao', cartao)
              order by total desc, nome) from por_usuario),
      '[]'::jsonb),
    'pagamentos', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'id', id, 'hora', created_at, 'cliente', cliente_nome, 'valor', valor,
                'forma', forma_pagamento, 'status', status, 'recibo', recibo_numero,
                'descricao', descricao, 'recebido_por', public.nome_usuario(criado_por))
              order by created_at, id) from lista),
      '[]'::jsonb),
    'truncado', (select count(*) from dia) > 500
  )
  into v_resultado;

  return v_resultado;
end;
$$;

-- Funções novas são públicas por padrão no Supabase: libera só para quem está logado.
revoke all on function public.fechamento_dia(uuid, date) from public, anon;
grant execute on function public.fechamento_dia(uuid, date) to authenticated;
