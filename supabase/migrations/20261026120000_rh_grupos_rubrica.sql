-- Rubricas: quatro grupos novos que entram no custo. Arquivo separado porque
-- um valor novo do enum só pode ser usado depois de criado. Como contam:
-- provento (P) soma e desconto (D) subtrai (src/lib/rh/custo.ts).

-- Faltas, atrasos e DSR descontados: reduzem a remuneração (e a base dos encargos).
alter type rh.grupo_rubrica add value 'faltas_atrasos' before 'adiantamento';
-- Primeiros dias de afastamento, pagos pela empresa (o resto é do INSS).
alter type rh.grupo_rubrica add value 'afastamento_empresa' before 'adiantamento';
-- Banco de horas pago: remuneração, separado das horas extras.
alter type rh.grupo_rubrica add value 'banco_horas' before 'adiantamento';
-- Verbas indenizatórias do mês: somam no custo sem gerar encargos nem provisões.
alter type rh.grupo_rubrica add value 'verbas_sem_encargos' before 'adiantamento';
