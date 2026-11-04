import { describe, expect, it } from "vitest";
import { lerDados } from "./contrato";
import { fiadorDaFicha, partesDaFicha } from "./contrato-ficha";
import { dadosDaFichaParaContrato } from "./ficha";

const ID = "00000000-0000-4000-8000-000000000001";

describe("ficha → etapa Partes", () => {
  it("PJ: empresa, sócio administrador e destinação", () => {
    const f = dadosDaFichaParaContrato({
      id: ID,
      tipo: "pj",
      origem: "sistema",
      respostas: {
        email: "contato@alecrim.com.br",
        tipo: "pj",
        empresa: {
          cnpj: "11222333000181",
          razao_social: "Ateliê Alecrim Ltda",
          nome_fantasia: "Ateliê Alecrim",
          ie_isento: true,
          im: "123",
          ramo: "Comércio de presentes",
        },
        pessoas: [
          {
            nome: "Larissa Pacheco",
            cpf: "52998224725",
            estado_civil: "Solteiro(a)",
            telefone: "22999990000",
          },
        ],
      },
    });
    const p = partesDaFicha(f, lerDados({}).partes, "Ateliê Alecrim Ltda");
    expect(p.origem).toBe("ficha");
    expect(p.ficha_id).toBe(ID);
    expect(p.tipo).toBe("pj");
    expect(p.pj.razao_social).toBe("ATELIÊ ALECRIM LTDA");
    expect(p.pj.ie_isento).toBe(true);
    expect(p.pj.im).toBe("123");
    expect(p.representantes).toHaveLength(1);
    expect(p.representantes[0]?.nome).toBe("LARISSA PACHECO");
    expect(p.representantes[0]?.estado_civil).toBe("solteiro");
    expect(p.destinacao.atividades).toBe("COMÉRCIO DE PRESENTES");
  });

  it("fiador casado traz o cônjuge", () => {
    const f = dadosDaFichaParaContrato({
      id: ID,
      tipo: "fiador",
      origem: "sistema",
      respostas: {
        tipo: "fiador",
        pessoas: [
          {
            nome: "José Fiador",
            cpf: "52998224725",
            estado_civil: "Casado(a)",
            conjuge: { nome: "Ana Fiadora", cpf: "11144477735" },
          },
        ],
      },
    });
    const fi = fiadorDaFicha(f, undefined, "José Fiador");
    expect(fi.tipo).toBe("pf");
    expect(fi.pf.nome).toBe("JOSÉ FIADOR");
    expect(fi.pf.estado_civil).toBe("casado");
    expect(fi.conjuge.nome).toBe("ANA FIADORA");
  });
});
