-- Vistoria: a ARP finaliza e assina como locador na tela; depois manda um
-- link (sem login) para o locatário conferir o laudo, concordar e assinar
-- por último. A assinatura dele vai para assinatura_locatario_path, como a
-- feita na tela; aqui fica o link e quem assinou por ele.

alter table os.vistorias
  add column assinatura_token text unique check (length(assinatura_token) >= 32),
  add column assinatura_enviada_em timestamptz,
  add column locatario_assinatura_nome text,
  add column locatario_assinatura_documento text,
  add column locatario_assinado_em timestamptz;
