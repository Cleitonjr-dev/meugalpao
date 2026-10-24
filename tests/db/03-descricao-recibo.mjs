// 03-descricao-recibo: ver docs/PLANO_ENTREGA.md (Parte 2.1)
import { db, ok, terminar } from './_base.mjs'

const U = '11111111-1111-1111-1111-111111111111'
const G = 'aaaaaaaa-0000-0000-0000-000000000001'
const C1 = 'cccccccc-0000-0000-0000-000000000001' // sábado, com itens
const C2 = 'cccccccc-0000-0000-0000-000000000002' // sem itens
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values ('${U}', 'dev@x.com', '{"nome":"dev"}');
  update public.profiles set is_super = true where id = '${U}';
  select set_config('request.jwt.claims', '{"sub":"${U}","amr":[{"method":"password","timestamp":' || extract(epoch from now())::bigint || '}]}', false);
  insert into galpoes (id, nome) values ('${G}', 'G1');
  insert into clientes (id, galpao_id, nome, dia_pagamento, created_at) values
    ('${C1}','${G}','Cleiton Junior','sabado', now() - interval '60 days'),
    ('${C2}','${G}','Sem Itens','sabado', now() - interval '60 days');
`)
const tipoRoupa = (await db.query(`select id from tipos_item where nome = 'Carrinho de roupa'`)).rows[0].id
const tipoCarro = (await db.query(`select id from tipos_item where nome = 'Carro'`)).rows[0].id
await db.query(`insert into itens_guardados (cliente_id, galpao_id, tipo_item_id, quantidade) values ($1,$2,$3,1)`, [C1, G, tipoRoupa])

const reg = async (c, semana) => (await db.query(`select public.registrar_pagamento($1,$2,$3,'dinheiro',$4,null) as r`, [G, c, 110, semana])).rows[0].r

const p1 = await reg(C1, '2025-10-04')
ok(p1.pagamento.descricao === 'Carrinho de roupa', 'recibo guarda o item pago', p1.pagamento.descricao)

// troca os itens DEPOIS do pagamento: o pagamento antigo não pode mudar
await db.exec(`delete from itens_guardados where cliente_id = '${C1}'`)
await db.query(`insert into itens_guardados (cliente_id, galpao_id, tipo_item_id, identificacao, quantidade) values ($1,$2,$3,'ABC1D23',2)`, [C1, G, tipoCarro])
const dep = (await db.query(`select descricao from pagamentos where id = $1`, [p1.pagamento.id])).rows[0].descricao
ok(dep === 'Carrinho de roupa', 'trocar os itens depois NÃO muda o pagamento já feito', dep)

const p2 = await reg(C1, '2025-10-11')
ok(p2.pagamento.descricao === 'Carro — ABC1D23 (x2)', 'novo pagamento guarda os itens da época, com identificação e quantidade', p2.pagamento.descricao)

await db.query(`insert into itens_guardados (cliente_id, galpao_id, tipo_item_id, quantidade) values ($1,$2,$3,1)`, [C1, G, tipoRoupa])
const p3 = await reg(C1, '2025-10-18')
ok(p3.pagamento.descricao === 'Carrinho de roupa; Carro — ABC1D23 (x2)', 'vários itens ficam separados por ponto e vírgula', p3.pagamento.descricao)

const p4 = await reg(C2, '2025-10-04')
ok(p4.pagamento.descricao === null, 'cliente sem itens: descrição vazia (recibo não mostra a linha)')

await db.query(`update itens_guardados set ativo = false where cliente_id = $1 and tipo_item_id = $2`, [C1, tipoCarro])
const p5 = await reg(C1, '2025-10-25')
ok(p5.pagamento.descricao === 'Carrinho de roupa', 'item inativo não entra na descrição', p5.pagamento.descricao)

const lista = (await db.query(`select public.listar_pagamentos($1) as r`, [G])).rows[0].r
ok(lista.itens.every((i) => 'descricao' in i), 'listar_pagamentos devolve a descrição')
ok(lista.itens.find((i) => i.id === p1.pagamento.id).descricao === 'Carrinho de roupa', 'e é a da época do pagamento')

const rec = await db.query(`select * from public.pagamentos_recentes($1, '2000-01-01')`, [G])
ok(rec.rows.length === 5 && rec.rows.every((r) => 'descricao' in r), 'pagamentos_recentes devolve a descrição')

const perm = await db.query(`select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname in ('registrar_pagamento','listar_pagamentos','pagamentos_recentes')`)
ok(perm.rows.every((r) => !r.anon && r.auth), 'permissões mantidas (anônimo sem acesso, logado com acesso)')

terminar('DESCRIÇÃO DO RECIBO')
