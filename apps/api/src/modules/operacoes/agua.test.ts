import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contexto } from "@/contexto";

// Locatário do ENET na água: os.lojas é lida pela service role, então a
// permissão é conferida no banco (podeAgora), nunca só pela permissão lida
// no começo da requisição.

const podeAgora = vi.fn<(ctx: Contexto, p: string) => Promise<boolean>>();
const lojas = [{ bloco: "05", luc: "05_112", locatario: "Loja X", nome: "X" }];
const comoServico = vi.fn(async () => lojas);

vi.mock("@/infra/banco", () => ({
  banco: { comoServico, comoUsuario: vi.fn() },
}));
vi.mock("@/infra/arquivos", () => ({
  lerArquivo: async () => null,
  linksDeLeitura: async () => new Map(),
}));
vi.mock("./apoio", () => ({
  BUCKET: "operacoes",
  podeAgora,
  nomesDeUsuarios: async () => new Map(),
  parametrosDoModulo: async () => ({}),
}));

const { indiceEnet } = await import("./agua.service");

const ctx: Contexto = {
  ip: "127.0.0.1",
  agente: null,
  requisicaoId: "teste",
  usuario: { id: "u", nome: "Teste", email: "teste@exemplo.com" },
  permissoes: new Set(),
  senhaProvisoria: false,
  sessao: {
    id: "s",
    inicio: new Date(),
    ultimoUso: new Date(),
    acessoExpiraEm: new Date(),
  },
};

beforeEach(() => {
  podeAgora.mockReset();
  comoServico.mockClear();
});

describe("contratos do ENET para a água", () => {
  it("sem a permissão no banco agora, não lê os.lojas", async () => {
    podeAgora.mockResolvedValue(false);
    expect(await indiceEnet(ctx)).toBeNull();
    expect(podeAgora).toHaveBeenCalledWith(ctx, "operacoes.agua.ver");
    expect(comoServico).not.toHaveBeenCalled();
  });

  it("com a permissão conferida, lê os contratos vigentes", async () => {
    podeAgora.mockResolvedValue(true);
    expect(await indiceEnet(ctx)).not.toBeNull();
    expect(comoServico).toHaveBeenCalled();
  });
});
