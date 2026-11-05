import { formatarData } from "@/lib/formato";
import type { Calendario } from "./prazo";
import { deBrasilia, somarDias } from "./tempo";

// Modelos de entrada e saída de cliente (spec 4.12): um contrato novo (ou a
// saída) vira um Aviso com um destino por item do modelo, cada um com o
// próprio título e prazo, e algumas ações automáticas (vistoria, link do
// portal). Puras: o servidor lê o banco, monta aqui e grava.

export const GATILHOS = {
  entrada: "Entrada de cliente",
  saida: "Saída de cliente",
  manual: "Manual (só pelo botão)",
} as const;
export type Gatilho = keyof typeof GATILHOS;

/** De onde o prazo do item conta, no rótulo do campo. */
export const PRAZO_CONTA_DE: Record<Gatilho, string> = {
  entrada: "dias após o início",
  saida: "dias após a saída",
  manual: "dias após o disparo",
};

export const CONDICOES = {
  sempre: "Sempre",
  tem_vaga: "Só se o contrato tiver vaga",
} as const;
export type Condicao = keyof typeof CONDICOES;

export const ACOES = {
  nenhuma: "Nenhuma",
  vistoria_entrada: "Criar a vistoria de entrada",
  vistoria_saida: "Criar a vistoria de saída",
  portal_gerar: "Conferir o CNPJ para o portal",
  portal_cancelar: "Encerrar o acesso ao portal",
} as const;
export type AcaoItem = keyof typeof ACOES;

/**
 * Janela para achar contrato novo ou saída sem a API do ENET: até lá as
 * lojas são cadastradas à mão, às vezes dias depois do início.
 */
export const JANELA_CONTRATO_DIAS = 30;

export interface ItemDoModelo {
  id: string;
  ordem: number;
  setor_id: string;
  categoria_id: string | null;
  titulo: string;
  descricao: string | null;
  prazo_dias: number;
  responsavel_id: string | null;
  condicao: Condicao;
  acao: AcaoItem;
}

export interface Contrato {
  id: string;
  nome: string;
  luc: string;
  situacao: "vigente" | "encerrado";
  inicio: string | null;
  fim: string | null;
  tem_vaga: boolean | null;
  /** aaaa-mm-dd ou timestamp: quando a linha mudou (encerrado sem data). */
  atualizado_em: string;
}

/** Contrato que começou há pouco (ou vai começar): dispara a entrada. */
export function contratoNovo(c: Contrato, hoje: string): boolean {
  return (
    c.situacao === "vigente" &&
    !!c.inicio &&
    c.inicio >= somarDias(hoje, -JANELA_CONTRATO_DIAS)
  );
}

/**
 * Contrato que saiu há pouco: a data de saída chegou ou foi encerrado. Saída
 * antiga (cadastrada já encerrada) não dispara nada.
 */
export function contratoSaindo(c: Contrato, hoje: string): boolean {
  const desde = somarDias(hoje, -JANELA_CONTRATO_DIAS);
  if (c.fim) return c.fim <= hoje && c.fim >= desde;
  return c.situacao === "encerrado" && c.atualizado_em.slice(0, 10) >= desde;
}

/** Data de referência do modelo: início (entrada), saída ou hoje. */
export function dataDoContrato(
  gatilho: Gatilho,
  c: Pick<Contrato, "inicio" | "fim">,
  hoje: string,
): string {
  if (gatilho === "entrada") return c.inicio ?? hoje;
  if (gatilho === "saida") return c.fim ?? hoje;
  return hoje;
}

/** Itens que valem para o contrato (credenciamento só se tiver vaga). */
export function itensDoContrato(
  itens: ItemDoModelo[],
  c: Pick<Contrato, "tem_vaga">,
): ItemDoModelo[] {
  return [...itens]
    .filter((i) => i.condicao === "sempre" || c.tem_vaga === true)
    .sort((a, b) => a.ordem - b.ordem);
}

export interface DestinoDoAviso {
  itemId: string;
  setorId: string;
  categoriaId: string | null;
  titulo: string;
  prazo: Date;
  responsavelId: string | null;
  acao: AcaoItem;
}

export interface AvisoMontado {
  titulo: string;
  descricao: string;
  /** O prazo do Aviso é o do último destino. */
  prazo: Date | null;
  destinos: DestinoDoAviso[];
}

/** "Entrada de cliente – Café Serra (A012)". */
export function tituloDoAviso(
  modelo: { nome: string },
  c: Pick<Contrato, "nome" | "luc">,
): string {
  return `${modelo.nome} – ${c.nome} (${c.luc})`;
}

/**
 * Monta o Aviso: um destino por item que vale para o contrato, com prazo de
 * N dias corridos a partir da data do contrato, no fim do expediente. Prazo
 * que já passou (contrato cadastrado com atraso) vira o fim de hoje: o
 * aviso nasce para ser feito, não atrasado.
 */
export function montarAviso(
  modelo: { nome: string; gatilho: Gatilho; descricao: string | null },
  itens: ItemDoModelo[],
  c: Contrato,
  hoje: string,
  cal: Pick<Calendario, "expedienteFim">,
): AvisoMontado {
  const base = dataDoContrato(modelo.gatilho, c, hoje);
  const destinos = itensDoContrato(itens, c).map((i) => {
    const dia = somarDias(base, Math.max(0, i.prazo_dias));
    return {
      itemId: i.id,
      setorId: i.setor_id,
      categoriaId: i.categoria_id,
      titulo: i.titulo,
      prazo: deBrasilia(dia < hoje ? hoje : dia, cal.expedienteFim),
      responsavelId: i.responsavel_id,
      acao: i.acao,
    };
  });
  const prazo = destinos.reduce<Date | null>(
    (m, d) => (!m || d.prazo > m ? d.prazo : m),
    null,
  );
  const linhas = [
    modelo.descricao ?? "",
    `Contrato: ${c.nome}, LUC ${c.luc}.`,
    modelo.gatilho === "saida"
      ? `Saída em ${formatarData(base)}.`
      : `Início em ${formatarData(base)}.`,
    "Cada pessoa que recebe marca como lido.",
  ].filter(Boolean);
  return {
    titulo: tituloDoAviso(modelo, c),
    descricao: linhas.join("\n"),
    prazo,
    destinos,
  };
}

/**
 * Setor do Aviso: o da categoria com o nome do modelo (ex.: "Entrada de
 * cliente", do Comercial); senão o Comercial; senão o do primeiro item.
 */
export function setorDoAviso(
  modelo: { nome: string },
  categorias: { id: string; nome: string; setor_id: string; ativo: boolean }[],
  setores: { id: string; nome: string }[],
  itens: Pick<ItemDoModelo, "setor_id">[],
): { setorId: string | null; categoriaId: string | null } {
  const igual = (a: string, b: string) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" }) === 0;
  const cat = categorias.find((c) => c.ativo && igual(c.nome, modelo.nome));
  if (cat) return { setorId: cat.setor_id, categoriaId: cat.id };
  const comercial = setores.find((s) => igual(s.nome, "Comercial"));
  return {
    setorId: comercial?.id ?? itens[0]?.setor_id ?? null,
    categoriaId: null,
  };
}

/** "4 de 6 setores concluíram". */
export function andamentoDoDisparo(destinos: { status: string }[]): {
  concluidos: number;
  total: number;
  texto: string;
} {
  const total = destinos.length;
  const concluidos = destinos.filter((d) => d.status === "concluido").length;
  const texto =
    total === 0
      ? "Sem destinos"
      : `${concluidos} de ${total} ${total === 1 ? "setor concluiu" : "setores concluíram"}`;
  return { concluidos, total, texto };
}
