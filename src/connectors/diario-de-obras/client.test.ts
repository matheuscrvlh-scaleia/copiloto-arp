import { describe, expect, it } from "vitest";
import listaDeTarefas from "./__fixtures__/lista-de-tarefas.json";
import obra from "./__fixtures__/obra.json";
import relatorio from "./__fixtures__/relatorio.json";
import { createDiarioDeObrasClient } from "./client";
import { dataHoraBr, horasEmMinutos, obraResumoSchema } from "./schemas";

// Fixtures montadas com os exemplos da documentação da API (nomes trocados).

const EMPRESA = {
  _id: "57fa4eebffd18769058b4567",
  nome: "Construtora Exemplo",
  razaoSocial: "CONSTRUTORA EXEMPLO LTDA",
  log: { totalObras: 8, totalUsuarios: 6, totalRelatorios: 121 },
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
      log: { totalObras: 8, totalRelatorios: 121 },
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

  it("429 falha na hora, sem repetir dentro da janela de um minuto", async () => {
    let chamadas = 0;
    const client = createDiarioDeObrasClient({
      token: "abc",
      intervaloMs: 0,
      fetch: (async () => {
        chamadas++;
        return new Response("limite", { status: 429 });
      }) as typeof fetch,
    });
    await expect(client.obras()).rejects.toThrow(/HTTP 429/);
    expect(chamadas).toBe(1);
  });

  it("espaça as chamadas pelo intervalo", async () => {
    const horarios: number[] = [];
    const client = createDiarioDeObrasClient({
      token: "abc",
      intervaloMs: 30,
      fetch: (async () => {
        horarios.push(Date.now());
        return new Response(JSON.stringify(EMPRESA), { status: 200 });
      }) as typeof fetch,
    });
    await Promise.all([client.empresa(), client.empresa(), client.empresa()]);
    const [primeira = 0, , terceira = 0] = horarios;
    expect(horarios).toHaveLength(3);
    expect(terceira - primeira).toBeGreaterThanOrEqual(55);
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
        modified: "2023-02-01T09:05:00",
      },
    ]);
  });

  it("valida o cadastro da obra", async () => {
    const o = await cliente(obra).obra(obra._id);
    expect(o.dataInicio).toBe("2020-04-01");
    expect(o.prazo).toEqual({ contratual: 1005, decorrido: 1005, aVencer: 0 });
    expect(o.visaoGeral?.total.tarefasCronograma).toBe(429);
    expect(o).not.toHaveProperty("fotoUrl");
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
    // Comentários e fotos não entram.
    expect(r).not.toHaveProperty("comentarios");
    expect(r).not.toHaveProperty("galeriaDeFotos");
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
