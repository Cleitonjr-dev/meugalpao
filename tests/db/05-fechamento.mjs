// 05-fechamento: função fechamento_dia (migração 0013). Ver docs/PLANO_ENTREGA.md (Parte 1.4)
import { db, ok, terminar } from './_base.mjs'

const SUPER = '11111111-1111-1111-1111-111111111111'
const MARIA = '22222222-2222-2222-2222-222222222222'
const JOAO = '33333333-3333-3333-3333-333333333333'
const G1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const G2 = 'aaaaaaaa-0000-0000-0000-000000000002'
const C1 = 'cccccccc-0000-0000-0000-000000000001'
const C2 = 'cccccccc-0000-0000-0000-000000000002'
const C3 = 'cccccccc-0000-0000-0000-000000000003'

const token = (id) =>
  `select set_config('request.jwt.claims', '{"sub":"${id}","amr":[{"method":"password","timestamp":' || extract(epoch from now())::bigint || '}]}', false);`
const como = (id) => db.exec(`reset role; ${token(id)} set role authenticated;`)
const fechar = async (galpao, dia) =>
  (await db.query(`select public.fechamento_dia($1,$2) as r`, [galpao, dia])).rows[0].r
const pagar = (galpao, cliente, valor, forma, semana) =>
  db.query(`select public.registrar_pagamento($1,$2,$3,$4,$5,null) as r`, [galpao, cliente, valor, forma, semana])

await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${SUPER}', 'dev@x.com', '{"nome":"Dev"}'),
    ('${MARIA}', 'maria@x.com', '{"nome":"Maria"}'),
    ('${JOAO}', 'joao@x.com', '{"nome":"João"}');
  update public.profiles set is_super = true where id = '${SUPER}';
  insert into galpoes (id, nome) values ('${G1}', 'G1'), ('${G2}', 'G2');
  insert into galpao_membros (galpao_id, profile_id) values ('${G1}', '${MARIA}'), ('${G1}', '${JOAO}');
  insert into clientes (id, galpao_id, nome, dia_pagamento, created_at) values
    ('${C1}','${G1}','Cliente Um','quarta', now() - interval '60 days'),
    ('${C2}','${G1}','Cliente Dois','quarta', now() - interval '60 days'),
    ('${C3}','${G2}','Cliente Três','quarta', now() - interval '60 days');
`)

// ---- dia 08/10: Maria recebe dinheiro e pix; João recebe cartão; um pagamento é cancelado ----
await como(MARIA)
await pagar(G1, C1, 100, 'dinheiro', '2025-10-08')
await pagar(G1, C2, 50.5, 'pix', '2025-10-08')
await como(JOAO)
await pagar(G1, C1, 30, 'cartao', '2025-10-01')
const pCanc = (await pagar(G1, C2, 70, 'dinheiro', '2025-10-01')).rows[0].r.pagamento.id

// todos foram registrados "hoje" pelo banco; usamos a data de hoje como dia do fechamento
const hoje = (await db.query(`select current_date::text as d`)).rows[0].d
await como(JOAO)
await db.query(`select public.cancelar_pagamento($1,$2)`, [pCanc, 'valor lançado errado'])
// pagamento de outro galpão, no mesmo dia
await como(SUPER)
await pagar(G2, C3, 999, 'pix', '2025-10-08')

// ---- como Maria, no G1 ----
await como(MARIA)
const f = await fechar(G1, hoje)
ok(Number(f.total) === 180.5, 'total soma só os pagamentos válidos do galpão', String(f.total))
ok(Number(f.quantidade) === 3, 'quantidade conta só os válidos', String(f.quantidade))
ok(Number(f.cancelados.quantidade) === 1 && Number(f.cancelados.total) === 70, 'cancelado aparece à parte', JSON.stringify(f.cancelados))
const forma = Object.fromEntries(f.por_forma.map((x) => [x.forma, Number(x.total)]))
ok(forma.dinheiro === 100 && forma.pix === 50.5 && forma.cartao === 30, 'separa por forma de pagamento (cancelado fora)', JSON.stringify(forma))
const usu = Object.fromEntries(f.por_usuario.map((x) => [x.nome, x]))
ok(Number(usu['Maria'].total) === 150.5 && Number(usu['Maria'].dinheiro) === 100 && Number(usu['Maria'].pix) === 50.5, 'Maria: dinheiro e pix', JSON.stringify(usu['Maria']))
ok(Number(usu['João'].total) === 30 && Number(usu['João'].cartao) === 30, 'João: só cartão (o cancelado dele não conta)', JSON.stringify(usu['João']))
ok(f.pagamentos.length === 4, 'lista traz os 4 pagamentos do dia, inclusive o cancelado', String(f.pagamentos.length))
ok(f.pagamentos.some((p) => p.status === 'cancelado' && p.cliente === 'Cliente Dois'), 'cancelado marcado na lista')
ok(f.pagamentos.every((p) => p.recebido_por), 'lista mostra quem recebeu')
ok(f.truncado === false, 'não está truncado')

// ---- outro dia: vazio ----
const v = await fechar(G1, '2000-01-01')
ok(Number(v.total) === 0 && v.pagamentos.length === 0 && v.por_forma.length === 0, 'dia sem pagamentos vem zerado')

// ---- isolamento ----
const outro = await fechar(G2, hoje)
ok(Number(outro.total) === 0 && outro.pagamentos.length === 0, 'Maria NÃO vê o fechamento de outro galpão', String(outro.total))
await como(SUPER)
const g2 = await fechar(G2, hoje)
ok(Number(g2.total) === 999, 'super usuário vê o outro galpão', String(g2.total))

// ---- anônimo ----
await db.exec(`reset role; select set_config('request.jwt.claims', '', false); set role anon;`)
try {
  await db.query(`select public.fechamento_dia($1,$2)`, [G1, hoje])
  ok(false, 'anônimo NÃO pode ver fechamento')
} catch (e) {
  ok(/permission denied/.test(e.message), 'anônimo NÃO pode ver fechamento', e.message)
}

// ---- mais de 500 pagamentos no dia: lista limitada, totais completos ----
await db.exec(`reset role; ${token(SUPER)}`)
await db.exec(`
  insert into pagamentos (galpao_id, cliente_id, valor, data_pagamento, semana_referencia, forma_pagamento, status)
  select '${G2}', '${C3}', 1, '2024-01-10', date '2000-01-05' + (g * 7), 'pix', 'pago'
  from generate_series(1, 520) g;
`)
await como(SUPER)
const grande = await fechar(G2, '2024-01-10')
ok(grande.pagamentos.length === 500 && grande.truncado === true, 'lista limita em 500 e avisa', `${grande.pagamentos.length} / ${grande.truncado}`)
ok(Number(grande.total) === 520 && Number(grande.quantidade) === 520, 'totais continuam completos', String(grande.total))
ok(grande.por_usuario[0].nome === 'Não informado', 'pagamento sem usuário aparece como "Não informado"', grande.por_usuario[0].nome)

terminar('FECHAMENTO')
