import { describe, expect, it } from "vitest";
import {
  agrupar,
  atalhoDoPeriodo,
  CARTOES,
  CHAVES_CARTAO,
  type ContextoLista,
  type CriterioCartao,
  cargaPorPessoa,
  contarCartao,
  criterioDoCartao,
  descreverFiltros,
  descreverPeriodo,
  filtrarLinhas,
  filtrosDaBusca,
  inicioDoMes,
  type LinhaChamado,
  lerBusca,
  lerCartao,
  lerFiltros,
  lerOrdem,
  modoDaLista,
  noMesAtual,
  ordemDaConsulta,
  ordemNaUrl,
  ordenarCarga,
  ordenarLinhas,
  paraExportar,
  paraParametros,
  periodoDoAtalho,
  statusComCartao,
  statusDoFiltro,
  temFiltrosNaUrl,
} from "./lista";
import { STATUS_ABERTOS, type StatusChamado } from "./rotulos";

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

/** O que o banco faria com o critério (para comparar com CARTOES.testa). */
function passaNoBanco(
  l: LinhaChamado,
  c: CriterioCartao,
  barra?: StatusChamado[],
): boolean {
  if (!statusComCartao(barra, c).includes(l.status)) return false;
  if (c.abertoPor && l.abertoPor !== c.abertoPor) return false;
  if (c.semResponsavel && l.responsavelId !== null) return false;
  const prazo = l.prazo ? new Date(l.prazo).getTime() : null;
  if (c.prazoDesde && (prazo === null || prazo < Date.parse(c.prazoDesde)))
    return false;
  if (c.prazoAntes && (prazo === null || prazo >= Date.parse(c.prazoAntes)))
    return false;
  if (c.encerradoDesde) {
    const v =
      c.encerradoDesde.campo === "concluido_em" ? l.concluidoEm : l.fechadoEm;
    if (!v || Date.parse(v) < Date.parse(c.encerradoDesde.iso)) return false;
  }
  return true;
}

describe("cartões no banco", () => {
  const amostra = [
    linha({ prazo: "2026-10-23T12:00:00Z" }),
    linha({ prazo: "2026-10-23T20:00:00Z", status: "em_andamento" }),
    linha({ prazo: "2026-10-24T02:59:00Z", responsavelId: ANA }),
    linha({ prazo: "2026-10-24T03:00:00Z" }),
    linha({ prazo: "2026-10-22T10:00:00Z", status: "aguardando" }),
    linha({
      prazo: "2026-10-20T10:00:00Z",
      status: "concluido",
      abertoPor: EU,
    }),
    linha({ status: "concluido", concluidoEm: "2026-10-05T12:00:00Z" }),
    linha({
      status: "fechado",
      concluidoEm: "2026-09-30T12:00:00Z",
      fechadoEm: "2026-10-01T03:00:00Z",
    }),
    linha({
      status: "fechado",
      concluidoEm: "2026-09-29T12:00:00Z",
      fechadoEm: "2026-10-01T02:59:00Z",
    }),
    linha({ status: "cancelado", prazo: "2026-10-01T10:00:00Z" }),
    linha({ responsavelId: ANA }),
  ];

  it("cada critério conta o mesmo que o cartão na tela", () => {
    for (const chave of CHAVES_CARTAO) {
      const criterio = criterioDoCartao(chave, ctx);
      expect(
        amostra.filter((l) => passaNoBanco(l, criterio)).map((l) => l.id),
        chave,
      ).toEqual(
        amostra.filter((l) => CARTOES[chave].testa(l, ctx)).map((l) => l.id),
      );
    }
  });

  it("vence hoje vai até a meia-noite de Brasília", () => {
    expect(criterioDoCartao("vence_hoje", ctx)).toMatchObject({
      prazoDesde: "2026-10-23T13:00:00.000Z",
      prazoAntes: "2026-10-24T03:00:00.000Z",
    });
    expect(inicioDoMes(agora)).toBe("2026-10-01T03:00:00.000Z");
  });

  it("status: o da barra e o do cartão; encerrados no mês fora da barra", () => {
    const atrasados = criterioDoCartao("atrasados", ctx);
    expect(statusComCartao(undefined, atrasados)).toEqual(EM_ABERTO_TESTE);
    expect(statusComCartao(["aberto", "concluido"], atrasados)).toEqual([
      "aberto",
    ]);
    expect(statusComCartao(["fechado"], atrasados)).toEqual([]);
    expect(
      statusComCartao(STATUS_ABERTOS, criterioDoCartao("fechados_mes", ctx)),
    ).toEqual(["fechado"]);
  });

  it("cartão da URL só vale se for da tela", () => {
    expect(lerCartao("caixa", "vence_hoje")).toBe("vence_hoje");
    expect(lerCartao("setor", "vence_hoje")).toBeNull();
    expect(lerCartao("abertos", ["fechados_mes"])).toBe("fechados_mes");
    expect(lerCartao("abertos", undefined)).toBeNull();
  });
});

const EM_ABERTO_TESTE = ["aberto", "em_andamento", "aguardando"];

describe("busca no banco", () => {
  it("um filtro por palavra: título, descrição e o número", () => {
    expect(filtrosDaBusca("  bomba   #123 ")).toEqual([
      "titulo.ilike.*bomba*,descricao.ilike.*bomba*",
      "titulo.ilike.*#123*,descricao.ilike.*#123*,numero.eq.123",
    ]);
    expect(filtrosDaBusca("")).toEqual([]);
  });

  it("tira o que é sintaxe do PostgREST e os curingas", () => {
    expect(filtrosDaBusca('a,b (c) "d" e:f g*h 10%')).toEqual(
      ["a", "b", "c", "d", "e", "f", "g", "h", "10"]
        .map((p) =>
          /^\d+$/.test(p)
            ? `titulo.ilike.*${p}*,descricao.ilike.*${p}*,numero.eq.${p}`
            : `titulo.ilike.*${p}*,descricao.ilike.*${p}*`,
        )
        .slice(0, 6),
    );
  });

  it("lê a busca da URL aparada e curta", () => {
    expect(lerBusca("  vazamento ")).toBe("vazamento");
    expect(lerBusca(["a", "b"])).toBe("a");
    expect(lerBusca(undefined)).toBe("");
    expect(lerBusca("x".repeat(200))).toHaveLength(80);
  });
});

describe("ordem no banco", () => {
  it("lê e escreve a ordem da URL", () => {
    expect(lerOrdem("prazo.desc")).toEqual({ coluna: "prazo", sentido: -1 });
    expect(lerOrdem("numero.asc")).toEqual({ coluna: "numero", sentido: 1 });
    expect(lerOrdem("responsavel.asc")).toBeNull();
    expect(lerOrdem("prazo.cima")).toBeNull();
    expect(lerOrdem(undefined)).toBeNull();
    expect(ordemNaUrl({ coluna: "titulo", sentido: -1 })).toBe("titulo.desc");
  });

  it("grupo primeiro, depois a coluna (vazio no fim) e o desempate", () => {
    expect(ordemDaConsulta("caixa", null)).toEqual([
      { coluna: "prazo", asc: true, nullsFirst: false },
      { coluna: "prioridade", asc: false, nullsFirst: false },
      { coluna: "numero", asc: true, nullsFirst: false },
    ]);
    expect(
      ordemDaConsulta("responsavel", { coluna: "numero", sentido: -1 }),
    ).toEqual([
      { coluna: "responsavel_id", asc: true, nullsFirst: true },
      { coluna: "numero", asc: false, nullsFirst: false },
      { coluna: "prioridade", asc: false, nullsFirst: false },
    ]);
    expect(
      ordemDaConsulta("status", { coluna: "prioridade", sentido: 1 }).map(
        (p) => p.coluna,
      ),
    ).toEqual(["status", "prioridade", "numero"]);
    expect(ordemDaConsulta("categoria", null)[0]).toEqual({
      coluna: "categoria_id",
      asc: true,
      nullsFirst: false,
    });
  });

  it("a caixa só agrupa pelo prazo; o Meu setor agrupa pelo escolhido", () => {
    expect(modoDaLista("caixa", undefined, null)).toBe("caixa");
    expect(
      modoDaLista("caixa", undefined, { coluna: "prazo", sentido: 1 }),
    ).toBe("caixa");
    expect(
      modoDaLista("caixa", undefined, { coluna: "titulo", sentido: 1 }),
    ).toBe("nenhum");
    expect(modoDaLista("setor", undefined, null)).toBe("responsavel");
    expect(modoDaLista("setor", "categoria", null)).toBe("categoria");
    expect(modoDaLista("abertos", undefined, null)).toBe("status");
  });

  it("na página, os grupos saem na ordem das linhas", () => {
    const zeca = linha({ responsavelId: "z", responsavel: "Zeca" });
    const ana = linha({ responsavelId: "a", responsavel: "Ana" });
    expect(
      agrupar([zeca, ana], "responsavel", ctx, { naOrdemDasLinhas: true }).map(
        (g) => g.titulo,
      ),
    ).toEqual(["Zeca", "Ana"]);
    expect(
      agrupar([zeca, ana], "responsavel", ctx).map((g) => g.titulo),
    ).toEqual(["Ana", "Zeca"]);
  });
});

describe("período do painel de filtros", () => {
  const hoje = "2026-10-23";
  it("atalhos contam a partir de hoje", () => {
    expect(periodoDoAtalho("mes", hoje)).toEqual({
      de: "2026-10-01",
      ate: hoje,
    });
    expect(periodoDoAtalho("dias30", hoje)).toEqual({
      de: "2026-09-24",
      ate: hoje,
    });
    expect(periodoDoAtalho("ano", hoje)).toEqual({
      de: "2026-01-01",
      ate: hoje,
    });
  });

  it("reconhece o atalho das datas e descreve o período", () => {
    expect(atalhoDoPeriodo(undefined, undefined, hoje)).toBeNull();
    expect(atalhoDoPeriodo("2026-10-01", hoje, hoje)).toBe("mes");
    expect(atalhoDoPeriodo("2026-10-02", hoje, hoje)).toBe("personalizado");
    expect(descreverPeriodo("2026-01-01", hoje, hoje)).toBe("Este ano");
    expect(descreverPeriodo("2026-10-02", "2026-10-15", hoje)).toBe(
      "02/10/2026 a 15/10/2026",
    );
    expect(descreverPeriodo("2026-10-02", undefined, hoje)).toBe(
      "Desde 02/10/2026",
    );
  });
});

describe("carga contada no banco", () => {
  it("quem tem mais primeiro; a fila no topo só com algo", () => {
    const pessoa = (nome: string, abertos: number, atrasados = 0) => ({
      id: nome,
      nome,
      abertos,
      atrasados,
    });
    const fila = { id: null, nome: "Na fila", abertos: 0, atrasados: 0 };
    expect(
      ordenarCarga(
        [pessoa("Bia", 1), pessoa("Ana", 3), pessoa("Caio", 1, 1)],
        fila,
      ).map((c) => c.nome),
    ).toEqual(["Ana", "Caio", "Bia"]);
    expect(
      ordenarCarga([pessoa("Ana", 3)], { ...fila, abertos: 2 })[0]?.nome,
    ).toBe("Na fila");
  });
});

describe("exportação da lista", () => {
  it("colunas da tela e o grupo na primeira coluna", () => {
    const l = linha({ numero: 7, titulo: "Lâmpada", categoria: "Elétrica" });
    const r = paraExportar(
      agrupar([l], "status", ctx),
      "status",
      { setor: true },
      ctx,
    );
    expect(r.colunas.map((c) => c.titulo).slice(0, 5)).toEqual([
      "Grupo",
      "Número",
      "Tipo",
      "Título",
      "Setor",
    ]);
    expect(r.linhas[0]?.slice(0, 5)).toEqual([
      "Aberto",
      7,
      expect.any(String),
      "Lâmpada",
      "Operações",
    ]);
  });
});
