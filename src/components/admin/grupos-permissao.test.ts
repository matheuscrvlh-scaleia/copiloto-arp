import { describe, expect, it } from "vitest";
import {
  PERMISSOES,
  type Permissao,
  permissaoDoPrograma,
} from "@/lib/permissions";
import {
  codigosDoGrupo,
  ehCodigoConhecido,
  gruposDePermissao,
  planoDePermissoes,
  programasInexistentes,
  rotuloDaPermissao,
  temTodasAsPermissoes,
} from "./grupos-permissao";

const A = "a0000000-0000-4000-8000-000000000001";
const B = "a0000000-0000-4000-8000-000000000002";
const programas = [
  {
    codigo: permissaoDoPrograma(A),
    descricao: "Programa – lançar: SustentArp",
  },
  { codigo: permissaoDoPrograma(B), descricao: "Programa – lançar: Turismo" },
];
const fixas = Object.keys(PERMISSOES) as Permissao[];

describe("ehCodigoConhecido", () => {
  it("aceita fixa e programa com uuid; recusa o resto", () => {
    expect(ehCodigoConhecido("admin.usuarios")).toBe(true);
    expect(ehCodigoConhecido(permissaoDoPrograma(A))).toBe(true);
    expect(ehCodigoConhecido("sustentabilidade.programa.x")).toBe(false);
    expect(ehCodigoConhecido("sustentabilidade.programa.")).toBe(false);
    expect(ehCodigoConhecido("toString")).toBe(false);
    expect(ehCodigoConhecido("constructor")).toBe(false);
  });
});

describe("gruposDePermissao", () => {
  it("põe os programas só em Sustentabilidade, depois das fixas", () => {
    const grupos = gruposDePermissao(programas);
    const comProgramas = grupos.filter((g) => g.programas.length > 0);
    expect(comProgramas.map((g) => g.prefixo)).toEqual(["sustentabilidade."]);
    const sus = comProgramas[0];
    if (!sus) throw new Error("sem grupo");
    expect(sus.programas).toEqual(programas);
    const codigos = codigosDoGrupo(sus);
    expect(codigos.slice(-2)).toEqual(programas.map((p) => p.codigo));
    expect(codigos).toHaveLength(sus.fixas.length + 2);
  });

  it("sem programas, só o catálogo fixo (cada fixa em um módulo)", () => {
    const grupos = gruposDePermissao([]);
    expect(grupos.flatMap(codigosDoGrupo).sort()).toEqual([...fixas].sort());
  });
});

describe("rotuloDaPermissao", () => {
  it("usa o catálogo e a descrição do banco; cai no código", () => {
    expect(rotuloDaPermissao("admin.usuarios", programas)).toBe(
      PERMISSOES["admin.usuarios"],
    );
    expect(rotuloDaPermissao(permissaoDoPrograma(A), programas)).toBe(
      "Programa – lançar: SustentArp",
    );
    const outro = permissaoDoPrograma("a0000000-0000-4000-8000-0000000000ff");
    expect(rotuloDaPermissao(outro, programas)).toBe(outro);
  });
});

describe("temTodasAsPermissoes", () => {
  const codigosDosProgramas = programas.map((p) => p.codigo);
  it("exige as fixas e os programas que existem", () => {
    expect(
      temTodasAsPermissoes([...fixas, ...codigosDosProgramas], programas),
    ).toBe(true);
    expect(temTodasAsPermissoes(fixas, programas)).toBe(false);
    expect(temTodasAsPermissoes(fixas, [])).toBe(true);
    expect(
      temTodasAsPermissoes(
        [...fixas.slice(1), ...codigosDosProgramas],
        programas,
      ),
    ).toBe(false);
  });
});

describe("planoDePermissoes", () => {
  const pa = permissaoDoPrograma(A);
  const pb = permissaoDoPrograma(B);

  it("com os programas no formulário, não apaga nada sem querer", () => {
    const r = planoDePermissoes(
      ["rh.ver", pa, pb],
      ["rh.ver", pa, pb],
      [pa, pb],
    );
    expect(r).toEqual({ conceder: [], revogar: [] });
  });

  it("revoga o fixo e o programa desmarcado que a tela mostrou", () => {
    const r = planoDePermissoes(["rh.ver", pa, pb], [pb], [pa, pb]);
    expect(r.revogar.sort()).toEqual(["rh.ver", pa].sort());
    expect(r.conceder).toEqual([]);
  });

  it("concede o que veio e falta", () => {
    const r = planoDePermissoes(["rh.ver"], ["rh.ver", pa], [pa]);
    expect(r).toEqual({ conceder: [pa], revogar: [] });
  });

  it("programa que a tela não mostrou (criado depois) não é revogado", () => {
    const r = planoDePermissoes(["rh.ver", pa, pb], ["rh.ver", pa], [pa]);
    expect(r.revogar).toEqual([]);
    // sem o campo (cliente antigo): nenhum programa é revogado
    expect(planoDePermissoes([pa, pb], [], []).revogar).toEqual([]);
    // mas o fixo continua sendo revogado como antes
    expect(planoDePermissoes(["rh.ver", pa], [], []).revogar).toEqual([
      "rh.ver",
    ]);
  });
});

describe("programasInexistentes", () => {
  it("lista os de programa pedidos que o banco não tem", () => {
    const pa = permissaoDoPrograma(A);
    const pb = permissaoDoPrograma(B);
    expect(programasInexistentes([pa, pb, "rh.ver"], [pa])).toEqual([pb]);
    expect(programasInexistentes([pa, pa], [pa])).toEqual([]);
    expect(programasInexistentes(["rh.ver"], [])).toEqual([]);
  });
});
