import { describe, expect, it } from "vitest";
import {
  agrupar,
  CARTOES,
  type ContextoLista,
  cargaPorPessoa,
  contarCartao,
  descreverFiltros,
  filtrarLinhas,
  type LinhaChamado,
  lerFiltros,
  noMesAtual,
  ordenarLinhas,
  paraParametros,
  statusDoFiltro,
  temFiltrosNaUrl,
} from "./lista";
import { STATUS_ABERTOS } from "./rotulos";

// Sexta, 23/10/2026, 10h em Brasília (13h UTC).
const agora = new Date("2026-10-23T13:00:00Z");
const EU = "11111111-1111-4111-8111-111111111111";
const ANA = "22222222-2222-4222-8222-222222222222";
const ctx: ContextoLista = { agora, eu: EU, avisoHoras: 24 };

let seq = 0;
function linha(p: Partial<LinhaChamado> = {}): LinhaChamado {
  seq++;
  return {
    id: `id-${seq}`,
    numero: seq,
    tipo: "solicitacao",
    origem: "sistema",
    titulo: `Chamado ${seq}`,
    status: "aberto",
    prioridade: "media",
    prazo: null,
    setorId: "s1",
    setor: "Operações",
    setorCor: "#2a78d6",
    categoriaId: null,
    categoria: null,
    responsavelId: null,
    responsavel: null,
    abertoPor: ANA,
    solicitante: "Ana",
    etiquetas: [],
    aguardando: null,
    pessoal: false,
    precisaConfirmacao: true,
    concluidoEm: null,
    fechadoEm: null,
    criadoEm: "2026-10-20T12:00:00Z",
    exemplo: false,
    podeAtribuir: false,
    podePrazo: false,
    ...p,
  };
}

describe("cartões", () => {
  it("atrasados só conta o que ainda está em aberto", () => {
    const linhas = [
      linha({ prazo: "2026-10-22T21:00:00Z" }),
      linha({ prazo: "2026-10-22T21:00:00Z", status: "concluido" }),
      linha({ prazo: "2026-10-24T21:00:00Z" }),
    ];
    expect(contarCartao(linhas, "atrasados", ctx)).toBe(1);
  });

  it("vence hoje: prazo ainda à frente, no mesmo dia em Brasília", () => {
    expect(
      CARTOES.vence_hoje.testa(linha({ prazo: "2026-10-23T21:00:00Z" }), ctx),
    ).toBe(true);
    // 23/10 23h em Brasília = 24/10 02h UTC: ainda é hoje.
    expect(
      CARTOES.vence_hoje.testa(linha({ prazo: "2026-10-24T02:00:00Z" }), ctx),
    ).toBe(true);
    expect(
      CARTOES.vence_hoje.testa(linha({ prazo: "2026-10-24T04:00:00Z" }), ctx),
    ).toBe(false);
  });

  it("aguardando minha confirmação: concluído e pedido por mim", () => {
    expect(
      CARTOES.aguardando_confirmacao.testa(
        linha({ status: "concluido", abertoPor: EU }),
        ctx,
      ),
    ).toBe(true);
    expect(
      CARTOES.aguardando_confirmacao.testa(
        linha({ status: "concluido", abertoPor: ANA }),
        ctx,
      ),
    ).toBe(false);
  });

  it("concluídos e fechados no mês olham o mês de Brasília", () => {
    expect(noMesAtual("2026-10-01T03:00:00Z", agora)).toBe(true);
    // 30/09 23h em Brasília.
    expect(noMesAtual("2026-10-01T02:00:00Z", agora)).toBe(false);
    expect(
      CARTOES.concluidos_mes.testa(
        linha({ status: "fechado", concluidoEm: "2026-10-05T12:00:00Z" }),
        ctx,
      ),
    ).toBe(true);
    expect(
      CARTOES.fechados_mes.testa(
        linha({ status: "concluido", concluidoEm: "2026-10-05T12:00:00Z" }),
        ctx,
      ),
    ).toBe(false);
  });

  it("sem responsável não conta o que já foi concluído", () => {
    expect(CARTOES.sem_responsavel.testa(linha(), ctx)).toBe(true);
    expect(
      CARTOES.sem_responsavel.testa(linha({ status: "concluido" }), ctx),
    ).toBe(false);
  });
});

describe("filtrarLinhas", () => {
  const fechado = linha({
    status: "fechado",
    fechadoEm: "2026-10-10T12:00:00Z",
    soNoCartao: true,
  });
  const aberta = linha({ titulo: "Trocar lâmpada do corredor" });
  const linhas = [aberta, fechado];

  it("sem cartão, esconde o que só entra pelo cartão", () => {
    expect(filtrarLinhas(linhas, {}, ctx)).toEqual([aberta]);
  });

  it("com cartão, mostra só o que ele conta", () => {
    expect(filtrarLinhas(linhas, { cartao: "fechados_mes" }, ctx)).toEqual([
      fechado,
    ]);
  });

  it("busca sem acento, por todas as palavras e pelo número", () => {
    expect(filtrarLinhas(linhas, { busca: "lampada corredor" }, ctx)).toEqual([
      aberta,
    ]);
    expect(filtrarLinhas(linhas, { busca: "lâmpada cozinha" }, ctx)).toEqual(
      [],
    );
    expect(filtrarLinhas(linhas, { busca: `#${aberta.numero}` }, ctx)).toEqual([
      aberta,
    ]);
  });
});

describe("ordenarLinhas", () => {
  it("prazo: vazio sempre no fim, nos dois sentidos", () => {
    const a = linha({ prazo: "2026-10-25T12:00:00Z" });
    const b = linha({ prazo: null });
    const c = linha({ prazo: "2026-10-24T12:00:00Z" });
    expect(ordenarLinhas([a, b, c]).map((l) => l.id)).toEqual([
      c.id,
      a.id,
      b.id,
    ]);
    expect(
      ordenarLinhas([a, b, c], { coluna: "prazo", sentido: -1 }).map(
        (l) => l.id,
      ),
    ).toEqual([a.id, c.id, b.id]);
  });

  it("empate: o mais urgente primeiro", () => {
    const a = linha({ prioridade: "baixa" });
    const b = linha({ prioridade: "urgente" });
    expect(ordenarLinhas([a, b]).map((l) => l.id)).toEqual([b.id, a.id]);
  });

  it("texto em ordem alfabética do português", () => {
    const a = linha({ responsavel: "Érica" });
    const b = linha({ responsavel: "Bruno" });
    expect(
      ordenarLinhas([a, b], { coluna: "responsavel", sentido: 1 }).map(
        (l) => l.responsavel,
      ),
    ).toEqual(["Bruno", "Érica"]);
  });
});

describe("agrupar", () => {
  it("minha caixa: confirmar primeiro, depois pelo prazo, concluídos dos outros no fim", () => {
    const grupos = agrupar(
      [
        linha({ prazo: null }),
        linha({ status: "concluido", abertoPor: ANA }),
        linha({ prazo: "2026-10-22T12:00:00Z" }),
        linha({ status: "concluido", abertoPor: EU }),
        linha({ prazo: "2026-10-23T20:00:00Z" }),
        linha({ prazo: "2026-10-25T20:00:00Z" }),
        linha({ prazo: "2026-11-10T20:00:00Z" }),
      ],
      "caixa",
      ctx,
    );
    expect(grupos.map((g) => g.chave)).toEqual([
      "confirmar",
      "atrasados",
      "hoje",
      "semana",
      "depois",
      "sem_prazo",
      "com_solicitante",
    ]);
    expect(grupos[1]?.tom).toBe("atrasado");
  });

  it("por responsável: a fila primeiro", () => {
    const grupos = agrupar(
      [
        linha({ responsavelId: ANA, responsavel: "Ana" }),
        linha(),
        linha({ responsavelId: EU, responsavel: "Bruno" }),
      ],
      "responsavel",
      ctx,
    );
    expect(grupos.map((g) => g.titulo)).toEqual([
      "Sem responsável",
      "Ana",
      "Bruno",
    ]);
  });

  it("por status: na ordem do ciclo", () => {
    const grupos = agrupar(
      [
        linha({ status: "aguardando" }),
        linha({ status: "aberto" }),
        linha({ status: "em_andamento" }),
      ],
      "status",
      ctx,
    );
    expect(grupos.map((g) => g.chave)).toEqual([
      "aberto",
      "em_andamento",
      "aguardando",
    ]);
  });

  it("sem linhas, sem grupos", () => {
    expect(agrupar([], "nenhum", ctx)).toEqual([]);
  });
});

describe("cargaPorPessoa", () => {
  it("conta abertos e atrasados, inclui quem está com zero e a fila no topo", () => {
    const carga = cargaPorPessoa(
      [
        linha({ responsavelId: ANA, responsavel: "Ana" }),
        linha({
          responsavelId: ANA,
          responsavel: "Ana",
          prazo: "2026-10-20T12:00:00Z",
        }),
        linha({ responsavelId: ANA, responsavel: "Ana", status: "concluido" }),
        linha(),
      ],
      [
        { id: ANA, nome: "Ana" },
        { id: EU, nome: "Bruno" },
      ],
      ctx,
    );
    expect(carga).toEqual([
      { id: null, nome: "Na fila", abertos: 1, atrasados: 0 },
      { id: ANA, nome: "Ana", abertos: 2, atrasados: 1 },
      { id: EU, nome: "Bruno", abertos: 0, atrasados: 0 },
    ]);
  });
});

describe("filtros", () => {
  it("lê só os campos válidos da tela", () => {
    expect(
      lerFiltros("caixa", {
        tipo: "os",
        prioridade: "altissima",
        setor: "não é id",
        status: "fechado",
        etiqueta: ["telhado", "outra"],
      }),
    ).toEqual({ tipo: "os", etiqueta: "telhado" });
  });

  it("sabe quando a URL traz filtro da tela", () => {
    expect(temFiltrosNaUrl("caixa", { c: "x" })).toBe(false);
    expect(temFiltrosNaUrl("caixa", { tipo: "os" })).toBe(true);
    expect(temFiltrosNaUrl("caixa", { f: "0" })).toBe(true);
  });

  it("status padrão é o que ainda está na fila", () => {
    expect(statusDoFiltro(undefined)).toEqual(STATUS_ABERTOS);
    expect(statusDoFiltro("todos")).toBeUndefined();
    expect(statusDoFiltro("fechado")).toEqual(["fechado"]);
  });

  it("vira parâmetros de URL sem os vazios", () => {
    expect(paraParametros({ tipo: "os", setor: undefined }).toString()).toBe(
      "tipo=os",
    );
  });

  it("descreve a linha de filtros da exportação", () => {
    expect(
      descreverFiltros(
        "setor",
        { prioridade: "alta", de: "2026-10-01", ate: "2026-10-31" },
        { setor: "Operações" },
      ),
    ).toBe(
      "Setor: Operações · Status: Em aberto · Prioridade: Alta · Aberto de 01/10/2026 até 31/10/2026",
    );
    expect(descreverFiltros("caixa", {})).toBe("");
  });
});
