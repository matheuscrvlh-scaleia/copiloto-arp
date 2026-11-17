import { permissaoDoPrograma } from "@arp/shared/permissions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { navigationFor } from "@/config/navigation";
import { apiFalsa, erro, euDeTeste, json } from "@/teste/api-falsa";
import { api } from "./api";
import { clienteDeConsultas } from "./consulta";
import { consultaDaSessao, entrar, montarSessao } from "./sessao";

// "Programa – lançar" (sustentabilidade.programa.<id>): fica fora do catálogo
// fixo, mas precisa chegar à tela e abrir o item Programas do menu.

const PROGRAMA = permissaoDoPrograma("a0000000-0000-4000-8000-000000000002");

const itensDe = (s: ReturnType<typeof montarSessao>) =>
  navigationFor(
    (p) => s.usuario.permissoes.includes(p),
    s.usuario.programas.length > 0,
  )
    .filter((secao) => secao.titulo === "Sustentabilidade")
    .flatMap((secao) => secao.itens.map((i) => i.href));

describe("sessão: permissões por programa", () => {
  it("separa as fixas das de programa e descarta o que o sistema não conhece", () => {
    const s = montarSessao(
      euDeTeste([
        "os.acessar",
        PROGRAMA,
        "nao.existe",
        "sustentabilidade.programa.abc",
      ]),
    );
    expect(s.usuario.permissoes).toEqual(["os.acessar"]);
    expect(s.usuario.programas).toEqual([PROGRAMA]);
    expect(s.pode("os.acessar")).toBe(true);
    expect(s.pode(PROGRAMA)).toBe(true);
    expect(s.pode([PROGRAMA, "admin.usuarios"])).toBe(true);
    expect(
      s.pode(permissaoDoPrograma("b0000000-0000-4000-8000-000000000003")),
    ).toBe(false);
    expect(s.pode("sustentabilidade.programas.gerenciar")).toBe(false);
  });

  it("quem só lança num programa vê só o item Programas", () => {
    expect(itensDe(montarSessao(euDeTeste([PROGRAMA])))).toEqual([
      "/sustentabilidade/programas",
    ]);
    expect(itensDe(montarSessao(euDeTeste(["os.acessar"])))).toEqual([]);
    expect(
      itensDe(montarSessao(euDeTeste(["sustentabilidade.painel"]))),
    ).toEqual(["/sustentabilidade"]);
  });
});

// A corrida do login: a tela pergunta quem está logado (401), tenta renovar
// e a pessoa entra antes de o 401 do renovar chegar. Essa resposta atrasada
// apagava os cookies que o `entrar` tinha acabado de gravar.
describe("sessão: entrar logo que a tela abre", () => {
  const CREDENCIAIS = { email: "pessoa@exemplo.test", senha: "segredo-123" };
  const EU = "GET /api/v1/auth/eu";
  const RENOVAR = "POST /api/v1/auth/renovar";
  const ENTRAR = "POST /api/v1/auth/entrar";

  /** Uma resposta que só chega quando o teste mandar. */
  function atrasada() {
    let soltar: (r: Response) => void = () => undefined;
    const promessa = new Promise<Response>((resolve) => {
      soltar = resolve;
    });
    return { promessa, soltar };
  }

  beforeEach(() => {
    clienteDeConsultas.clear();
    window.localStorage.clear();
  });

  it("espera o renovar que está no ar antes de pedir o entrar", async () => {
    // Alguém já entrou por este navegador: a checagem inicial tenta renovar.
    window.localStorage.setItem("arp.sessao", "1");
    const renovar = atrasada();
    const falsa = apiFalsa({
      [EU]: erro(401, "nao_autenticado"),
      [RENOVAR]: () => renovar.promessa,
      [ENTRAR]: json(euDeTeste(["os.acessar"])),
    });

    const checagem = clienteDeConsultas.fetchQuery(consultaDaSessao);
    await vi.waitFor(() => expect(falsa.quantos(RENOVAR)).toBe(1));

    const entrando = entrar(CREDENCIAIS);
    await new Promise((resolve) => setTimeout(resolve, 20));
    // O renovar ainda não respondeu: o entrar não saiu.
    expect(falsa.quantos(ENTRAR)).toBe(0);

    renovar.soltar(erro(401, "nao_autenticado"));
    await entrando;
    expect(await checagem).toBeNull();

    // O entrar só foi pedido depois da resposta do renovar, e a sessão fica.
    expect(falsa.pedidos.map((p) => `${p.metodo} ${p.caminho}`)).toEqual([
      EU,
      RENOVAR,
      ENTRAR,
    ]);
    expect(
      clienteDeConsultas.getQueryData(consultaDaSessao.queryKey)?.usuario
        .permissoes,
    ).toEqual(["os.acessar"]);
  });

  it("sem ninguém ter entrado por este navegador, a checagem inicial não tenta renovar", async () => {
    const falsa = apiFalsa({
      [EU]: erro(401, "nao_autenticado"),
      [RENOVAR]: erro(401, "nao_autenticado"),
    });
    expect(await clienteDeConsultas.fetchQuery(consultaDaSessao)).toBeNull();
    expect(falsa.quantos(RENOVAR)).toBe(0);
  });

  it("depois de entrar, a checagem renova o acesso vencido (F5 depois de 10 min)", async () => {
    let renovado = false;
    const falsa = apiFalsa({
      [ENTRAR]: json(euDeTeste()),
      [EU]: () => (renovado ? json(euDeTeste()) : erro(401, "nao_autenticado")),
      [RENOVAR]: () => {
        renovado = true;
        return json({ sessao: euDeTeste().sessao });
      },
    });
    await entrar(CREDENCIAIS);
    clienteDeConsultas.clear();
    expect(
      await clienteDeConsultas.fetchQuery(consultaDaSessao),
    ).not.toBeNull();
    expect(falsa.quantos(RENOVAR)).toBe(1);
  });

  it("renovar pedido enquanto o entrar está no ar espera por ele", async () => {
    window.localStorage.setItem("arp.sessao", "1");
    const eu = atrasada();
    const entrada = atrasada();
    const falsa = apiFalsa({
      [EU]: () => eu.promessa,
      [RENOVAR]: json({ sessao: euDeTeste().sessao }),
      [ENTRAR]: () => entrada.promessa,
      "GET /api/v1/coisas": erro(401, "nao_autenticado"),
    });
    const entrando = entrar(CREDENCIAIS);
    await vi.waitFor(() => expect(falsa.quantos(ENTRAR)).toBe(1));

    // Outro pedido toma 401 agora: a renovação fica para depois do entrar.
    const outro = api.get("/coisas", { irParaOLogin: false }).catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(falsa.quantos(RENOVAR)).toBe(0);

    entrada.soltar(json(euDeTeste()));
    await entrando;
    await outro;
    expect(falsa.quantos(RENOVAR)).toBe(1);
    const ordem = falsa.pedidos.map((p) => `${p.metodo} ${p.caminho}`);
    expect(ordem.indexOf(RENOVAR)).toBeGreaterThan(ordem.indexOf(ENTRAR));
  });

  it("o 401 atrasado da checagem inicial não derruba a sessão de quem entrou", async () => {
    const eu = atrasada();
    const falsa = apiFalsa({
      [EU]: () => eu.promessa,
      [RENOVAR]: erro(401, "nao_autenticado"),
      [ENTRAR]: json(euDeTeste(["os.acessar"])),
    });
    const checagem = clienteDeConsultas
      .fetchQuery(consultaDaSessao)
      .catch(() => "cancelada");
    await vi.waitFor(() => expect(falsa.quantos(EU)).toBe(1));

    await entrar(CREDENCIAIS);
    eu.soltar(erro(401, "nao_autenticado"));
    expect(await checagem).toBe("cancelada");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(
      clienteDeConsultas.getQueryData(consultaDaSessao.queryKey),
    ).not.toBeNull();
    expect(
      clienteDeConsultas.getQueryData(consultaDaSessao.queryKey),
    ).toBeDefined();
    expect(falsa.quantos(RENOVAR)).toBe(0);
  });
});
