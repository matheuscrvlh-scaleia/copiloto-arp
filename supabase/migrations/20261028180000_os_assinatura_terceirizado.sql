-- Assinaturas da OS terceirizada: a OS nasce sem assinatura; o prestador
-- confere tudo pelo link e assina (depois de "Terminei"); a ARP valida a OS
-- com a assinatura dele e assina por último (os.chamados.assinatura_*).
-- Com a OS concluída, o ticket do Financeiro abre no setor escolhido em
-- Parâmetros.

alter table os.terceirizado_links
  add column assinatura_nome text check (btrim(assinatura_nome) <> ''),
  add column assinatura_documento text,
  add column assinatura_path text,
  add column assinado_em timestamptz,
  add constraint terceirizado_links_assinatura_completa check (
    assinado_em is null
    or (assinatura_nome is not null and assinatura_path is not null)
  );

alter table os.parametros
  add column setor_financeiro_id uuid references os.setores (id) on delete set null;
