import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configurarApi } from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";
import { apiFalsa, erro, json } from "@/teste/api-falsa";
import Inicio from "./paginas/portal-publico/inicio";

// Portal do lojista (/portal) com a API falsa: sem sessão da loja aparece a
// entrada pelo CPF ou CNPJ; a recusa da entrada mostra a mensagem da API e
// nunca leva ao login do sistema; com a sessão, aparecem a loja e os pedidos.

const SEM_LOJA = {
  loja: null,
  boasVindas: null,
  categorias: [],
  pedidos: [],
  documentos: [],
};

const LOJA = "00000000-0000-4000-8000-000000000001";

const COM_LOJA = {
  loja: { id: LOJA, nome: "Loja de Teste", luc: "T-01", bloco: "A" },
  boasVindas: "Bem-vindo ao portal.",
  categorias: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      nome: "Manutenção",
      icone: "wrench",
      orientacao: null,
      campos: [],
    },
  ],
  pedidos: [],
  documentos: [],
};

function abrir() {
  return render(
    <QueryClientProvider client={clienteDeConsultas}>
      <MemoryRouter initialEntries={["/portal"]}>
        <Suspense fallback={<p>carregando</p>}>
          <Inicio />
        </Suspense>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("portal do lojista: início", () => {
  afterEach(() => {
    clienteDeConsultas.clear();
    vi.unstubAllGlobals();
  });

  it("sem sessão da loja, mostra a entrada; a recusa não leva ao login", async () => {
    const aoPerderSessao = vi.fn();
    const desfazer = configurarApi({ aoPerderSessao });
    const api = apiFalsa({
      "GET /api/v1/os/portal-publico/inicio": json(SEM_LOJA),
      "POST /api/v1/os/portal-publico/entrar": erro(
        422,
        "regra",
        "Nenhuma loja com contrato vigente neste CPF ou CNPJ. Confira o número ou fale com a administração.",
      ),
    });
    abrir();
    expect(await screen.findByText("Entrar no portal")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Só os números"), {
      target: { value: "11.222.333/0001-81" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(
      await screen.findByText(/Nenhuma loja com contrato vigente/),
    ).toBeTruthy();
    const entrada = api.pedidos.find((p) => p.metodo === "POST");
    expect(entrada?.headers.get("X-ARP")).toBe("1");
    expect(JSON.parse(String(entrada?.corpo))).toEqual({
      cnpj: "11.222.333/0001-81",
      loja: "",
    });
    // A sessão do portal não é a do sistema: nada de renovar nem de login.
    expect(api.pedidos.some((p) => p.caminho.startsWith("/api/v1/auth"))).toBe(
      false,
    );
    expect(aoPerderSessao).not.toHaveBeenCalled();
    desfazer();
  });

  it("com a sessão da loja, mostra a loja e os tipos de pedido", async () => {
    apiFalsa({ "GET /api/v1/os/portal-publico/inicio": json(COM_LOJA) });
    abrir();
    expect(await screen.findByText("Loja de Teste")).toBeTruthy();
    expect(screen.getByText("LUC T-01 · Bloco A")).toBeTruthy();
    expect(screen.getByText("Bem-vindo ao portal.")).toBeTruthy();
    expect(screen.getByText("Manutenção")).toBeTruthy();
    expect(screen.getByText("Trocar de loja")).toBeTruthy();
  });
});
