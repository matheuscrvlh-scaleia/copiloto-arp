-- O banco de horas da ARP é pago com adicional de 80% (parâmetro
-- rh.parametros_empresa.banco_horas_adicional_pct): o nome da rubrica 408
-- acompanha. A importação da folha não sobrescreve o nome de quem já existe.
update rh.rubricas
set descricao = 'Saldo banco de horas 80%', atualizado_em = now()
where codigo = 408 and descricao = 'Saldo banco de horas 50%';
