// 04-auditoria: ver docs/PLANO_ENTREGA.md (Parte 2.1)
import { db, ok, terminar } from './_base.mjs'

const SUPER = '11111111-1111-1111-1111-111111111111'
const MARIA = '22222222-2222-2222-2222-222222222222'
const G1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const G2 = 'aaaaaaaa-0000-0000-0000-000000000002'
const C1 = 'cccccccc-0000-0000-0000-000000000001'
const C2 = 'cccccccc-0000-0000-0000-000000000002'

const agora = () => Math.floor(Date.now() / 1000)
// simula o token de um usuário logado: amr = datas do login por senha; semAmr usa só o iat
async function como(usuario, { senhaHa = 5, semAmr = false, iatHa = 5 } = {}) {
  const claims = { sub: usuario, iat: agora() - iatHa }
  if (!semAmr) claims.amr = [{ method: 'password', timestamp: agora() - senhaHa }]
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false)`)
}
const q = async (sql, p = []) => (await db.query(sql, p)).rows
const falha = async (sql, p = []) => { try { await db.query(sql, p); return null } catch (e) { return e.message } }
const auditoria = async (acao) => q(`select resumo, usuario_nome, galpao_id from public.auditoria where acao = $1 order by created_at, id`, [acao])

// ---------- formatação de dinheiro (não pode depender do idioma do servidor) ----------
for (const [valor, esperado] of [[0, 'R$ 0,00'], [5, 'R$ 5,00'], [110, 'R$ 110,00'], [1234.5, 'R$ 1.234,50'], [1000000, 'R$ 1.000.000,00'], [999.999, 'R$ 999,99'], [0.07, 'R$ 0,07'], [-25, 'R$ -25,00']]) {
  const got = (await q(`select public.fmt_brl($1::numeric) as r`, [valor]))[0].r
  ok(got === (valor === 999.999 ? 'R$ 1.000,00' : esperado), `fmt_brl(${valor})`, got)
}

// ---------- cadastro (como "sistema", sem token) ----------
await db.exec(`select set_config('request.jwt.claims', '', false)`)
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${SUPER}', 'dev@x.com', '{"nome":"Dev"}'), ('${MARIA}', 'maria@x.com', '{"nome":"Maria"}');
`)
let r = await auditoria('usuario.criado')
ok(r.length === 2 && r.every((x) => x.usuario_nome === 'Sistema') && r.some((x) => /Nova conta criada: "Dev" \(dev@x.com\)/.test(x.resumo)), 'nova conta fica no histórico', r.map((x) => x.resumo).join(' | '))

await db.exec(`update public.profiles set is_super = true where id = '${SUPER}'`)
r = await auditoria('usuario.super_alterado')
ok(r.length === 1 && /"Dev" passou a ser super usuário/.test(r[0].resumo), 'virar super usuário fica no histórico', r[0]?.resumo)

await como(SUPER)
await db.exec(`
  insert into galpoes (id, nome) values ('${G1}', 'Galpão 1'), ('${G2}', 'Galpão 2');
  insert into galpao_membros (galpao_id, profile_id) values ('${G1}', '${MARIA}');
  insert into clientes (id, galpao_id, nome, dia_pagamento, created_at) values
    ('${C1}','${G1}','Cleiton Junior','sabado', now() - interval '60 days'),
    ('${C2}','${G2}','Outro Cliente','sabado', now() - interval '60 days');
`)
r = await auditoria('galpao.criado'); ok(r.length === 2 && r[0].usuario_nome === 'Dev', 'galpão criado registrado com o nome de quem criou')
r = await auditoria('acesso.liberado'); ok(r.length === 1 && /Acesso de "Maria" ao galpão "Galpão 1" liberado/.test(r[0].resumo), 'acesso liberado registrado', r[0]?.resumo)
r = await auditoria('cliente.criado'); ok(r.length === 2, 'clientes criados registrados')

// ---------- pagamento registrado ----------
const tipoRoupa = (await q(`select id from tipos_item where nome = 'Carrinho de roupa'`))[0].id
await q(`insert into itens_guardados (cliente_id, galpao_id, tipo_item_id, quantidade) values ($1,$2,$3,2)`, [C1, G1, tipoRoupa])
r = await auditoria('item.adicionado')
ok(r.length === 1 && /Item "Carrinho de roupa \(x2\)" adicionado ao cliente "Cleiton Junior"/.test(r[0].resumo), 'item adicionado registrado', r[0]?.resumo)

await como(MARIA)
const pag = (await q(`select public.registrar_pagamento($1,$2,110,'dinheiro','2026-10-10',null) as r`, [G1, C1]))[0].r
r = await auditoria('pagamento.registrado')
ok(r.length === 1 && r[0].usuario_nome === 'Maria' && /Pagamento de R\$ 110,00 registrado: cliente "Cleiton Junior", recibo nº 1/.test(r[0].resumo), 'pagamento registrado vai para o histórico com quem recebeu', r[0]?.resumo)

// ---------- cancelar: senha recente + motivo ----------
await como(MARIA, { senhaHa: 3600 })
let e = await falha(`select public.cancelar_pagamento($1,'valor errado')`, [pag.pagamento.id])
ok(/Confirme sua senha/.test(e ?? ''), 'cancelar SEM senha recente é recusado', e)

await como(MARIA, { senhaHa: 5 })
e = await falha(`select public.cancelar_pagamento($1,'')`, [pag.pagamento.id])
ok(/motivo/.test(e ?? ''), 'cancelar sem motivo é recusado', e)
e = await falha(`select public.cancelar_pagamento($1,'ab')`, [pag.pagamento.id])
ok(/mínimo 3/.test(e ?? ''), 'motivo curto demais é recusado', e)

await como(MARIA, { senhaHa: 119 })
ok((await q(`select status from pagamentos where id = $1`, [pag.pagamento.id]))[0].status === 'pago', 'nada foi cancelado até aqui')
await como(MARIA, { senhaHa: 130 })
e = await falha(`select public.cancelar_pagamento($1,'valor errado')`, [pag.pagamento.id])
ok(/Confirme sua senha/.test(e ?? ''), 'senha de 130 s atrás já não vale', e)

await como(MARIA, { semAmr: true, iatHa: 3600 })
e = await falha(`select public.cancelar_pagamento($1,'valor errado')`, [pag.pagamento.id])
ok(/Confirme sua senha/.test(e ?? ''), 'token sem amr e antigo é recusado', e)

await como(MARIA, { senhaHa: 10 })
await q(`select public.cancelar_pagamento($1,'  valor lançado errado  ')`, [pag.pagamento.id])
const cancelado = (await q(`select status, motivo_cancelamento, cancelado_por from pagamentos where id = $1`, [pag.pagamento.id]))[0]
ok(cancelado.status === 'cancelado' && cancelado.motivo_cancelamento === 'valor lançado errado' && cancelado.cancelado_por === MARIA, 'cancelar COM senha recente funciona e guarda motivo e quem cancelou')
r = await auditoria('pagamento.cancelado')
ok(r.length === 1 && r[0].usuario_nome === 'Maria' && /Pagamento de R\$ 110,00 cancelado \(recibo nº 1, cliente "Cleiton Junior"\)\. Motivo: valor lançado errado/.test(r[0].resumo), 'cancelamento no histórico', r[0]?.resumo)
e = await falha(`select public.cancelar_pagamento($1,'de novo')`, [pag.pagamento.id])
ok(/já foi cancelado/.test(e ?? ''), 'cancelar duas vezes é recusado', e)

// AUD-004: sem prova de login por senha o sistema falha fechado, mesmo com o token recém-emitido (token renovado)
await como(MARIA, { semAmr: true, iatHa: 5 })
const pag2 = (await q(`select public.registrar_pagamento($1,$2,50,'pix','2026-10-17',null) as r`, [G1, C1]))[0].r
e = await falha(`select public.cancelar_pagamento($1,'teste sem amr')`, [pag2.pagamento.id])
ok(/Confirme sua senha/.test(e ?? ''), 'token sem amr é recusado mesmo recém-emitido (sem atalho pelo iat)', e)
await como(MARIA, { senhaHa: 5 })
await q(`select public.cancelar_pagamento($1,'teste com senha recente')`, [pag2.pagamento.id])
ok(true, 'com senha recente o cancelamento passa')

// ---------- gatilhos de cadastro ----------
await como(SUPER)
await db.exec(`update clientes set dia_pagamento = 'quarta', ativo = false where id = '${C1}'`)
r = await auditoria('cliente.alterado')
ok(r.length === 1 && /dia de pagamento \(sabado → quarta\)/.test(r[0].resumo) && /situação \(ativo\) \(true → false\)/.test(r[0].resumo), 'alteração de cliente mostra antes → depois', r[0]?.resumo)

await db.exec(`update clientes set nome = nome where id = '${C1}'`)
ok((await auditoria('cliente.alterado')).length === 1, 'atualização sem mudança real não gera registro')

await db.exec(`update itens_guardados set quantidade = 4 where cliente_id = '${C1}'`)
r = await auditoria('item.alterado'); ok(r.length === 1 && /quantidade \(2 → 4\)/.test(r[0].resumo), 'quantidade do item alterada registrada', r[0]?.resumo)

await db.exec(`update tipos_item set preco_semanal = 33 where id = '${tipoRoupa}'`)
r = await auditoria('tipo.alterado'); ok(r.length === 1 && /preço semanal/.test(r[0].resumo), 'preço padrão alterado registrado', r[0]?.resumo)

await db.query(`insert into precos_galpao (galpao_id, tipo_item_id, preco_semanal) values ($1,$2,45)`, [G1, tipoRoupa])
await db.query(`update precos_galpao set preco_semanal = 50 where galpao_id = $1`, [G1])
r = await auditoria('preco.alterado')
ok(r.length === 1 && /Preço de "Carrinho de roupa" no galpão "Galpão 1": R\$ 45,00 → R\$ 50,00/.test(r[0].resumo), 'preço por galpão: antes → depois', r[0]?.resumo)
await db.query(`delete from precos_galpao where galpao_id = $1`, [G1])
ok((await auditoria('preco.removido')).length === 1, 'remoção do preço próprio registrada')

await db.exec(`update galpoes set nome = 'Galpão Um', endereco = 'Rua X, 10' where id = '${G1}'`)
r = await auditoria('galpao.alterado'); ok(r.length === 1 && /nome \(Galpão 1 → Galpão Um\)/.test(r[0].resumo) && /endereço/.test(r[0].resumo), 'galpão renomeado/endereço registrados', r[0]?.resumo)

await db.exec(`delete from galpao_membros where profile_id = '${MARIA}'`)
ok((await auditoria('acesso.removido')).length === 1, 'acesso removido registrado')

// ---------- exclusão em cascata não gera ruído ----------
await q(`insert into itens_guardados (cliente_id, galpao_id, tipo_item_id, quantidade) values ($1,$2,$3,1)`, [C2, G2, tipoRoupa])
await db.exec(`delete from clientes where id = '${C2}'`)
r = await auditoria('item.removido')
ok(r.length === 0, 'cliente excluído: os itens apagados em cascata NÃO geram registros próprios')
ok((await auditoria('cliente.excluido')).length === 1, 'exclusão do cliente registrada uma vez')

await db.exec(`delete from galpoes where id = '${G2}'`)
r = await auditoria('galpao.excluido')
ok(r.length === 1 && r[0].galpao_id === null && /Galpão 2/.test(r[0].resumo), 'galpão excluído registrado (sem apontar para o galpão que sumiu)', r[0]?.resumo)

// ---------- quem pode ler / escrever ----------
await db.exec(`set role authenticated`)
await como(MARIA)
ok((await q(`select count(*)::int as n from public.auditoria`))[0].n === 0, 'usuário comum NÃO enxerga o histórico (RLS)')
const lm = (await q(`select public.listar_auditoria() as r`))[0].r
ok(lm.total === 0 && lm.itens.length === 0, 'listar_auditoria vazio para usuário comum')
e = await falha(`insert into public.auditoria (acao, entidade, resumo) values ('x','y','z')`)
ok(/permission denied/.test(e ?? ''), 'usuário comum NÃO grava no histórico', e)
e = await falha(`select public.registrar_auditoria('x','y',null,null,'z')`)
ok(/permission denied/.test(e ?? ''), 'ninguém chama registrar_auditoria direto', e)

await como(SUPER)
const total = (await q(`select count(*)::int as n from public.auditoria`))[0].n
ok(total > 20, 'super usuário enxerga o histórico', String(total))
e = await falha(`update public.auditoria set resumo = 'adulterado'`)
ok(/permission denied/.test(e ?? ''), 'nem o super usuário edita o histórico', e)
e = await falha(`delete from public.auditoria`)
ok(/permission denied/.test(e ?? ''), 'nem o super usuário apaga o histórico', e)

// ---------- listar_auditoria ----------
let la = (await q(`select public.listar_auditoria(null,null,null,null,5,0) as r`))[0].r
ok(la.total === total && la.itens.length === 5, 'listar_auditoria pagina (5 por vez)', `total=${la.total}`)
ok(la.itens[0].created_at >= la.itens[4].created_at, 'mais recentes primeiro')
la = (await q(`select public.listar_auditoria('cancelado',null,null,null,25,0) as r`))[0].r
ok(la.total >= 2 && la.itens.every((i) => /cancelad/i.test(i.resumo)), 'busca por texto', `total=${la.total}`)
la = (await q(`select public.listar_auditoria(null,array['pagamento.cancelado'],null,null,25,0) as r`))[0].r
ok(la.total === 2, 'filtro por tipo de ação', `total=${la.total}`)
la = (await q(`select public.listar_auditoria(null,null,current_date + 1,null,25,0) as r`))[0].r
ok(la.total === 0, 'filtro por período (amanhã em diante: nada)')
la = (await q(`select public.listar_auditoria('Maria',null,null,null,25,0) as r`))[0].r
ok(la.total >= 3, 'busca pelo nome de quem fez', `total=${la.total}`)
la = (await q(`select public.listar_auditoria('100%',null,null,null,25,0) as r`))[0].r
ok(la.total === 0, 'busca com % é literal')

// ---------- listar_pagamentos mostra quem recebeu/cancelou para colegas ----------
await db.exec(`reset role`)
await db.exec(`insert into galpao_membros (galpao_id, profile_id) values ('${G1}', '${MARIA}')`)
await db.exec(`update clientes set ativo = true where id = '${C1}'`)
await db.exec(`set role authenticated`)
await como(MARIA)
const lp = (await q(`select public.listar_pagamentos($1) as r`, [G1]))[0].r
const linha = lp.itens.find((i) => i.id === pag.pagamento.id)
ok(linha && linha.recebido_por_nome === 'Maria' && linha.cancelado_por_nome === 'Maria', 'lista de pagamentos traz recebido_por e cancelado_por', JSON.stringify([linha?.recebido_por_nome, linha?.cancelado_por_nome]))
const ptxt = JSON.stringify(lp)
ok(!ptxt.includes('maria@x.com'), 'a lista não vaza e-mail de ninguém')

// ---------- anônimo ----------
await db.exec(`reset role; set role anon;`)
e = await falha(`select public.cancelar_pagamento($1,'x')`, [pag.pagamento.id])
ok(/permission denied/.test(e ?? ''), 'anônimo não cancela', e)
e = await falha(`select * from public.auditoria`)
ok(/permission denied/.test(e ?? ''), 'anônimo não lê o histórico', e)

terminar('AUDITORIA')
