-- Rubricas: grupo para as informativas e correção da 8221.

-- Rubrica informativa ("*" no extrato, ex.: FGTS de rescisão) não entra no
-- custo: o encargo correspondente já é calculado pelos parâmetros.
alter type rh.grupo_rubrica add value 'informativa' before 'nao_classificada';

-- 8221 "Antecipação salarial" é o reajuste antecipado (3%) sobre o saldo de
-- salário, não adiantamento: entra no custo como salário. Os adiantamentos
-- de fato são 981 e 8468. Os reflexos nas outras verbas (8232, 8238…, 9609)
-- seguem o grupo da verba-base.
update rh.rubricas set grupo = 'salario' where codigo = 8221;
