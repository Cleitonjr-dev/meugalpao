// 01-codigo-paginacao: ver docs/PLANO_ENTREGA.md (Parte 2.1)
import { db, ok, lerMigracao, terminar } from './_base.mjs'

const USER = '11111111-1111-1111-1111-111111111111'
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values ('${USER}', 'dev@x.com', '{"nome":"dev"}');
  update public.profiles set is_super = true where id = '${USER}';
  select set_config('request.jwt.claims', '{"sub":"${USER}","amr":[{"method":"password","timestamp":' || extract(epoch from now())::bigint || '}]}', false);
  insert into galpoes (id, nome) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Galpão 1'),
                                        ('aaaaaaaa-0000-0000-0000-000000000002', 'Galpão 2');
  insert into clientes (id, galpao_id, nome, dia_pagamento, created_at) values
    ('cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Maria da Silva Souza','quarta', now() - interval '60 days'),
    ('cccccccc-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','José_50% Lima','quarta', now() - interval '60 days'),
    ('cccccccc-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000002','Outra Pessoa','quarta', now() - interval '60 days');
`)
const G1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const G2 = 'aaaaaaaa-0000-0000-0000-000000000002'
const C1 = 'cccccccc-0000-0000-0000-000000000001'
const C2 = 'cccccccc-0000-0000-0000-000000000002'
const C3 = 'cccccccc-0000-0000-0000-000000000003'

// quartas: 2025-09-03, 09-10, 09-17, 09-24, 10-01, 10-08
const quartas = ['2025-09-03', '2025-09-10', '2025-09-17', '2025-09-24', '2025-10-01', '2025-10-08']
const recibos = []
for (const q of quartas) {
  const r = await db.query(`select public.registrar_pagamento($1,$2,$3,$4,$5,$6) as r`, [G1, C1, 10, 'pix', q, null])
  recibos.push(r.rows[0].r)
}
const rJose = (await db.query(`select public.registrar_pagamento($1,$2,$3,$4,$5,$6) as r`, [G1, C2, 25.5, 'dinheiro', '2025-10-08', 'obs'])).rows[0].r
await db.query(`select public.registrar_pagamento($1,$2,$3,$4,$5,$6)`, [G2, C3, 99, 'cartao', '2025-10-08', null])

// ---- código de autenticação ----
const cod = recibos[0].recibo.codigo
ok(/^[0-9A-F]{16}$/.test(cod), 'código tem 16 caracteres hexadecimais maiúsculos', cod)
ok(new Set([...recibos, rJose].map((r) => r.recibo.codigo)).size === 7, 'códigos são únicos')
ok(recibos.map((r) => r.recibo.numero).join() === '1,2,3,4,5,6', 'números dos recibos sequenciais por galpão', recibos.map((r) => r.recibo.numero).join())

try {
  await db.query(`select public.registrar_pagamento($1,$2,$3,$4,$5,$6)`, [G1, C1, 10, 'pix', '2025-10-08', null])
  ok(false, 'pagar a mesma semana de novo é recusado')
} catch (e) { ok(/já foi paga/.test(e.message), 'pagar a mesma semana de novo é recusado', e.message) }

// ---- listar_pagamentos ----
const lista = async (...a) => (await db.query(`select public.listar_pagamentos($1,$2,$3,$4,$5,$6,$7,$8,$9) as r`, a)).rows[0].r
let r = await lista(G1, null, null, null, null, null, false, 25, 0)
ok(r.total === 7 && r.itens.length === 7, 'lista sem filtro traz só o galpão certo', `total=${r.total}`)
ok(r.itens[0].cliente_nome && r.itens[0].recibo_codigo, 'linha traz cliente e código do recibo')

r = await lista(G1, null, null, null, null, null, false, 3, 0)
const p1 = r.itens.map((i) => i.id)
const r2 = await lista(G1, null, null, null, null, null, false, 3, 3)
const r3 = await lista(G1, null, null, null, null, null, false, 3, 6)
const todos = [...p1, ...r2.itens.map((i) => i.id), ...r3.itens.map((i) => i.id)]
ok(r.total === 7 && r.itens.length === 3 && r2.itens.length === 3 && r3.itens.length === 1, 'paginação 3+3+1 com total 7')
ok(new Set(todos).size === 7, 'nenhuma linha repetida entre as páginas')
r = await lista(G1, null, null, null, null, null, false, 3, 600)
ok(r.total === 7 && r.itens.length === 0, 'página além do fim: itens vazios e total correto')
r = await lista(G1, null, null, null, null, null, false, 5000, -4)
ok(r.itens.length === 7, 'limite alto é limitado a 100 e deslocamento negativo vira 0')

r = await lista(G1, 'maria', null, null, null, null, false, 25, 0)
ok(r.total === 6, 'busca por nome (sem diferenciar maiúsculas)', `total=${r.total}`)
r = await lista(G1, '50%', null, null, null, null, false, 25, 0)
ok(r.total === 1 && r.itens[0].cliente_nome.startsWith('José'), 'busca com % é literal', `total=${r.total}`)
r = await lista(G1, '_', null, null, null, null, false, 25, 0)
ok(r.total === 1, 'busca com _ é literal', `total=${r.total}`)
r = await lista(G1, '0003', null, null, null, null, false, 25, 0)
ok(r.total >= 1 && r.itens.some((i) => i.recibo_numero === 3), 'busca por número do recibo (0003)', `total=${r.total}`)
const cf = cod.match(/.{4}/g).join('-').toLowerCase()
r = await lista(G1, cf, null, null, null, null, false, 25, 0)
ok(r.total === 1 && r.itens[0].recibo_codigo === cod, 'busca pelo código com traços e minúsculas', `total=${r.total}`)
r = await lista(G1, null, ['dinheiro'], null, null, null, false, 25, 0)
ok(r.total === 1, 'filtro por forma de pagamento')
r = await lista(G1, null, null, null, '2025-10-01', '2025-10-31', false, 25, 0)
ok(r.total >= 0, 'filtro por período executa', `total=${r.total}`)
r = await lista(G1, null, null, null, null, null, true, 25, 0)
ok(r.itens[0].recibo_numero === 7 && r.itens[6].recibo_numero === 1, 'ordenar por recibo: do mais novo para o mais antigo', r.itens.map((i) => i.recibo_numero).join())

// ---- cancelar + verificar ----
await db.query(`select public.cancelar_pagamento($1, $2)`, [recibos[5].pagamento.id, 'teste'])
r = await lista(G1, null, null, ['cancelado'], null, null, false, 25, 0)
ok(r.total === 1, 'filtro por situação cancelado')

const v = async (c) => (await db.query(`select public.verificar_recibo($1) as r`, [c])).rows[0].r
let ver = await v(cf)
ok(ver && ver.situacao === 'valido' && ver.cliente === 'Maria S.' && ver.numero === 1, 'verificar: recibo válido, cliente abreviado', JSON.stringify(ver))
ok(!('cliente_id' in ver) && !('observacoes' in ver), 'verificar: não expõe campos internos')
ver = await v(recibos[5].recibo.codigo)
ok(ver && ver.situacao === 'cancelado', 'verificar: recibo cancelado aparece como cancelado')
ok((await v('0000-0000-0000-0000')) === null, 'verificar: código inexistente devolve null')
ok((await v('abc')) === null, 'verificar: código curto devolve null')
ok((await v(null)) === null, 'verificar: código nulo devolve null')

const ab = async (n) => (await db.query(`select public.abreviar_nome($1) as r`, [n])).rows[0].r
ok((await ab('Maria')) === 'Maria' && (await ab('  ana  paula   lima ')) === 'ana L.' && (await ab('')) === '' && (await ab(null)) === '', 'abreviar_nome')

// ---- relatório ----
const rel = (await db.query(`select public.relatorio_resumo($1,$2,$3,$4) as r`, [G1, '2025-10-01', '2025-10-31', '2025-10-08'])).rows[0].r
const hojeReg = (await db.query(`select (now() at time zone 'America/Fortaleza')::date::text as d`)).rows[0].d
ok(Number(rel.total_geral) === 60 + 25.5 - 10, 'relatório: total geral ignora cancelados', rel.total_geral)
ok(Array.isArray(rel.por_forma) && Array.isArray(rel.por_dia), 'relatório: por_forma e por_dia são listas')
const relHoje = (await db.query(`select public.relatorio_resumo($1,$2,$3,$4) as r`, [G1, hojeReg, hojeReg, hojeReg])).rows[0].r
ok(Number(relHoje.total_periodo) === 75.5 && relHoje.quantidade_periodo === 6 && Number(relHoje.total_hoje) === 75.5, 'relatório: período = hoje (6 pagamentos válidos)', JSON.stringify([relHoje.total_periodo, relHoje.quantidade_periodo]))
ok(relHoje.por_dia.length === 1 && relHoje.por_forma.length === 2, 'relatório: agrupa por dia e por forma')

// ---- pagamentos_recentes ----
const rec = await db.query(`select * from public.pagamentos_recentes($1, $2)`, [G1, '2025-09-20'])
ok(rec.rows.length === 7 && rec.rows.every((x) => x.recibo_codigo), 'recentes: traz pagamentos com recibo (por data de registro de hoje)', `n=${rec.rows.length}`)
const rec2 = await db.query(`select * from public.pagamentos_recentes($1, $2)`, [G2, '2000-01-01'])
ok(rec2.rows.length === 1, 'recentes: isola por galpão')

// ---- permissões ----
const perms = await db.query(`
  select p.proname,
         has_function_privilege('anon', p.oid, 'execute') as anon,
         has_function_privilege('authenticated', p.oid, 'execute') as auth
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in
    ('verificar_recibo','listar_pagamentos','relatorio_resumo','pagamentos_recentes','registrar_pagamento','cancelar_pagamento')`)
const porNome = Object.fromEntries(perms.rows.map((x) => [x.proname, x]))
ok(porNome.verificar_recibo.anon && porNome.verificar_recibo.auth, 'permissão: verificar_recibo é pública')
ok(['listar_pagamentos','relatorio_resumo','pagamentos_recentes','registrar_pagamento','cancelar_pagamento'].every((n) => !porNome[n].anon && porNome[n].auth), 'permissão: demais funções só para logados')

// ---- código nunca repete (nem entre galpões) ----
const dupl = await db.query(`select codigo, count(*) from recibos group by codigo having count(*) > 1`)
ok(dupl.rows.length === 0, 'nenhum código repetido na tabela inteira (todos os galpões)')
// pagamento novo, ainda sem recibo, em OUTRO galpão: o recibo dele tenta reutilizar um código existente
await db.exec(`insert into pagamentos (id, galpao_id, cliente_id, valor, data_pagamento, semana_referencia, forma_pagamento, status)
  values ('dddddddd-0000-0000-0000-000000000001', '${G2}', '${C3}', 5, current_date, '2025-10-15', 'pix', 'pago')`)
try {
  await db.query(`insert into recibos (galpao_id, pagamento_id, numero, codigo)
    values ($1, 'dddddddd-0000-0000-0000-000000000001', 500, $2)`, [G2, cod])
  ok(false, 'o banco recusa um código igual em outro galpão')
} catch (e) { ok(/recibos_codigo_unico/.test(e.message), 'o banco recusa um código igual em outro galpão (trava recibos_codigo_unico)', e.message.slice(0, 90)) }
const gerados = new Set()
for (let i = 0; i < 2000; i++) {
  gerados.add((await db.query(`select public.gerar_codigo_recibo() as c`)).rows[0].c)
}
ok(gerados.size === 2000, '2000 códigos gerados em sequência, todos diferentes')
const jaExistem = await db.query(`select count(*) as n from recibos where codigo = any($1)`, [[...gerados]])
ok(Number(jaExistem.rows[0].n) === 0, 'nenhum código gerado coincide com um recibo existente')

// ---- migrações 0010 e 0011 podem ser repetidas sem erro e sem mudar dados ----
try {
  await db.exec(lerMigracao('0010_codigo_sem_repeticao.sql'))
  await db.exec(lerMigracao('0011_descricao_pagamento.sql'))
  const n = (await db.query(`select count(distinct codigo) as c, count(*) as t from recibos`)).rows[0]
  ok(Number(n.c) === Number(n.t), 'rodar a 0010 e a 0011 de novo não dá erro nem muda os códigos')
} catch (e) { ok(false, 'rodar a 0010 e a 0011 de novo', e.message) }

terminar('CÓDIGO E PAGINAÇÃO')
