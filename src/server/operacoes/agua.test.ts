import { beforeEach, describe, expect, it, vi } from "vitest";

// Locatário do ENET na água: os.lojas é lida pela service role, então a
// permissão é conferida no banco (podeAgora), nunca só pela sessão em cache.

const podeAgora = vi.fn<(p: string) => Promise<boolean>>();
const pode = vi.fn<(p: string) => Promise<boolean>>(async () => true);
const lojas = [{ bloco: "05", luc: "05_112", locatario: "Loja X", nome: "X" }];
const admin = vi.fn(() => ({
  schema: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        range: async () => ({ data: lojas, error: null }),
      };
      return q;
    },
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));
vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));
vi.mock("@/server/auth", () => ({ pode, podeAgora }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: admin }));
vi.mock("@/server/arquivos", () => ({ linksDeLeitura: async () => new Map() }));
vi.mock("@/server/comercial/usuarios", () => ({
  nomesDeUsuarios: async () => new Map(),
}));
vi.mock("./base", () => ({
  falhar: () => {},
  op: async () => null,
  parametros: async () => ({}),
}));

const { contratosEnet } = await import("./agua");

beforeEach(() => {
  podeAgora.mockReset();
  admin.mockClear();
});

describe("contratos do ENET para a água", () => {
  it("sem a permissão no banco agora, não lê os.lojas", async () => {
    podeAgora.mockResolvedValue(false);
    expect(await contratosEnet()).toBeNull();
    expect(podeAgora).toHaveBeenCalledWith("operacoes.agua.ver");
    expect(admin).not.toHaveBeenCalled();
    expect(pode).not.toHaveBeenCalled();
  });

  it("com a permissão conferida, lê os contratos vigentes", async () => {
    podeAgora.mockResolvedValue(true);
    expect(await contratosEnet()).toEqual(lojas);
    expect(admin).toHaveBeenCalled();
  });
});
