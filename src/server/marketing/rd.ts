import "server-only";
import type {
  RdContato,
  RdConversao,
  RdLandingPageDia,
} from "@/lib/marketing/fontes";
import { paraBrasilia } from "@/lib/os/tempo";
import { createAdminClient } from "@/lib/supabase/admin";
import { contextoMkt, mkt } from "./base";
import type { DadosRd } from "./exemplo/rd";

// RD Station com dados reais: o que a sincronização gravou (src/server/sync/
// rd-station.ts), no formato que as telas já usam (lib/marketing/fontes.ts).
// Lido com a sessão: o RLS só entrega contato (dado pessoal) a quem vê Site
// e leads, e nome, e-mail e telefone só saem com marketing.site.dados_lead.

const PAGINA = 1000;

/** Todas as linhas, de 1000 em 1000 (limite da API do banco). */
async function todas<T>(
  ler: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await ler(de, de + PAGINA - 1);
    if (error) throw new Error(`Falha ao ler o RD gravado: ${error.message}`);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGINA) return out;
  }
}

/** Instante do banco (UTC) → "aaaa-mm-ddThh:mm:00-03:00", como as telas comparam. */
function emBrasilia(iso: string | null): string {
  if (!iso) return "";
  const { data, hora } = paraBrasilia(new Date(iso));
  return `${data}T${hora}:00-03:00`;
}

/** Quando a última sincronização do RD terminou; null se nunca rodou. */
async function ultimaLeitura(): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .schema("integracao")
    .from("sync_runs")
    .select("finalizado_em")
    .eq("sistema", "mkt_rd_station")
    .eq("status", "sucesso")
    .order("finalizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler a sincronização: ${error.message}`);
  return data?.finalizado_em ?? null;
}

/** Dados reais do RD, ou null se o RD ainda não foi sincronizado. */
export async function rdReal(): Promise<DadosRd | null> {
  // Confere o acesso ao módulo antes da service role (ultimaLeitura).
  const ctx = await contextoMkt();
  if (!ctx.usuario.permissoes.some((p) => p.startsWith("marketing.")))
    throw new Error("Sem acesso ao módulo Marketing.");
  const lidoEm = await ultimaLeitura();
  if (!lidoEm) return null;
  const db = await mkt();
  const pessoal = ctx.pode("marketing.site.dados_lead");

  const [contatos, conversoes, lps] = await Promise.all([
    todas((de, ate) =>
      db
        .from("rd_contatos")
        .select(
          "uuid, nome, email, telefone, cidade, uf, tags, etapa, criado_em",
        )
        .order("uuid")
        .range(de, ate),
    ),
    todas((de, ate) =>
      db
        .from("rd_conversoes")
        .select(
          "id, contato_uuid, identificador, convertido_em, origem, meio, campanha",
        )
        .order("id")
        .range(de, ate),
    ),
    todas((de, ate) =>
      db
        .from("rd_landing_pages_dia")
        .select("identificador, dia, nome, visitas, conversoes")
        .order("dia")
        .order("identificador")
        .range(de, ate),
    ),
  ]);

  return {
    lidoEm,
    contatos: contatos.map(
      (c): RdContato => ({
        uuid: c.uuid,
        name: pessoal ? c.nome : "",
        email: pessoal ? c.email : "",
        mobile_phone: pessoal ? c.telefone : "",
        city: c.cidade,
        state: c.uf,
        tags: c.tags,
        created_at: emBrasilia(c.criado_em),
        lifecycle_stage: c.etapa,
      }),
    ),
    conversoes: conversoes
      .map(
        (c): RdConversao => ({
          event_uuid: c.id,
          contact_uuid: c.contato_uuid,
          conversion_identifier: c.identificador,
          created_at: emBrasilia(c.convertido_em),
          traffic_source: c.origem,
          traffic_medium: c.meio,
          traffic_campaign: c.campanha,
        }),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    landingPages: lps.map(
      (l): RdLandingPageDia => ({
        conversion_identifier: l.identificador,
        nome: l.nome || l.identificador,
        date: l.dia,
        visits_count: l.visitas,
        conversion_count: l.conversoes,
      }),
    ),
  };
}
