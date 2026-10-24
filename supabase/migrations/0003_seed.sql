-- ============================================================
-- MeuGalpão — 0003_seed.sql (dados iniciais)
-- ============================================================
-- Tipos de item globais (preço 0 = configurar depois em "Configurações")

insert into public.tipos_item (galpao_id, nome, preco_semanal)
select null, 'Carrinho de lanche', 0
where not exists (select 1 from public.tipos_item where galpao_id is null and nome = 'Carrinho de lanche');

insert into public.tipos_item (galpao_id, nome, preco_semanal)
select null, 'Carrinho de bebida', 0
where not exists (select 1 from public.tipos_item where galpao_id is null and nome = 'Carrinho de bebida');

insert into public.tipos_item (galpao_id, nome, preco_semanal)
select null, 'Carrinho de roupa', 0
where not exists (select 1 from public.tipos_item where galpao_id is null and nome = 'Carrinho de roupa');

insert into public.tipos_item (galpao_id, nome, preco_semanal)
select null, 'Carro', 0
where not exists (select 1 from public.tipos_item where galpao_id is null and nome = 'Carro');
