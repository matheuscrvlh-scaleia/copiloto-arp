import { ehPermissaoDePrograma, PERMISSOES } from "@arp/shared/permissions";
import { sql } from "kysely";
import { afterAll, expect, it } from "vitest";
import { banco } from "@/infra/banco";
import { descreverComBanco } from "@/testes/apoio";

// Veio de packages/shared (permissions.test.ts do sistema antigo, que lia o
// catálogo das migrations): com a base clonada, o catálogo só está no banco.
// As permissões por programa (`sustentabilidade.programa.<id>`) são criadas
// pelo gatilho, uma por programa, e ficam fora do catálogo fixo.

descreverComBanco("catálogo de permissões", () => {
  afterAll(() => banco.encerrar());

  it("é o mesmo no código e no banco", async () => {
    const noBanco = await banco.comoServico(async (tx) => {
      const r = await sql<{
        codigo: string;
      }>`select codigo from core.permissoes order by codigo`.execute(tx);
      return r.rows
        .map((l) => l.codigo)
        .filter((c) => !ehPermissaoDePrograma(c));
    });
    expect(noBanco.sort()).toEqual(Object.keys(PERMISSOES).sort());
  });
});
