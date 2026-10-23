import { podeIr, statusAoConcluir } from "./ciclo";
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

/** A coluna aceita o cartão? (destaque durante o arraste) */
export function colunaAceita(
  c: CartaoNoQuadro,
  coluna: StatusChamado,
): boolean {
  const r = aoSoltar(c, coluna);
  return r === null || r.ok;
}
