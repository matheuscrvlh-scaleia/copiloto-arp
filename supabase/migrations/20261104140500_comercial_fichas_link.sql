-- Fichas cadastrais (4.12): o link pode ser cancelado (o interessado vê
-- "link cancelado", não "vencido") e guarda a oportunidade do RD a que se
-- refere (só referência, nada vai para o RD).

alter table comercial.fichas
  add column cancelada_em timestamptz,
  add column rd_oportunidade text check (rd_oportunidade is null or length(rd_oportunidade) <= 200),
  -- Só link ainda não preenchido pode ser cancelado.
  add constraint fichas_cancelada_em_preenchimento
    check (cancelada_em is null or situacao = 'em_preenchimento');
