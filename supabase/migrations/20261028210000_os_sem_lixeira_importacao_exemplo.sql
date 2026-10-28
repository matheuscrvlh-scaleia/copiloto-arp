-- Saem do módulo Tickets a lixeira, a importação do sistema de OS atual e os
-- dados de exemplo.
--
-- Lixeira: os chamados que estavam nela voltam às listas como estavam.
-- Importação: o que já foi importado fica (com legado_* e origem
-- 'importacao'); some só o vínculo com a importação, que servia para
-- desfazer. Exemplo: as fotos do exemplo estão no bucket, que a migration não
-- alcança; por isso ela não apaga nada e para se ainda houver exemplo. Apague
-- antes pela tela de Importação e exemplos da versão anterior.

do $$
declare
  v_tabela text;
  v_tem boolean;
begin
  foreach v_tabela in array array[
    'lojas', 'tecnicos', 'empresas', 'profissionais', 'contatos', 'ativos',
    'planos_preventivos', 'vistorias', 'chamados', 'anexos', 'agendamentos'
  ] loop
    execute format('select exists (select 1 from os.%I where exemplo)', v_tabela)
      into v_tem;
    if v_tem then
      raise exception 'ainda há dados de exemplo em os.%: apague-os pela tela antes desta migration', v_tabela;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lixeira
-- ---------------------------------------------------------------------------

-- Igual à de 20261023120100_os_regras.sql, sem o alcance de os.excluir.
create or replace function os.edita_chamado(
  p_id uuid, p_setor uuid, p_aberto_por uuid, p_responsavel uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select core.pode('os.acessar')
    and os.ve_chamado(p_id, p_setor, p_aberto_por, p_responsavel)
    and (
      p_aberto_por = (select auth.uid())
      or p_responsavel = (select auth.uid())
      or p_setor in (select os.meus_setores())
      or os.gerencia(p_setor)
      or os.envolvido(p_id)
    );
$$;

-- Igual à de 20261023120100_os_regras.sql, sem o filtro da lixeira.
create or replace function os.resumo_ativos(p_desde date)
returns table (
  ativo_id uuid,
  custo_periodo numeric,
  custo_total numeric,
  corretivas_periodo bigint,
  preventivas_periodo bigint,
  os_abertas bigint,
  ultima_os timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.ativo_id,
    coalesce(sum(k.custo_total) filter (where c.criado_em >= p_desde), 0),
    coalesce(sum(k.custo_total), 0),
    count(*) filter (
      where c.criado_em >= p_desde and c.plano_id is null
        and not coalesce(cat.preventiva, false)
    ),
    count(*) filter (
      where c.criado_em >= p_desde
        and (c.plano_id is not null or coalesce(cat.preventiva, false))
    ),
    count(*) filter (where c.status in ('aberto', 'em_andamento', 'aguardando')),
    max(c.criado_em)
  from os.chamados c
  left join os.os_custos k on k.chamado_id = c.id
  left join os.categorias cat on cat.id = c.categoria_id
  where (core.pode('os.ativos') or core.pode('os.ativos_gerenciar'))
    and c.ativo_id is not null
    and c.tipo = 'os'
    and c.status <> 'cancelado'
  group by c.ativo_id;
$$;

-- Igual à de 20261028160000_os_carga_aberto_por.sql, sem o filtro da lixeira.
create or replace function os.carga_do_setor(
  p_setor uuid,
  p_agora timestamptz,
  p_status os.status_chamado[] default null,
  p_tipos os.tipo_chamado[] default null,
  p_categoria uuid default null,
  p_responsavel uuid default null,
  p_prioridade os.prioridade default null,
  p_etiqueta text default null,
  p_criado_desde timestamptz default null,
  p_criado_ate timestamptz default null,
  p_aberto_por uuid default null
)
returns table (responsavel_id uuid, abertos int, atrasados int)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.responsavel_id,
    count(*)::int as abertos,
    count(*) filter (where c.prazo < p_agora)::int as atrasados
  from os.chamados c
  where c.setor_id = p_setor
    and c.status in ('aberto', 'em_andamento', 'aguardando')
    and (p_status is null or c.status = any (p_status))
    and (p_tipos is null or c.tipo = any (p_tipos))
    and (p_categoria is null or c.categoria_id = p_categoria)
    and (p_responsavel is null or c.responsavel_id = p_responsavel)
    and (p_prioridade is null or c.prioridade = p_prioridade)
    and (p_etiqueta is null or c.etiquetas @> array[p_etiqueta])
    and (p_criado_desde is null or c.criado_em >= p_criado_desde)
    and (p_criado_ate is null or c.criado_em <= p_criado_ate)
    and (p_aberto_por is null or c.aberto_por = p_aberto_por)
  group by c.responsavel_id;
$$;

-- Igual à de 20261028150000_os_chamado_encerrado.sql, sem a regra da lixeira.
create or replace function os.validar_chamado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select auth.uid());
  v_gestor boolean;
  v_pediu boolean;
begin
  if v_eu is null or current_setting('os.sistema', true) = 'on' then
    return new;
  end if;
  v_gestor := os.gerencia(old.setor_id);
  v_pediu := old.aberto_por = v_eu;

  if old.status in ('concluido', 'fechado', 'cancelado')
     and new.status = old.status
     and (
       new.responsavel_id is distinct from old.responsavel_id
       or new.prazo is distinct from old.prazo
       or new.prioridade is distinct from old.prioridade
       or new.setor_id is distinct from old.setor_id
       or new.categoria_id is distinct from old.categoria_id
     ) then
    raise exception 'chamado encerrado não muda responsável, prazo, prioridade nem setor'
      using errcode = 'P0001';
  end if;

  -- O único prazo novo que não é troca de prazo: o empurrado por
  -- os.ciclo_do_chamado ao sair de Aguardando (que roda antes deste
  -- gatilho, com o mesmo now() da transação).
  if (
       new.prazo is distinct from old.prazo
       and (
         case when old.status = 'aguardando' and new.status <> 'aguardando'
           then new.prazo is distinct from old.prazo + (now() - old.aguardando_desde)
           -- Fora disso, qualquer troca conta (inclusive apagar o prazo).
           else true
         end
       )
     )
     or new.prioridade is distinct from old.prioridade then
    if not (v_gestor or v_pediu) then
      raise exception 'só quem pediu ou quem gerencia o setor muda prazo e prioridade'
        using errcode = 'P0001';
    end if;
  end if;

  if new.setor_id is distinct from old.setor_id
     and not (v_gestor or (v_pediu and old.status = 'aberto')) then
    raise exception 'só quem gerencia o setor transfere o chamado' using errcode = 'P0001';
  end if;

  if new.responsavel_id is distinct from old.responsavel_id and not (
    v_gestor
    -- Assumir: estava sem responsável (ou quem pediu assume o próprio).
    or (new.responsavel_id = v_eu and (old.responsavel_id is null or v_pediu))
    -- Devolver à fila.
    or (old.responsavel_id = v_eu and new.responsavel_id is null)
    or (v_pediu and old.status = 'aberto')
  ) then
    raise exception 'só quem gerencia o setor troca o responsável' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'cancelado' and not (v_gestor or v_pediu) then
      raise exception 'só quem pediu ou quem gerencia o setor cancela' using errcode = 'P0001';
    end if;
    -- Confirmar e reabrir: quem pediu (quem gerencia o setor também).
    if old.status = 'concluido' and not (v_pediu or v_gestor) then
      raise exception 'só quem pediu confirma ou reabre o chamado' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- Os índices das listas eram parciais (fora da lixeira); voltam inteiros.
drop index os.chamados_lista_criado;
drop index os.chamados_lista_prazo;
drop index os.chamados_lista_status;
drop index os.chamados_lixeira;
drop index os.chamados_lixeira_por;
alter table os.chamados drop column lixeira_em, drop column lixeira_por;
create index chamados_lista_criado on os.chamados (criado_em desc, id);
create index chamados_lista_prazo on os.chamados (prazo, id);
create index chamados_lista_status on os.chamados (status, prazo);

-- ---------------------------------------------------------------------------
-- Importação e exemplo
-- ---------------------------------------------------------------------------

-- Igual à de 20261028190000_os_criar_rapido.sql, sem as colunas que saem.
alter policy criar on os.empresas
  with check (
    (select core.pode('os.acessar'))
    and ativo
    and legado_id is null
  );

drop function os.desfazer_importacao(uuid);
drop table os.importacoes;

alter table os.tecnicos drop column importacao_id, drop column exemplo;
alter table os.empresas drop column importacao_id, drop column exemplo;
alter table os.profissionais drop column importacao_id, drop column exemplo;
alter table os.contatos drop column importacao_id, drop column exemplo;
alter table os.ativos drop column importacao_id, drop column exemplo;
alter table os.vistorias drop column importacao_id, drop column exemplo;
alter table os.chamados drop column importacao_id, drop column exemplo;
alter table os.anexos drop column importacao_id, drop column exemplo;
alter table os.sessoes drop column importacao_id;
alter table os.agendamentos drop column importacao_id, drop column exemplo;
alter table os.lojas drop column exemplo;
alter table os.planos_preventivos drop column exemplo;

-- As permissões saem também de quem as tinha (on delete cascade).
delete from core.permissoes where codigo in ('os.excluir', 'os.importacao');
