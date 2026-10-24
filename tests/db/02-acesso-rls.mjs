// 02-acesso-rls: ver docs/PLANO_ENTREGA.md (Parte 2.1)
import { db, ok, terminar } from './_base.mjs'

const SUPER = '11111111-1111-1111-1111-111111111111'
const MARIA = '22222222-2222-2222-2222-222222222222'
const G1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const G2 = 'aaaaaaaa-0000-0000-0000-000000000002'
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${SUPER}', 'dev@x.com', '{"nome":"dev"}'), ('${MARIA}', 'maria@x.com', '{"nome":"maria"}');
  update public.profiles set is_super = true where id = '${SUPER}';
  insert into galpoes (id, nome) values ('${G1}', 'G1'), ('${G2}', 'G2');
  insert into galpao_membros (galpao_id, profile_id) values ('${G1}', '${MARIA}');
  insert into clientes (id, galpao_id, nome, dia_pagamento, created_at) values
    ('cccccccc-0000-0000-0000-000000000001','${G1}','Cliente Um','quarta', now() - interval '30 days'),
    ('cccccccc-0000-0000-0000-000000000002','${G2}','Cliente Dois','quarta', now() - interval '30 days');
  select set_config('request.jwt.claims', '{"sub":"${SUPER}","amr":[{"method":"password","timestamp":' || extract(epoch from now())::bigint || '}]}', false);
  select public.registrar_pagamento('${G1}','cccccccc-0000-0000-0000-000000000001', 10, 'pix', '2025-10-08', null);
  select public.registrar_pagamento('${G2}','cccccccc-0000-0000-0000-000000000002', 20, 'pix', '2025-10-08', null);
`)
const codG2 = (await db.query(`select codigo from recibos where galpao_id = '${G2}'`)).rows[0].codigo

// ---- como Maria (membro só do G1) ----
await db.exec(`select set_config('request.jwt.claims', '{"sub":"${MARIA}","amr":[{"method":"password","timestamp":' || extract(epoch from now())::bigint || '}]}', false); set role authenticated;`)
const q = async (sql, p = []) => (await db.query(sql, p)).rows
let r = (await q(`select public.listar_pagamentos($1) as r`, [G1]))[0].r
ok(r.total === 1, 'Maria vê os pagamentos do próprio galpão', `total=${r.total}`)
r = (await q(`select public.listar_pagamentos($1) as r`, [G2]))[0].r
ok(r.total === 0 && r.itens.length === 0, 'Maria NÃO vê pagamentos de outro galpão (RLS vale dentro da função)', `total=${r.total}`)
r = (await q(`select public.relatorio_resumo($1,$2,$3,$4) as r`, [G2, '2025-01-01', '2025-12-31', '2025-10-08']))[0].r
ok(Number(r.total_geral) === 0, 'Maria NÃO soma valores de outro galpão no relatório', String(r.total_geral))
const rec = await q(`select * from public.pagamentos_recentes($1,$2)`, [G2, '2000-01-01'])
ok(rec.length === 0, 'Maria NÃO vê pagamentos recentes de outro galpão')
try {
  await db.query(`insert into recibos (galpao_id, pagamento_id, numero) select galpao_id, id, 99 from pagamentos limit 1`)
  ok(false, 'Maria não consegue inserir recibo direto')
} catch (e) { ok(true, 'Maria não consegue inserir recibo direto', e.message.slice(0, 60)) }
try {
  await db.query(`update profiles set is_super = true where id = '${MARIA}'`)
  const s = (await q(`select is_super from profiles where id = '${MARIA}'`))[0].is_super
  ok(s === false, 'Maria não vira super usuário')
} catch (e) { ok(true, 'Maria não vira super usuário', e.message.slice(0, 60)) }

// ---- como anônimo (sem login) ----
await db.exec(`reset role; select set_config('request.jwt.claims', '', false); set role anon;`)
const ver = (await q(`select public.verificar_recibo($1) as r`, [codG2]))[0].r
ok(ver && ver.situacao === 'valido' && ver.cliente === 'Cliente D.', 'anônimo consegue verificar um recibo pelo código', JSON.stringify(ver))
try {
  await db.query(`select public.listar_pagamentos($1)`, [G1])
  ok(false, 'anônimo NÃO pode listar pagamentos')
} catch (e) { ok(/permission denied/.test(e.message), 'anônimo NÃO pode listar pagamentos', e.message) }
try {
  await db.query(`select * from recibos`)
  ok(false, 'anônimo NÃO lê a tabela de recibos')
} catch (e) { ok(/permission denied/.test(e.message), 'anônimo NÃO lê a tabela de recibos', e.message) }
try {
  await db.query(`select public.registrar_pagamento($1,$2,1,'pix','2025-10-15',null)`, [G1, 'cccccccc-0000-0000-0000-000000000001'])
  ok(false, 'anônimo NÃO registra pagamento')
} catch (e) { ok(/permission denied/.test(e.message), 'anônimo NÃO registra pagamento', e.message) }

terminar('ACESSO')
