import { formatarData, formatarNumero } from "@/lib/formato";
import type { Aviso, Decisao, Periodo, TipoDeImportacao } from "./importacao";

// Rótulos e textos da lista de importações do módulo (spec 4.10 e mockup):
// situação, "o que foi lido", conferências e as pendências da ARP que ainda
// não chegaram ("Aguardando arquivo"). Puro.

export const ROTA_IMPORTACOES_SU =
  "/sustentabilidade/configuracoes/importacoes";
export const rotaDaImportacaoSu = (id: string) =>
  `${ROTA_IMPORTACOES_SU}/${id}`;

export type StatusImportacaoSu =
  | "previa"
  | "confirmada"
  | "desfeita"
  | "substituida";

export const ehStatusSu = (s: string): s is StatusImportacaoSu =>
  ["previa", "confirmada", "desfeita", "substituida"].includes(s);

/** Nome do tipo na lista e na escolha ("Nova importação"). */
export const NOME_DO_TIPO: Record<TipoDeImportacao, string> = {
  entrevistas: "Respostas da entrevista (Questionário RSU)",
  atracoes: "Mercado Local – Atrações",
  produtores: "Mercado Local – Produtores na feira",
  ecocopos: "Mercado Local – Ecocopos",
  quiosque: "Quiosque (Tour Guiado ARP)",
  tour: "Tour guiado",
};

/** O que cada tipo espera do arquivo (texto da escolha). */
export const ARQUIVO_DO_TIPO: Record<TipoDeImportacao, string> = {
  entrevistas:
    'Planilha "Questionário RSU – respostas" baixada do Forms (.xlsx ou .csv): uma linha por entrevista.',
  atracoes:
    'Planilha do Mercado Local: são lidas as abas "Atração 2024", "2025" e "2026".',
  produtores:
    'Planilha do Mercado Local: são lidas as abas "Produtores Feira -25" e "-26".',
  ecocopos: 'Planilha do Mercado Local: são lidas as abas "Souvenir – ARP".',
  quiosque:
    'Planilha "Tour Guiado ARP": são lidas as abas "Quiosque_Nov25" a "Quiosque_Set26".',
  tour: 'Planilha "Tour Guiado ARP": aba principal, "Tour Cervejeiro" e o resumo "Gestão" para conferir.',
};

const NOMES: Record<TipoDeImportacao, [string, string]> = {
  entrevistas: ["entrevista", "entrevistas"],
  atracoes: ["atração", "atrações"],
  produtores: ["participação", "participações"],
  ecocopos: ["lançamento de ecocopos", "lançamentos de ecocopos"],
  quiosque: ["pergunta", "perguntas"],
  tour: ["tour", "tours"],
};

export const contar = (tipo: TipoDeImportacao, n: number) =>
  `${formatarNumero(n)} ${NOMES[tipo][n === 1 ? 0 : 1]}`;

/** "20 entrevistas · 28/04/2026 a 13/10/2026". */
export function descreverLido(
  tipo: TipoDeImportacao,
  linhas: number,
  periodo: Periodo,
): string {
  const p =
    periodo.de && periodo.ate
      ? periodo.de === periodo.ate
        ? formatarData(periodo.de)
        : `${formatarData(periodo.de)} a ${formatarData(periodo.ate)}`
      : null;
  return p ? `${contar(tipo, linhas)} · ${p}` : contar(tipo, linhas);
}

export interface ContagemDeAvisos {
  erro: number;
  aviso: number;
  info: number;
}

export function contarAvisos(avisos: Pick<Aviso, "nivel">[]): ContagemDeAvisos {
  const c = { erro: 0, aviso: 0, info: 0 };
  for (const a of avisos) c[a.nivel]++;
  return c;
}

/** Conferências em poucas palavras (coluna "Conferências" da lista). */
export function resumirConferencias(
  decisoes: Decisao[],
  avisos: ContagemDeAvisos,
): string[] {
  const n = (t: Decisao["tipo"]) => decisoes.filter((d) => d.tipo === t).length;
  const v = n("vincular_contrato");
  const u = n("unificar_nomes");
  const m = n("confirmar_motivo");
  const itens = [
    v &&
      `${formatarNumero(v)} ${v === 1 ? "entrevista pede" : "entrevistas pedem"} vínculo com o contrato`,
    u &&
      `${formatarNumero(u)} ${u === 1 ? "grupo" : "grupos"} de nomes parecidos para unificar`,
    m &&
      `${formatarNumero(m)} ${m === 1 ? "total diferente" : "totais diferentes"} do escrito na planilha`,
    avisos.erro &&
      `${formatarNumero(avisos.erro)} ${avisos.erro === 1 ? "linha não entra" : "linhas não entram"}`,
    avisos.aviso &&
      `${formatarNumero(avisos.aviso)} ${avisos.aviso === 1 ? "aviso" : "avisos"}`,
  ];
  return itens.filter((i): i is string => typeof i === "string");
}

export type SituacaoNaLista =
  | "Prévia"
  | "Importado"
  | "Com avisos"
  | "Desfeita"
  | "Substituída"
  | "Aguardando arquivo";

export function situacaoNaLista(
  status: StatusImportacaoSu,
  conferencias: number,
): SituacaoNaLista {
  if (status === "previa") return "Prévia";
  if (status === "desfeita") return "Desfeita";
  if (status === "substituida") return "Substituída";
  return conferencias ? "Com avisos" : "Importado";
}

/** Planilhas que a ARP ainda não mandou (spec 4.10): até lá, marco inicial. */
export const PENDENCIAS_DA_ARP = [
  { chave: "clube", arquivo: "Planilha do SustentArp e do clube" },
  { chave: "rondas", arquivo: "Planilha das rondas" },
  { chave: "rcc", arquivo: "Planilha do RCC" },
  { chave: "painel", arquivo: "Planilha do painel da área" },
] as const;

export const TEXTO_PENDENCIA =
  "Pendência da ARP. Até chegar, os totais de anos anteriores entram como marco inicial nos Parâmetros.";

/** Aviso com valor em reais (só aparece para quem vê valores). */
export const avisoEmReais = (a: Pick<Aviso, "mensagem">) =>
  /\bresultado lido\b/i.test(a.mensagem);
