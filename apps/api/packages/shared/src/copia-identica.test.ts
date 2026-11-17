import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// apps/api e apps/web têm cada um a sua cópia desta pasta (cada app é
// independente). Os contratos precisam ser os mesmos dos dois lados: toda
// mudança aqui vai, igual, para a outra cópia.

const RAIZ = join(import.meta.dirname, "../../../../..");
const API = join(RAIZ, "apps/api/packages/shared");
const WEB = join(RAIZ, "apps/web/packages/shared");

function conteudo(pasta: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of readdirSync(pasta, { recursive: true, encoding: "utf8" }))
    if (!f.includes("node_modules") && f.includes("."))
      m.set(
        f.replaceAll("\\", "/"),
        readFileSync(join(pasta, f), "utf8").replaceAll("\r\n", "\n"),
      );
  return m;
}

describe.skipIf(!existsSync(API) || !existsSync(WEB))("packages/shared", () => {
  it("é igual em apps/api e apps/web", () => {
    const api = conteudo(API);
    const web = conteudo(WEB);
    const nomes = new Set([...api.keys(), ...web.keys()]);
    const diferentes = [...nomes].filter((n) => api.get(n) !== web.get(n));
    expect(diferentes).toEqual([]);
  });
});
