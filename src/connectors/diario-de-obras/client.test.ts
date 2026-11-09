import { describe, expect, it, vi } from "vitest";
import listaDeTarefas from "./__fixtures__/lista-de-tarefas.json";
import obra from "./__fixtures__/obra.json";
import relatorio from "./__fixtures__/relatorio.json";
import {
  createDiarioDeObrasClient,
  esperaDoLimite,
  limiteAtingido,
} from "./client";
import {
  dataHoraBr,
  horasEmMinutos,
  link,
  obraResumoSchema,
  relatorioResumoSchema,
  tarefaSchema,
} from "./schemas";

// Fixtures montadas com os exemplos da documentação da API (nomes trocados).

const EMPRESA = {
  _id: "57fa4eebffd18769058b4567",
  nome: "Construtora Exemplo",
  razaoSocial: "CONSTRUTORA EXEMPLO LTDA",
  cpfCnpj: "00.000.000/0001-00",
  logoUrl: "https://exemplo.test/logo.jpg",
  log: {
    totalObras: 8,
    totalUsuarios: 6,
    totalRelatorios: 121,
    totalAnexos: 15,
    ultimoRelatorio: "01/01/2023 00:00:00",
  },
};

function cliente(body: unknown, chamadas: string[] = []) {
  return createDiarioDeObrasClient({
    token: "abc",
    intervaloMs: 0,
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("token")).toBe("abc");
      chamadas.push(String(url));
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch,
  });
}

describe("diário de obras", () => {
  it("manda o token no header e valida a empresa", async () => {
    const chamadas: string[] = [];
    const e = await cliente(EMPRESA, chamadas).empresa();
    expect(chamadas).toEqual([
      "https://apiexterna.diariodeobra.app/v1/empresa",
    ]);
    expect(e).toEqual({
      _id: EMPRESA._id,
      nome: EMPRESA.nome,
      razaoSocial: EMPRESA.razaoSocial,
      cpfCnpj: EMPRESA.cpfCnpj,
      logoUrl: EMPRESA.logoUrl,
      log: {
        totalObras: 8,
        totalUsuarios: 6,
        totalRelatorios: 121,
        ultimoRelatorio: "2023-01-01T00:00:00",
      },
    });
  });

  it("token recusado vira erro do conector", async () => {
    const client = createDiarioDeObrasClient({
      token: "errado",
      intervaloMs: 0,
      fetch: (async () =>
        new Response('{"erro":"token inválido"}', {
          status: 401,
        })) as typeof fetch,
    });
    await expect(client.empresa()).rejects.toThrow(/HTTP 401/);
  });

  it("429: espera o Retry-After e continua de onde parou", async () => {
    vi.useFakeTimers({ now: 1_000_000, toFake: ["setTimeout", "Date"] });
    try {
      const horarios: number[] = [];
      const client = createDiarioDeObrasClient({
        token: "abc",
        intervaloMs: 0,
        limite: { jitterMs: 0 },
        fetch: (async () => {
          horarios.push(Date.now() - 1_000_000);
          return horarios.length === 1
            ? new Response("limite", {
                status: 429,
                headers: { "Retry-After": "7" },
              })
            : new Response("[]", { status: 200 });
        }) as typeof fetch,
      });
      const obras = client.obras();
      await vi.advanceTimersByTimeAsync(7_000);
      await expect(obras).resolves.toEqual([]);
      expect(horarios).toEqual([0, 7_000]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("429 seguido: desiste depois das esperas e avisa que é o limite", async () => {
    let chamadas = 0;
    const client = createDiarioDeObrasClient({
      token: "abc",
      intervaloMs: 0,
      limite: { tentativas: 2, esperaMs: 1, maxMs: 1, jitterMs: 0 },
      fetch: (async () => {
        chamadas++;
        return new Response("limite", { status: 429 });
      }) as typeof fetch,
    });
    const erro = await client.obras().catch((e: unknown) => e);
    expect(limiteAtingido(erro)).toBe(true);
    expect(String(erro)).toMatch(/HTTP 429/);
    expect(chamadas).toBe(3);
  });

  it("tempo de espera do 429", () => {
    expect(esperaDoLimite(null, 60_000, 120_000)).toBe(60_000);
    expect(esperaDoLimite("30", 60_000, 120_000)).toBe(30_000);
    expect(esperaDoLimite("9999", 60_000, 120_000)).toBe(120_000);
    expect(esperaDoLimite("0", 60_000, 120_000)).toBe(1_000);
    const agora = Date.parse("2026-11-09T12:00:00Z");
    expect(
      esperaDoLimite("Mon, 09 Nov 2026 12:00:20 GMT", 60_000, 120_000, agora),
    ).toBe(20_000);
    expect(esperaDoLimite("depois", 60_000, 120_000)).toBe(60_000);
  });

  it("espaça as chamadas pelo intervalo", async () => {
    // Relógio falso: o intervalo é medido no tempo do cliente, não no da
    // máquina (que atrasa quando outros testes ocupam a CPU).
    vi.useFakeTimers({ now: 1_000_000, toFake: ["setTimeout", "Date"] });
    try {
      const horarios: number[] = [];
      const client = createDiarioDeObrasClient({
        token: "abc",
        intervaloMs: 30,
        fetch: (async () => {
          horarios.push(Date.now());
          return new Response(JSON.stringify(EMPRESA), { status: 200 });
        }) as typeof fetch,
      });
      const chamadas = Promise.all([
        client.empresa(),
        client.empresa(),
        client.empresa(),
      ]);
      await vi.advanceTimersByTimeAsync(29);
      expect(horarios.map((h) => h - 1_000_000)).toEqual([0]);
      await vi.advanceTimersByTimeAsync(31);
      await chamadas;
      expect(horarios.map((h) => h - 1_000_000)).toEqual([0, 30, 60]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("monta os filtros de relatórios na query", async () => {
    const chamadas: string[] = [];
    await cliente([], chamadas).relatorios("obra 1", {
      periodo: { inicio: "2026-10-01", fim: "2026-10-31" },
      limite: 50,
      ordem: "desc",
    });
    expect(chamadas).toEqual([
      "https://apiexterna.diariodeobra.app/v1/obras/obra%201/relatorios?dataInicio=2026-10-01&dataFim=2026-10-31&limite=50&ordem=desc",
    ]);
  });

  it("converte as datas da lista de obras", async () => {
    const obras = await cliente([
      {
        _id: "5c4f206f33e3821f9e559902",
        nome: "Obra Exemplo",
        status: { id: 3, descricao: "Em Andamento" },
        totalRelatorios: 35,
        totalFotos: 23,
        modified: "01/02/2023 09:05:00",
      },
    ]).obras();
    expect(obras).toEqual([
      {
        _id: "5c4f206f33e3821f9e559902",
        nome: "Obra Exemplo",
        status: { id: 3, descricao: "Em Andamento" },
        totalRelatorios: 35,
        totalFotos: 23,
        modified: "2023-02-01T09:05:00",
      },
    ]);
  });

  it("valida o cadastro da obra", async () => {
    const o = await cliente(obra).obra(obra._id);
    expect(o.dataInicio).toBe("2020-04-01");
    expect(o.prazo).toEqual({ contratual: 1005, decorrido: 1005, aVencer: 0 });
    expect(o.visaoGeral?.total?.tarefasCronograma).toBe(429);
    expect(o.fotoUrl).toBe("https://exemplo.test/foto.jpg");
    expect(o.observacao).toBeNull();
    expect(o.tipoContratanteContratada).toBe("Contratante");
  });

  it("valida o diário completo", async () => {
    const r = await cliente(relatorio).relatorio("o", relatorio._id);
    expect(r.data).toBe("2023-01-01");
    expect(r.horarioDeTrabalho?.horasTrabalhadas).toBe(480);
    expect(r.clima?.manha?.condicao).toBe("Impraticável");
    expect(r.maoDeObra?.opcaoSelecionada).toBe("personalizada");
    expect(
      r.maoDeObra?.personalizada.map((p) => [p.presenca, p.horasTrabalhadas]),
    ).toEqual([
      [true, 480],
      [false, null],
    ]);
    expect(r.atividades[1]?.controleDeProducao?.acumulado).toBe(10);
    expect(r.ocorrencias[0]?.tags.map((t) => t.descricao)).toEqual([
      "Chuva",
      "Dia parado",
    ]);
    expect(r.controleDeMaterial?.utilizado[0]?.quantidade).toBe("5m");
    expect(r.modified).toBe("2023-01-14T00:00:00");
    expect(r.comentarios).toEqual([
      {
        descricao: "Comentário",
        dataHora: "2023-01-01T00:00:00",
        usuario: { nome: "Usuário" },
      },
    ]);
    expect(r.galeriaDeFotos[0]).toEqual({
      descricao: "Concretagem dos pilares",
      url: "https://exemplo.test/g1.jpg",
      urlMiniatura: "https://exemplo.test/miniatura/g1.jpg",
      tarefaId: null,
      ocorrenciaId: null,
    });
    // Endereço que não é http(s) nunca chega a um link.
    expect(r.galeriaDeFotos[1]?.url).toBeNull();
    expect(r.galeriaDeFotos[1]?.tarefaId).toBe("5cc21c9c33e38246132b9a44");
    expect(r.videos[0]?.duracao).toBe("00:21");
    expect(r.anexos[0]).toMatchObject({ extensao: "pdf", tamanho: 1749888 });
    expect(r.atividades[1]?.fotos[0]?.url).toBe("https://exemplo.test/a.jpeg");
    expect(r.atividades[1]?.horario?.segundos).toBe(21600);
    expect(r.linkPdf).toBe("https://diariodeobras.net/");
    // O detalhe não traz "obra" no formato da lista; e-mails nunca entram.
    expect(r).not.toHaveProperty("obra");
  });

  it("aceita listas ausentes no diário", async () => {
    const r = await cliente({
      _id: "x",
      data: "02/01/2023",
      numero: 1,
      status: { id: 1, descricao: "Preenchendo" },
      maoDeObra: { opcaoSelecionada: null, padrao: null },
    }).relatorio("o", "x");
    expect(r.atividades).toEqual([]);
    expect(r.maoDeObra?.personalizada).toEqual([]);
  });

  it("percentuais do cronograma em texto viram número", async () => {
    const l = await cliente(listaDeTarefas).listaDeTarefas("o");
    expect(l.realizado).toBe(18.67);
    expect(l.cronograma[0]?.porcentagem).toBe(83.33);
    expect(l.cronograma[0]?.tarefas.map((t) => t.porcentagem)).toEqual([
      100, 50,
    ]);
  });

  it("data fora do formato vira erro do conector", async () => {
    await expect(
      cliente({ ...obra, dataInicio: "2020-04-01" }).obra("o"),
    ).rejects.toThrow(/fora do formato esperado/);
  });

  it("lista de relatórios: autor sem e-mail", () => {
    const r = relatorioResumoSchema.parse({
      _id: "640232c954310533ae33cbe4",
      data: "03/03/2023",
      dataFim: null,
      diaDaSemana: "Sexta-Feira",
      numero: 1,
      status: { id: 1, descricao: "Preenchendo" },
      obra: { _id: "o1", nome: "Escola" },
      modeloDeRelatorioGlobal: { _id: "m1", descricao: "RDO" },
      criadoPor: {
        appIss: "app-web",
        dataHora: "03/03/2023 14:47",
        usuario: {
          _id: "u1",
          nome: "Pessoa",
          cargo: "Fiscal",
          email: "pessoa@exemplo.test",
        },
      },
    });
    expect(r.criadoPor).toEqual({
      appIss: "app-web",
      dataHora: "2023-03-03T14:47:00",
      usuario: { _id: "u1", nome: "Pessoa", cargo: "Fiscal" },
    });
  });

  it("tarefa: ocorrências em formato não documentado não quebram", () => {
    const t = tarefaSchema.parse({
      _id: "t",
      item: "1.3",
      descricao: "Remoção de piso",
      porcentagem: 100,
      totalHoras: "3h e 30min",
      status: { id: 3, descricao: "Concluída" },
      relatorios: [
        {
          _id: "r",
          data: "01/06/2022",
          porcentagem: 35,
          ocorrencias: ["Chuva", { descricao: "Falta de material" }, 7],
          fotos: [],
        },
      ],
    });
    expect(t.relatorios[0]?.ocorrencias).toEqual([
      { descricao: "Chuva" },
      { descricao: "Falta de material" },
    ]);
  });

  it("links: só http(s)", () => {
    expect(link.parse(" https://a.test/x.jpg ")).toBe("https://a.test/x.jpg");
    expect(link.parse("javascript:alert(1)")).toBeNull();
    expect(link.parse("data:image/png;base64,AAAA")).toBeNull();
    expect(link.parse("")).toBeNull();
    expect(link.parse(null)).toBeNull();
  });

  it("conversões de data e hora", () => {
    expect(dataHoraBr.parse("03/03/2023 14:47")).toBe("2023-03-03T14:47:00");
    expect(horasEmMinutos.parse("01:30")).toBe(90);
    expect(horasEmMinutos.parse("")).toBeNull();
    expect(horasEmMinutos.safeParse("6h").success).toBe(false);
    expect(
      obraResumoSchema.parse({
        _id: "a",
        nome: "b",
        status: { id: 1, descricao: "Não Iniciada" },
        modified: "",
      }).modified,
    ).toBeNull();
  });
});
