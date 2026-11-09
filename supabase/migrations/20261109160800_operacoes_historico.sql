-- Operações no histórico do sistema (Administração › Histórico): os eventos
-- das ações (importações, parâmetros, rateio, termos) entram em core.logs com
-- o módulo "operacoes", e as alterações das tabelas operacoes.* aparecem
-- nesse módulo.

alter table core.logs drop constraint logs_modulo_check;
alter table core.logs add constraint logs_modulo_check
  check (modulo in ('acesso', 'admin', 'rh', 'financeiro', 'integracoes', 'os', 'comercial', 'operacoes'));

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
    when p_tabela like 'operacoes.%' then 'operacoes'
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
