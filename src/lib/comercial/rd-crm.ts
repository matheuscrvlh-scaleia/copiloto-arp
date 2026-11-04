import type { RdCrmFunil, RdCrmOportunidade } from "@/connectors/rd-crm";
import type { RdOportunidade, RdRef } from "./fontes";

// Oportunidade da API do RD Station CRM → formato das telas do Comercial.
// O funil sai da própria oportunidade ou, sem ele, da etapa (lista de funis).

const SEM: RdRef = { _id: "", name: "" };

export function oportunidadeDoCrm(
  o: RdCrmOportunidade,
  funilDaEtapa: ReadonlyMap<string, RdRef>,
): RdOportunidade {
  const etapa = o.deal_stage
    ? { _id: o.deal_stage._id, name: o.deal_stage.name }
    : SEM;
  const funil =
    o.deal_pipeline ??
    funilDaEtapa.get(etapa._id) ??
    (o.deal_stage?.deal_pipeline_id
      ? { _id: o.deal_stage.deal_pipeline_id, name: "" }
      : SEM);
  return {
    _id: o._id ?? o.id ?? "",
    name: o.name,
    organization: o.organization ?? null,
    rating: o.rating,
    deal_pipeline: funil,
    deal_stage: etapa,
    win: o.win ?? null,
    deal_lost_reason: o.deal_lost_reason ?? null,
    deal_lost_note: o.deal_lost_note ?? null,
    amount_unique: o.amount_unique,
    amount_montly: o.amount_montly,
    hold: o.hold ?? false,
    created_at: o.created_at,
    first_activity_at: null,
    last_activity_at: o.last_activity_at ?? null,
    next_task: o.next_task?.date
      ? { date: o.next_task.date, subject: o.next_task.subject }
      : null,
    prediction_date: o.prediction_date?.slice(0, 10) ?? null,
    closed_at: o.closed_at ?? null,
    deal_source: o.deal_source ?? null,
    campaign: o.campaign ?? null,
    user: o.user ?? SEM,
    deal_custom_fields: (o.deal_custom_fields ?? []).flatMap((c) =>
      c.custom_field
        ? [
            {
              custom_field: {
                _id: c.custom_field._id ?? "",
                label: c.custom_field.label,
              },
              value: c.value,
            },
          ]
        : [],
    ),
    contacts: (o.contacts ?? []).map((c) => ({
      name: c.name,
      title: c.title ?? null,
      emails: c.emails,
      phones: c.phones,
    })),
  };
}

/** Etapa → funil, pela lista de funis do CRM. */
export function funilPorEtapa(funis: RdCrmFunil[]): Map<string, RdRef> {
  const m = new Map<string, RdRef>();
  for (const f of funis)
    for (const e of f.deal_stages) m.set(e._id, { _id: f._id, name: f.name });
  return m;
}
