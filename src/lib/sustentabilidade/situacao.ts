// Entrevistas (spec 4.4) e Clube SustentArp (spec 4.5): situação calculada,
// datas previstas, cobertura e participação. Datas "aaaa-mm-dd" (Brasília),
// sem Date com fuso. Prazos e avisos chegam dos Parâmetros. Funções puras.

import { diasEntre, somarMeses } from "@/lib/comercial/datas";
import { normalizar } from "@/lib/operacoes/agua-formato";

export type SituacaoEntrevista =
  | "aguardando"
  | "pendente"
  | "em_dia"
  | "a_vencer"
  | "vencida"
  | "dispensada";

export const ROTULO_SITUACAO: Record<SituacaoEntrevista, string> = {
  aguardando: "Aguardando",
  pendente: "Pendente",
  em_dia: "Em dia",
  a_vencer: "A vencer",
  vencida: "Vencida",
  dispensada: "Dispensada",
};

export type TipoEntrevista = "primeira" | "atualizacao";

export interface ParametrosEntrevista {
  /** Meses após a ativação para a primeira entrevista. */
  mesesPrimeira: number;
  /** Validade de quem não tem setor ou tem setor sem prazo na tabela. */
  validadePadraoMeses: number;
  /** Setor econômico (pergunta 3) → meses de validade. */
  validadePorSetor: Readonly<Record<string, number>>;
  /** Dias antes do fim da validade em que vira "A vencer". */
  avisoDias: number;
}

export interface EntradaSituacao {
  hoje: string;
  /** Data que conta como inauguração (parâmetro), já com a correção manual. */
  ativacao: string | null;
  dispensada: boolean;
  ultimaEntrevista: { data: string; setor: string | null } | null;
  /** Prazo trocado para este contrato; vence o do setor. */
  validadeEspecificaMeses: number | null;
  parametros: ParametrosEntrevista;
}

export interface ResultadoSituacao {
  situacao: SituacaoEntrevista;
  /** Ativação + meses da primeira, ou a validade da última. */
  dataPrevista: string | null;
  validaAte: string | null;
}

/** Meses de validade: específico do contrato > setor > padrão. */
export function prazoDaValidade(
  setor: string | null,
  validadeEspecificaMeses: number | null,
  p: Pick<ParametrosEntrevista, "validadePadraoMeses" | "validadePorSetor">,
): number {
  if (validadeEspecificaMeses != null) return validadeEspecificaMeses;
  const doSetor = setor ? p.validadePorSetor[setor.trim()] : undefined;
  return doSetor ?? p.validadePadraoMeses;
}

/** Validade de uma entrevista = a próxima data prevista. */
export function proximaDataDaEntrevista(
  dataEntrevista: string,
  setor: string | null,
  validadeEspecificaMeses: number | null,
  p: Pick<ParametrosEntrevista, "validadePadraoMeses" | "validadePorSetor">,
): string {
  return somarMeses(
    dataEntrevista,
    prazoDaValidade(setor, validadeEspecificaMeses, p),
  );
}

/**
 * Situação da tabela de 4.4. Limites: no dia da prevista já é "Pendente";
 * no último dia da validade ainda é "A vencer"; faltando exatamente
 * `avisoDias` já é "A vencer". Sem data de ativação e sem entrevista não há
 * como prever: fica "Pendente" sem data, para a equipe corrigir a ativação.
 */
export function situacaoDaEntrevista(e: EntradaSituacao): ResultadoSituacao {
  const validaAte = e.ultimaEntrevista
    ? proximaDataDaEntrevista(
        e.ultimaEntrevista.data,
        e.ultimaEntrevista.setor,
        e.validadeEspecificaMeses,
        e.parametros,
      )
    : null;
  if (e.dispensada)
    return { situacao: "dispensada", dataPrevista: null, validaAte };
  if (validaAte) {
    const faltam = diasEntre(e.hoje, validaAte);
    const situacao =
      faltam < 0
        ? "vencida"
        : faltam <= e.parametros.avisoDias
          ? "a_vencer"
          : "em_dia";
    return { situacao, dataPrevista: validaAte, validaAte };
  }
  if (!e.ativacao)
    return { situacao: "pendente", dataPrevista: null, validaAte: null };
  const dataPrevista = somarMeses(e.ativacao, e.parametros.mesesPrimeira);
  return {
    situacao: e.hoje < dataPrevista ? "aguardando" : "pendente",
    dataPrevista,
    validaAte: null,
  };
}

/** "Primeira" se o contrato não tem entrevista salva antes desta. */
export function tipoDaEntrevista(
  ultimaEntrevista: { data: string } | null,
): TipoEntrevista {
  return ultimaEntrevista ? "atualizacao" : "primeira";
}

export interface ContratoDaLista {
  situacao: "vigente" | "encerrado";
  rescisao: string | null;
  tipoLoja: string | null;
}

/**
 * Entra na lista de entrevistas: vigente, sem rescisão até hoje (rescisão
 * futura ainda entra) e tipo de loja fora dos dispensados (comparação sem
 * acento e sem maiúsculas).
 */
export function contratoEntraNaLista(
  c: ContratoDaLista,
  p: { hoje: string; tiposLojaDispensados: readonly string[] },
): boolean {
  if (c.situacao !== "vigente") return false;
  if (c.rescisao && c.rescisao <= p.hoje) return false;
  const tipo = normalizar(c.tipoLoja ?? "");
  return !p.tiposLojaDispensados.some((t) => normalizar(t) === tipo);
}

export interface Cobertura {
  /** Em dia + a vencer (a validade ainda não passou). */
  emDia: number;
  /** Todos, menos aguardando e dispensada. */
  precisam: number;
  /** De 0 a 100; null sem contrato que precise. */
  pct: number | null;
}

/**
 * Cobertura do cartão e do painel. "A vencer" conta como em dia porque a
 * entrevista ainda vale (igual ao mockup). Receba só os contratos da lista
 * (`contratoEntraNaLista`).
 */
export function cobertura(lista: readonly SituacaoEntrevista[]): Cobertura {
  const emDia = lista.filter((s) => s === "em_dia" || s === "a_vencer").length;
  const precisam = lista.filter(
    (s) => s !== "aguardando" && s !== "dispensada",
  ).length;
  return { emDia, precisam, pct: precisam ? (emDia / precisam) * 100 : null };
}

/**
 * LUCs de um contrato. "11_129/130/202" → ["11_129", "11_130", "11_202"]:
 * o pedaço só com números herda o prefixo do primeiro ("11_", "ESTAC_",
 * "OOH"). Aceita também "/", "," ou ";" com código completo.
 */
export function lucsDoTexto(texto: string | null | undefined): string[] {
  const partes = (texto ?? "")
    .split(/[/,;]/)
    .map((p) => p.trim().replace(/\s+/g, ""))
    .filter(Boolean);
  const prefixo = (partes[0] ?? "").replace(/\d+$/, "");
  const lucs = partes.map((p) => (/^\d+$/.test(p) ? prefixo + p : p));
  return [...new Set(lucs)];
}

// ---- Clube SustentArp (4.5) ----

export type SituacaoTermo = "ativo" | "a_vencer" | "vencido" | "saiu";

export const ROTULO_TERMO: Record<SituacaoTermo, string> = {
  ativo: "Ativo",
  a_vencer: "Termo a vencer",
  vencido: "Termo vencido",
  saiu: "Saiu",
};

/** Válido até = assinatura + meses do parâmetro. */
export function validadeDoTermo(assinadoEm: string, meses: number): string {
  return somarMeses(assinadoEm, meses);
}

/**
 * Situação do participante. "Saiu" (marcado à mão) vence tudo; sem termo
 * válido (nenhum ou já vencido) é "Termo vencido". Mesmos limites da
 * entrevista: o último dia ainda vale; faltando `avisoDias`, a vencer.
 */
export function situacaoDoTermo(t: {
  hoje: string;
  validoAte: string | null;
  saiuEm: string | null;
  avisoDias: number;
}): SituacaoTermo {
  if (t.saiuEm) return "saiu";
  if (!t.validoAte) return "vencido";
  const faltam = diasEntre(t.hoje, t.validoAte);
  return faltam < 0 ? "vencido" : faltam <= t.avisoDias ? "a_vencer" : "ativo";
}

/** Ativo no clube = termo válido (inclusive a vencer). */
export function termoValido(s: SituacaoTermo): boolean {
  return s === "ativo" || s === "a_vencer";
}

/** Participantes ativos locatários ÷ clientes com contrato ativo, de 0 a 100. */
export function participacao(
  ativosLocatarios: number,
  clientesComContrato: number,
): number | null {
  return clientesComContrato
    ? (ativosLocatarios / clientesComContrato) * 100
    : null;
}
