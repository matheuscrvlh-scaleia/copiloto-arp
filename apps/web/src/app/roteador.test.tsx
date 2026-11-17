import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, describe, expect, it } from "vitest";
import { criarClienteDeConsultas } from "@/lib/consulta";
import { TRAVA_DA_RECARGA } from "@/lib/versao-nova";
import { apiFalsa, erro, euDeTeste, json } from "@/teste/api-falsa";
import {
  destinoDoRedirecionamento,
  REDIRECIONAMENTOS,
} from "./redirecionamentos";
import type { Modulo } from "./rota";
import { montarRotas } from "./roteador";

// Guarda de rota e permissão, de ponta a ponta: a árvore de rotas de verdade
// (montarRotas), com um módulo de teste e a API falsa.

const moduloDeTeste: Modulo = {
  nome: "teste",
  autenticadas: [
    {
      caminho: "gestao",
      titulo: "Dashboard",
      pagina: async () => ({ default: () => <p>Tela do início</p> }),
    },
    {
      caminho: "rh/folha-de-teste",
      titulo: "Folha",
      permissao: "rh.folha",
      pagina: async () => ({ default: () => <p>Tela da folha</p> }),
    },
    {
      caminho: "tela-que-sumiu",
      // Aba aberta durante um deploy: o arquivo da tela não existe mais.
      pagina: () =>
        Promise.reject(
          new TypeError(
            "Failed to fetch dynamically imported module: /assets/tela-abc123.js",
          ),
        ),
    },
    {
      caminho: "com-erro",
      pagina: async () => ({
        default: () => {
          throw new Error("detalhe técnico que a pessoa não deve ver");
        },
      }),
    },
  ],
  publicas: [
    {
      caminho: "ordem/:token",
      pagina: async () => ({ default: () => <p>Ordem pública</p> }),
    },
  ],
};

/** A casca sempre pergunta pelos avisos e pelas notificações. */
const DA_CASCA = {
  "GET /api/v1/avisos": json({ avisos: [] }),
  "GET /api/v1/notificacoes": json({ notificacoes: [] }),
};

const SEM_SESSAO = {
  "GET /api/v1/auth/eu": erro(401, "nao_autenticado"),
  "POST /api/v1/auth/renovar": erro(401, "nao_autenticado"),
};

function abrir(endereco: string) {
  const roteador = createMemoryRouter(montarRotas([moduloDeTeste]), {
    initialEntries: [endereco],
  });
  render(
    <QueryClientProvider client={criarClienteDeConsultas()}>
      <RouterProvider router={roteador} />
    </QueryClientProvider>,
  );
  const local = () => roteador.state.location;
  return { local, onde: () => local().pathname + local().search };
}

afterEach(() => {
  document.title = "";
});

describe("guarda de rota", () => {
  it("sem sessão: vai para o login levando o destino", async () => {
    apiFalsa(SEM_SESSAO);
    const tela = abrir("/rh/folha-de-teste?mes=2026-01");
    expect(await screen.findByText("Bem-vindo de volta")).toBeTruthy();
    expect(tela.onde()).toBe(
      "/login?destino=%2Frh%2Ffolha-de-teste%3Fmes%3D2026-01",
    );
    expect(screen.queryByText("Tela da folha")).toBeNull();
  });

  it("sem sessão na raiz: login sem destino", async () => {
    apiFalsa(SEM_SESSAO);
    const tela = abrir("/");
    await screen.findByText("Bem-vindo de volta");
    expect(tela.onde()).toBe("/login");
  });

  it("com sessão: a raiz e o login levam ao início", async () => {
    apiFalsa({ ...DA_CASCA, "GET /api/v1/auth/eu": json(euDeTeste()) });
    const raiz = abrir("/");
    expect(await screen.findByText("Tela do início")).toBeTruthy();
    expect(raiz.onde()).toBe("/gestao");
    expect(document.title).toBe("Dashboard · ARP Centralizador");
  });

  it("login com sessão volta para o destino pedido (só interno)", async () => {
    apiFalsa({
      ...DA_CASCA,
      "GET /api/v1/auth/eu": json(euDeTeste(["rh.folha"])),
    });
    const tela = abrir("/login?destino=%2Frh%2Ffolha-de-teste");
    expect(await screen.findByText("Tela da folha")).toBeTruthy();
    expect(tela.onde()).toBe("/rh/folha-de-teste");
  });

  it("destino de outro site é ignorado", async () => {
    apiFalsa({ ...DA_CASCA, "GET /api/v1/auth/eu": json(euDeTeste()) });
    const tela = abrir("/login?destino=%2F%2Fsite-falso.test");
    await screen.findByText("Tela do início");
    expect(tela.onde()).toBe("/gestao");
  });

  it("senha provisória: só a tela de trocar a senha abre", async () => {
    apiFalsa({
      ...DA_CASCA,
      "GET /api/v1/auth/eu": json(euDeTeste(["rh.folha"], true)),
    });
    const tela = abrir("/rh/folha-de-teste");
    expect(await screen.findByText("Defina a sua senha")).toBeTruthy();
    expect(tela.onde()).toBe("/trocar-senha");
    expect(screen.queryByText("Tela da folha")).toBeNull();
  });

  it("senha já definida: trocar-senha volta ao início", async () => {
    apiFalsa({ ...DA_CASCA, "GET /api/v1/auth/eu": json(euDeTeste()) });
    const tela = abrir("/trocar-senha");
    await screen.findByText("Tela do início");
    expect(tela.onde()).toBe("/gestao");
  });

  it("tela pública abre sem sessão e sem perguntar quem está logado", async () => {
    const falsa = apiFalsa(SEM_SESSAO);
    abrir("/ordem/abc");
    expect(await screen.findByText("Ordem pública")).toBeTruthy();
    expect(falsa.pedidos).toHaveLength(0);
  });
});

describe("permissão", () => {
  it("sem a permissão: aviso de acesso negado, dentro da casca", async () => {
    apiFalsa({ ...DA_CASCA, "GET /api/v1/auth/eu": json(euDeTeste()) });
    const tela = abrir("/rh/folha-de-teste");
    expect(
      await screen.findByText(
        "Você não tem acesso a esta tela. Peça a liberação ao administrador.",
      ),
    ).toBeTruthy();
    expect(tela.onde()).toBe("/rh/folha-de-teste");
    expect(screen.queryByText("Tela da folha")).toBeNull();
    expect(screen.getByText("Pessoa de Teste")).toBeTruthy();
  });

  it("com a permissão: a tela abre", async () => {
    apiFalsa({
      ...DA_CASCA,
      "GET /api/v1/auth/eu": json(euDeTeste(["rh.folha"])),
    });
    abrir("/rh/folha-de-teste");
    expect(await screen.findByText("Tela da folha")).toBeTruthy();
  });

  it("o menu mostra só o que a pessoa pode ver", async () => {
    apiFalsa({
      ...DA_CASCA,
      "GET /api/v1/auth/eu": json(euDeTeste(["calendario.ver"])),
    });
    abrir("/gestao");
    await screen.findByText("Tela do início");
    const menu = screen.getByRole("navigation");
    const itens = [...menu.querySelectorAll("a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(itens).toEqual(["/gestao", "/calendario"]);
  });

  it("permissão que o sistema não conhece é ignorada", async () => {
    apiFalsa({
      ...DA_CASCA,
      "GET /api/v1/auth/eu": json(euDeTeste(["inventada.agora"])),
    });
    abrir("/rh/folha-de-teste");
    expect(await screen.findByText(/Você não tem acesso/)).toBeTruthy();
  });
});

describe("telas que não existem ou falham", () => {
  it("endereço desconhecido: página não encontrada, com o menu", async () => {
    apiFalsa({ ...DA_CASCA, "GET /api/v1/auth/eu": json(euDeTeste()) });
    abrir("/nao-existe");
    expect(await screen.findByText("Página não encontrada")).toBeTruthy();
    expect(screen.getByText("Pessoa de Teste")).toBeTruthy();
  });

  it("erro na tela: aviso com tentar de novo, sem detalhe técnico", async () => {
    // O React escreve o erro capturado no console; aqui ele é esperado.
    const calado = console.error;
    console.error = () => undefined;
    try {
      apiFalsa({ ...DA_CASCA, "GET /api/v1/auth/eu": json(euDeTeste()) });
      abrir("/com-erro");
      expect(await screen.findByText("Tentar de novo")).toBeTruthy();
      expect(screen.queryByText(/detalhe técnico/)).toBeNull();
      expect(screen.getByText("Pessoa de Teste")).toBeTruthy();
    } finally {
      console.error = calado;
    }
  });
});

describe("endereços antigos", () => {
  it("levam para a tela nova, com o resto do endereço e a busca", () => {
    const sem = { search: "", hash: "" };
    expect(destinoDoRedirecionamento("/relatorios/*", "", sem)).toBe(
      "/relatorios",
    );
    expect(destinoDoRedirecionamento("/relatorios/*", "12/editar", sem)).toBe(
      "/relatorios/12/editar",
    );
    expect(
      destinoDoRedirecionamento("/operacoes/configuracoes/importacoes/*", "", {
        search: "?tipo=agua",
        hash: "",
      }),
    ).toBe("/operacoes/configuracoes/importacoes?tipo=agua");
    expect(destinoDoRedirecionamento("/os?aberto_por=eu", "", sem)).toBe(
      "/os?aberto_por=eu",
    );
    expect(
      destinoDoRedirecionamento(
        "/rh/configuracoes/cadastros#beneficios",
        "",
        sem,
      ),
    ).toBe("/rh/configuracoes/cadastros#beneficios");
  });

  it("um endereço antigo abre a tela nova", async () => {
    apiFalsa({ ...DA_CASCA, "GET /api/v1/auth/eu": json(euDeTeste()) });
    const tela = abrir("/rh/folha?x=1");
    await screen.findByText("Página não encontrada");
    expect(tela.onde()).toBe("/rh/configuracoes/importacoes?x=1");
  });

  it("a lista não tem origem repetida", () => {
    const origens = REDIRECIONAMENTOS.map((r) => r.de);
    expect(new Set(origens).size).toBe(origens.length);
  });
});

describe("aba aberta durante um deploy", () => {
  it("a página já recarregou e a tela continua sem baixar: limite de erro normal", async () => {
    // A trava diz que a recarga automática acabou de acontecer.
    window.sessionStorage.setItem(TRAVA_DA_RECARGA, String(Date.now()));
    apiFalsa({ ...DA_CASCA, "GET /api/v1/auth/eu": json(euDeTeste()) });
    abrir("/tela-que-sumiu");
    expect(await screen.findByText("Algo não saiu como esperado")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Recarregar a página" }),
    ).toBeTruthy();
    window.sessionStorage.clear();
  });
});
