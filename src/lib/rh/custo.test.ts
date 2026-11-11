import { describe, expect, it } from "vitest";
import {
  ativosPorGrupo,
  type BeneficioDoMes,
  calcularCusto,
  custoMedio,
  custosPor,
  diasNoMes,
  type EncargosDoContrato,
  idadeEm,
  jornadaDe,
  mensalidadeDaFaixa,
  type PessoaDoMes,
  type RubricaDaFolha,
  somarCustos,
  valorDasExtras,
  valorDoBanco,
  valorPelaFaixa,
  vigenteEm,
} from "./custo";
import type { GrupoRubrica } from "./rubricas";

const GRUPOS: Record<number, GrupoRubrica> = {
  8781: "salario",
  149: "adicional",
  250: "hora_extra",
  100: "pro_labore",
  981: "adiantamento",
  8785: "afastamento",
  8801: "afastamento",
  9591: "rescisao",
  28: "pagamento_provisionado",
  307: "beneficio_desconto",
  490: "beneficio_desconto",
  998: "imposto_funcionario",
  995: "reembolso_inss",
  8069: "faltas_atrasos",
  8100: "afastamento_empresa",
  8200: "banco_horas",
  8300: "verbas_sem_encargos",
  5000: "salario",
  23: "informativa",
  77: "nao_classificada",
};
const grupoDe = (c: number) => GRUPOS[c];

const CLT: EncargosDoContrato = {
  inss_patronal_pct: 20,
  terceiros_pct: 5.8,
  fgts_pct: 8,
  aplica_rat: true,
  provisiona_13: true,
  provisiona_ferias: true,
  provisiona_recesso: false,
  multa_rescisoria_pct: 40,
};
// Valores antigos gravados nos campos que a tela não mostra mais: o cálculo
// ignora (estagiário e PJ nunca têm encargos).
const LEGADO: EncargosDoContrato = {
  ...CLT,
  provisiona_recesso: true,
};
// RAT 1% × FAP 2 = 2%: com INSS, Terceiros e FGTS, 35,8%.
const RAT = { rat_pct: 1, fap: 2 };

const r = (
  codigo: number,
  valor: number,
  natureza: RubricaDaFolha["natureza"] = "provento",
): RubricaDaFolha => ({ codigo, descricao: `R${codigo}`, natureza, valor });

const pessoa = (p: Partial<PessoaDoMes>): PessoaDoMes => ({
  colaborador_id: "c1",
  tipo_contrato: "clt",
  departamento_id: "d1",
  cargo_id: "k1",
  salario: 2500,
  jornada_min: 220 * 60,
  rubricas: [r(8781, 2500)],
  beneficios: [],
  ...p,
});

const beneficio = (b: Partial<BeneficioDoMes>): BeneficioDoMes => ({
  nome: "Plano de saúde",
  valor: 417.05,
  rubricas_desconto: [307],
  rubricas_desconto_dependente: [490],
  dependentes: 0,
  ...b,
});

describe("custo por funcionário", () => {
  it("exemplo da especificação: R$ 2.500 com 35,8% de encargos", () => {
    const c = calcularCusto(
      pessoa({
        beneficios: [beneficio({ valor: 1126, rubricas_desconto: [] })],
      }),
      grupoDe,
      CLT,
      RAT,
    );
    expect(c.remuneracao).toBe(2500);
    expect(c.encargos).toBe(895);
    // Provisões com todos os encargos por cima, não só o FGTS.
    expect(c.provisao_13).toBe(282.92);
    expect(c.provisao_ferias).toBe(377.22);
    // 40% do FGTS do mês, sem dividir por 12.
    expect(c.multa_rescisoria).toBe(80);
    expect(c.custo_total).toBe(5261.14);
    expect(c.custo_hora).toBeCloseTo(5261.14 / 220, 4);
    expect(c.salario_hora).toBeCloseTo(2500 / 220, 4);
    expect(c.memoria.pendencias).toEqual([]);
  });

  it("o total sempre fecha com as parcelas", () => {
    const c = calcularCusto(
      pessoa({ rubricas: [r(8781, 1234.57), r(149, 370.37), r(250, 0.4)] }),
      grupoDe,
      CLT,
      RAT,
    );
    const soma =
      c.remuneracao +
      c.encargos +
      c.provisao_13 +
      c.provisao_ferias +
      c.multa_rescisoria +
      c.beneficios +
      c.rescisao -
      c.reembolsos;
    expect(c.custo_total).toBeCloseTo(soma, 10);
    expect(c.remuneracao).toBe(1605.34);
  });

  it("adiantamento, afastamento, impostos e informativas não entram", () => {
    const c = calcularCusto(
      pessoa({
        rubricas: [
          r(8781, 2000),
          r(981, 800, "desconto"),
          r(8785, 1621),
          r(8801, 1621, "desconto"),
          r(998, 150, "desconto"),
          r(23, 0, "informativa"),
        ],
      }),
      grupoDe,
      CLT,
      RAT,
    );
    expect(c.remuneracao).toBe(2000);
  });

  it("férias e 13º pagos consomem a provisão; aviso prévio é rescisão", () => {
    const c = calcularCusto(
      pessoa({ rubricas: [r(8781, 380.78), r(28, 761.55), r(9591, 1748.09)] }),
      grupoDe,
      CLT,
      RAT,
    );
    expect(c.remuneracao).toBe(380.78);
    expect(c.rescisao).toBe(1748.09);
    expect(c.custo_total).toBeGreaterThan(1748.09 + 380.78);
    expect(
      c.memoria.linhas.find((l) => l.rotulo.startsWith("Férias e 13º"))?.valor,
    ).toBe(0);
  });

  it("salário-família é pago e compensado: não entra", () => {
    const sem = calcularCusto(pessoa({}), grupoDe, CLT, RAT);
    const com = calcularCusto(
      pessoa({ rubricas: [r(8781, 2500), r(995, 40.52)] }),
      grupoDe,
      CLT,
      RAT,
    );
    expect(com.custo_total).toBe(sem.custo_total);
  });

  it("benefício: valor cheio − o que o funcionário paga; dependente é repasse", () => {
    const c = calcularCusto(
      pessoa({
        rubricas: [
          r(8781, 2500),
          r(307, 166.82, "desconto"),
          r(490, 673.41, "desconto"),
        ],
        beneficios: [beneficio({})],
      }),
      grupoDe,
      CLT,
      RAT,
    );
    // Exemplo da especificação: 36 anos, 2 anos e 6 meses de casa.
    expect(c.beneficios).toBe(250.23);
    expect(c.memoria.pendencias).toEqual([]);
  });

  it("empresa paga parte do dependente quando configurado", () => {
    const c = calcularCusto(
      pessoa({
        rubricas: [r(8781, 2500), r(307, 166.82, "desconto")],
        beneficios: [beneficio({ dependentes: 100 })],
      }),
      grupoDe,
      CLT,
      RAT,
    );
    expect(c.beneficios).toBe(350.23);
  });

  it("rubrica de pró-labore não entra no custo", () => {
    const c = calcularCusto(
      pessoa({ rubricas: [r(8781, 2500), r(100, 10_000)] }),
      grupoDe,
      CLT,
      RAT,
    );
    expect(c.remuneracao).toBe(2500);
  });

  it("estagiário: sem encargos; recesso = bolsa ÷ 12, sem 1/3 e sem encargos", () => {
    const c = calcularCusto(
      pessoa({
        tipo_contrato: "estagiario",
        salario: 1200,
        rubricas: [r(8781, 1200)],
      }),
      grupoDe,
      LEGADO,
      RAT,
    );
    expect(c.encargos).toBe(0);
    expect(c.provisao_13).toBe(0);
    expect(c.multa_rescisoria).toBe(0);
    expect(c.provisao_ferias).toBe(100);
    expect(c.custo_total).toBe(1300);
    expect(
      c.memoria.linhas.find(
        (l) => l.rotulo === "Provisão de recesso remunerado",
      )?.valor,
    ).toBe(100);
    expect(
      c.memoria.linhas.find((l) => l.rotulo === "Encargos do mês")?.regra,
    ).toMatch(/Lei 11\.788/);

    const semRecesso = calcularCusto(
      pessoa({ tipo_contrato: "estagiario", rubricas: [r(8781, 1200)] }),
      grupoDe,
      { ...LEGADO, provisiona_recesso: false },
      RAT,
    );
    expect(semRecesso.custo_total).toBe(1200);
  });

  it("PJ: custo é o Salário do Copiloto; provisões só se marcadas, sem encargos", () => {
    const pj = (valor_pj: number | null) =>
      pessoa({ tipo_contrato: "pj", rubricas: [], salario: null, valor_pj });
    const sem = calcularCusto(
      pj(7000),
      grupoDe,
      { ...LEGADO, provisiona_13: false, provisiona_ferias: false },
      RAT,
    );
    expect(sem.custo_total).toBe(7000);
    expect(sem.encargos).toBe(0);
    expect(sem.salario_hora).toBeNull();
    expect(sem.valor_informado).toBe(true);

    const com = calcularCusto(pj(6000), grupoDe, LEGADO, RAT);
    expect(com.encargos).toBe(0);
    expect(com.multa_rescisoria).toBe(0);
    expect(com.provisao_13).toBe(500);
    expect(com.provisao_ferias).toBe(666.67);
    expect(com.custo_total).toBe(7166.67);
  });

  it("PJ sem Salário: valor não informado, com pendência", () => {
    const c = calcularCusto(
      pessoa({
        tipo_contrato: "pj",
        rubricas: [],
        salario: null,
        valor_pj: null,
      }),
      grupoDe,
      LEGADO,
      RAT,
    );
    expect(c.valor_informado).toBe(false);
    expect(c.remuneracao).toBe(0);
    expect(c.custo_hora).toBeNull();
    expect(c.memoria.pendencias.join("\n")).toMatch(/Valor não informado/);
  });

  it("grupos novos: faltas reduzem, banco e afastamento somam, verba sem encargos fica fora da base", () => {
    const c = calcularCusto(
      pessoa({
        rubricas: [
          r(8781, 2500),
          r(8069, 100, "desconto"),
          r(8100, 300),
          r(8200, 200),
          r(8300, 1000),
          r(8300, 100, "desconto"),
        ],
      }),
      grupoDe,
      CLT,
      RAT,
    );
    // Base 2.500 − 100 + 300 + 200 = 2.900; remuneração + 900 sem encargos.
    expect(c.remuneracao).toBe(3800);
    expect(c.encargos).toBe(1038.2);
    // Provisão sobre o salário contratual (2.500), não sobre a base do mês.
    expect(c.provisao_13).toBe(282.92);
    expect(
      c.memoria.linhas.find((l) => l.rotulo === "Remuneração")?.regra,
    ).toMatch(/− faltas e atrasos 100\.00.*verbas sem encargos 900\.00 \(fora/);
  });

  it("provisões sobre o salário contratual + adicionais, mesmo em mês de férias (Evandro, out/2026)", () => {
    // Remuneração do mês 903,22 (férias); salário contratual 2.597,18.
    const c = calcularCusto(
      pessoa({
        salario: 2597.18,
        situacao: "ferias",
        valor_fgts: 45.08,
        rubricas: [r(8781, 903.22)],
      }),
      grupoDe,
      { ...CLT, inss_patronal_pct: 20, terceiros_pct: 5.8, fgts_pct: 8 },
      { rat_pct: 3, fap: 0.5 },
    );
    expect(c.remuneracao).toBe(903.22);
    // 2.597,18 ÷ 12 × 1,353 = 292,83; férias × 4/3 = 390,44: 683,27.
    expect(c.provisao_13).toBe(292.83);
    expect(c.provisao_ferias).toBe(390.44);
    expect(c.provisao_13 + c.provisao_ferias).toBeCloseTo(683.27, 2);
    expect(c.multa_rescisoria).toBe(18.03);
    const linha = c.memoria.linhas.find((l) => l.rotulo === "Provisão de 13º");
    expect(linha?.regra).toContain("salário contratual 2597.18");
    expect(
      c.memoria.linhas.find((l) => l.rotulo === "Multa rescisória provisionada")
        ?.regra,
    ).toContain("Valor FGTS do Extrato Mensal (45.08)");
    // Encargos do mês continuam sobre a remuneração.
    expect(c.encargos).toBe(Math.round(903.22 * 0.353 * 100) / 100);
  });

  it("adicionais fixos entram na base da provisão", () => {
    const c = calcularCusto(
      pessoa({ salario: 2400, rubricas: [r(8781, 2400), r(149, 600)] }),
      grupoDe,
      CLT,
      RAT,
    );
    // (2.400 + 600) ÷ 12 × 1,358
    expect(c.provisao_13).toBe(339.5);
  });

  it("afastado pelo INSS no mês não provisiona 13º nem férias", () => {
    for (const situacao of ["doenca", "acidente", "aposentadoria"]) {
      const c = calcularCusto(
        pessoa({ situacao, rubricas: [r(8785, 500)] }),
        grupoDe,
        CLT,
        RAT,
      );
      expect(c.provisao_13).toBe(0);
      expect(c.provisao_ferias).toBe(0);
      expect(
        c.memoria.linhas.find((l) => l.rotulo === "Provisão de férias")?.regra,
      ).toMatch(/Afastado pelo INSS/);
    }
  });

  it("admitido ou desligado no mês: provisiona só com 15 dias ou mais", () => {
    const com = (dias_no_mes: number | null) =>
      calcularCusto(pessoa({ dias_no_mes }), grupoDe, CLT, RAT);
    expect(com(14).provisao_13).toBe(0);
    expect(com(14).provisao_ferias).toBe(0);
    expect(com(15).provisao_13).toBe(282.92);
    expect(com(null).provisao_13).toBe(282.92);
  });

  it("dias no mês de quem entrou ou saiu nele", () => {
    expect(diasNoMes("2026-10-01", "2020-01-10", null)).toBeNull();
    expect(diasNoMes("2026-10-01", "2026-10-17", null)).toBe(15);
    expect(diasNoMes("2026-10-01", "2026-10-18", null)).toBe(14);
    expect(diasNoMes("2026-10-01", "2025-01-01", "2026-10-14")).toBe(14);
    expect(diasNoMes("2026-10-01", "2026-10-05", "2026-10-20")).toBe(16);
    expect(diasNoMes("2026-02-01", "2026-02-14", null)).toBe(15);
    expect(diasNoMes("2026-10-01", "2025-01-01", "2026-11-03")).toBeNull();
  });

  it("aponta o que ficou de fora", () => {
    const c = calcularCusto(
      pessoa({
        jornada_min: null,
        rubricas: [r(8781, 2500), r(77, 10), r(307, 100, "desconto")],
        beneficios: [
          beneficio({
            nome: "Odonto",
            valor: null,
            pendencia: "falta a data de nascimento",
            rubricas_desconto: [],
            rubricas_desconto_dependente: [],
          }),
        ],
      }),
      grupoDe,
      CLT,
      null,
    );
    expect(c.memoria.pendencias.join("\n")).toMatch(/77.*não classificada/);
    expect(c.memoria.pendencias.join("\n")).toMatch(/RAT e FAP/);
    expect(c.memoria.pendencias.join("\n")).toMatch(/Odonto: falta/);
    expect(c.memoria.pendencias.join("\n")).toMatch(/307.*sem benefício/);
    expect(c.memoria.pendencias.join("\n")).toMatch(/Sem jornada/);
    expect(c.custo_hora).toBeNull();
    // Sem RAT: 33,8%.
    expect(c.encargos).toBe(845);
  });

  it("sem encargos cadastrados, só remuneração e benefícios", () => {
    const c = calcularCusto(pessoa({}), grupoDe, null, RAT);
    expect(c.custo_total).toBe(2500);
    expect(c.memoria.pendencias[0]).toMatch(/Sem encargos/);
  });
});

describe("apoio", () => {
  it("jornada: colaborador > cargo > departamento > empresa > folha", () => {
    const p = { colaborador_id: "c1", cargo_id: "k1", departamento_id: "d1" };
    const j = (
      nivel: Partial<{
        colaborador_id: string;
        cargo_id: string;
        departamento_id: string;
      }>,
      horas: number,
      desde = "2026-01-01",
    ) => ({
      colaborador_id: null,
      cargo_id: null,
      departamento_id: null,
      ...nivel,
      horas_mes_min: horas,
      vigente_desde: desde,
    });
    const comp = "2026-07-01";
    expect(jornadaDe(p, [], comp, 13_200)).toBe(13_200);
    expect(jornadaDe(p, [j({}, 1)], comp, 13_200)).toBe(1);
    expect(
      jornadaDe(p, [j({}, 1), j({ departamento_id: "d1" }, 2)], comp, null),
    ).toBe(2);
    expect(
      jornadaDe(
        p,
        [j({ departamento_id: "d1" }, 2), j({ cargo_id: "k1" }, 3)],
        comp,
        null,
      ),
    ).toBe(3);
    expect(
      jornadaDe(
        p,
        [j({ cargo_id: "k1" }, 3), j({ colaborador_id: "c1" }, 4)],
        comp,
        null,
      ),
    ).toBe(4);
    // Vigência futura não vale; a mais recente vence.
    expect(jornadaDe(p, [j({}, 1, "2026-08-01")], comp, 9)).toBe(9);
    expect(jornadaDe(p, [j({}, 1), j({}, 5, "2026-06-01")], comp, null)).toBe(
      5,
    );
  });

  it("vigência, idade e faixa", () => {
    const regs = [
      { vigente_desde: "2026-01-01", v: 1 },
      { vigente_desde: "2026-07-01", v: 2 },
      { vigente_desde: "2026-09-01", v: 3 },
    ];
    expect(vigenteEm(regs, "2026-07-01")?.v).toBe(2);
    expect(vigenteEm(regs, "2025-12-01")).toBeNull();

    expect(idadeEm("1990-07-15", "2026-07-01")).toBe(35);
    expect(idadeEm("1990-07-01", "2026-07-01")).toBe(36);

    const faixas = [
      { idade_min: 34, idade_max: 38, mensalidade: 417.05 },
      { idade_min: 59, idade_max: null, mensalidade: 1535.58 },
    ];
    expect(mensalidadeDaFaixa(faixas, 36)).toBe(417.05);
    expect(mensalidadeDaFaixa(faixas, 80)).toBe(1535.58);
    expect(mensalidadeDaFaixa(faixas, 40)).toBeNull();

    expect(valorPelaFaixa(faixas, "1990-07-15", "2026-07-01")).toEqual({
      valor: 417.05,
      idade: 35,
      faixa: faixas[0],
    });
    expect(valorPelaFaixa(faixas, "1986-01-01", "2026-07-01")).toEqual({
      valor: null,
      idade: 40,
      pendencia: "idade fora das faixas da tabela",
    });
    expect(valorPelaFaixa(faixas, null, "2026-07-01").pendencia).toMatch(
      /nascimento/,
    );
    expect(valorPelaFaixa(null, "1990-07-15", "2026-07-01").pendencia).toMatch(
      /sem tabela/,
    );
  });
});

describe("somas", () => {
  const linha = (dep: string, total: number) => ({
    competencia: "2026-07-01",
    departamento_id: dep,
    cargo_id: null,
    tipo_contrato: "clt",
    colaboradores: 1,
    remuneracao: total / 2,
    encargos: total / 4,
    provisoes: total / 8,
    beneficios: total / 8,
    rescisao: 0,
    reembolsos: 0,
    custo_total: total,
    sem_valor: 0,
  });

  it("soma e agrupa do maior para o menor", () => {
    const ls = [linha("a", 100.1), linha("b", 300.2), linha("a", 0.2)];
    expect(somarCustos(ls)).toMatchObject({
      colaboradores: 3,
      custo_total: 400.5,
    });
    expect(custosPor(ls, (l) => l.departamento_id)).toMatchObject([
      { chave: "b", totais: { custo_total: 300.2 } },
      { chave: "a", totais: { colaboradores: 2, custo_total: 100.3 } },
    ]);
  });
});

describe("custo médio", () => {
  const p = (
    admissao: string | null,
    desligamento: string | null,
    dep: string,
  ) => ({
    admissao,
    desligamento,
    dep,
  });

  it("ativos no último dia de cada mês, somados por grupo", () => {
    const pessoas = [
      p("2026-01-10", null, "a"),
      p("2026-01-10", "2026-07-15", "a"),
      p("2026-07-20", null, "b"),
      p("2026-08-05", null, "b"),
    ];
    const n = ativosPorGrupo(
      pessoas,
      ["2026-07-31", "2026-08-31"],
      (x) => x.dep,
    );
    expect(n.get("a")).toBe(2);
    expect(n.get("b")).toBe(3);
  });

  it("custo ÷ ativos, sem os PJ sem valor; sem ninguém, null", () => {
    expect(custoMedio(9000, 3)).toBe(3000);
    expect(custoMedio(9000, 4, 1)).toBe(3000);
    expect(custoMedio(9000, 1, 1)).toBeNull();
    expect(custoMedio(9000, 0)).toBeNull();
  });
});

describe("horas em R$", () => {
  it("banco: positivo com o adicional, negativo pela hora simples", () => {
    expect(valorDoBanco(19 * 60, 10, 50)).toBeCloseTo(285, 6);
    expect(valorDoBanco(-90, 10, 50)).toBeCloseTo(-15, 6);
    expect(valorDoBanco(-90, 10, null)).toBeCloseTo(-15, 6);
    expect(valorDoBanco(60, 10, null)).toBeNull();
    expect(valorDoBanco(60, null, 50)).toBeNull();
  });

  it("extras: pelo percentual de cada coluna; sem percentual fica de fora", () => {
    expect(
      valorDasExtras(
        { "Ex80%": 60, "Ex100%": 30, "Sem divisão por %": 45 },
        10,
      ),
    ).toEqual({ valor: 18 + 10, foraMin: 45 });
    expect(valorDasExtras({ "Ex80%": 60 }, null)).toEqual({
      valor: null,
      foraMin: 0,
    });
  });
});
