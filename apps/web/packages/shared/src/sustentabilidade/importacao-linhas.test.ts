import { describe, expect, it } from "vitest";
import type {
  DefinicaoFormulario,
  Pergunta,
  TipoPergunta,
} from "./formulario/tipos";
import {
  abasDoArquivo,
  type Decisao,
  lerAtracoesDasAbas,
  lerEntrevistasDasAbas,
  lerProdutoresDasAbas,
  lerQuiosqueDasAbas,
  lerTourDasAbas,
  type ParticipacaoLida,
} from "./importacao";
import {
  ATRACOES_2026,
  abaAtracoes2025,
  abaAtracoes2026,
  abaEcocopos,
  abaGestao,
  abaProdutores25,
  abaProdutores26,
  abaQuiosqueNov25,
  abaTour,
  abaTourCervejeiro,
  CONTRATOS_FICTICIOS,
  cabecalhoForms,
  linhasForms,
  planilha,
} from "./importacao/__fixtures__/planilhas";
import {
  abasSemOrcamento,
  aplicarNomes,
  aplicarVinculos,
  type ContratoDaImportacao,
  casarCampos,
  contagemPorResposta,
  converterValor,
  decisoesPendentes,
  entrevistaDaLinha,
  lancamentoDaLinha,
  lerEscolhas,
  nomesNovos,
  PULAR,
  SEPARADOS,
  separarReais,
  somaDosReais,
  totaisPorAno,
  totaisPorMes,
} from "./importacao-linhas";
import { questionarioV1 } from "./questionario-inicial";

// Mapeamento leitor → linhas do banco (spec 4.10) e as conferências da
// seção 8 com as planilhas fictícias dos leitores.

/** Campo como os formulários de exemplo do banco (opção `<id>_<n>`). */
function campo(
  id: string,
  texto: string,
  tipo: TipoPergunta,
  opcoes: string[] = [],
  unidades: string[] = [],
): Pergunta {
  return {
    id,
    numero: "",
    texto,
    ajuda: "",
    tipo,
    obrigatoria: false,
    opcoes: opcoes.map((t, i) => ({
      id: `${id}_${i + 1}`,
      texto: t,
      ativa: true,
    })),
    unidades,
    mostrar_se: null,
    fonte_indicador: false,
    ativa: true,
    travada: false,
    auto: null,
  };
}
const formulario = (...perguntas: Pergunta[]): DefinicaoFormulario => ({
  secoes: [{ id: "s1", nome: "Lançamento", ativa: true, perguntas }],
});

const ATRACOES = formulario(
  campo("data", "Data", "data"),
  campo("horario", "Horário", "hora"),
  campo("tipo", "Tipo", "uma", [
    "Feira de produtor local",
    "Feira de orgânicos",
    "Degustação",
    "Oficina",
    "Oficina infantil",
    "DJ",
    "Massagem",
    "Demonstração",
    "Contação de história",
  ]),
  campo("tema", "Tema", "texto"),
  campo("local", "Local", "uma", ["Rua das Rendas", "Boulevard"]),
  campo(
    "horas_experiencia",
    "Horas de experiência",
    "numero_unidade",
    [],
    ["h"],
  ),
  campo("valor", "Valor", "reais"),
);
const PRODUTORES = formulario(
  campo("data", "Data da feira", "data"),
  campo("produtor", "Produtor", "lista_cadastro"),
);
const QUIOSQUE = formulario(
  campo("pergunta", "Pergunta", "texto"),
  campo("data", "Data", "data"),
  campo("horario", "Horário", "hora"),
  campo("publico", "Público", "uma", [
    "Turista",
    "Friburguense",
    "Entrega",
    "Trabalhador",
    "Não informado",
  ]),
  campo("cidade", "Cidade de origem", "texto"),
  campo("pessoas", "Número de pessoas", "numero"),
);
const TOUR = formulario(
  campo("data", "Data", "data"),
  campo("grupo", "Grupo ou descrição", "texto"),
  campo("tipo", "Tipo", "uma", ["Mensal", "Escolar", "Cervejeiro", "Outro"]),
  campo("participantes", "Participantes", "numero"),
  campo("receita_parceiro", "Receita do parceiro", "reais"),
  campo("receita_arp", "Receita da ARP", "reais"),
  campo("custo_parceiro", "Custo do parceiro", "reais"),
  campo("custo_album", "Custo do álbum", "reais"),
  campo("custo_copo", "Custo do copo", "reais"),
);

const abas = async (...a: Parameters<typeof planilha>[0]) =>
  abasDoArquivo(await planilha(a));

const PARAMETROS = {
  validadePadraoMeses: 24,
  validadePorSetor: { "Lojas e serviços gerais": 12 },
};

const CONTRATOS: ContratoDaImportacao[] = CONTRATOS_FICTICIOS.map((c, i) => ({
  ...c,
  cliente_doc: `0000000000${String(i).padStart(4, "0")}`,
  validade_meses_especifica: c.id === "c-02" ? 6 : null,
}));

describe("entrevistas do Forms", () => {
  const ler = async () =>
    lerEntrevistasDasAbas(
      await abas({
        nome: "Respostas ao formulário 1",
        linhas: [cabecalhoForms(), ...linhasForms()],
      }),
      { contratos: CONTRATOS },
    );

  it("seção 8: 20 entrevistas, 16 de 1ª vez e 4 de atualização; 4 pedem vínculo", async () => {
    const r = await ler();
    expect(r.resumo).toMatchObject({
      linhas: 20,
      primeira: 16,
      atualizacao: 4,
    });
    const vinculos = r.decisoes.filter((d) => d.tipo === "vincular_contrato");
    expect(vinculos).toHaveLength(4);
    // Sem escolha, as 4 ficam pendentes e não entram.
    const sem = aplicarVinculos(r.linhas, r.decisoes, {});
    expect(sem.linhas).toHaveLength(16);
    expect(decisoesPendentes(r.decisoes, lerEscolhas({}))).toHaveLength(4);
  });

  it("seção 8: grau de conhecimento e PGRS contados como no Forms", async () => {
    const r = await ler();
    expect(contagemPorResposta(r.linhas, "q7")).toEqual([
      { resposta: "Pouco", n: 8 },
      { resposta: "Mediano", n: 6 },
      { resposta: "Nenhum", n: 5 },
      { resposta: "Muito", n: 1 },
    ]);
    expect(contagemPorResposta(r.linhas, "q16")).toEqual([
      { resposta: "Não", n: 17 },
      { resposta: "Sim", n: 2 },
      { resposta: "Em branco", n: 1 },
    ]);
  });

  it("vínculo escolhido na prévia: contrato, pular, e a duplicidade refeita", async () => {
    const r = await ler();
    const [a, b, c, d] = r.decisoes as Extract<
      Decisao,
      { tipo: "vincular_contrato" }
    >[];
    if (!a || !b || !c || !d) throw new Error("faltam decisões");
    const linhaA = r.linhas.find((l) => l.linha === a.linha);
    const vinculos = {
      [a.id]: "c-90",
      [b.id]: PULAR,
      [c.id]: "c-90",
      [d.id]: "c-90",
    };
    const ap = aplicarVinculos(r.linhas, r.decisoes, vinculos, [
      // c-90 já tem entrevista na data da linha de `a`: bloqueia.
      { contrato_id: "c-90", data: linhaA?.data ?? "" },
    ]);
    expect(ap.puladas).toBe(1);
    expect(ap.repetidas.size).toBe(1);
    expect(ap.repetidas.get(a.linha)).toBe("já importada antes");
    expect(ap.linhas).toHaveLength(18);
    expect(
      ap.linhas.filter((l) => l.contrato_id === "c-90").map((l) => l.linha),
    ).toEqual([c.linha, d.linha]);
    expect(decisoesPendentes(r.decisoes, lerEscolhas({ vinculos }))).toEqual(
      [],
    );
  });

  it("linha lida → entrevista da versão 1: respostas por id, setor e validade", async () => {
    const r = await ler();
    const v1 = questionarioV1();
    const lida = r.linhas[0];
    if (!lida) throw new Error("sem linha");
    const c01 = CONTRATOS.find((c) => c.id === lida.contrato_id);
    if (!c01) throw new Error("sem contrato");
    const e = entrevistaDaLinha(lida, c01, v1, PARAMETROS);
    expect(e).toMatchObject({
      contrato_id: "c-01",
      data: lida.data,
      tipo: "primeira",
      setor: "Lojas e serviços gerais",
      cliente_doc: c01.cliente_doc,
    });
    expect(e?.respostas.q3).toEqual(["q3_lojas"]);
    expect(e?.respostas.q16).toBe("q16_sim");
    expect(e?.respostas.q20).toEqual({
      q20_organico: "pouco",
      q20_plastico: "muito",
      q20_papel: "nao_gera",
    });
    // Validade do setor (12 meses) a partir da data da entrevista.
    expect(e?.valida_ate).toBe(
      `${Number(lida.data?.slice(0, 4)) + 1}${lida.data?.slice(4)}`,
    );
    // "Pouco" não é o texto da opção do questionário: fica para corrigir.
    expect(e?.pendentes.map((p) => p.pergunta_id)).toContain("q7");

    // Validade específica do contrato vence a do setor.
    const l2 = r.linhas.find((l) => l.contrato_id === "c-02");
    const c02 = CONTRATOS.find((c) => c.id === "c-02");
    if (!l2 || !c02) throw new Error("sem c-02");
    const e2 = entrevistaDaLinha(l2, c02, v1, PARAMETROS);
    expect(e2?.valida_ate.slice(0, 7)).toBe(
      (() => {
        const [a, m] = (l2.data ?? "").split("-").map(Number);
        const t = (a ?? 0) * 12 + (m ?? 1) - 1 + 6;
        return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
      })(),
    );
  });
});

describe("atrações → lançamentos de Mercado Local / Atrações do mês", () => {
  const ler = async () =>
    lerAtracoesDasAbas(await abas(abaAtracoes2025(), abaAtracoes2026()));

  it("seção 8: mai 56×57 e ago 26×27 pedem motivo; com motivo, nada pendente", async () => {
    const r = await ler();
    const motivos = r.decisoes.filter((d) => d.tipo === "confirmar_motivo");
    expect(
      motivos.map((d) =>
        d.tipo === "confirmar_motivo" ? [d.lido, d.escrito] : null,
      ),
    ).toEqual([
      [56, 57],
      [26, 27],
    ]);
    expect(decisoesPendentes(r.decisoes, lerEscolhas({}))).toHaveLength(2);
    const escolhas = lerEscolhas({
      motivos: Object.fromEntries(
        motivos.map((d) => [d.id, "Uma ativação cancelada."]),
      ),
    });
    expect(decisoesPendentes(r.decisoes, escolhas)).toEqual([]);
    // Motivo curto demais não vale.
    expect(
      decisoesPendentes(
        r.decisoes,
        lerEscolhas({ motivos: { [motivos[0]?.id ?? ""]: "ok" } }),
      ),
    ).toHaveLength(2);
  });

  it("colunas casadas pelo nome do campo; reais à parte; o que não casa vira pendência", async () => {
    const r = await ler();
    const c = casarCampos("atracoes", ATRACOES);
    expect(Object.keys(c.porColuna).sort()).toEqual(
      [
        "data",
        "horario",
        "horas_experiencia",
        "local",
        "tema",
        "tipo",
        "valor",
      ].sort(),
    );
    expect(c.semCampo).toEqual(["horas_oficina", "inscricao", "observacao"]);
    expect(c.semColuna).toEqual([]);

    const jan = r.linhas.find((l) => l.data === "2026-01-01");
    if (!jan) throw new Error("sem atração");
    const l = lancamentoDaLinha(c, { ...jan, valor: 25 });
    expect(l.data).toBe("2026-01-01");
    expect(l.valores).toEqual({
      data: "2026-01-01",
      horario: "10:00",
      tipo: "tipo_4",
      tema: "Tema inventado 1",
      horas_experiencia: { n: 2, u: "h" },
    });
    expect(l.reais).toEqual({ valor: 25 });
    expect(l.pendentes).toEqual([
      {
        coluna: "local",
        valor: "Corredor fictício",
        motivo: "opção não encontrada",
      },
    ]);
  });

  it("totais por mês e por ano das atrações de 2026", async () => {
    const r = await ler();
    const meses = totaisPorMes(
      r.linhas.filter((l) => l.data?.startsWith("2026")),
    );
    expect(meses.map((m) => m.linhas)).toEqual(ATRACOES_2026.map(([, l]) => l));
    expect(totaisPorAno(meses)).toEqual([
      { competencia: "2026", linhas: 287, quantidade: null },
    ]);
  });
});

describe("produtores → Mercado Local / Produtores na feira", () => {
  const ler = async () =>
    lerProdutoresDasAbas(await abas(abaProdutores25(), abaProdutores26()));

  it("unificar nomes: a grafia errada vira a escolhida; separados mantém", async () => {
    const r = await ler();
    const d = r.decisoes[0];
    if (d?.tipo !== "unificar_nomes") throw new Error("sem decisão de nomes");
    const unidos = aplicarNomes(r.linhas, r.decisoes, {
      [d.id]: "Quitutes da Dona Zuza",
    });
    expect(unidos.some((l) => l.produtor === "Quitutess da Dona Zuza")).toBe(
      false,
    );
    const separados = aplicarNomes(r.linhas, r.decisoes, {
      [d.id]: SEPARADOS,
    });
    expect(
      separados.filter((l) => l.produtor === "Quitutess da Dona Zuza"),
    ).toHaveLength(1);
    // Mesma grafia sem acento: o nome do cadastro vale.
    const comCadastro = aplicarNomes(
      r.linhas,
      r.decisoes,
      { [d.id]: SEPARADOS },
      new Map([["horta imaginaria", "Horta Imaginária"]]),
    );
    expect(
      comCadastro
        .filter((l) => l.chave === "horta imaginaria")
        .map((l) => l.produtor),
    ).toEqual(Array(4).fill("Horta Imaginária"));
  });

  it("seção 8: janeiro tem 7 participações e 4 produtores únicos", async () => {
    const r = await ler();
    const jan = r.linhas.filter((l) => l.data?.startsWith("2026-01"));
    expect(jan).toHaveLength(7);
    expect(new Set(jan.map((l) => l.chave)).size).toBe(4);
  });

  it("participação → lançamento com o nome no campo lista; nomes novos para o cadastro", async () => {
    const r = await ler();
    const c = casarCampos("produtores", PRODUTORES);
    const p = r.linhas[0] as ParticipacaoLida;
    expect(lancamentoDaLinha(c, { ...p })).toMatchObject({
      data: p.data,
      valores: { data: p.data, produtor: p.produtor },
      reais: {},
      pendentes: [],
    });
    const novos = nomesNovos(
      r.linhas,
      new Map([["horta imaginaria", "Horta Imaginária"]]),
    );
    expect(novos.map((n) => n.normalizado)).not.toContain("horta imaginaria");
    expect(novos.map((n) => n.normalizado)).toContain("quitutes da dona zuza");
  });
});

describe("quiosque e tour → Turismo", () => {
  it("pergunta do quiosque: público pela opção do formulário", async () => {
    const r = lerQuiosqueDasAbas(await abas(abaQuiosqueNov25()), {
      publicos: [
        "Turista",
        "Friburguense",
        "Entrega",
        "Trabalhador",
        "Não informado",
      ],
    });
    const c = casarCampos("quiosque", QUIOSQUE);
    expect(c.semCampo).toEqual(["dificuldade"]);
    const [a, b, d] = r.linhas.map((l) => lancamentoDaLinha(c, { ...l }));
    expect(a?.valores).toMatchObject({
      data: "2025-11-03",
      horario: "10:15",
      publico: "publico_1",
      cidade: "Cidade Inventada",
    });
    // "Friiburguense" padronizado; data invertida para o mês da aba.
    expect(b?.valores).toMatchObject({
      data: "2025-11-05",
      publico: "publico_2",
    });
    expect(d?.valores.publico).toBe("publico_3");
  });

  it("tour: participantes nos valores, receitas e custos em lancamento_valores", async () => {
    const r = lerTourDasAbas(
      await abas(abaTour(), abaTourCervejeiro(), abaGestao()),
    );
    const c = casarCampos("tour", TOUR);
    const montados = r.linhas.map((l) => lancamentoDaLinha(c, { ...l }));
    const primeiro = montados[0];
    expect(primeiro?.valores).toEqual({
      data: "2023-02-10",
      grupo: "Grupo inventado 1",
      tipo: "tipo_1",
      participantes: 30,
    });
    expect(primeiro?.reais).toMatchObject({
      receita_parceiro: 100,
      receita_arp: 50,
      custo_parceiro: 120,
    });
    expect(Object.keys(primeiro?.valores ?? {})).not.toContain("receita_arp");
    const soma = somaDosReais(montados);
    expect(soma.receita_arp).toBe(50 * 4 + 300);
    // Participantes por mês somados (o tour de 2025 marcado como 2024 usa a data).
    const meses = totaisPorMes(
      montados.map((m) => ({
        data: m.data,
        quantidade: m.valores.participantes as number,
      })),
    );
    expect(
      totaisPorAno(meses).map((a) => [a.competencia, a.quantidade]),
    ).toEqual([
      ["2023", 70],
      ["2024", 25],
      ["2025", 32],
    ]);
  });

  it("separarReais tira os campos em reais de valores já prontos", () => {
    expect(
      separarReais(TOUR, { participantes: 3, receita_arp: 10.5, grupo: "x" }),
    ).toEqual({
      valores: { participantes: 3, grupo: "x" },
      reais: { receita_arp: 10.5 },
    });
  });
});

describe("conversões e abas", () => {
  it("abas de orçamento de eventos ficam de fora", () => {
    const r = abasSemOrcamento([
      { nome: "Atração 2026", linhas: [] },
      { nome: "Plano B", linhas: [] },
      { nome: "Plano de Mídia", linhas: [] },
      { nome: "Local Working", linhas: [] },
      { nome: "Souvenir – ARP", linhas: [] },
    ]);
    expect(r.ignoradas).toEqual(["Plano B", "Plano de Mídia", "Local Working"]);
    expect(r.abas.map((a) => a.nome)).toEqual([
      "Atração 2026",
      "Souvenir – ARP",
    ]);
  });

  it("valores por tipo de campo", () => {
    expect(converterValor(campo("n", "N", "numero"), "1.234,5")).toEqual({
      ok: true,
      valor: 1234.5,
    });
    expect(converterValor(campo("n", "N", "numero"), "dois")).toMatchObject({
      ok: false,
    });
    expect(converterValor(campo("d", "D", "data"), "05/11/2025")).toEqual({
      ok: true,
      valor: "2025-11-05",
    });
    expect(converterValor(campo("t", "T", "texto"), "")).toEqual({
      ok: true,
      valor: null,
    });
    expect(converterValor(campo("u", "U", "numero_unidade"), 3)).toMatchObject({
      ok: false,
    });
  });

  it("ecocopos: só a planilha certa, sem abas de orçamento", async () => {
    const a = await abas(abaEcocopos(), {
      nome: "Plano B",
      linhas: [["Data"]],
    });
    expect(abasSemOrcamento(a).abas.map((x) => x.nome)).toEqual([
      "Souvenir – ARP",
    ]);
  });
});
