-- Dados de exemplo (fictícios) dos quadros de medidores (spec 4.5): os 8
-- quadros e as 315 caixas na contagem do catálogo (169 ocupadas, 143
-- livres, 3 reservadas; caixas por bloco iguais à tabela de 4.5), com
-- locatários, documentos, números de caixa, rotas e medidores inventados.
-- Os projetos e subestações são os da própria spec (identificam o quadro,
-- não pessoas). Uma caixa do Bloco 12 fica com a troca de locatário
-- pendente (novo no ENET, sem termo) e parte das caixas tem histórico de
-- ocupantes. Salas dos blocos sem quadro próprio (03, 07, 14 e 16) ficam
-- sem caixa. Tudo com exemplo = true: operacoes.remover_exemplos() apaga.

-- Quadros ------------------------------------------------------------------

create temporary table _q (
  codigo text, nome text, bloco text, projeto text, subestacao text, roteiro text,
  armario text, base int, total int, ocupadas int, reservadas int, ordem int
);

insert into _q values
  ('b01', 'Bloco 01', '01', 'Projeto Energisa nº 266/19', 'ET 12062', '14-250-2080', '9', 1824, 63, 37, 1, 1),
  ('b02', 'Bloco 02', '02', 'Projeto Elétrico 371/22 de 27/06/2022', null, '14-250-645', '10', 1720, 27, 8, 0, 2),
  ('b04', 'Bloco 04 & 03', '04', 'Projeto PE 03213/23 (OS 174793573)', null, '006-0250-333', '11', 1580, 48, 26, 1, 3),
  ('b05', 'Bloco 05', '05', 'Projeto PE 00407/18', 'ET 4278', '14-250-645', '12', 1920, 48, 17, 0, 4),
  ('b09', 'Bloco 09', '09', 'Projeto PE 0001418 AP / 1278', 'ET 4593', '14-250-645', '13', 1980, 45, 13, 0, 5),
  ('b10', 'Bloco 10', '10', 'Projeto PE 001518 de 18/01/2018', null, '14-250-2030', '14', 2030, 24, 23, 0, 6),
  ('b11', 'Bloco 11', '11', 'Projeto nº 08 de 2017', null, '14-250-645', '15', 2080, 36, 34, 0, 7),
  ('b12', 'Bloco 12', '12', 'PE 00615 00 649', null, '14-250-645', '16', 2155, 24, 11, 1, 8);

insert into operacoes.quadros (
  codigo, nome, bloco, projeto, subestacao, roteiro_base, armario, disjuntor_geral,
  observacoes, ordem, exemplo
)
select codigo, nome, bloco, projeto, subestacao, roteiro, armario, '150A tripolar',
  case codigo
    when 'b04' then 'O Bloco 03 usa a sala de medidores do Bloco 04 (lado direito).'
    when 'b01' then 'Aumento de carga previsto; conferir o barramento antes de ligar caixa nova.'
  end,
  ordem, true
from _q;

-- Caixas: posição, sala e sorteio fixo do status ---------------------------

create temporary table _c as
select
  q.id as quadro_id,
  p.codigo,
  p.bloco,
  p.roteiro,
  p.base + s.i as numero,
  s.i,
  p.total,
  p.ocupadas,
  p.reservadas,
  ceil(p.total / 2.0)::int as metade,
  (abs(hashtext(p.codigo || ':' || s.i)::bigint) % 2147483647)::int as h,
  row_number() over (partition by p.codigo order by md5(p.codigo || ':' || s.i)) as sorteio
from _q p
join operacoes.quadros q on q.codigo = p.codigo and q.exemplo
cross join lateral generate_series(0, p.total - 1) as s(i);

alter table _c add column lado text, add column j int, add column colunas int,
  add column status text, add column sala_bloco text, add column sala text, add column pavimento text;

update _c set
  lado = case when i < metade then 'esquerdo' else 'direito' end,
  j = case when i < metade then i else i - metade end,
  colunas = least(6, ceil(sqrt(metade * 1.6))::int),
  status = case
    when sorteio <= ocupadas then 'ocupado'
    when sorteio <= ocupadas + reservadas then 'reservado'
    else 'livre'
  end;

-- Lado esquerdo: térreo (1xx); direito: 2º pavimento (2xx). No quadro do
-- Bloco 04, o lado direito atende as salas do Bloco 03 (térreo).
update _c set
  sala_bloco = case when codigo = 'b04' and lado = 'direito' then '03' else bloco end,
  sala = case
    when codigo = 'b04' and lado = 'direito' then (101 + j)::text
    when lado = 'esquerdo' then (101 + j)::text
    else (201 + j)::text
  end,
  pavimento = case
    when lado = 'esquerdo' or codigo = 'b04' then '1º pavimento (térreo)'
    else '2º pavimento'
  end;

-- Salas (cadastro), uma por caixa, e as dos blocos sem quadro próprio.
insert into operacoes.salas (codigo, bloco, sala, pavimento, armario, projeto, exemplo)
select distinct 'BL' || c.sala_bloco || '-' || c.sala, c.sala_bloco, c.sala, c.pavimento,
  q.armario, q.projeto, true
from _c c join _q q on q.codigo = c.codigo
on conflict (codigo) do nothing;

insert into operacoes.salas (codigo, bloco, sala, pavimento, observacoes, exemplo) values
  ('BL03-301', '03', '301', '3º pavimento', 'Sem caixa ligada: conferir no quadro do Bloco 04.', true),
  ('BL03-302', '03', '302', '3º pavimento', null, true),
  ('BL07-101', '07', '101', '1º pavimento (térreo)', 'Bloco sem sala de medidores própria.', true),
  ('BL07-102', '07', '102', '1º pavimento (térreo)', null, true),
  ('BL14-101', '14', '101', '1º pavimento (térreo)', null, true),
  ('BL14-102', '14', '102', '1º pavimento (térreo)', null, true),
  ('BL16-101', '16', '101-102', '1º pavimento (térreo)', 'Duas salas unidas, um medidor.', true)
on conflict (codigo) do nothing;

insert into operacoes.caixas (
  quadro_id, numero, numero_antigo, lado, coluna, linha, rota, sala_id, salas_texto, pavimento,
  status, ocupante, ocupante_documento, ocupante_desde, contrato, ocupante_origem,
  disjuntor_amperes, ligacao, disjuntor_texto, medidor_situacao, medidor_numero,
  observacoes, termo_externo, exemplo
)
select
  c.quadro_id,
  c.numero::text,
  case when c.codigo = 'b05' then 'cx ' || (1670 + c.i) end,
  c.lado,
  c.j % c.colunas + 1,
  c.j / c.colunas + 1,
  c.roteiro || '-' || c.numero,
  s.id,
  'Sala ' || c.sala,
  c.pavimento,
  c.status,
  case when c.status = 'ocupado' then (array[
    'Café Serra', 'Ateliê Lume', 'Vila Pão', 'Studio Nó', 'Casa Brasa', 'Ponto Verde',
    'Oficina 9', 'Bazar Fio', 'Lótus Yoga', 'Tinta Viva', 'Grão Moído', 'Rede Azul',
    'Arte & Linho', 'Bike Serrana', 'Livraria Trilha', 'Clínica Aurora', 'Escola Passo',
    'Studio Pilates Ar', 'Odonto Serra', 'Fisio Movimento', 'Escritório Prisma',
    'Barbearia Norte', 'Ótica Visão', 'Pet Amigo', 'Empório Raiz', 'Papelaria Traço'
  ])[1 + c.h % 26] end,
  case when c.status = 'ocupado' then
    case when c.h % 3 = 0
      then '000.000.' || lpad((c.h % 1000)::text, 3, '0') || '-00'
      else '00.000.' || lpad((c.h % 1000)::text, 3, '0') || '/0001-00'
    end
  end,
  case when c.status = 'ocupado' then date '2021-01-04' + (c.h % 1800) end,
  case when c.status = 'ocupado' then 'CONTR-' || lpad((c.h % 10000)::text, 4, '0') end,
  case when c.status = 'ocupado' then 'importacao' end,
  case when c.status = 'ocupado' and c.h % 10 = 8 then 50 else 40 end,
  case
    when c.status <> 'ocupado' then 'Monofásica'
    when c.h % 10 in (7, 8) then 'Trifásica'
    when c.h % 10 = 9 then 'Bifásica'
    else 'Monofásica'
  end,
  case
    when c.status = 'livre' then '40A em espera'
    when c.status = 'reservado' then '40A Monofásico'
    when c.h % 10 = 7 then 'Disj. 3x40A Trifásico'
    when c.h % 10 = 8 then '50A Trifásico'
    when c.h % 10 = 9 then '40A Bifásico'
    else '40A Monofásico'
  end,
  case
    when c.status = 'ocupado' then 'Medidor ativo'
    when c.status = 'reservado' then 'Outro'
    when c.h % 2 = 0 then 'Chicote de espera'
    else 'Cabos de espera'
  end,
  case when c.status = 'ocupado' then 'M' || (1000000 + c.h % 9000000)::text end,
  case c.status
    when 'livre' then 'Giz ' || c.numero || ', plaqueta Sala ' || c.sala || ', cabos de espera.'
    when 'reservado' then 'Em ligação: aguardando a Energisa. Giz ' || c.numero || '.'
    else 'Giz ' || c.numero || ', plaqueta Sala ' || c.sala || '.'
  end,
  c.status = 'ocupado' and c.h % 20 <> 0,
  true
from _c c
join operacoes.salas s on s.codigo = 'BL' || c.sala_bloco || '-' || c.sala;

-- Caixas sem sala: barramento coletor (Bloco 01) e módulo reserva (Bloco 05).
update operacoes.caixas x set
  numero = 'BARR-01', sala_id = null, salas_texto = null, ocupante = 'Barramento coletor',
  ocupante_origem = 'manual', observacoes = 'Barramento coletor do quadro, sem sala ligada.'
where x.id = (
  select cx.id from operacoes.caixas cx join operacoes.quadros q on q.id = cx.quadro_id
  where q.codigo = 'b01' and q.exemplo and cx.status = 'livre'
  order by cx.numero desc limit 1
);
update operacoes.caixas x set
  numero = x.numero || '-ESP', sala_id = null, salas_texto = null, ocupante = 'Módulo reserva',
  ocupante_origem = 'manual', observacoes = 'Módulo reserva, sem sala ligada.'
where x.id = (
  select cx.id from operacoes.caixas cx join operacoes.quadros q on q.id = cx.quadro_id
  where q.codigo = 'b05' and q.exemplo and cx.status = 'livre'
  order by cx.numero desc limit 1
);
delete from operacoes.salas s
where s.exemplo and s.bloco in ('01', '05')
  and not exists (select 1 from operacoes.caixas c where c.sala_id = s.id);

-- Histórico de ocupantes (sigiloso): um anterior em cerca de 1 de cada 4
-- caixas ocupadas.
insert into operacoes.caixa_ocupantes (caixa_id, nome, documento, entrada, saida, origem)
select c.id,
  (array['Loja Antiga Serra', 'Atelier Rosa', 'Mercearia Vale', 'Studio Ponto', 'Casa Lírio',
         'Gráfica Linha', 'Doceria Nuvem', 'Sapataria Passo'])[(1 + abs(hashtext(c.id::text)::bigint) % 8)::int],
  '00.000.' || lpad((abs(hashtext(c.numero)::bigint) % 1000)::text, 3, '0') || '/0001-99',
  c.ocupante_desde - 900,
  c.ocupante_desde - 1,
  'importacao'
from operacoes.caixas c
join operacoes.quadros q on q.id = c.quadro_id and q.exemplo
where c.status = 'ocupado' and c.ocupante_desde is not null and abs(hashtext(c.numero || q.codigo)::bigint) % 4 = 0
on conflict do nothing;

-- Troca pendente no Bloco 12: o ENET mostra contrato novo e ainda não há termo.
with alvo as (
  select cx.id from operacoes.caixas cx join operacoes.quadros q on q.id = cx.quadro_id
  where q.codigo = 'b12' and q.exemplo and cx.status = 'ocupado'
  order by cx.numero limit 1
), anterior as (
  insert into operacoes.caixa_ocupantes (caixa_id, nome, documento, entrada, saida, origem)
  select id, 'Doce Trama', '00.000.902/0001-00', date '2023-02-01', date '2026-10-31', 'enet'
  from alvo
  on conflict do nothing
)
update operacoes.caixas x set
  ocupante = 'Ateliê Serrano',
  ocupante_documento = '00.000.901/0001-00',
  ocupante_desde = date '2026-11-03',
  contrato = 'CONTR-9001',
  ocupante_origem = 'enet',
  locatario_novo = true,
  termo_externo = false
from alvo
where x.id = alvo.id;

drop table _c;
drop table _q;
