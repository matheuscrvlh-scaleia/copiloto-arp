import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AsanaTarefa } from "./fontes";
import {
  conferirNomes,
  eventosDoCalendario,
  type ParametrosRadar,
  prazoDoMes,
  type RegraCfg,
  resumoRadar,
  rotuloSemPrazo,
  sinalizacoesDoMarketing,
  tarefasDoTime,
} from "./radar";

// Plano de testes do spec (4.9): sinalizações do Marketing com o alerta,
// % no prazo sem as tarefas sem prazo e nomes de projeto/tag só de Parâmetros.

const HOJE = "2026-10-29";

const P: ParametrosRadar = {
  asana_projetos_marketing: ["Mkt", "Demandas"],
  asana_projeto_calendario: "Agenda",
  asana_projeto_ronda: "Ronda",
  asana_tag_locatario: "Loc",
  asana_tag_terceiro: "Ter",
  asana_tag_gratuita: "Grátis",
  asana_tag_paga: "Paga",
  sinalizacao_antiga_dias: 15,
};
const CODIGOS = [
  { codigo: "S", descricao: "Sinalização", area: "marketing" },
  { codigo: "E", descricao: "Estrutura", area: "operacoes" },
];
const REGRAS: RegraCfg[] = [
  { regra: "sinalizacoes_abertas", limite: 30, ativa: true },
  { regra: "tarefa_atrasada", limite: 7, ativa: true },
];

let n = 0;
function tarefa(t: Partial<AsanaTarefa> & { projeto: string }): AsanaTarefa {
  const { projeto, ...resto } = t;
  n++;
  return {
    gid: `g${n}`,
    name: `Tarefa ${n}`,
    projects: [{ gid: projeto, name: projeto }],
    memberships: [{ section: { name: "A fazer" } }],
    assignee: { name: "Ana" },
    created_at: "2026-10-01T12:00:00.000Z",
    due_on: null,
    start_on: null,
    completed: false,
    completed_at: null,
    tags: [],
    custom_fields: [],
    permalink_url: `https://app.asana.com/0/0/g${n}`,
    ...resto,
  };
}

describe("Sinalizações da ronda", () => {
  const tarefas = [
    ...Array.from({ length: 35 }, (_, i) =>
      tarefa({ projeto: "Ronda", name: `S - Placa ${i}` }),
    ),
    ...Array.from({ length: 20 }, (_, i) =>
      tarefa({ projeto: "Ronda", name: `E - Piso ${i}` }),
    ),
  ];

  it("35 abertas S e 20 abertas E → mostra 35, nenhuma E, e o Painel diz Urgente", () => {
    const lista = sinalizacoesDoMarketing(tarefas, "Ronda", CODIGOS, HOJE);
    expect(lista).toHaveLength(35);
    expect(lista.every((s) => s.codigo === "S")).toBe(true);
    expect(lista[0]?.descricao).toBe("Placa 0");

    const r = resumoRadar({ projetos: [], tarefas }, P, CODIGOS, REGRAS, HOJE);
    expect(r.sinalizacoesAbertas).toBe(35);
    expect(r.sinalizacoesUrgente).toBe(true);
  });

  it("regra desligada não alerta", () => {
    const r = resumoRadar(
      { projetos: [], tarefas },
      P,
      CODIGOS,
      [{ regra: "sinalizacoes_abertas", limite: 30, ativa: false }],
      HOJE,
    );
    expect(r.sinalizacoesUrgente).toBe(false);
  });
});

describe("% no prazo", () => {
  it("7 no prazo, 2 atrasadas e 1 sem prazo → 7 de 9 = 77,8%", () => {
    const concluida = (prazo: string | null, em: string) =>
      tarefa({
        projeto: "Mkt",
        due_on: prazo,
        completed: true,
        completed_at: `${em}T15:00:00.000Z`,
      });
    const tarefas = [
      ...Array.from({ length: 7 }, () => concluida("2026-10-20", "2026-10-20")),
      concluida("2026-10-10", "2026-10-12"),
      concluida("2026-10-05", "2026-10-09"),
      concluida(null, "2026-10-15"),
    ];
    const r = prazoDoMes(tarefasDoTime(tarefas, ["Mkt"], HOJE), "2026-10-01");
    expect(r).toMatchObject({
      concluidas: 10,
      noPrazo: 7,
      comAtraso: 2,
      semPrazo: 1,
    });
    expect(r.pct?.toFixed(1)).toBe("77.8");
    expect(rotuloSemPrazo(r.semPrazo)).toContain(
      "arefas sem prazo fora do cálculo",
    );
  });

  it("concluída depois das 21h do dia do prazo (já é o dia seguinte em UTC) segue no prazo", () => {
    const [l] = tarefasDoTime(
      [
        tarefa({
          projeto: "Mkt",
          due_on: "2026-10-20",
          completed: true,
          completed_at: "2026-10-21T01:30:00.000Z",
        }),
      ],
      ["Mkt"],
      HOJE,
    );
    expect(l?.noPrazo).toBe(true);
  });

  it("aberta vencida: atrasada, com os dias de atraso", () => {
    const [l] = tarefasDoTime(
      [tarefa({ projeto: "Mkt", due_on: "2026-10-19" })],
      ["Mkt"],
      HOJE,
    );
    expect(l?.situacao).toBe("atrasada");
    expect(l?.diasAtraso).toBe(10);
  });
});

describe("Nomes de projetos e tags só de Parâmetros", () => {
  it("trocar os nomes em Parâmetros muda o que entra", () => {
    const tarefas = [
      tarefa({ projeto: "Time novo" }),
      tarefa({ projeto: "Mkt" }),
      tarefa({
        projeto: "Eventos 2027",
        due_on: "2026-11-07",
        tags: [{ name: "Inquilino" }, { name: "Cobrado" }],
      }),
    ];
    expect(tarefasDoTime(tarefas, ["Time novo"], HOJE)).toHaveLength(1);
    const [e] = eventosDoCalendario(
      tarefas,
      {
        ...P,
        asana_projeto_calendario: "Eventos 2027",
        asana_tag_locatario: "inquilino",
        asana_tag_paga: "Cobrado",
      },
      HOJE,
      "2027-04-30",
    );
    expect(e?.tipo).toBe("locatario");
    expect(e?.cobranca).toBe("paga");
  });

  it("projeto arquivado ou tag que não existe mais vira aviso", () => {
    const c = conferirNomes(
      {
        projetos: [
          { gid: "1", name: "Mkt", archived: false },
          { gid: "2", name: "Demandas", archived: true },
          { gid: "3", name: "Agenda", archived: false },
          { gid: "4", name: "Ronda", archived: false },
        ],
        tarefas: [
          tarefa({
            projeto: "Agenda",
            tags: [{ name: "Loc" }, { name: "Ter" }, { name: "Paga" }],
          }),
        ],
      },
      P,
    );
    expect(c.projetos).toEqual(["Demandas"]);
    expect(c.tags).toEqual(["Grátis"]);
    expect(c.semDefinir).toEqual([]);
  });

  it("o código do Radar não tem os nomes do ponto de partida", () => {
    const fonte = readFileSync(new URL("./radar.ts", import.meta.url), "utf8");
    for (const nome of [
      "Marketing",
      "Demandas internas",
      "Conteúdo e redes",
      "Calendário de eventos",
      "Ronda de ambiência",
      "Locatário",
      "Terceiro",
      "Gratuito",
      "Pago",
    ])
      expect(fonte).not.toContain(`"${nome}"`);
  });
});
