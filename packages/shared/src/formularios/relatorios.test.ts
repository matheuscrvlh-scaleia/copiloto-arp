import { describe, expect, it } from "vitest";
import {
  type Campo,
  camposSchema,
  novoCampo,
  problemasDosCampos,
  resumir,
  validarRespostas,
} from "./campos";
import { aparenciaSchema, hexDaCor, paginasDosCampos } from "./formulario";
import { MODELOS, NOMES_DOS_MODELOS } from "./modelos";
import { lerPeriodo, perguntar, sugestoes } from "./perguntar";

// Relatórios (evolução de Formulários): opção "Outro", modelos, aparência,
// páginas e o chat "Pergunte às respostas".

const campo = (tipo: Campo["tipo"], extra: Partial<Campo> = {}): Campo => ({
  ...novoCampo(tipo),
  ...extra,
});

describe("opção Outro", () => {
  const unica = campo("unica", {
    titulo: "Motivo",
    opcoes: ["A", "B"],
    outro: true,
  });
  const caixas = campo("multipla", {
    titulo: "Itens",
    opcoes: ["X", "Y"],
    outro: true,
  });

  it("aceita texto livre só quando a pergunta tem Outro", () => {
    expect(
      validarRespostas([unica], { [unica.id]: "Vazamento" }).respostas,
    ).toEqual({ [unica.id]: "Vazamento" });
    const sem = { ...unica, outro: false };
    expect(
      validarRespostas([sem], { [sem.id]: "Vazamento" }).erros[sem.id],
    ).toBe("Escolha uma das opções.");
    const lista = campo("lista", { titulo: "L", opcoes: ["A"], outro: true });
    expect(
      validarRespostas([lista], { [lista.id]: "Z" }).erros[lista.id],
    ).toBeTruthy();
  });

  it("caixas: opções na ordem e um só Outro, no fim", () => {
    const r = validarRespostas([caixas], { [caixas.id]: ["Livre", "Y", "X"] });
    expect(r.respostas[caixas.id]).toEqual(["X", "Y", "Livre"]);
    expect(
      validarRespostas([caixas], { [caixas.id]: ["a", "b"] }).erros[caixas.id],
    ).toBeTruthy();
    expect(
      validarRespostas([caixas], { [caixas.id]: ["x".repeat(201)] }).erros[
        caixas.id
      ],
    ).toContain("200");
  });

  it("resumo conta o Outro e o editor barra opção chamada Outro", () => {
    const r = resumir(unica, ["A", "Livre", "Outra coisa", "B"]);
    expect(r.tipo === "contagem" && r.itens.at(-1)).toEqual({
      rotulo: "Outro",
      n: 2,
    });
    expect(
      problemasDosCampos([{ ...unica, opcoes: ["A", "outro"] }]).join(),
    ).toContain("Outro");
  });

  it("pergunta gravada antes do Outro continua válida", () => {
    const { outro: _, ...antiga } = unica;
    const lido = camposSchema.parse([antiga]);
    expect(lido[0]?.outro).toBe(false);
  });
});

describe("modelos", () => {
  it.each(NOMES_DOS_MODELOS)("%s sai pronto para publicar", (nome) => {
    const m = MODELOS[nome].criar();
    expect(m.titulo.trim()).not.toBe("");
    expect(camposSchema.safeParse(m.campos).success).toBe(true);
    expect(problemasDosCampos(m.campos)).toEqual([]);
  });

  it("cada chamada gera ids novos", () => {
    const a = MODELOS.visita.criar().campos.map((c) => c.id);
    const b = MODELOS.visita.criar().campos.map((c) => c.id);
    expect(a.some((id) => b.includes(id))).toBe(false);
  });

  it("condição do modelo aponta para a pergunta certa", () => {
    const { campos } = MODELOS.visita.criar();
    const urgencia = campos.find((c) => c.titulo === "Urgência");
    const precisa = campos.find((c) => c.titulo.startsWith("Precisa"));
    expect(urgencia?.condicao).toEqual({
      campo: precisa?.id,
      valores: ["sim"],
    });
  });
});

describe("aparência e páginas", () => {
  it("valida cor, páginas e o endereço depois do envio", () => {
    expect(
      aparenciaSchema.parse({
        cor: "azul",
        paginas: true,
        redirecionar_para: " ",
      }),
    ).toEqual({ cor: "azul", paginas: true, redirecionar_para: null });
    expect(
      aparenciaSchema.safeParse({
        cor: "azul",
        paginas: false,
        redirecionar_para: "http://x.com",
      }).success,
    ).toBe(false);
    expect(
      aparenciaSchema.safeParse({
        cor: "rosa",
        paginas: false,
        redirecionar_para: "",
      }).success,
    ).toBe(false);
    expect(hexDaCor("verde")).toBe("#15803d");
    expect(hexDaCor("qualquer")).toBe("#171717");
  });

  it("cada seção abre uma página; o que vem antes fica na primeira", () => {
    const [a, s1, b, s2, c] = [
      campo("texto"),
      campo("secao"),
      campo("texto"),
      campo("secao"),
      campo("texto"),
    ] as Campo[];
    expect(paginasDosCampos([a, s1, b, s2, c] as Campo[])).toEqual([
      [a?.id],
      [s1?.id, b?.id],
      [s2?.id, c?.id],
    ]);
    expect(paginasDosCampos([s1, b] as Campo[])).toEqual([[s1?.id, b?.id]]);
    expect(paginasDosCampos([])).toEqual([]);
  });
});

describe("Pergunte às respostas", () => {
  // Quarta, 11/11/2026, 15h em Brasília.
  const agora = new Date("2026-11-11T18:00:00Z");
  const motivo = campo("unica", {
    titulo: "Motivo da visita",
    opcoes: ["Preventiva", "Corretiva"],
    outro: true,
  });
  const nota = campo("escala", {
    titulo: "Nota geral do local",
    escalaMin: 1,
    escalaMax: 5,
  });
  const precisa = campo("sim_nao", { titulo: "Precisa de providência?" });
  const obs = campo("paragrafo", { titulo: "Observações" });
  const campos = [motivo, nota, precisa, obs];
  const reg = (quando: string, m: string, n: number, p: boolean, o = "") => ({
    enviada_em: quando,
    respostas: {
      [motivo.id]: m,
      [nota.id]: n,
      [precisa.id]: p,
      ...(o ? { [obs.id]: o } : {}),
    },
  });
  const registros = [
    reg("2026-11-11T13:00:00Z", "Preventiva", 5, false, "Tudo certo"),
    reg("2026-11-10T13:00:00Z", "Corretiva", 3, true),
    reg("2026-11-02T13:00:00Z", "Preventiva", 4, false),
    reg("2026-10-15T13:00:00Z", "Vazamento", 1, true, "Cano furado"),
  ];
  const p = (t: string) => perguntar(t, campos, registros, agora);

  it("quantas pessoas responderam (exemplo da ata)", () => {
    expect(p("quantas pessoas responderam?").texto).toBe(
      "Chegaram 4 respostas.",
    );
    expect(p("Quantas respostas chegaram hoje?").texto).toBe(
      "Chegou 1 resposta hoje.",
    );
    expect(p("quantas respostas nesta semana").texto).toContain(
      "2 respostas nos últimos 7 dias",
    );
    expect(p("total em outubro").texto).toContain(
      "1 resposta em outubro de 2026",
    );
    expect(p("respostas neste mês").texto).toContain("3 respostas neste mês");
  });

  it("quantos marcaram uma opção, pelo título ou só pela opção", () => {
    expect(p("Quantos marcaram Preventiva em “Motivo da visita”?").texto).toBe(
      "2 respostas de 4 (50%) marcaram “Preventiva” em “Motivo da visita”.",
    );
    expect(p("quantos corretiva?").texto).toContain(
      "1 resposta de 4 (25%) marcou",
    );
    expect(p("quantos disseram sim em precisa de providencia").texto).toContain(
      "2 respostas de 4 (50%) marcaram “Sim”",
    );
  });

  it("média, maior e menor; mais escolhida; Outro", () => {
    expect(p("qual a média da nota geral?").texto).toBe(
      "A média de “Nota geral do local” é 3,3, com 4 respostas.",
    );
    expect(p("qual a média?").texto).toContain("3,3");
    expect(p("qual a menor nota do local").texto).toContain("1,00");
    expect(p("qual o motivo mais escolhido").texto).toContain("“Preventiva”");
    const outros = p("o que escreveram em outro no motivo da visita");
    expect(outros.texto).toContain("1 pessoa escreveu");
    expect(outros.linhas).toEqual(["Vazamento"]);
  });

  it("resumo de pergunta de texto e última resposta", () => {
    const r = p("observações");
    expect(r.texto).toContain("2 de 4 respostas responderam “Observações”");
    expect(r.linhas).toEqual(["Tudo certo", "Cano furado"]);
    expect(p("quando foi a última resposta?").texto).toBe(
      "A última resposta chegou em 11/11/2026 10:00.",
    );
    expect(p("pergunta 2").texto).toContain("“Nota geral do local”");
  });

  it("sem entender, devolve sugestões que funcionam", () => {
    const r = p("me conta uma piada");
    expect(r.sugestoes?.length).toBeGreaterThan(2);
    for (const s of sugestoes(campos))
      expect(p(s).sugestoes, s).toBeUndefined();
  });

  it("período em Brasília", () => {
    const hoje = lerPeriodo("hoje", agora);
    expect(hoje?.de.toISOString()).toBe("2026-11-11T03:00:00.000Z");
    expect(lerPeriodo("ultimos 30 dias", agora)?.rotulo).toBe(
      "nos últimos 30 dias",
    );
    // Dezembro sem ano, em novembro: o do ano passado.
    expect(lerPeriodo("dezembro", agora)?.rotulo).toBe("em dezembro de 2025");
  });
});
