-- Chamado concluído, fechado ou cancelado não muda responsável, prazo,
-- prioridade nem setor: a tela já escondia a gestão, mas uma janela aberta
-- antes do fechamento (ou a ação chamada direto) gravava assim mesmo. Para
-- mexer, reabre primeiro. Mudança de status (reabrir, confirmar) continua
-- valendo; o resto da função é igual ao de 20261023120100_os_regras.sql.
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

  if new.lixeira_em is distinct from old.lixeira_em and not core.pode('os.excluir') then
    raise exception 'só quem pode excluir manda para a lixeira ou restaura'
      using errcode = 'P0001';
  end if;

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
