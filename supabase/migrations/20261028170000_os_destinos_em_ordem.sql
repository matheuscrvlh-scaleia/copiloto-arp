-- Destinos em ordem: o chamado passa de setor em setor (e depois de pessoa
-- em pessoa) na ordem escolhida em "Também para". Cada destino só começa ou
-- conclui depois que todos os de ordem menor concluíram; confirmar a
-- leitura continua livre. O Aviso para vários setores segue em paralelo
-- (coluna falsa).

alter table os.chamados
  add column destinos_em_ordem boolean not null default false;

create function os.respeitar_ordem_do_destino()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('os.sistema', true) = 'on'
     or old.status <> 'aberto'
     or new.status = 'aberto' then
    return new;
  end if;
  if exists (
    select 1 from os.chamados c
    where c.id = new.chamado_id and c.destinos_em_ordem
  ) and exists (
    select 1 from os.destinatarios d
    where d.chamado_id = new.chamado_id
      and d.ordem < new.ordem
      and d.status <> 'concluido'
  ) then
    raise exception 'esta parte espera a anterior concluir'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger respeitar_ordem before update of status on os.destinatarios
  for each row execute function os.respeitar_ordem_do_destino();
