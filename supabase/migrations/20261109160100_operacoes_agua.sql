-- operacoes (água): parâmetros do alerta de variação do consumo.
--
-- O alerta compara o consumo do mês com a média dos últimos meses do mesmo
-- hidrômetro (src/lib/operacoes/agua-alertas.ts). Para não alertar em
-- consumo pequeno (0,5 → 1,0 m³ é +100%), a diferença também precisa passar
-- de um mínimo em m³. Os três valores ficam em Parâmetros (spec 4.12).

alter table operacoes.parametros
  -- Variação (para mais ou para menos) contra a média que vira alerta, em %.
  add column agua_variacao_pct numeric(6, 2) not null default 50
    check (agua_variacao_pct > 0),
  -- Quantos meses anteriores entram na média.
  add column agua_variacao_meses int not null default 3
    check (agua_variacao_meses between 1 and 12),
  -- Diferença mínima contra a média, em m³, para o alerta de variação.
  add column agua_variacao_min_m3 numeric(10, 2) not null default 5
    check (agua_variacao_min_m3 >= 0);

grant update (agua_variacao_pct, agua_variacao_meses, agua_variacao_min_m3)
  on operacoes.parametros to authenticated;
