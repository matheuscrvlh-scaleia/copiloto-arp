import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LINHAS_POR_PAGINA, lerTudo } from "./supabase-paginas";

/** Imita o PostgREST: corta em `maximo` linhas, como o max_rows. */
function tabela(total: number, maximo = LINHAS_POR_PAGINA) {
  const linhas = Array.from({ length: total }, (_, i) => ({ id: i }));
  const pedidos: [number, number][] = [];
  let montadas = 0;
  const consulta = () => {
    montadas++;
    return {
      range: async (de: number, ate: number) => {
        pedidos.push([de, ate]);
        return {
          data: linhas.slice(de, Math.min(ate + 1, de + maximo)),
          error: null,
        };
      },
    };
  };
  return { linhas, pedidos, consulta, montadas: () => montadas };
}

describe("lerTudo", () => {
  it("tabela vazia: uma consulta só", async () => {
    const t = tabela(0);
    expect(await lerTudo(t.consulta)).toEqual([]);
    expect(t.pedidos).toEqual([[0, 999]]);
  });

  it("menos de uma página: uma consulta só", async () => {
    const t = tabela(10);
    expect(await lerTudo(t.consulta)).toEqual(t.linhas);
    expect(t.pedidos).toEqual([[0, 999]]);
  });

  it("passa de mil: lê todas as páginas, na ordem, sem repetir", async () => {
    const t = tabela(2_345);
    const lidas = await lerTudo(t.consulta);
    expect(lidas).toHaveLength(2_345);
    expect(lidas).toEqual(t.linhas);
    expect(t.pedidos).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("múltiplo exato da página: confere a próxima, que vem vazia", async () => {
    const t = tabela(2_000);
    expect(await lerTudo(t.consulta)).toHaveLength(2_000);
    expect(t.pedidos).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("monta a consulta de novo a cada página", async () => {
    const t = tabela(25);
    await lerTudo(t.consulta, 10);
    expect(t.montadas()).toBe(3);
    expect(t.pedidos).toEqual([
      [0, 9],
      [10, 19],
      [20, 29],
    ]);
  });

  it("data null conta como página vazia", async () => {
    const consulta = () => ({
      range: async () => ({ data: null, error: null }),
    });
    expect(await lerTudo(consulta)).toEqual([]);
  });

  it("erro em qualquer página vira exceção, sem devolver metade", async () => {
    let pagina = 0;
    const consulta = () => ({
      range: async (de: number) =>
        pagina++ === 0
          ? { data: Array.from({ length: 10 }, (_, i) => de + i), error: null }
          : { data: null, error: { message: "timeout" } },
    });
    await expect(lerTudo(consulta, 10)).rejects.toThrow(
      "Falha ao ler o banco: timeout",
    );
  });

  it("recusa tamanho de página inválido", async () => {
    const t = tabela(1);
    await expect(lerTudo(t.consulta, 0)).rejects.toThrow(RangeError);
    await expect(lerTudo(t.consulta, 1.5)).rejects.toThrow(RangeError);
    expect(t.pedidos).toEqual([]);
  });
});
