import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { criarClienteDeConsultas } from "@/lib/consulta";
import { ProvedorDaSessao } from "@/lib/sessao";
import { apiFalsa, euDeTeste, json } from "@/teste/api-falsa";
import Caixa from "./paginas/caixa";

// Minha caixa (/os) com a API falsa: a lista lê os filtros da URL, mostra a
// linha que a API devolve e os cartões; sem os.acessar, só o aviso (e nada
// é pedido à API).

const SETOR = "00000000-0000-4000-8000-000000000001";
const CHAMADO = "00000000-0000-4000-8000-000000000002";

const APOIO = {
  setores: [
    {
      id: SETOR,
      nome: "Manutenção",
      cor: "#2a78d6",
      icone: "wrench",
      ativo: true,
      ordem: 1,
    },
  ],
  categorias: [],
  pessoas: [],
  meusSetores: [SETOR],
  gestorDe: [],
  avisoHoras: 24,
};

const LINHA = {
  id: CHAMADO,
  numero: 42,
  tipo: "solicitacao",
  origem: "sistema",
  titulo: "Trocar a lâmpada do corredor",
  status: "aberto",
  prioridade: "media",
  prazo: null,
  setorId: SETOR,
  setor: "Manutenção",
  setorCor: "#2a78d6",
  categoriaId: null,
  categoria: null,
  responsavelId: null,
  responsavel: null,
  abertoPor: null,
  solicitante: "Pessoa de Teste",
  etiquetas: [],
  aguardando: null,
  pessoal: false,
  precisaConfirmacao: true,
  concluidoEm: null,
  fechadoEm: null,
  criadoEm: "2026-11-16T12:00:00.000Z",
  soNoCartao: false,
  podeAtribuir: false,
  podePrazo: false,
  destinos: null,
};

const LISTA = {
  tela: "caixa",
  filtros: { prioridade: "media" },
  lembrados: false,
  disponiveis: [],
  setores: [],
  linhas: [LINHA],
  total: 1,
  pagina: 1,
  cartoes: {
    atrasados: 0,
    vence_hoje: 0,
    aguardando_confirmacao: 0,
    em_andamento: 0,
  },
  carga: null,
  agora: "2026-11-16T13:32:00.000Z",
};

function abrir(permissoes: string[]) {
  render(
    <QueryClientProvider client={criarClienteDeConsultas()}>
      <ProvedorDaSessao eu={euDeTeste(permissoes)}>
        <MemoryRouter initialEntries={["/os?prioridade=media"]}>
          <Caixa />
        </MemoryRouter>
      </ProvedorDaSessao>
    </QueryClientProvider>,
  );
}

describe("/os (Minha caixa)", () => {
  it("pede a lista com os filtros da URL e mostra o chamado", async () => {
    const api = apiFalsa({
      "GET /api/v1/os/apoio": json(APOIO),
      "GET /api/v1/os/visoes/lista?prioridade=media&tela=caixa": json(LISTA),
      "GET /api/v1/os/visoes/seu-dia": json({ resumo: null }),
    });
    abrir(["os.acessar"]);
    // O apoio e a lista chegam um depois do outro; a linha aparece na
    // tabela e na versão de celular.
    const linhas = await screen.findAllByText(
      /Trocar a lâmpada do corredor/,
      {},
      { timeout: 4000 },
    );
    expect(linhas.length).toBeGreaterThan(0);
    expect(screen.getByText("10:32")).toBeTruthy();
    expect(
      api.quantos("GET /api/v1/os/visoes/lista?prioridade=media&tela=caixa"),
    ).toBe(1);
  });

  it("sem os.acessar mostra o aviso e não chama a API", async () => {
    const api = apiFalsa({});
    abrir([]);
    expect(
      await screen.findByText(/Você não tem acesso a esta tela/),
    ).toBeTruthy();
    expect(api.pedidos).toEqual([]);
  });
});
