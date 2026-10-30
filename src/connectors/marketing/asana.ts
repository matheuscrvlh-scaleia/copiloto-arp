import { z } from "zod";
import type { AsanaProjeto, AsanaTarefa } from "@/lib/marketing/fontes";
import { parseWith, requestJson } from "../http";

// Asana (API 1.0) com token de acesso pessoal. Só leitura.

const SISTEMA = "mkt_asana";
const API_URL = "https://app.asana.com/api/1.0";
/** Maior página que a API aceita. */
const LIMITE = 100;

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

const pagina = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    next_page: z.object({ offset: z.string() }).nullable().optional(),
  });

const projetosSchema = pagina(
  z.object({
    gid: z.string(),
    name: z.string(),
    archived: z.boolean().optional(),
  }),
);

const nomeSchema = z.object({ name: z.string() });

const tarefasSchema = pagina(
  z.object({
    gid: z.string(),
    name: z.string(),
    notes: z.string().optional(),
    projects: z.array(z.object({ gid: z.string(), name: z.string() })),
    memberships: z.array(
      z.object({
        project: z.object({ gid: z.string() }).optional(),
        section: nomeSchema.nullable().optional(),
      }),
    ),
    assignee: nomeSchema.nullable(),
    created_at: z.string(),
    due_on: z.string().nullable(),
    start_on: z.string().nullable(),
    completed: z.boolean(),
    completed_at: z.string().nullable(),
    tags: z.array(nomeSchema),
    custom_fields: z.array(
      z.object({
        name: z.string(),
        display_value: z.string().nullable().optional(),
      }),
    ),
    permalink_url: z.string(),
  }),
);

const CAMPOS_TAREFA = [
  "name",
  "projects.name",
  "memberships.project",
  "memberships.section.name",
  "assignee.name",
  "created_at",
  "due_on",
  "start_on",
  "completed",
  "completed_at",
  "tags.name",
  "custom_fields.name",
  "custom_fields.display_value",
  "permalink_url",
].join(",");

export function createAsanaClient(config: AsanaConfig) {
  const ler = (caminho: string, query: Record<string, string | number>) =>
    requestJson(SISTEMA, `${API_URL}${caminho}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      query,
      retries: 1,
      fetch: config.fetch,
    });

  /** Todas as páginas de uma lista, seguindo o `next_page.offset`. */
  async function todas<T extends z.ZodType>(
    schema: ReturnType<typeof pagina<T>>,
    caminho: string,
    query: Record<string, string | number>,
  ): Promise<z.infer<T>[]> {
    const out: z.infer<T>[] = [];
    let offset: string | undefined;
    do {
      const r = parseWith(
        SISTEMA,
        schema,
        await ler(caminho, {
          ...query,
          limit: LIMITE,
          ...(offset && { offset }),
        }),
      );
      out.push(...r.data);
      offset = r.next_page?.offset;
    } while (offset);
    return out;
  }

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
          limit: LIMITE,
          opt_fields: "name",
        }),
      );
      return { projetos: r.data, temMais: Boolean(r.next_page) };
    },
    /** Todos os projetos do workspace, arquivados inclusive. */
    async todosOsProjetos(workspaceGid: string): Promise<AsanaProjeto[]> {
      const lista = await todas(projetosSchema, "/projects", {
        workspace: workspaceGid,
        opt_fields: "name,archived",
      });
      return lista.map((p) => ({
        gid: p.gid,
        name: p.name,
        archived: p.archived ?? false,
      }));
    },
    /**
     * Tarefas do projeto: as abertas e as concluídas desde `concluidasDesde`
     * (ISO). A seção deste projeto vem primeiro em `memberships`; campos
     * personalizados sem valor ficam de fora. `notas` traz a descrição.
     */
    async tarefas(
      projetoGid: string,
      concluidasDesde: string,
      notas = false,
    ): Promise<AsanaTarefa[]> {
      const lista = await todas(
        tarefasSchema,
        `/projects/${projetoGid}/tasks`,
        {
          completed_since: concluidasDesde,
          opt_fields: notas ? `${CAMPOS_TAREFA},notes` : CAMPOS_TAREFA,
        },
      );
      return lista.map(({ memberships, custom_fields, notes, ...t }) => ({
        ...t,
        memberships: memberships
          .filter((m) => m.section)
          .sort(
            (a, b) =>
              Number(b.project?.gid === projetoGid) -
              Number(a.project?.gid === projetoGid),
          )
          .map((m) => ({ section: { name: m.section?.name ?? "" } })),
        custom_fields: custom_fields
          .filter((f) => f.display_value)
          .map((f) => ({
            name: f.name,
            display_value: f.display_value ?? null,
          })),
        ...(notes !== undefined && { notes }),
      }));
    },
  };
}
