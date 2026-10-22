-- Decisão do desligamento no Copiloto RH (termination_decision: pediu_pra_sair,
-- foi_demitido ou acordo_mutuo). O Copiloto classifica o tipo de turnover
-- pela decisão antes do motivo; o Centralizador mostra o tipo de cada pessoa
-- do mesmo jeito. As taxas e contagens vêm prontas de GET /v1/turnover.

alter table rh.colaboradores add column decisao_desligamento_copiloto text;
