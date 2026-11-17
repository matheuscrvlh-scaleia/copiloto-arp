import { describe, expect, it } from "vitest";
import type { RegrasAgenda } from "./agenda";
import {
  autorNoPortal,
  camposDaCategoria,
  descreverHorario,
  diasComHorarios,
  equipeDoSetor,
  erroDoArquivo,
  etapasDoPedido,
  horarioDisponivel,
  inicioDoMes,
  intervaloDoBloqueio,
  LIMITES_PORTAL,
  mediaDasNotas,
  medidasReduzidas,
  modeloDaMensagem,
  paraEscolha,
  podeAvaliar,
  podeResponder,
  tituloDoPedido,
  tokenValido,
  validarCampos,
} from "./portal";
import type { CampoExtra } from "./rotulos";
import { MENSAGENS_PADRAO } from "./whatsapp";

const h = (s: string) => new Date(`${s}:00-03:00`);

describe("token do link", () => {
  it("aceita só base64url com 32 ou mais caracteres", () => {
    expect(tokenValido("a".repeat(32))).toBe(true);
    expect(tokenValido("Ab_-".repeat(8))).toBe(true);
    expect(tokenValido("a".repeat(31))).toBe(false);
    expect(tokenValido(`${"a".repeat(32)}/`)).toBe(false);
    expect(tokenValido("")).toBe(false);
  });
});

describe("título do pedido", () => {
  it("usa a categoria e a primeira linha da descrição", () => {
    expect(tituloDoPedido("Manutenção", "Vazamento na pia\nDesde ontem")).toBe(
      "Manutenção: Vazamento na pia",
    );
  });

  it("corta descrição longa com reticências", () => {
    const t = tituloDoPedido("Manutenção", "x".repeat(100));
    expect(t.endsWith("…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual("Manutenção: ".length + 60);
  });

  it("sem descrição fica só a categoria", () => {
    expect(tituloDoPedido("Enviar projeto", "  ")).toBe("Enviar projeto");
  });
});

describe("campos extras", () => {
  const campos: CampoExtra[] = [
    {
      chave: "tipo",
      rotulo: "Tipo",
      tipo: "lista",
      opcoes: ["A", "B"],
      obrigatorio: true,
    },
    { chave: "qtd", rotulo: "Quantidade", tipo: "numero" },
    { chave: "quando", rotulo: "Quando", tipo: "data" },
    { chave: "vaga", rotulo: "Tem vaga", tipo: "sim_nao" },
    { chave: "art", rotulo: "ART", tipo: "anexo", obrigatorio: true },
    { chave: "obs", rotulo: "Obs.", tipo: "texto" },
  ];
  const form: Record<string, string> = {
    tipo: "A",
    qtd: "1.234,5",
    quando: "2026-11-02",
    vaga: "sim",
    obs: " ok ",
  };
  const valor = (f: Record<string, string>) => (c: string) => f[c] ?? null;

  it("converte cada tipo", () => {
    const r = validarCampos(campos, valor(form), (c) =>
      c === "art" ? ["art.pdf"] : [],
    );
    expect(r).toEqual({
      ok: true,
      valores: {
        tipo: "A",
        qtd: 1234.5,
        quando: "2026-11-02",
        vaga: true,
        art: ["art.pdf"],
        obs: "ok",
      },
    });
  });

  it("recusa obrigatório vazio, opção fora da lista e número inválido", () => {
    const sem = (c: string) => (c === "art" ? ["a.pdf"] : []);
    expect(validarCampos(campos, valor({ ...form, tipo: "" }), sem).ok).toBe(
      false,
    );
    expect(validarCampos(campos, valor({ ...form, tipo: "C" }), sem).ok).toBe(
      false,
    );
    expect(validarCampos(campos, valor({ ...form, qtd: "dez" }), sem).ok).toBe(
      false,
    );
    expect(
      validarCampos(campos, valor({ ...form, quando: "02/11" }), sem).ok,
    ).toBe(false);
  });

  it("anexo obrigatório precisa de arquivo", () => {
    const r = validarCampos(campos, valor(form), () => []);
    expect(r).toEqual({ ok: false, erro: 'Envie o arquivo de "ART".' });
  });

  it("opcional vazio vira null", () => {
    const r = validarCampos(campos, valor({ tipo: "B" }), (c) =>
      c === "art" ? ["x.pdf"] : [],
    );
    expect(r.ok && r.valores).toMatchObject({
      qtd: null,
      quando: null,
      vaga: null,
      obs: null,
    });
  });

  it("lê do catálogo só campos bem formados", () => {
    expect(
      camposDaCategoria([
        { chave: "ok", rotulo: "Ok", tipo: "texto" },
        { chave: "Errado!", rotulo: "X", tipo: "texto" },
        { chave: "x", rotulo: "X", tipo: "desconhecido" },
        null,
      ]),
    ).toEqual([{ chave: "ok", rotulo: "Ok", tipo: "texto" }]);
    expect(camposDaCategoria("nada")).toEqual([]);
  });
});

describe("arquivos", () => {
  it("o envio cabe no limite da Vercel (4,5 MB por requisição)", () => {
    expect(LIMITES_PORTAL.tamanhoEnvio).toBeLessThan(4.5 * 1024 * 1024);
    expect(LIMITES_PORTAL.tamanhoArquivo).toBeLessThanOrEqual(
      LIMITES_PORTAL.tamanhoEnvio,
    );
  });

  it("aceita foto e PDF dentro do limite", () => {
    expect(erroDoArquivo("foto.JPG", 1000)).toBeNull();
    expect(
      erroDoArquivo("projeto.pdf", LIMITES_PORTAL.tamanhoArquivo),
    ).toBeNull();
  });

  it("recusa tipo desconhecido, vazio e grande demais", () => {
    expect(erroDoArquivo("virus.exe", 10)).toMatch(/envie foto/);
    expect(erroDoArquivo("a.pdf", 0)).toMatch(/vazio/);
    expect(erroDoArquivo("a.pdf", LIMITES_PORTAL.tamanhoArquivo + 1)).toMatch(
      /MB/,
    );
  });

  it("reduz a foto sem distorcer nem aumentar", () => {
    expect(medidasReduzidas(4000, 3000, 1600)).toEqual({
      largura: 1600,
      altura: 1200,
    });
    expect(medidasReduzidas(900, 1800, 1600)).toEqual({
      largura: 800,
      altura: 1600,
    });
    expect(medidasReduzidas(800, 600, 1600)).toEqual({
      largura: 800,
      altura: 600,
    });
  });
});

describe("agenda do lojista", () => {
  // Telhado: 7h às 11h, 1 h cada, no máximo 2 por dia, segunda a sábado.
  const regras: RegrasAgenda = {
    hora_inicio: "07:00",
    hora_fim: "11:00",
    duracao_min: 60,
    limite_por_dia: 2,
    dias_semana: [1, 2, 3, 4, 5, 6],
  };
  // 2026-10-23 é sexta; 25 é domingo.
  const agora = h("2026-10-23T10:30");

  it("lista só os dias com horário livre, a partir de hoje", () => {
    const dias = diasComHorarios({
      regras,
      ocupados: [],
      bloqueios: [],
      agora,
      dias: 4,
    });
    expect(dias.map((d) => d.data)).toEqual(["2026-10-24", "2026-10-26"]);
    expect(dias[0]?.horarios).toHaveLength(4);
  });

  it("dia que bateu o limite some", () => {
    const ocupados = [
      { inicio: h("2026-10-24T07:00"), fim: h("2026-10-24T08:00") },
      { inicio: h("2026-10-24T09:00"), fim: h("2026-10-24T10:00") },
    ];
    const dias = diasComHorarios({
      regras,
      ocupados,
      bloqueios: [],
      agora,
      dias: 3,
    });
    expect(dias.map((d) => d.data)).toEqual([]);
  });

  it("confere o horário pedido contra a janela, o choque e o bloqueio", () => {
    const base = { regras, ocupados: [], bloqueios: [], agora };
    expect(
      horarioDisponivel({ ...base, inicio: h("2026-10-24T08:00") }),
    ).not.toBeNull();
    // Fora da janela, fora do passo e domingo.
    expect(
      horarioDisponivel({ ...base, inicio: h("2026-10-24T11:00") }),
    ).toBeNull();
    expect(
      horarioDisponivel({ ...base, inicio: h("2026-10-24T08:30") }),
    ).toBeNull();
    expect(
      horarioDisponivel({ ...base, inicio: h("2026-10-25T08:00") }),
    ).toBeNull();
    const bloqueios = [
      { inicio: h("2026-10-24T00:00"), fim: h("2026-10-25T00:00") },
    ];
    expect(
      horarioDisponivel({ ...base, bloqueios, inicio: h("2026-10-24T08:00") }),
    ).toBeNull();
  });
});

describe("escolha de horário", () => {
  it("rotula o dia e a hora em Brasília", () => {
    const inicio = h("2026-10-24T07:00");
    expect(
      paraEscolha([
        {
          data: "2026-10-24",
          horarios: [{ inicio, fim: h("2026-10-24T08:00") }],
        },
      ]),
    ).toEqual([
      {
        data: "2026-10-24",
        rotulo: "Sáb 24/10",
        horarios: [{ valor: inicio.toISOString(), rotulo: "07:00" }],
      },
    ]);
  });
});

describe("horário por extenso", () => {
  it("dia da semana, data e hora de Brasília", () => {
    expect(descreverHorario(h("2026-10-24T08:00"))).toBe(
      "sábado, 24/10/2026 às 08:00",
    );
  });
});

describe("bloqueio por clima", () => {
  it("dia inteiro vai da meia-noite à meia-noite seguinte", () => {
    expect(intervaloDoBloqueio({ dataInicio: "2026-10-24" })).toEqual({
      inicio: h("2026-10-24T00:00"),
      fim: h("2026-10-25T00:00"),
    });
  });

  it("vários dias e trecho do dia", () => {
    expect(
      intervaloDoBloqueio({ dataInicio: "2026-10-24", dataFim: "2026-10-26" }),
    ).toEqual({ inicio: h("2026-10-24T00:00"), fim: h("2026-10-27T00:00") });
    expect(
      intervaloDoBloqueio({
        dataInicio: "2026-10-24",
        horaInicio: "07:00",
        horaFim: "09:00",
      }),
    ).toEqual({ inicio: h("2026-10-24T07:00"), fim: h("2026-10-24T09:00") });
  });

  it("recusa período invertido", () => {
    expect(
      intervaloDoBloqueio({ dataInicio: "2026-10-24", dataFim: "2026-10-23" }),
    ).toHaveProperty("erro");
    expect(
      intervaloDoBloqueio({
        dataInicio: "2026-10-24",
        horaInicio: "09:00",
        horaFim: "08:00",
      }),
    ).toHaveProperty("erro");
  });
});

describe("o que o lojista vê", () => {
  it("a equipe aparece só pelo setor", () => {
    expect(equipeDoSetor("Operações")).toBe("Equipe de Operações");
    expect(equipeDoSetor(null)).toBe("Equipe da ARP");
    expect(
      autorNoPortal({ tipo: "comentario", dados: {} }, "Operações"),
    ).toEqual({
      nome: "Equipe de Operações",
      daLoja: false,
    });
  });

  it("o que veio do portal mostra quem pediu", () => {
    expect(
      autorNoPortal(
        { tipo: "portal", dados: { portal: true, nome: "Ana" } },
        "Operações",
      ),
    ).toEqual({ nome: "Ana", daLoja: true });
    expect(
      autorNoPortal(
        { tipo: "criado", dados: { origem: "portal" } },
        "Operações",
        "Bia",
      ),
    ).toEqual({ nome: "Bia", daLoja: true });
  });

  it("etapas acompanham o status", () => {
    const base = {
      criado_em: "2026-10-20T10:00:00Z",
      primeira_resposta_em: null,
      iniciado_em: null,
      concluido_em: null,
      fechado_em: null,
    };
    expect(
      etapasDoPedido({ ...base, status: "aberto" }).map((e) => e.feita),
    ).toEqual([true, false, false]);
    expect(
      etapasDoPedido({ ...base, status: "aguardando", iniciado_em: "x" }).map(
        (e) => e.feita,
      ),
    ).toEqual([true, true, false]);
    expect(
      etapasDoPedido({ ...base, status: "fechado", fechado_em: "y" }).at(-1),
    ).toEqual({ rotulo: "Concluído", feita: true, em: "y" });
  });

  it("avalia uma vez, depois de concluído; responde até encerrar", () => {
    expect(podeAvaliar({ status: "concluido", avaliacao: null })).toBe(true);
    expect(podeAvaliar({ status: "fechado", avaliacao: 4 })).toBe(false);
    expect(podeAvaliar({ status: "em_andamento", avaliacao: null })).toBe(
      false,
    );
    expect(podeResponder("aguardando")).toBe(true);
    expect(podeResponder("fechado")).toBe(false);
    expect(podeResponder("cancelado")).toBe(false);
  });
});

describe("mensagens e números", () => {
  it("usa o modelo dos parâmetros ou o sugerido", () => {
    expect(
      modeloDaMensagem({ portal_link: "Oi {{link}}" }, "portal_link"),
    ).toBe("Oi {{link}}");
    expect(modeloDaMensagem({ portal_link: "  " }, "portal_link")).toBe(
      MENSAGENS_PADRAO.portal_link,
    );
    expect(modeloDaMensagem(null, "remarcar")).toBe(MENSAGENS_PADRAO.remarcar);
  });

  it("início do mês é em Brasília", () => {
    // 1º/11 às 01h UTC ainda é 31/10 em Brasília.
    expect(inicioDoMes(new Date("2026-11-01T01:00:00Z"))).toBe(
      "2026-10-01T03:00:00.000Z",
    );
  });

  it("média com uma casa", () => {
    expect(mediaDasNotas([])).toBeNull();
    expect(mediaDasNotas([5, 4, 4])).toBe(4.3);
  });
});
