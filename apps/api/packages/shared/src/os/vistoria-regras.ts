import type { StatusVistoria, TipoVistoria } from "./rotulos";
import { MENSAGENS_PADRAO } from "./whatsapp";

// Regras da tela de vistoria (4.10) que não dependem de banco nem de tela:
// o que falta para finalizar, quando perguntar antes de trocar os textos,
// como achar o ambiente da entrada na saída e em que situação a vistoria
// está nos cartões.

export interface TextosDoTipo {
  observacao: string;
  termo: string;
}

const igual = (a: string, b: string) =>
  a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

/**
 * A pessoa mexeu na observação ou no termo? Texto vazio ou igual ao padrão
 * do tipo atual pode ser trocado sem perguntar.
 */
export function textosEditados(
  atual: TextosDoTipo,
  padraoDoTipo: TextosDoTipo,
): boolean {
  const mexeu = (campo: keyof TextosDoTipo) =>
    atual[campo].trim() !== "" && !igual(atual[campo], padraoDoTipo[campo]);
  return mexeu("observacao") || mexeu("termo");
}

export interface CamposObrigatorios {
  tipo: string | null;
  codigo: string;
  status: string | null;
  data: string;
  vistoriador: string;
  locador: string;
  locatario: string;
}

const ROTULOS_OBRIGATORIOS: Record<keyof CamposObrigatorios, string> = {
  tipo: "Tipo",
  codigo: "Código do laudo",
  status: "Status",
  data: "Data",
  vistoriador: "Vistoriador",
  locador: "Locador",
  locatario: "Locatário(a)",
};

/** Campos obrigatórios em branco, na ordem do formulário (vazio: pode salvar). */
export function faltando(v: CamposObrigatorios): string[] {
  return (Object.keys(ROTULOS_OBRIGATORIOS) as (keyof CamposObrigatorios)[])
    .filter((k) => !(v[k] ?? "").trim())
    .map((k) => ROTULOS_OBRIGATORIOS[k]);
}

/** "Fachada e  acesso " e "FACHADA E ACESSO" são o mesmo ambiente. */
export function chaveDoAmbiente(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Ambiente da entrada equivalente a cada ambiente da saída, pelo título.
 * Títulos repetidos casam na ordem (o segundo "Banheiro" com o segundo).
 */
export function casarAmbientes(
  saida: { id: string; titulo: string }[],
  entrada: { id: string; titulo: string }[],
): Map<string, string> {
  const livres = new Map<string, string[]>();
  for (const e of entrada) {
    const k = chaveDoAmbiente(e.titulo);
    livres.set(k, [...(livres.get(k) ?? []), e.id]);
  }
  const pares = new Map<string, string>();
  for (const s of saida) {
    const fila = livres.get(chaveDoAmbiente(s.titulo));
    const id = fila?.shift();
    if (id) pares.set(s.id, id);
  }
  return pares;
}

export type SituacaoVistoria =
  | "andamento"
  | "aguardando_assinatura"
  | "concluida"
  | "cancelada";

/**
 * Situação nos cartões: finalizada sem as duas assinaturas na tela ainda
 * espera assinatura; com as duas, está concluída. A importada do sistema
 * antigo foi assinada no papel: finalizada já é concluída.
 */
export function situacaoDaVistoria(v: {
  status: StatusVistoria;
  assinatura_locador_path: string | null;
  assinatura_locatario_path: string | null;
  legado_id?: string | null;
}): SituacaoVistoria {
  if (v.status === "cancelado") return "cancelada";
  if (v.status === "andamento") return "andamento";
  if (v.legado_id) return "concluida";
  return v.assinatura_locador_path && v.assinatura_locatario_path
    ? "concluida"
    : "aguardando_assinatura";
}

/**
 * Por que o locatário ainda não pode assinar pelo link (null: pode). A ARP
 * finaliza e assina como locador primeiro; o locatário assina por último.
 */
export function motivoParaAssinaturaDoLocatario(v: {
  status: StatusVistoria;
  assinatura_locador_path: string | null;
  assinatura_locatario_path: string | null;
}): string | null {
  if (v.status === "cancelado") return "A vistoria foi cancelada.";
  if (v.status === "andamento")
    return "Finalize a vistoria antes de mandar para o locatário assinar.";
  if (!v.assinatura_locador_path)
    return "Assine como locador antes de mandar para o locatário.";
  if (v.assinatura_locatario_path) return "O locatário já assinou.";
  return null;
}

export const ROTULOS_SITUACAO: Record<SituacaoVistoria, string> = {
  andamento: "Em andamento",
  aguardando_assinatura: "Aguardando assinatura",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

/** Move um item da posição `de` para `para` (reordenar ambientes). */
export function mover<T>(lista: T[], de: number, para: number): T[] {
  if (de === para || de < 0 || para < 0 || de >= lista.length) return lista;
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(Math.min(para, nova.length), 0, item as T);
  return nova;
}

/**
 * Tamanho da foto reduzida no navegador: o lado maior fica com `ladoMaior`
 * pixels (foto menor não cresce). Mantém a proporção.
 */
export function tamanhoReduzido(
  d: { largura: number; altura: number },
  ladoMaior: number,
): { largura: number; altura: number } {
  const escala = Math.min(1, ladoMaior / Math.max(d.largura, d.altura));
  return {
    largura: Math.max(1, Math.round(d.largura * escala)),
    altura: Math.max(1, Math.round(d.altura * escala)),
  };
}

/** Mensagem pronta do WhatsApp com o link do laudo (editável em Parâmetros). */
export const MENSAGEM_LAUDO_PADRAO = MENSAGENS_PADRAO.laudo;

/** "Bloco B - Loja 118" (bloco que já diz "Bloco" não repete a palavra). */
export function localDaUnidade(
  bloco: string | null,
  unidade: string | null,
): string {
  const b = bloco?.trim() ?? "";
  return [b && !/^bloco\b/i.test(b) ? `Bloco ${b}` : b, unidade?.trim()]
    .filter(Boolean)
    .join(" - ");
}

/** Tipos que pedem o campo extra no formulário e no laudo. */
export function temCampoDoTipo(tipo: TipoVistoria): boolean {
  return tipo === "entrada" || tipo === "saida";
}
