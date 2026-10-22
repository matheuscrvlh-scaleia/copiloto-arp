import { describe, expect, it } from "vitest";
import {
  type BeneficioDoMes,
  calcularCusto,
  custosPor,
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
  multa_rescisoria_pct: 40,
};
const PRO_LABORE: EncargosDoContrato = {
  inss_patronal_pct: 20,
  terceiros_pct: 0,
  fgts_pct: 0,
  aplica_rat: false,
  provisiona_13: false,
  provisiona_ferias: false,
  multa_rescisoria_pct: 0,
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

  it("pró-labore: só INSS de 20%, sem provisões nem multa", () => {
    const c = calcularCusto(
      pessoa({ tipo_contrato: "pro_labore", rubricas: [r(100, 10_000)] }),
      grupoDe,
      PRO_LABORE,
      RAT,
    );
    expect(c.encargos).toBe(2000);
    expect(c.provisao_13 + c.provisao_ferias + c.multa_rescisoria).toBe(0);
    expect(c.custo_total).toBe(12_000);
  });

  it("PJ: custo é a nota do mês", () => {
    const c = calcularCusto(
      pessoa({
        tipo_contrato: "pj",
        rubricas: [],
        valor_notas: 7000,
        salario: null,
      }),
      grupoDe,
      { ...PRO_LABORE, inss_patronal_pct: 0 },
      RAT,
    );
    expect(c.custo_total).toBe(7000);
    expect(c.salario_hora).toBeNull();
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
