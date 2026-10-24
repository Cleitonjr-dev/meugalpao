// 06-endurecimento: migração 0014 (correções da auditoria de 17/10/2026, docs/auditoria/)
import { db, ok, terminar } from './_base.mjs'

const SUPER = '11111111-1111-1111-1111-111111111111'
const MARIA = '22222222-2222-2222-2222-222222222222'
const G1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const G2 = 'aaaaaaaa-0000-0000-0000-000000000002'
const C1 = 'cccccccc-0000-0000-0000-000000000001'

const agora = () => Math.floor(Date.now() / 1000)
// simula o token de quem fez login: senhaHa = segundos desde que digitou a senha
async function como(usuario, { senhaHa = 5, semAmr = false } = {}) {
  const claims = { sub: usuario, iat: agora() - 5 }
  if (!semAmr) claims.amr = [{ method: 'password', timestamp: agora() - senhaHa }]
  await db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false); set role authenticated;`)
}
const admin = () => db.exec(`reset role; select set_config('request.jwt.claims', '', false);`)
const q = async (sql, params = []) => (await db.query(sql, params)).rows
async function falha(sql, params = []) {
  try {
    await db.query(sql, params)
    return null
  } catch (e) {
    return e.message
  }
}

await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${SUPER}', 'dev@x.com', '{"nome":"Dev"}'),
    ('${MARIA}', 'maria@x.com', '{"nome":"Maria"}');
  update public.profiles set is_super = true where id = '${SUPER}';
  insert into galpoes (id, nome) values ('${G1}', 'G1'), ('${G2}', 'G2');
  insert into galpao_membros (galpao_id, profile_id) values ('${G1}', '${MARIA}');
  insert into clientes (id, galpao_id, nome, dia_pagamento, created_at) values
    ('${C1}', '${G1}', 'Cliente Um', 'quarta', now() - interval '30 days');
`)

// ---------- registro das migrações (AUD-024) ----------
await admin()
const migr = await q(`select nome from migracoes_aplicadas order by nome`)
ok(migr.length === 14 && migr[0].nome === '0001_init' && migr[13].nome === '0014_endurecimento', 'ledger lista as 14 migrações', String(migr.length))
await como(MARIA)
ok(/permission denied/.test((await falha(`select * from migracoes_aplicadas`)) ?? ''), 'usuário logado não lê o ledger')

// ---------- limites de valor e de semana (AUD-012) ----------
await como(MARIA)
let e = await falha(`select public.registrar_pagamento($1,$2,100001,'pix','2025-10-08',null)`, [G1, C1])
ok(/limite permitido/.test(e ?? ''), 'valor acima de R$ 100.000,00 é recusado', e)
const hoje = (await q(`select (now() at time zone 'America/Fortaleza')::date::text as d`))[0].d
const quartaLonge = (
  await q(`select (d::date)::text as d from generate_series($1::date + 70, $1::date + 76, interval '1 day') d where extract(dow from d) = 3`, [hoje])
)[0].d
e = await falha(`select public.registrar_pagamento($1,$2,50,'pix',$3,null)`, [G1, C1, quartaLonge])
ok(/longe demais no futuro/.test(e ?? ''), 'semana a mais de 8 semanas no futuro é recusada', e)
const pag = (await q(`select public.registrar_pagamento($1,$2,100000,'pix','2025-10-08',null) as r`, [G1, C1]))[0].r
ok(Number(pag.pagamento.valor) === 100000, 'valor exatamente no limite é aceito')

// ---------- pagamentos e recibos não se apagam (AUD-002) ----------
await como(SUPER)
e = await falha(`delete from pagamentos where id = $1`, [pag.pagamento.id])
ok(/permission denied/.test(e ?? ''), 'nem o super usuário apaga pagamento pela API', e)
e = await falha(`delete from recibos where pagamento_id = $1`, [pag.pagamento.id])
ok(/permission denied/.test(e ?? ''), 'nem o super usuário apaga recibo pela API', e)
await admin()
const politicas = await q(
  `select polname from pg_policy where polrelid in ('public.pagamentos'::regclass, 'public.recibos'::regclass) and polcmd = 'd'`,
)
ok(politicas.length === 0, 'não existe mais política de exclusão em pagamentos/recibos', JSON.stringify(politicas))

// ---------- galpão com pagamentos não é excluído (AUD-001) ----------
await como(SUPER)
e = await falha(`delete from galpoes where id = $1`, [G1])
ok(/não pode ser excluído/.test(e ?? '') && /1 pagamento/.test(e ?? ''), 'galpão com pagamentos não pode ser excluído', e)
ok((await q(`select count(*)::int as n from galpoes where id = $1`, [G1]))[0].n === 1, 'o galpão continua lá')
await db.query(`insert into tipos_item (id, galpao_id, nome, preco_semanal) values ('dddddddd-0000-0000-0000-000000000009', $1, 'Tipo só do G2', 10)`, [G2])
await db.query(`insert into clientes (id, galpao_id, nome, dia_pagamento) values ('cccccccc-0000-0000-0000-000000000002', $1, 'Cliente G2', 'sabado')`, [G2])
await db.query(`insert into itens_guardados (cliente_id, galpao_id, tipo_item_id) values ('cccccccc-0000-0000-0000-000000000002', $1, 'dddddddd-0000-0000-0000-000000000009')`, [G2])
e = await falha(`delete from galpoes where id = $1`, [G2])
ok(e === null, 'galpão sem pagamentos pode ser excluído, mesmo com tipo próprio em uso (exclusão em cascata)', e)

// ---------- exclusão administrativa deixa rastro ----------
await admin()
await db.exec(`delete from pagamentos where id = '${pag.pagamento.id}'`)
const rastro = await q(`select acao from auditoria where acao in ('pagamento.excluido', 'recibo.excluido') order by acao`)
ok(rastro.map((r) => r.acao).join() === 'pagamento.excluido,recibo.excluido', 'excluir pelo SQL Editor registra pagamento e recibo no histórico', JSON.stringify(rastro))

// ---------- tipo em uso (AUD-015) ----------
await como(SUPER)
await db.query(`insert into tipos_item (id, nome, preco_semanal) values ('dddddddd-0000-0000-0000-000000000001', 'Tipo em uso', 50)`)
await db.query(`insert into tipos_item (id, nome, preco_semanal) values ('dddddddd-0000-0000-0000-000000000002', 'Tipo livre', 50)`)
await db.query(`insert into itens_guardados (cliente_id, galpao_id, tipo_item_id) values ($1, $2, 'dddddddd-0000-0000-0000-000000000001')`, [C1, G1])
e = await falha(`delete from tipos_item where id = 'dddddddd-0000-0000-0000-000000000001'`)
ok(/em uso por 1 item/.test(e ?? ''), 'tipo em uso não pode ser excluído', e)
e = await falha(`delete from tipos_item where id = 'dddddddd-0000-0000-0000-000000000002'`)
ok(e === null, 'tipo sem uso pode ser excluído', e)
await db.query(`update tipos_item set ativo = false where id = 'dddddddd-0000-0000-0000-000000000001'`)
ok(true, 'tipo em uso pode ser desativado')

// ---------- super usuário só com senha recente (AUD-003) ----------
await como(SUPER, { senhaHa: 500 })
e = await falha(`update profiles set is_super = true where id = $1`, [MARIA])
ok(/Confirme sua senha/.test(e ?? ''), 'promover super usuário sem senha recente é recusado', e)
await como(SUPER, { semAmr: true })
e = await falha(`update profiles set is_super = true where id = $1`, [MARIA])
ok(/Confirme sua senha/.test(e ?? ''), 'token sem amr também é recusado', e)
await como(SUPER, { senhaHa: 5 })
e = await falha(`update profiles set is_super = true where id = $1`, [MARIA])
ok(e === null, 'com senha recente a promoção funciona', e)
e = await falha(`update profiles set nome = 'Dev Silva' where id = $1`, [SUPER])
ok(e === null, 'mudar o próprio nome não pede senha', e)
await como(SUPER, { senhaHa: 500 })
e = await falha(`update profiles set is_super = false where id = $1`, [MARIA])
ok(/Confirme sua senha/.test(e ?? ''), 'remover super usuário sem senha recente é recusado', e)
await como(SUPER, { senhaHa: 5 })
await db.query(`update profiles set is_super = false where id = $1`, [MARIA])

// ---------- foto de perfil (AUD-007) ----------
await como(MARIA)
e = await falha(`update profiles set avatar_url = 'https://evil.example/pixel.png' where id = $1`, [MARIA])
ok(/Foto de perfil inválida/.test(e ?? ''), 'avatar de site externo é recusado', e)
e = await falha(`update profiles set avatar_url = $2 where id = $1`, [MARIA, `https://x.supabase.co/storage/v1/object/public/avatars/${SUPER}/1.png`])
ok(/Foto de perfil inválida/.test(e ?? ''), 'avatar na pasta de outro usuário é recusado', e)
e = await falha(`update profiles set avatar_url = $2 where id = $1`, [MARIA, `https://x.supabase.co/storage/v1/object/public/avatars/${MARIA}/1.png`])
ok(e === null, 'avatar na própria pasta é aceito', e)
e = await falha(`update profiles set avatar_url = null where id = $1`, [MARIA])
ok(e === null, 'remover o avatar é aceito', e)

// ---------- limites de tamanho (AUD-011) ----------
await como(MARIA)
e = await falha(`insert into clientes (galpao_id, nome) values ($1, repeat('a', 121))`, [G1])
ok(/clientes_tamanhos/.test(e ?? ''), 'nome de cliente com mais de 120 caracteres é recusado', e)
e = await falha(`insert into clientes (galpao_id, nome, observacoes) values ($1, 'Ok', repeat('a', 501))`, [G1])
ok(/clientes_tamanhos/.test(e ?? ''), 'observações com mais de 500 caracteres são recusadas', e)
e = await falha(`insert into clientes (galpao_id, nome, telefone) values ($1, 'Ok', repeat('1', 31))`, [G1])
ok(/clientes_tamanhos/.test(e ?? ''), 'telefone com mais de 30 caracteres é recusado', e)
await admin()
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('44444444-4444-4444-4444-444444444444', 'longo@x.com', jsonb_build_object('nome', repeat('n', 400)))`)
ok((await q(`select char_length(nome)::int as n from profiles where id = '44444444-4444-4444-4444-444444444444'`))[0].n === 120, 'nome longo do cadastro é cortado em 120 caracteres')

// ---------- o que um usuário sem login consegue chamar (AUD-008) ----------
await admin()
const anon = await q(
  `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute') order by 1`,
)
ok(anon.map((f) => f.proname).join() === 'verificar_recibo', 'a única função chamável sem login é verificar_recibo', anon.map((f) => f.proname).join())
const logado = await q(
  `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('is_super', 'pode_acessar_galpao', 'auth_galpao_ids', 'senha_confirmada_recentemente') and has_function_privilege('authenticated', p.oid, 'execute')`,
)
ok(logado[0].n === 4, 'as funções que as regras de linha usam continuam liberadas para quem fez login')

// ---------- as regras de linha continuam funcionando depois dos revokes ----------
await como(MARIA)
const visiveis = await q(`select id from clientes where galpao_id = $1`, [G1])
ok(visiveis.length === 1, 'usuário comum continua vendo os clientes do próprio galpão')
await db.exec(`reset role; select set_config('request.jwt.claims', '', false); set role anon;`)
ok(/permission denied/.test((await falha(`select public.is_super()`)) ?? ''), 'sem login, is_super() é recusada')

terminar('ENDURECIMENTO')
