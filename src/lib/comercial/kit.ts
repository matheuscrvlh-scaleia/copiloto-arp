import { diasEntre } from "@/lib/comercial/datas";

// Kit de entrega (spec 4.14): situação da validade de cada documento e o que
// vai no contrato de um LUC (os "vai em todo contrato" + os mapas de
// fachada do bloco do LUC; nunca mapa de outro bloco).

export type SituacaoKit = "valido" | "vence" | "vencido" | "sem_validade";

/** Rótulos da tela; `dias` é a antecedência do aviso (parâmetro). */
export function rotuloSituacao(s: SituacaoKit, dias: number): string {
  return {
    valido: "Válido",
    vence: `Vence em ${dias} dias`,
    vencido: "Vencido",
    sem_validade: "Sem validade",
  }[s];
}

/** Vencido se a validade já passou; "vence" se faltam até `avisoDias`. */
export function situacaoDaValidade(
  validade: string | null,
  hoje: string,
  avisoDias: number,
): SituacaoKit {
  if (!validade) return "sem_validade";
  if (validade < hoje) return "vencido";
  return diasEntre(hoje, validade) <= avisoDias ? "vence" : "valido";
}

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Código do bloco para comparar: "Bloco 03", "BL 3" e "03" viram "3";
 * "Casarão" vira "casarao"; "QQ Praça" vira "qq praca".
 */
export function codigoDoBloco(texto: string): string {
  const t = semAcento(texto)
    .replace(/^(bloco|bl)\.?\s*/, "")
    .replace(/\s+/g, " ");
  return /^\d+$/.test(t) ? String(Number(t)) : t;
}

/** Bloco do LUC do ENET ("Bloco 11" → "11"; o Casarão é bloco próprio). */
export function blocoDoLuc(luc: {
  local: string;
  tipo_loja: string;
}): string | null {
  if (/^bloco\s/i.test(luc.local)) return codigoDoBloco(luc.local);
  if (semAcento(luc.tipo_loja) === "casarao") return "Casarão";
  return null;
}

export interface DocumentoDoKit {
  ativo: boolean;
  todo_contrato: boolean;
  /** Só mapas de fachada: blocos atendidos. */
  blocos: string[];
  ordem: number;
}

/** O documento atende o bloco (mapa com o bloco na lista). */
export function atendeBloco(d: DocumentoDoKit, bloco: string | null): boolean {
  if (!bloco) return false;
  const alvo = codigoDoBloco(bloco);
  return d.blocos.some((b) => codigoDoBloco(b) === alvo);
}

/** O que vai no contrato do bloco: "vai em todo contrato" + mapas do bloco. */
export function itensDoKit<T extends DocumentoDoKit>(
  documentos: T[],
  bloco: string | null,
): T[] {
  return documentos
    .filter((d) => d.ativo && (d.todo_contrato || atendeBloco(d, bloco)))
    .sort((a, b) => a.ordem - b.ordem);
}

/** Avisos do kit antes de entregar: vencido ou ainda sem arquivo. */
export function avisosDoKit(
  itens: { nome: string; validade: string | null; arquivo: boolean }[],
  hoje: string,
): string[] {
  const avisos: string[] = [];
  for (const i of itens) {
    if (situacaoDaValidade(i.validade, hoje, 0) === "vencido")
      avisos.push(`${i.nome}: vencido. Suba a versão nova antes de entregar.`);
    if (!i.arquivo)
      avisos.push(`${i.nome}: ainda sem arquivo; não entra no PDF do kit.`);
  }
  return avisos;
}
