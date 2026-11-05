import { z } from "zod";
import { parseWith, requestJson } from "./http";

// RD Station CRM (API v2, OAuth do app do CRM na RD Station App Store). É
// outro produto que o RD Station Marketing: cada app só abre um produto. O
// access token vale 2 horas; o refresh token muda a cada renovação (o antigo
// para de valer) e vence com 14 dias sem uso. Só leitura. A negociação traz
// só os ids (funil, etapa, dono, fonte...): os nomes vêm das listas.

const SISTEMA = "rd_crm";
const API_URL = "https://api.rd.services/crm/v2";
const TOKEN_URL = "https://api.rd.services/oauth2/token";
export const AUTORIZAR_URL = "https://accounts.rdstation.com/oauth/authorize";
const POR_PAGINA = 100;
/** A API só entrega os 10 mil primeiros registros de cada lista. */
const MAX_PAGINAS = 100;

const txt = z
  .string()
  .nullish()
  .transform((v) => v ?? "");
const num = z.coerce
  .number()
  .nullish()
  .transform((v) => (Number.isFinite(v) ? (v as number) : 0));
const id = z.union([z.string(), z.number()]).transform(String);
const idOpcional = id.nullish().transform((v) => v ?? null);

const tokensSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
});
export type TokensRdCrm = z.infer<typeof tokensSchema>;

/** Item de lista com id e nome (funil, etapa, usuário, fonte, campanha...). */
const comNome = z.object({ id, name: txt });
export type ItemRdCrm = z.infer<typeof comNome>;

const funilSchema = comNome.extend({
  stage_ids: z
    .array(id)
    .nullish()
    .transform((v) => v ?? []),
});
export type FunilRdCrm = z.infer<typeof funilSchema>;

const campoSchema = z.object({
  id,
  slug: txt,
  label: z.string().nullish(),
  name: z.string().nullish(),
});
export type CampoRdCrm = z.infer<typeof campoSchema>;

const contatoSchema = z.object({
  id,
  name: txt,
  job_title: z.string().nullish(),
  emails: z
    .array(z.object({ email: txt }))
    .nullish()
    .transform((v) => v ?? []),
  phones: z
    .array(z.object({ phone: txt }))
    .nullish()
    .transform((v) => v ?? []),
});
export type ContatoRdCrm = z.infer<typeof contatoSchema>;

const negociacaoSchema = z.object({
  id,
  name: txt,
  rating: num,
  status: z.string().nullish(),
  one_time_price: num,
  recurrence_price: num,
  expected_close_date: z.string().nullish(),
  closed_at: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string().nullish(),
  pipeline_id: idOpcional,
  stage_id: idOpcional,
  owner_id: idOpcional,
  source_id: idOpcional,
  campaign_id: idOpcional,
  lost_reason_id: idOpcional,
  organization_id: idOpcional,
  contact_ids: z
    .array(id)
    .nullish()
    .transform((v) => v ?? []),
  custom_fields: z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((v) => v ?? {}),
});
export type NegociacaoRdCrm = z.infer<typeof negociacaoSchema>;

const paginaSchema = z.object({
  data: z.array(z.unknown()),
  links: z.object({ next: z.string().nullish() }).nullish(),
});

const form = (campos: Record<string, string>) => new URLSearchParams(campos);

async function pedirTokens(campos: Record<string, string>, f?: typeof fetch) {
  return parseWith(
    SISTEMA,
    tokensSchema,
    await requestJson(SISTEMA, TOKEN_URL, {
      method: "POST",
      body: form(campos),
      retries: 1,
      fetch: f,
    }),
  );
}

export interface AppRdCrm {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
}

/** Troca o code da volta da autorização (vale 5 minutos) pelos tokens. */
export const trocarCodigoRdCrm = (
  app: AppRdCrm & { code: string; redirectUri: string },
) =>
  pedirTokens(
    {
      grant_type: "authorization_code",
      client_id: app.clientId,
      client_secret: app.clientSecret,
      code: app.code,
      redirect_uri: app.redirectUri,
    },
    app.fetch,
  );

/** Novo par de tokens: o refresh token antigo deixa de valer. */
export const renovarRdCrm = (app: AppRdCrm & { refreshToken: string }) =>
  pedirTokens(
    {
      grant_type: "refresh_token",
      client_id: app.clientId,
      client_secret: app.clientSecret,
      refresh_token: app.refreshToken,
    },
    app.fetch,
  );

export function createRdCrmClient(config: {
  accessToken: string;
  fetch?: typeof fetch;
}) {
  const ler = (caminho: string, query?: Record<string, string | number>) =>
    requestJson(SISTEMA, `${API_URL}${caminho}`, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
      query,
      retries: 2,
      fetch: config.fetch,
    });

  /** Todas as páginas de uma lista, conferindo cada item no schema. */
  async function listar<T extends z.ZodType>(
    caminho: string,
    schema: T,
  ): Promise<z.infer<T>[]> {
    const out: z.infer<T>[] = [];
    for (let n = 1; n <= MAX_PAGINAS; n++) {
      const p = parseWith(
        SISTEMA,
        paginaSchema,
        await ler(caminho, { "page[number]": n, "page[size]": POR_PAGINA }),
      );
      out.push(...parseWith(SISTEMA, z.array(schema), p.data));
      if (!p.links?.next || p.data.length < POR_PAGINA) break;
    }
    return out;
  }

  return {
    funis: () => listar("/pipelines", funilSchema),
    etapas: (funil: string) =>
      listar(`/pipelines/${encodeURIComponent(funil)}/stages`, comNome),
    usuarios: () => listar("/users", comNome),
    fontes: () => listar("/sources", comNome),
    campanhas: () => listar("/campaigns", comNome),
    motivosDePerda: () => listar("/lost_reasons", comNome),
    empresas: () => listar("/organizations", comNome),
    contatos: () => listar("/contacts", contatoSchema),
    campos: () => listar("/custom_fields", campoSchema),
    negociacoes: () => listar("/deals", negociacaoSchema),
  };
}
