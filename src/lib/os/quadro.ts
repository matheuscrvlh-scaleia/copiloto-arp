import { podeIr, statusAoConcluir } from "./ciclo";
import type { LinhaChamado } from "./lista";
import { STATUS, type StatusChamado, type TipoChamado } from "./rotulos";

// Quadro (kanban) dos chamados: o que acontece ao soltar um cartão numa
// coluna. Respeita o ciclo (TRANSICOES); o banco confere de novo quem pode.

/** Colunas na ordem do fluxo. Fechado fica recolhido por padrão. */
export const COLUNAS_QUADRO: StatusChamado[] = [
  "aberto",
  "em_andamento",
  "aguardando",
  "concluido",
  "fechado",
];

export interface CartaoNoQuadro {
  status: StatusChamado;
  tipo: TipoChamado;
  pessoal: boolean;
  precisaConfirmacao: boolean;
  responsavelId: string | null;
  /** Aviso com vários destinos: cada destino conclui o seu. */
  multiplos: boolean;
}

export interface Movimento {
  status: StatusChamado;
  /** O que perguntar antes de gravar. */
  pede: "aguardando" | "reabertura" | null;
  /** Sem responsável e indo para Em andamento: quem arrastou assume. */
  assumir: boolean;
}

export type Soltura =
  | { ok: true; movimento: Movimento }
  | { ok: false; motivo: string };

const nao = (de: StatusChamado, para: StatusChamado): Soltura => ({
  ok: false,
  motivo: `Não dá para passar de ${STATUS[de]} para ${STATUS[para]}.`,
});

/**
 * Resultado de soltar o cartão na coluna. null: mesma coluna (nada muda).
 * Concluir vai para Fechado quando não precisa de confirmação (Aviso,
 * tarefa pessoal); Fechado só aceita quem já pode fechar.
 */
export function aoSoltar(
  c: CartaoNoQuadro,
  coluna: StatusChamado,
): Soltura | null {
  if (coluna === c.status) return null;
  const ok = (status: StatusChamado, pede: Movimento["pede"] = null) => ({
    ok: true as const,
    movimento: {
      status,
      pede,
      assumir: status === "em_andamento" && c.responsavelId === null,
    },
  });

  if (coluna === "concluido" || coluna === "fechado") {
    if (c.multiplos && c.status !== "concluido")
      return {
        ok: false,
        motivo: "Aviso com vários destinos: cada destino conclui o seu.",
      };
    if (c.status === "concluido")
      return coluna === "fechado" ? ok("fechado") : null;
    const destino = statusAoConcluir({
      tipo: c.tipo,
      pessoal: c.pessoal,
      precisa_confirmacao: c.precisaConfirmacao,
    });
    if (coluna === "fechado" && destino !== "fechado")
      return {
        ok: false,
        motivo:
          "Este chamado espera a confirmação de quem pediu: solte em Concluído.",
      };
    return podeIr(c.status, destino) ? ok(destino) : nao(c.status, coluna);
  }
  if (!podeIr(c.status, coluna)) return nao(c.status, coluna);
  if (coluna === "aguardando") return ok("aguardando", "aguardando");
  if (c.status === "concluido") return ok(coluna, "reabertura");
  return ok(coluna);
}

/**
 * Ações do chamado que fazem o movimento, na ordem (as mesmas do detalhe,
 * com as mesmas regras e textos na linha do tempo). "iniciar" assume quando
 * está sem responsável; Aberto direto para Concluído passa por Em andamento.
 */
export type Passo =
  | "iniciar"
  | "aguardar"
  | "concluir"
  | "confirmar"
  | "reabrir"
  | "devolver";

export function passosDoMovimento(
  de: StatusChamado,
  para: StatusChamado,
): Passo[] {
  const fechando = para === "concluido" || para === "fechado";
  if (de === "concluido")
    return para === "fechado"
      ? ["confirmar"]
      : para === "em_andamento"
        ? ["reabrir"]
        : [];
  if (de === "em_andamento") {
    if (fechando) return ["concluir"];
    if (para === "aguardando") return ["aguardar"];
    if (para === "aberto") return ["devolver"];
    return [];
  }
  if (de === "aberto" || de === "aguardando") {
    if (para === "em_andamento") return ["iniciar"];
    if (fechando) return ["iniciar", "concluir"];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Paginação por coluna: cada coluna traz os primeiros cartões do seu status
// e o "Mostrar mais" pede os próximos pela URL (?mais=aberto:25,concluido:50),
// que o arrastar e o refresh do servidor mantêm.
// ---------------------------------------------------------------------------

/** Uma coluna como o servidor manda: os primeiros cartões e o total real. */
export interface ColunaDoQuadro {
  status: StatusChamado;
  cartoes: LinhaChamado[];
  /** Total da coluna com os filtros (o número do cabeçalho). */
  total: number;
}

/** Cartões por coluna (e a quantidade que cada "Mostrar mais" traz). */
export const POR_COLUNA = 25;

/** Teto por coluna, para a URL não pedir milhares de cartões. */
export const MAXIMO_POR_COLUNA = 500;

export type MaisPorColuna = Partial<Record<StatusChamado, number>>;

/** "aberto:25,concluido:50" → cartões a mais em cada coluna. */
export function lerMais(valor: unknown): MaisPorColuna {
  const v = Array.isArray(valor) ? valor[0] : valor;
  const mais: MaisPorColuna = {};
  if (typeof v !== "string") return mais;
  for (const parte of v.split(",")) {
    const [status, qtd] = parte.split(":");
    const n = Number(qtd);
    if (
      status &&
      (COLUNAS_QUADRO as string[]).includes(status) &&
      Number.isInteger(n) &&
      n > 0
    )
      mais[status as StatusChamado] = Math.min(
        n,
        MAXIMO_POR_COLUNA - POR_COLUNA,
      );
  }
  return mais;
}

export function escreverMais(mais: MaisPorColuna): string {
  return COLUNAS_QUADRO.filter((s) => (mais[s] ?? 0) > 0)
    .map((s) => `${s}:${mais[s]}`)
    .join(",");
}

/** Quantos cartões a coluna mostra. */
export const limiteDaColuna = (mais: MaisPorColuna, s: StatusChamado) =>
  POR_COLUNA + (mais[s] ?? 0);

/** O "Mostrar mais" da coluna: mais POR_COLUNA, até o teto. */
export function maisUmaPagina(
  mais: MaisPorColuna,
  s: StatusChamado,
): MaisPorColuna {
  return {
    ...mais,
    [s]: Math.min((mais[s] ?? 0) + POR_COLUNA, MAXIMO_POR_COLUNA - POR_COLUNA),
  };
}

/** A coluna aceita o cartão? (destaque durante o arraste) */
export function colunaAceita(
  c: CartaoNoQuadro,
  coluna: StatusChamado,
): boolean {
  const r = aoSoltar(c, coluna);
  return r === null || r.ok;
}
