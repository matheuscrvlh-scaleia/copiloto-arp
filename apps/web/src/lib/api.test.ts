import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiFalsa, erro, json } from "@/teste/api-falsa";
import {
  api,
  configurarApi,
  ErroDaApi,
  enderecoDoLogin,
  mensagemDoErro,
} from "./api";

const aoPerderSessao = vi.fn();
const aoExigirSenha = vi.fn();
let desfazer: () => void;

beforeEach(() => {
  aoPerderSessao.mockReset();
  aoExigirSenha.mockReset();
  desfazer = configurarApi({ aoPerderSessao, aoExigirSenha });
});
afterEach(() => desfazer());

/** O erro que a promessa rejeitou (falha o teste se não for da API). */
async function erroDe(promessa: Promise<unknown>): Promise<ErroDaApi> {
  const e: unknown = await promessa.then(
    () => null,
    (motivo: unknown) => motivo,
  );
  if (!(e instanceof ErroDaApi)) throw new Error("esperava um ErroDaApi");
  return e;
}

describe("pedido", () => {
  it("leitura vai com os cookies e sem o cabeçalho de gravação", async () => {
    const falsa = apiFalsa({ "GET /api/v1/coisas": json({ itens: [1] }) });
    const esquema = z.object({ itens: z.array(z.number()) });
    const r = await api.get("/coisas", { esquema });
    expect(r.itens).toEqual([1]);
    expect(falsa.pedidos[0]?.headers.has("X-ARP")).toBe(false);
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(init?.credentials).toBe("same-origin");
  });

  it("gravação leva X-ARP e o corpo em JSON", async () => {
    const falsa = apiFalsa({
      "POST /api/v1/coisas": json({ mensagem: "Salvo." }, 201),
    });
    await api.post("/coisas", { nome: "Ana" });
    const pedido = falsa.pedidos[0];
    expect(pedido?.headers.get("X-ARP")).toBe("1");
    expect(pedido?.headers.get("Content-Type")).toBe("application/json");
    expect(pedido?.corpo).toBe('{"nome":"Ana"}');
  });

  it("multipart: o navegador escreve o Content-Type", async () => {
    const falsa = apiFalsa({ "POST /api/v1/arquivos": json({}) });
    const form = new FormData();
    form.set("arquivo", new File(["x"], "a.txt"));
    await api.post("/arquivos", form);
    expect(falsa.pedidos[0]?.headers.has("Content-Type")).toBe(false);
    expect(falsa.pedidos[0]?.corpo).toBe(form);
  });

  it("consulta: lista repete a chave; vazio fica de fora", async () => {
    const falsa = apiFalsa({});
    await api
      .get("/coisas", {
        consulta: { setor: ["a", "b"], busca: "", pagina: 2, x: null },
      })
      .catch(() => undefined);
    expect(falsa.pedidos[0]?.caminho).toBe(
      "/api/v1/coisas?setor=a&setor=b&pagina=2",
    );
  });

  it("204 devolve undefined", async () => {
    apiFalsa({
      "DELETE /api/v1/coisas/1": new Response(null, { status: 204 }),
    });
    expect(await api.delete("/coisas/1")).toBeUndefined();
  });
});

describe("erro padronizado", () => {
  it("lê codigo, mensagem, campos e status da resposta", async () => {
    apiFalsa({
      "POST /api/v1/coisas": erro(400, "validacao", "Confira os campos.", {
        nome: "Informe o nome.",
      }),
    });
    const e = await erroDe(api.post("/coisas", {}));
    expect(e.codigo).toBe("validacao");
    expect(e.status).toBe(400);
    expect(e.mensagem).toBe("Confira os campos.");
    expect(e.campos).toEqual({ nome: "Informe o nome." });
    expect(mensagemDoErro(e)).toBe("Informe o nome.");
  });

  it("resposta fora do formato vira erro interno, sem detalhe técnico", async () => {
    apiFalsa({
      "GET /api/v1/coisas": new Response("<html>502</html>", { status: 502 }),
    });
    const e = await erroDe(api.get("/coisas"));
    expect(e.codigo).toBe("interno");
    expect(e.status).toBe(502);
    expect(e.mensagem).not.toContain("html");
  });

  it("sem resposta (rede) tem código próprio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    const e = await erroDe(api.get("/coisas"));
    expect(e.codigo).toBe("rede");
    expect(e.status).toBe(0);
  });

  it("resposta fora do contrato é erro, não dado errado na tela", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    apiFalsa({ "GET /api/v1/coisas": json({ itens: "não é lista" }) });
    const e = await erroDe(
      api.get("/coisas", { esquema: z.object({ itens: z.array(z.string()) }) }),
    );
    expect(e.codigo).toBe("interno");
  });

  it("erro desconhecido tem mensagem genérica", () => {
    expect(mensagemDoErro(new Error("ECONNRESET at 10.0.0.1"))).toBe(
      "Não foi possível concluir. Tente de novo.",
    );
  });
});

describe("renovação da sessão", () => {
  it("401 → renova uma vez e repete o pedido", async () => {
    let tentativas = 0;
    const falsa = apiFalsa({
      "GET /api/v1/coisas": () =>
        ++tentativas === 1 ? erro(401, "nao_autenticado") : json({ ok: true }),
      "POST /api/v1/auth/renovar": json({ sessao: {} }),
    });
    expect(await api.get("/coisas")).toEqual({ ok: true });
    expect(falsa.quantos("POST /api/v1/auth/renovar")).toBe(1);
    expect(falsa.quantos("GET /api/v1/coisas")).toBe(2);
    expect(aoPerderSessao).not.toHaveBeenCalled();
  });

  it("chamadas simultâneas esperam a mesma renovação (fila)", async () => {
    let renovado = false;
    let liberar: () => void = () => undefined;
    const espera = new Promise<void>((ok) => {
      liberar = ok;
    });
    const falsa = apiFalsa({
      "GET /api/v1/a": () =>
        renovado ? json({ de: "a" }) : erro(401, "nao_autenticado"),
      "GET /api/v1/b": () =>
        renovado ? json({ de: "b" }) : erro(401, "nao_autenticado"),
      "POST /api/v1/c": () =>
        renovado ? json({ de: "c" }) : erro(401, "nao_autenticado"),
      "POST /api/v1/auth/renovar": async () => {
        await espera;
        renovado = true;
        return json({ sessao: {} });
      },
    });
    const todas = Promise.all([
      api.get("/a"),
      api.get("/b"),
      api.post("/c", { x: 1 }),
    ]);
    // As três já tomaram 401 e estão na fila da mesma renovação.
    await vi.waitFor(() =>
      expect(falsa.quantos("POST /api/v1/auth/renovar")).toBe(1),
    );
    liberar();
    expect(await todas).toEqual([{ de: "a" }, { de: "b" }, { de: "c" }]);
    expect(falsa.quantos("POST /api/v1/auth/renovar")).toBe(1);
    // A gravação repetida leva o mesmo corpo.
    expect(
      falsa.pedidos.filter((p) => p.caminho === "/api/v1/c")[1]?.corpo,
    ).toBe('{"x":1}');
  });

  it("renovação recusada: sessão perdida, vai para o login", async () => {
    const falsa = apiFalsa({
      "GET /api/v1/coisas": erro(401, "nao_autenticado"),
      "POST /api/v1/auth/renovar": erro(401, "nao_autenticado"),
    });
    const e = await erroDe(api.get("/coisas"));
    expect(e.codigo).toBe("nao_autenticado");
    expect(aoPerderSessao).toHaveBeenCalledTimes(1);
    // Não repete o pedido nem tenta renovar de novo.
    expect(falsa.quantos("GET /api/v1/coisas")).toBe(1);
    expect(falsa.quantos("POST /api/v1/auth/renovar")).toBe(1);
  });

  it("depois de renovar, um segundo 401 não entra em laço", async () => {
    const falsa = apiFalsa({
      "GET /api/v1/coisas": erro(401, "nao_autenticado"),
      "POST /api/v1/auth/renovar": json({ sessao: {} }),
    });
    await erroDe(api.get("/coisas"));
    expect(falsa.quantos("GET /api/v1/coisas")).toBe(2);
    expect(falsa.quantos("POST /api/v1/auth/renovar")).toBe(1);
    expect(aoPerderSessao).toHaveBeenCalledTimes(1);
  });

  it("renovar: false (entrar) não tenta renovar nem sai da tela", async () => {
    const falsa = apiFalsa({
      "POST /api/v1/auth/entrar": erro(
        401,
        "nao_autenticado",
        "E-mail ou senha incorretos.",
      ),
    });
    const e = await erroDe(
      api.post("/auth/entrar", { email: "a@b.test" }, { renovar: false }),
    );
    expect(e.mensagem).toBe("E-mail ou senha incorretos.");
    expect(falsa.pedidos).toHaveLength(1);
    expect(aoPerderSessao).not.toHaveBeenCalled();
  });

  it("irParaOLogin: false deixa quem chamou decidir", async () => {
    apiFalsa({
      "GET /api/v1/auth/eu": erro(401, "nao_autenticado"),
      "POST /api/v1/auth/renovar": erro(401, "nao_autenticado"),
    });
    await erroDe(api.get("/auth/eu", { irParaOLogin: false }));
    expect(aoPerderSessao).not.toHaveBeenCalled();
  });

  it("403 senha_provisoria leva para a troca de senha", async () => {
    apiFalsa({ "GET /api/v1/coisas": erro(403, "senha_provisoria") });
    await erroDe(api.get("/coisas"));
    expect(aoExigirSenha).toHaveBeenCalledTimes(1);
    expect(aoPerderSessao).not.toHaveBeenCalled();
  });

  it("403 sem_permissao não mexe na sessão", async () => {
    const falsa = apiFalsa({
      "GET /api/v1/coisas": erro(403, "sem_permissao"),
    });
    const e = await erroDe(api.get("/coisas"));
    expect(e.codigo).toBe("sem_permissao");
    expect(falsa.pedidos).toHaveLength(1);
  });
});

describe("download", () => {
  it("devolve o arquivo e o nome que o servidor sugeriu", async () => {
    apiFalsa({
      "GET /api/v1/relatorios/1/pdf": new Response("%PDF", {
        headers: {
          "content-type": "application/pdf",
          "content-disposition":
            "attachment; filename=\"relatorio.pdf\"; filename*=UTF-8''relat%C3%B3rio.pdf",
        },
      }),
    });
    const arquivo = await api.baixar("/relatorios/1/pdf");
    expect(arquivo.nome).toBe("relatório.pdf");
    expect(await arquivo.blob.text()).toBe("%PDF");
  });
});

describe("endereço do login", () => {
  it("leva a tela atual como destino", () => {
    expect(enderecoDoLogin({ pathname: "/rh/jornada", search: "?mes=1" })).toBe(
      "/login?destino=%2Frh%2Fjornada%3Fmes%3D1",
    );
    expect(enderecoDoLogin({ pathname: "/rh", search: "" }, "expirou")).toBe(
      "/login?destino=%2Frh&motivo=expirou",
    );
  });

  it("raiz, login e endereço de outro site não viram destino", () => {
    expect(enderecoDoLogin({ pathname: "/", search: "" })).toBe("/login");
    expect(
      enderecoDoLogin({ pathname: "/login", search: "?destino=%2Fx" }),
    ).toBe("/login");
    expect(enderecoDoLogin({ pathname: "//outro.test", search: "" })).toBe(
      "/login",
    );
  });
});
