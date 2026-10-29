import { z } from "zod";
import { parseWith, requestJson } from "../http";

// Asana (API 1.0) com token de acesso pessoal. Só leitura.

const SISTEMA = "mkt_asana";
const API_URL = "https://app.asana.com/api/1.0";

export interface AsanaConfig {
  token: string;
  fetch?: typeof fetch;
}

const euSchema = z.object({
  data: z.object({
    name: z.string(),
    workspaces: z.array(z.object({ gid: z.string(), name: z.string() })),
  }),
});

const projetosSchema = z.object({
  data: z.array(z.object({ gid: z.string(), name: z.string() })),
  next_page: z.object({ offset: z.string() }).nullable().optional(),
});

export function createAsanaClient(config: AsanaConfig) {
  const ler = (caminho: string, query: Record<string, string | number>) =>
    requestJson(SISTEMA, `${API_URL}${caminho}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      query,
      retries: 1,
      fetch: config.fetch,
    });

  return {
    /** Usuário do token e os workspaces que ele vê. */
    async eu() {
      const r = await ler("/users/me", { opt_fields: "name,workspaces.name" });
      return parseWith(SISTEMA, euSchema, r).data;
    },
    /** Projetos não arquivados do workspace (primeira página, até 100). */
    async projetos(workspaceGid: string) {
      const r = parseWith(
        SISTEMA,
        projetosSchema,
        await ler("/projects", {
          workspace: workspaceGid,
          archived: "false",
          limit: 100,
          opt_fields: "name",
        }),
      );
      return { projetos: r.data, temMais: Boolean(r.next_page) };
    },
  };
}
