-- Ajustes depois de conferir o formato real do Secullum (19/10/2026).

-- FaltasDias vem com decimal ("1,50").
alter table rh.ponto_mensal
  alter column faltas_dias type numeric(6, 2),
  alter column faltas_dias set default 0;

-- O afastamento tem id próprio no Secullum: é a chave da sincronização.
alter table rh.afastamentos add column secullum_id int unique;
