// Texto do termo anual do Clube SustentArp (spec 4.5), para o PDF gerado
// pela assinatura na tela. O texto oficial é da ARP (a confirmar, seção 10):
// este é um modelo curto com o que o sistema sabe (partes, ano, formas e
// validade). Funções puras.

import { formatarDocumento, soDigitos } from "../documentos";
import { dataPorExtenso, tipoDoDocumento } from "../operacoes/termo";

export const TITULO_DO_TERMO_CLUBE = "TERMO DE ADESÃO AO CLUBE SUSTENTARP";

export interface DadosDoTermoClube {
  /** aaaa-mm-dd */
  assinadoEm: string;
  validoAte: string;
  ano: number;
  validadeMeses: number;
  participante: { nome: string; doc: string };
  formas: readonly string[];
  /** Quem assinou na tela (representante), se informado. */
  assinante?: { nome: string; documento: string } | null;
  /** `cidade` vazia: a data sai sem a cidade. */
  arp: { razaoSocial: string; cnpj: string; cidade: string };
}

export interface TextoDoTermoClube {
  /** "Nova Friburgo, 08 de outubro de 2026." (à direita) */
  data: string;
  titulo: string;
  paragrafos: string[];
  /** A da ARP primeiro; a do participante recebe a imagem da assinatura. */
  assinaturas: { nome: string; documento: string }[];
}

/** ["a", "b", "c"] → "a, b e c". */
export function listaEmTexto(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

/** "12345678000190" → "CNPJ 12.345.678/0001-90". */
export function documentoComTipo(doc: string): string {
  const d = soDigitos(doc);
  const tipo = tipoDoDocumento(d);
  return tipo ? `${tipo} ${formatarDocumento(d)}` : doc;
}

/** "CNPJ …" ou "CNPJ … · assinado por Maria (CPF …)". */
function documentoDoAssinante(
  documento: string,
  assinante: DadosDoTermoClube["assinante"],
): string {
  const nome = assinante?.nome.trim();
  if (!nome) return documento;
  const doc = soDigitos(assinante?.documento ?? "");
  return `${documento} · assinado por ${nome}${doc ? ` (${documentoComTipo(doc)})` : ""}`;
}

export function textoDoTermoClube(d: DadosDoTermoClube): TextoDoTermoClube {
  const nome = d.participante.nome.trim().toLocaleUpperCase("pt-BR");
  const documento = documentoComTipo(d.participante.doc);
  const formas = d.formas.length
    ? `, nas formas de participação: ${listaEmTexto(d.formas)}`
    : "";
  return {
    data: `${d.arp.cidade ? `${d.arp.cidade}, ` : ""}${dataPorExtenso(d.assinadoEm)}.`,
    titulo: TITULO_DO_TERMO_CLUBE,
    paragrafos: [
      `Pelo presente Termo, ${d.arp.razaoSocial}, inscrita no CNPJ sob o nº ${d.arp.cnpj} (ARP), ` +
        `e ${nome}, inscrito(a) no ${documento} (Participante), formalizam a participação do ` +
        `Participante no Clube SustentArp, programa de sustentabilidade da ARP, no ano de ${d.ano}${formas}.`,
      "O Participante declara conhecer o programa e se compromete a colaborar com a separação e a " +
        "destinação correta dos resíduos e a participar das ações de engajamento promovidas pela ARP.",
      `Este Termo foi assinado em ${dataPorExtenso(d.assinadoEm)} e vale por ${d.validadeMeses} ` +
        `${d.validadeMeses === 1 ? "mês" : "meses"}, até ${dataPorExtenso(d.validoAte)}, ` +
        "podendo ser renovado por novo Termo.",
    ],
    assinaturas: [
      { nome: d.arp.razaoSocial, documento: `CNPJ ${d.arp.cnpj}` },
      { nome, documento: documentoDoAssinante(documento, d.assinante) },
    ],
  };
}
