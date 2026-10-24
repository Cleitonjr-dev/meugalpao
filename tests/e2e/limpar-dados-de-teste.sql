-- Limpeza do projeto Supabase DE TESTE (nunca rode no projeto real!).
-- Os testes de navegador (npm run test:e2e) criam galpões chamados "E2E <data e hora>".
-- Como o banco não deixa excluir galpão com pagamentos, rode isto de vez em quando no SQL Editor
-- do projeto de teste. Apaga só o que pertence a galpões cujo nome começa com "E2E ".

do $$
declare
  g record;
begin
  for g in select id from public.galpoes where nome like 'E2E %' loop
    delete from public.pagamentos where galpao_id = g.id;   -- apaga os recibos junto (cascata)
    delete from public.galpoes where id = g.id;              -- apaga clientes, itens e preços
  end loop;
end $$;

-- Conferência: não deve sobrar nenhum.
select count(*) as galpoes_e2e_restantes from public.galpoes where nome like 'E2E %';
