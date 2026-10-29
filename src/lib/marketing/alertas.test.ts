import { describe, expect, it } from "vitest";
import { avaliarAlertas, type Regra } from "./alertas";

const REGRAS: Regra[] = [
  { regra: "sinalizacoes_abertas", limite: 30, nivel: "urgente", ativa: true },
  { regra: "locatario_em_alerta", limite: null, nivel: "urgente", ativa: true },
  { regra: "avaliacao_sem_resposta", limite: 2, nivel: "atencao", ativa: true },
  {
    regra: "custo_por_lead_acima_meta",
    limite: null,
    nivel: "atencao",
    ativa: true,
  },
  { regra: "campanha_sem_lead", limite: null, nivel: "atencao", ativa: true },
  {
    regra: "avaliacoes_abaixo_do_ritmo",
    limite: null,
    nivel: "atencao",
    ativa: true,
  },
  { regra: "tarefa_atrasada", limite: 7, nivel: "atencao", ativa: true },
  { regra: "landing_page_sem_tipo", limite: null, nivel: "aviso", ativa: true },
];
const tudo = () => true;

describe("alertas do Painel", () => {
  it("35 sinalizações abertas com limite 30 dão Urgente; 29 não", () => {
    const a = avaliarAlertas(REGRAS, { sinalizacoesAbertas: 35 }, tudo);
    expect(a).toHaveLength(1);
    expect(a[0]?.nivel).toBe("urgente");
    expect(a[0]?.titulo).toContain("35");
    expect(
      avaliarAlertas(REGRAS, { sinalizacoesAbertas: 29 }, tudo),
    ).toHaveLength(0);
  });

  it("ordena do mais grave ao mais leve", () => {
    const a = avaliarAlertas(
      REGRAS,
      {
        landingPagesSemTipo: [{ identificador: "lp", nome: "Feira" }],
        custoPorLead: { valor: 60, meta: 45 },
        locatariosEmAlerta: [
          { id: "x", nome: "Loja X", reclamacoes: 4, tema: "Atendimento" },
        ],
      },
      tudo,
    );
    expect(a.map((x) => x.nivel)).toEqual(["urgente", "atencao", "aviso"]);
    expect(a[0]?.href).toBe("/marketing/reputacao/x");
  });

  it("limite, nível e ativa vêm de Parâmetros", () => {
    const regras = REGRAS.map((r) =>
      r.regra === "tarefa_atrasada"
        ? { ...r, limite: 10, nivel: "urgente" }
        : r.regra === "landing_page_sem_tipo"
          ? { ...r, ativa: false }
          : r,
    );
    const a = avaliarAlertas(
      regras,
      {
        tarefasAtrasadas: [
          { nome: "A", dias: 8, link: "" },
          { nome: "B", dias: 12, link: "" },
        ],
        landingPagesSemTipo: [{ identificador: "lp", nome: "Feira" }],
      },
      tudo,
    );
    expect(a).toHaveLength(1);
    expect(a[0]?.nivel).toBe("urgente");
    expect(a[0]?.titulo).toContain("1 tarefa atrasada");
  });

  it("avaliação sem resposta só depois do limite de dias", () => {
    const s = { avaliacoesSemResposta: [{ id: "r", dias: 2, estrelas: 1 }] };
    expect(avaliarAlertas(REGRAS, s, tudo)).toHaveLength(0);
    expect(
      avaliarAlertas(
        REGRAS,
        { avaliacoesSemResposta: [{ id: "r", dias: 4, estrelas: 1 }] },
        tudo,
      ),
    ).toHaveLength(1);
  });

  it("ritmo da meta do mês: 10 de 30 no dia 15 de 30 está abaixo", () => {
    const a = avaliarAlertas(
      REGRAS,
      {
        avaliacoesNoMes: {
          realizado: 10,
          meta: 30,
          diaDoMes: 15,
          diasNoMes: 30,
        },
      },
      tudo,
    );
    expect(a[0]?.descricao).toContain("15");
    expect(
      avaliarAlertas(
        REGRAS,
        {
          avaliacoesNoMes: {
            realizado: 15,
            meta: 30,
            diaDoMes: 15,
            diasNoMes: 30,
          },
        },
        tudo,
      ),
    ).toHaveLength(0);
  });

  it("só mostra os alertas das telas liberadas", () => {
    const a = avaliarAlertas(
      REGRAS,
      {
        sinalizacoesAbertas: 35,
        locatariosEmAlerta: [
          { id: "x", nome: "X", reclamacoes: 4, tema: null },
        ],
      },
      (p) => p === "marketing.reputacao",
    );
    expect(a.map((x) => x.regra)).toEqual(["locatario_em_alerta"]);
  });
});
