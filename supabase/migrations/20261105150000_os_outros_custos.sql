-- Outros custos da OS: linhas avulsas (descrição e valor) lançadas por quem
-- tem os.custos, que entram no valor da O.S. Ficam em os.os_custos, com o
-- mesmo RLS e a mesma auditoria do resto do dinheiro da OS.

alter table os.os_custos
  add column outros_custos jsonb not null default '[]'
    check (jsonb_typeof(outros_custos) = 'array');
