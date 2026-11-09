import { describe, expect, it, vi } from "vitest";

// Conferência de arquivo repetido (sha256) das importações. Sem banco: um
// cliente falso grava os filtros pedidos e devolve a resposta escolhida.

vi.mock("server-only", () => ({}));
vi.mock("@/server/arquivos", () => ({ linkDeLeitura: async () => null }));
vi.mock("@/server/comercial/usuarios", () => ({
  nomesDeUsuarios: async () => new Map(),
}));
vi.mock("./base", () => ({ falhar: () => {}, op: async () => null }));

const { importacaoDoArquivo } = await import("./importacoes");

function clienteFalso(resposta: { data: unknown; error: unknown }) {
  const filtros: [string, unknown[]][] = [];
  const consulta: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "contains", "order", "limit"])
    consulta[m] = (...args: unknown[]) => {
      filtros.push([m, args]);
      return consulta;
    };
  consulta.maybeSingle = async () => resposta;
  const db = { from: () => consulta } as unknown as Parameters<
    typeof importacaoDoArquivo
  >[0];
  return { db, filtros };
}

describe("importação com o mesmo arquivo", () => {
  it("filtra o jsonb pelo sha256 em texto JSON (não array do Postgres)", async () => {
    const { db, filtros } = clienteFalso({ data: null, error: null });
    expect(
      await importacaoDoArquivo(db, "limpeza", "abc", ["confirmada"]),
    ).toBeNull();
    expect(filtros).toContainEqual([
      "contains",
      ["arquivos", '[{"sha256":"abc"}]'],
    ]);
    expect(filtros).toContainEqual(["in", ["status", ["confirmada"]]]);
    expect(filtros).toContainEqual(["eq", ["tipo", "limpeza"]]);
  });

  it("devolve a importação achada", async () => {
    const achada = { id: "i1", status: "confirmada", referencia: "x" };
    const { db } = clienteFalso({ data: achada, error: null });
    expect(await importacaoDoArquivo(db, "orcamento", "abc")).toEqual(achada);
  });

  it("erro do banco sobe (quem chama recusa em vez de seguir sem conferir)", async () => {
    const erro = { message: "invalid input syntax for type json" };
    const { db } = clienteFalso({ data: null, error: erro });
    await expect(importacaoDoArquivo(db, "limpeza", "abc")).rejects.toBe(erro);
  });
});
