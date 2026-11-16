import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { criarClienteDeConsultas } from "@/lib/consulta";
import { apiFalsa, erro, json } from "@/teste/api-falsa";
import Responder from "./paginas/responder";

// /responder/:token sem login, com a API falsa: link fechado mostra o
// motivo; o envio manda as respostas e mostra o agradecimento; o link que
// fechou no meio troca a tela pelo aviso.

const TOKEN = "a".repeat(48);
const LINK = `/api/v1/relatorios/publico/${TOKEN}`;

const FORMULARIO = {
  titulo: "Pesquisa de teste",
  descricao: "",
  campos: [
    {
      id: "nome0001",
      tipo: "texto",
      titulo: "Seu nome",
      obrigatorio: true,
    },
  ],
  mensagem_final: "Recebemos, obrigado!",
  token: TOKEN,
  cor: "#171717",
  paginas: false,
  redirecionar_para: null,
};

function abrir() {
  render(
    <QueryClientProvider client={criarClienteDeConsultas()}>
      <MemoryRouter initialEntries={[`/responder/${TOKEN}`]}>
        <Routes>
          <Route path="responder/:token" element={<Responder />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function responder() {
  fireEvent.change(await screen.findByLabelText(/Seu nome/), {
    target: { value: "Pessoa de teste" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Enviar/ }));
}

describe("/responder/:token", () => {
  it("link encerrado: o motivo", async () => {
    apiFalsa({ [`GET ${LINK}`]: json({ motivo: "encerrado" }) });
    abrir();
    expect(await screen.findByText("Formulário encerrado")).toBeTruthy();
  });

  it("envia as respostas e agradece", async () => {
    const api = apiFalsa({
      [`GET ${LINK}`]: json({ formulario: FORMULARIO }),
      [`POST ${LINK}/respostas`]: json({ enviado: true }),
    });
    abrir();
    await responder();
    expect(await screen.findByText("Recebemos, obrigado!")).toBeTruthy();
    const envio = api.pedidos.find((p) => p.metodo === "POST");
    expect(JSON.parse(String(envio?.corpo))).toMatchObject({
      respostas: JSON.stringify({ nome0001: "Pessoa de teste" }),
    });
  });

  it("link que fechou no meio: troca pelo aviso", async () => {
    apiFalsa({
      [`GET ${LINK}`]: json({ formulario: FORMULARIO }),
      [`POST ${LINK}/respostas`]: erro(
        409,
        "conflito",
        "Este formulário não recebe mais respostas.",
      ),
    });
    abrir();
    await responder();
    expect(await screen.findByText("Formulário fechado")).toBeTruthy();
  });
});
