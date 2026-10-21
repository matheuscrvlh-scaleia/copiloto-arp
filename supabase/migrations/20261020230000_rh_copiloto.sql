-- Colaboradores ligados ao Copiloto RH (id do Copiloto, UUID). Quem tem
-- copiloto_id recebe o nascimento do Copiloto; o Secullum deixa de
-- sobrescrever esse campo.

alter table rh.colaboradores add column copiloto_id uuid unique;
