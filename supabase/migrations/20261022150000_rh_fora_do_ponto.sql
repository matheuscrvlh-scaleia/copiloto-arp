-- Fora do ponto: quem segue ativo no Secullum mas não conta no ponto (ex.:
-- antigos funcionários afastados por benefício). A sincronização não calcula
-- o ponto dessas pessoas e as telas deixam de fora o que já veio. Marcado na
-- ficha do funcionário por quem edita os cadastros do RH (rh.parametros).

alter table rh.colaboradores
  add column fora_do_ponto boolean not null default false;

-- Histórico só desta marcação: o resto da linha a sincronização regrava todo
-- dia e não vai para a auditoria.
create trigger auditoria_fora_do_ponto after update of fora_do_ponto on rh.colaboradores
  for each row when (old.fora_do_ponto is distinct from new.fora_do_ponto)
  execute function core.auditar('id');
