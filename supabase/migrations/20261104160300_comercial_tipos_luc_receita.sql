-- Painel (spec 4.10): receita com mídia e com eventos vem do faturamento dos
-- tipos de LUC marcados aqui, em vez de nomes fixos no código.
alter table comercial.tipos_luc
  add column receita text check (receita in ('midia', 'eventos'));

comment on column comercial.tipos_luc.receita is
  'Linha do Painel em que o faturamento deste tipo entra: midia, eventos ou nenhuma (null).';

update comercial.tipos_luc set receita = 'midia' where tipo = 'Área Publicitária';
update comercial.tipos_luc set receita = 'eventos' where tipo = 'Eventos';
