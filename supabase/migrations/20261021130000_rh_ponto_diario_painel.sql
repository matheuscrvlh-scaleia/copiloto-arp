-- Filtro de período nas telas: o Painel e a Gestão calculam absenteísmo e
-- banco de horas de um trecho de mês pelos dias do ponto. Quem vê o ponto
-- do mês no Painel (rh.painel) passa a ver também o do dia, como em
-- rh.ponto_mensal.

drop policy ver on rh.ponto_diario;
create policy ver on rh.ponto_diario for select to authenticated
  using (
    core.pode('rh.jornada') or core.pode('rh.painel') or core.pode('rh.funcionarios')
  );
