import type {
  CampoRdCrm,
  ContatoRdCrm,
  ItemRdCrm,
  NegociacaoRdCrm,
} from "@/connectors/rd-crm";
import type { RdContatoCrm, RdOportunidade, RdRef } from "./fontes";

// Negociação da API v2 do RD Station CRM → formato das telas do Comercial.
// A v2 manda só ids; os nomes vêm das listas (Cadastros). Contatos ficam à
// parte: vão para a coluna que só o servidor lê.

export interface CadastrosRdCrm {
  funis: ItemRdCrm[];
  etapas: ItemRdCrm[];
  usuarios: ItemRdCrm[];
  fontes: ItemRdCrm[];
  campanhas: ItemRdCrm[];
  motivos: ItemRdCrm[];
  empresas: ItemRdCrm[];
  campos: CampoRdCrm[];
  contatos: ContatoRdCrm[];
}

const porId = (xs: ItemRdCrm[]) =>
  new Map(xs.map((x) => [x.id, { _id: x.id, name: x.name }]));

const texto = (v: unknown): string | null =>
  v === null || v === undefined || v === ""
    ? null
    : Array.isArray(v)
      ? v.map(String).join(", ")
      : String(v);

export interface OportunidadeGravada {
  id: string;
  dados: Omit<RdOportunidade, "contacts">;
  contatos: RdContatoCrm[];
}

/** Monta as oportunidades com os nomes dos cadastros. */
export function oportunidadesDoCrm(
  negociacoes: NegociacaoRdCrm[],
  c: CadastrosRdCrm,
): OportunidadeGravada[] {
  const funis = porId(c.funis);
  const etapas = porId(c.etapas);
  const usuarios = porId(c.usuarios);
  const fontes = porId(c.fontes);
  const campanhas = porId(c.campanhas);
  const motivos = porId(c.motivos);
  const empresas = porId(c.empresas);
  const rotulo = new Map(
    c.campos.map((f) => [
      f.slug,
      { _id: f.id, label: f.label ?? f.name ?? f.slug },
    ]),
  );
  const contatos = new Map(c.contatos.map((x) => [x.id, x]));
  const ref = (m: Map<string, RdRef>, i: string | null): RdRef | null =>
    i ? (m.get(i) ?? { _id: i, name: "" }) : null;
  const SEM: RdRef = { _id: "", name: "" };

  return negociacoes.map((n) => ({
    id: n.id,
    dados: {
      _id: n.id,
      name: n.name,
      organization: ref(empresas, n.organization_id),
      rating: n.rating,
      deal_pipeline: ref(funis, n.pipeline_id) ?? SEM,
      deal_stage: ref(etapas, n.stage_id) ?? SEM,
      win: n.status === "won" ? true : n.status === "lost" ? false : null,
      deal_lost_reason: ref(motivos, n.lost_reason_id),
      deal_lost_note: null,
      amount_unique: n.one_time_price,
      amount_montly: n.recurrence_price,
      hold: n.status === "paused",
      created_at: n.created_at,
      first_activity_at: null,
      last_activity_at: null,
      next_task: null,
      prediction_date: n.expected_close_date?.slice(0, 10) ?? null,
      closed_at: n.closed_at ?? null,
      deal_source: ref(fontes, n.source_id),
      campaign: ref(campanhas, n.campaign_id),
      user: ref(usuarios, n.owner_id) ?? SEM,
      deal_custom_fields: Object.entries(n.custom_fields).map(
        ([slug, valor]) => ({
          custom_field: rotulo.get(slug) ?? { _id: slug, label: slug },
          value: texto(valor),
        }),
      ),
    },
    contatos: n.contact_ids.flatMap((i) => {
      const x = contatos.get(i);
      return x
        ? [
            {
              name: x.name,
              title: x.job_title ?? null,
              emails: x.emails,
              phones: x.phones,
            },
          ]
        : [];
    }),
  }));
}
