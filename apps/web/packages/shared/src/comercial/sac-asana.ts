import type { AsanaTarefa } from "../marketing/fontes";
import { paraBrasilia } from "../os/tempo";

// Registros do SAC no Asana (projeto "SAC - Relacionamentos - Feedbacks
// Relacionamento", escolhido nos parâmetros) → contatos do Relacionamento.
// Cada tarefa vira um contato só de leitura, ligado pela tarefa (asana_gid):
// reler atualiza o mesmo registro. Os nomes dos campos são os do projeto.

const CAMPOS_DATA = [
  "Data do Registro",
  "Data do Último Contato",
  "Data da Reclamação",
];
const CAMPOS_DESCRICAO = [
  "Assunto (s) ou Tema (s) Principais",
  "Observação e Anotações",
  "Observação",
];
const CAMPOS_SETOR = ["Setor", "Setorização"];
/** Setor do próprio Relacionamento: não precisa de outro setor. */
const SETOR_PROPRIO = "comercial";

export const TIPO_RECLAMACAO = "Reclamação";
export const TIPO_ATENDIMENTO = "Atendimento";
export const CANAL_SEM_INFORMACAO = "Não informado";

export interface ContatoDoSac {
  asana_gid: string;
  asana_url: string;
  data: string;
  locatario_nome: string;
  luc: string | null;
  bloco: string | null;
  tipo: string;
  canal: string;
  descricao: string;
  precisa_outro_setor: boolean;
}

const limpo = (v: string | null | undefined) => v?.trim() || null;

function campo(t: AsanaTarefa, nome: string): string | null {
  const alvo = nome.trim().toLowerCase();
  return limpo(
    t.custom_fields.find((f) => f.name.trim().toLowerCase() === alvo)
      ?.display_value,
  );
}

const primeiro = (t: AsanaTarefa, nomes: string[]) =>
  nomes.map((n) => campo(t, n)).find((v) => v !== null) ?? null;

/** "2026-03-05" ou "2026-03-05T…" → "2026-03-05"; outro formato, null. */
function dia(v: string | null): string | null {
  const m = v?.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

/** Converte a tarefa; sem nome, fica de fora (null). */
export function contatoDoSac(t: AsanaTarefa): ContatoDoSac | null {
  const nome = limpo(t.name);
  if (!nome) return null;
  const data =
    CAMPOS_DATA.map((c) => dia(campo(t, c))).find((d) => d !== null) ??
    paraBrasilia(new Date(t.created_at)).data;
  const partes = [
    ...CAMPOS_DESCRICAO.map((c) => campo(t, c)),
    limpo(t.notes),
  ].filter((p): p is string => p !== null);
  const descricao = [...new Set(partes)].join("\n\n") || nome;
  const setor = primeiro(t, CAMPOS_SETOR);
  const reclamacao =
    campo(t, "Data da Reclamação") !== null ||
    campo(t, "Classificação") !== null;
  return {
    asana_gid: t.gid,
    asana_url: t.permalink_url,
    data,
    locatario_nome: nome.slice(0, 200),
    luc: campo(t, "Imóvel (LUC)"),
    bloco: primeiro(t, ["Bloco", "Local"]),
    tipo: reclamacao ? TIPO_RECLAMACAO : TIPO_ATENDIMENTO,
    canal: campo(t, "Canal Utilizado") ?? CANAL_SEM_INFORMACAO,
    descricao: descricao.slice(0, 4000),
    precisa_outro_setor:
      setor !== null && setor.toLowerCase() !== SETOR_PROPRIO,
  };
}
