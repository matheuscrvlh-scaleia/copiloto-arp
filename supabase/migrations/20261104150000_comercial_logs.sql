-- Comercial no histórico do sistema (Administração › Histórico): os eventos
-- das ações (contratos, importações, configurações, rotina diária) entram em
-- core.logs com o módulo "comercial", e as alterações das tabelas
-- comercial.* e das metas comercial.* aparecem nesse módulo. As propostas de
-- evento passam a ter auditoria (quem, quando, antes e depois).

alter table core.logs drop constraint logs_modulo_check;
alter table core.logs add constraint logs_modulo_check
  check (modulo in ('acesso', 'admin', 'rh', 'financeiro', 'integracoes', 'os', 'comercial'));

create or replace function core.modulo_da_auditoria(p_tabela text, p_linha jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_tabela like 'rh.%' then 'rh'
    when p_tabela like 'financeiro.%' then 'financeiro'
    when p_tabela like 'os.%' then 'os'
    when p_tabela like 'comercial.%' then 'comercial'
    when p_tabela like 'integracao.%' then 'integracoes'
    when p_tabela = 'core.metas' then
      case split_part(p_linha ->> 'indicador', '.', 1)
        when 'rh' then 'rh'
        when 'financeiro' then 'financeiro'
        when 'comercial' then 'comercial'
        else 'admin'
      end
    when p_tabela = 'core.importacoes' then
      case when p_linha ->> 'tipo' in ('folha', 'plano_saude') then 'rh' else 'financeiro' end
    else 'admin'
  end;
$$;

create trigger auditoria after insert or update or delete on comercial.propostas_evento
  for each row execute function core.auditar('id');
