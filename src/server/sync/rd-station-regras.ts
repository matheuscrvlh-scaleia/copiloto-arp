import { createHash } from "node:crypto";
import type {
  RdContatoDaSegmentacao,
  RdEvento,
} from "@/connectors/marketing/rd-station";
import { somarDias } from "@/lib/marketing/periodo";

// Regras puras da sincronização do RD Station: origem de cada conversão,
// etapa do funil em português, linhas do banco e os dias do analytics.

/** Janela lida na primeira vez (a mesma do mockup: 18 semanas). */
export const JANELA_RD_DIAS = 126;
/** O analytics de landing pages do plano Pro só volta 45 dias. */
export const ANALYTICS_DIAS = 44;

export interface Origem {
  origem: string;
  meio: string;
  campanha: string;
}

const BUSCA = /(^|\.)(google|bing|yahoo|duckduckgo|ecosia)\./;
const SOCIAL =
  /(^|\.)(instagram|facebook|fb|tiktok|linkedin|youtube|twitter|x|pinterest|t)\.(com|co|me)/;

/**
 * Origem da sessão que converteu. O RD guarda em traffic_source um
 * "encoded_<base64>" com { first_session, current_session }; o value é a
 * query das UTMs ("utm_source=…&utm_medium=…&utm_campaign=…"), o endereço de
 * onde a pessoa veio ou "(none)" (acesso direto). Nos nomes do GA4, para o
 * canal do lead seguir as mesmas regras do site.
 */
export function origemDaConversao(
  trafficSource: string | null | undefined,
): Origem {
  const vazio = { origem: "", meio: "", campanha: "" };
  if (!trafficSource) return vazio;
  if (!trafficSource.startsWith("encoded_"))
    return { ...vazio, origem: trafficSource.slice(0, 200) };
  let valor = "";
  try {
    const sessoes = JSON.parse(
      Buffer.from(trafficSource.slice("encoded_".length), "base64").toString(
        "utf8",
      ),
    ) as { current_session?: { value?: unknown } };
    valor = String(sessoes.current_session?.value ?? "").trim();
  } catch {
    return vazio;
  }
  if (!valor || valor === "(none)")
    return { origem: "(direct)", meio: "(none)", campanha: "" };
  if (/^https?:\/\//i.test(valor)) {
    let host: string;
    try {
      host = new URL(valor).hostname
        .toLowerCase()
        .replace(/^(www|l|lm|m)\./, "");
    } catch {
      return vazio;
    }
    const nome = host.split(".")[0] ?? host;
    if (BUSCA.test(`.${host}`))
      return { origem: nome, meio: "organic", campanha: "" };
    if (SOCIAL.test(`.${host}`))
      return { origem: nome, meio: "referral", campanha: "" };
    return { origem: host, meio: "referral", campanha: "" };
  }
  const q = new URLSearchParams(valor);
  return {
    origem: (q.get("utm_source") ?? "").trim(),
    meio: (q.get("utm_medium") ?? "").trim(),
    campanha: (q.get("utm_campaign") ?? "").trim(),
  };
}

const ETAPAS: Record<string, string> = {
  lead: "Lead",
  "qualified lead": "Lead qualificado",
  client: "Cliente",
};

/** lifecycle_stage do RD → etapa nos nomes das telas ('' se desconhecida). */
export function etapaEmPortugues(stage: string): string {
  return ETAPAS[stage.trim().toLowerCase()] ?? stage.trim();
}

export interface LinhaConversao extends Origem {
  id: string;
  contato_uuid: string;
  identificador: string;
  convertido_em: string;
}

/** Conversão do contato como linha do banco (id estável: reler não duplica). */
export function linhaDaConversao(contato: string, e: RdEvento): LinhaConversao {
  const id = createHash("sha256")
    .update(`${contato}|${e.event_identifier}|${e.event_timestamp}`)
    .digest("base64url")
    .slice(0, 32);
  return {
    id,
    contato_uuid: contato,
    identificador: e.event_identifier,
    convertido_em: e.event_timestamp,
    ...origemDaConversao(e.payload?.traffic_source),
  };
}

export interface LinhaContato {
  uuid: string;
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  uf: string;
  tags: string[];
  etapa: string;
  criado_em: string | null;
  ultima_conversao: string | null;
  atualizado_em: string;
}

/**
 * Contato como linha do banco, com o que vem da segmentação. Cidade, UF e
 * tags ficam vazias: no RD da ARP os formulários não pedem cidade, e ler o
 * contato um a um custaria mais uma chamada por lead (conferido em 29/10).
 */
export function linhaDoContato(
  s: RdContatoDaSegmentacao,
  etapa: string,
  agora: Date,
): LinhaContato {
  return {
    uuid: s.uuid,
    nome: s.name,
    email: s.email,
    telefone: s.phone,
    cidade: "",
    uf: "",
    tags: [],
    etapa: etapaEmPortugues(etapa),
    criado_em: s.created_at ?? null,
    ultima_conversao: s.last_conversion_date ?? null,
    atualizado_em: agora.toISOString(),
  };
}

/**
 * Dias do analytics a ler: da última foto menos 2 (o RD consolida em até
 * 24 h) até ontem, sem passar dos 45 dias que o plano deixa.
 */
export function diasDoAnalytics(
  hoje: string,
  ultimoDia: string | null,
): string[] {
  const ontem = somarDias(hoje, -1);
  const limite = somarDias(hoje, -ANALYTICS_DIAS);
  const de =
    ultimoDia && somarDias(ultimoDia, -2) > limite
      ? somarDias(ultimoDia, -2)
      : limite;
  const dias: string[] = [];
  for (let d = de; d <= ontem; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

/** O contato precisa ser relido? (Novo, ou converteu de novo desde a última leitura.) */
export function precisaReler(
  s: RdContatoDaSegmentacao,
  salvo: string | null | undefined,
): boolean {
  if (salvo === undefined) return true;
  if (!s.last_conversion_date || !salvo)
    return salvo !== s.last_conversion_date;
  return (
    new Date(s.last_conversion_date).getTime() !== new Date(salvo).getTime()
  );
}
