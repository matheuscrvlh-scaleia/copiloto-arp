import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clienteDeConsultas } from "@/lib/consulta";
import { apiFalsa, erro, euDeTeste, json } from "@/teste/api-falsa";
import { PonteDeArquivo } from "./ponte-de-arquivo";

// As telas que só passam para um arquivo da API ficavam no "carregando"
// para sempre quando o navegador baixava o arquivo em vez de abri-lo.

const DESTINO = "/api/v1/operacoes/energia/termos/abc/arquivo?formato=docx";

function abrir(props: { publica?: boolean } = {}) {
  const ir = vi.fn();
  render(
    <MemoryRouter>
      <PonteDeArquivo
        destino={DESTINO}
        voltar="/operacoes/energia/termo"
        ir={ir}
        esperaMs={30}
        {...props}
      />
    </MemoryRouter>,
  );
  return ir;
}

beforeEach(() => {
  clienteDeConsultas.clear();
  window.localStorage.clear();
});

describe("ponte de arquivo", () => {
  it("pede o arquivo e troca o carregando pelo aviso, com tentar de novo e voltar", async () => {
    apiFalsa({ "GET /api/v1/auth/eu": json(euDeTeste()) });
    const ir = abrir();
    expect(screen.getByText("Carregando dados…")).toBeTruthy();
    await vi.waitFor(() => expect(ir).toHaveBeenCalledWith(DESTINO));

    expect(
      await screen.findByText("O arquivo foi aberto ou baixado"),
    ).toBeTruthy();
    expect(screen.queryByText("Carregando dados…")).toBeNull();
    expect(ir).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("link", { name: "Tentar de novo" }).getAttribute("href"),
    ).toBe(DESTINO);
    expect(
      screen.getByRole("link", { name: "Voltar" }).getAttribute("href"),
    ).toBe("/operacoes/energia/termo");
  });

  it("com sessão: renova o acesso vencido antes de pedir o arquivo", async () => {
    window.localStorage.setItem("arp.sessao", "1");
    let renovado = false;
    const falsa = apiFalsa({
      "GET /api/v1/auth/eu": () =>
        renovado ? json(euDeTeste()) : erro(401, "nao_autenticado"),
      "POST /api/v1/auth/renovar": () => {
        renovado = true;
        return json({ sessao: euDeTeste().sessao });
      },
    });
    const ir = abrir();
    expect(ir).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(ir).toHaveBeenCalledWith(DESTINO));
    expect(falsa.quantos("POST /api/v1/auth/renovar")).toBe(1);
  });

  it("link público (por token): não pergunta pela sessão", async () => {
    const falsa = apiFalsa({});
    const ir = abrir({ publica: true });
    await vi.waitFor(() => expect(ir).toHaveBeenCalledWith(DESTINO));
    expect(
      await screen.findByText("O arquivo foi aberto ou baixado"),
    ).toBeTruthy();
    expect(falsa.pedidos).toHaveLength(0);
  });
});
