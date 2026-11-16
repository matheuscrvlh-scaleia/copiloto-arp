import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { criarClienteDeConsultas } from "@/lib/consulta";
import { ProvedorDaSessao } from "@/lib/sessao";
import { apiFalsa, euDeTeste, json } from "@/teste/api-falsa";
import Agenda from "./paginas/agenda";

// A agenda pela URL (visão Dia) com a API falsa: o item chega, a legenda
// conta, e quem não tem calendario.ver vê o aviso sem chamar a API.

const TIPO = {
  id: "00000000-0000-4000-8000-000000000001",
  nome: "Reunião",
  descricao: null,
  cor: "#2a78d6",
  icone: "reuniao",
  usa_horario: true,
  usa_periodo: false,
  usa_local: true,
  usa_responsavel: true,
  usa_conclusao: false,
  usa_recorrencia: true,
  visibilidade_padrao: "todos",
  ordem: 1,
  ativo: true,
};

const ITEM = {
  id: "00000000-0000-4000-8000-000000000002",
  tipo_id: TIPO.id,
  titulo: "Alinhamento semanal",
  descricao: null,
  local: "Sala 1",
  inicio: "2026-11-16",
  fim: "2026-11-16",
  hora_inicio: "09:00:00",
  hora_fim: null,
  responsavel_id: null,
  concluido_em: null,
  recorrencia: null,
  recorrencia_ate: null,
  visibilidade: "todos",
  setores: [],
  cargos: [],
  usuarios: [],
  criado_por: null,
  podeEditar: false,
  podeConcluir: false,
};

function abrir(permissoes: string[]) {
  render(
    <QueryClientProvider client={criarClienteDeConsultas()}>
      <ProvedorDaSessao eu={euDeTeste(permissoes)}>
        <MemoryRouter
          initialEntries={["/calendario?visao=dia&data=2026-11-16"]}
        >
          <Agenda />
        </MemoryRouter>
      </ProvedorDaSessao>
    </QueryClientProvider>,
  );
}

describe("/calendario", () => {
  it("mostra os itens do dia pedido na URL", async () => {
    const api = apiFalsa({
      "GET /api/v1/calendario/tipos": json({ tipos: [TIPO] }),
      "GET /api/v1/calendario/publico": json({
        setores: [],
        cargos: [],
        pessoas: [],
      }),
      "GET /api/v1/calendario/itens?de=2026-11-16&ate=2026-11-16": json({
        itens: [ITEM],
      }),
    });
    abrir(["calendario.ver"]);
    expect(
      (await screen.findAllByText("Alinhamento semanal")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^Reunião\s*1$/ })).toBeTruthy();
    // Sem calendario.criar, não aparece "Novo".
    expect(screen.queryByRole("button", { name: "Novo" })).toBeNull();
    expect(
      api.quantos("GET /api/v1/calendario/itens?de=2026-11-16&ate=2026-11-16"),
    ).toBe(1);
  });

  it("sem calendario.ver: o aviso, sem chamar a API", async () => {
    const api = apiFalsa({});
    abrir([]);
    expect(await screen.findByText(/Você não tem acesso/)).toBeTruthy();
    expect(api.pedidos).toHaveLength(0);
  });
});
