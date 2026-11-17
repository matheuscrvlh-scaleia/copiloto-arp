import type { StatusChamado, TipoChamado } from "./rotulos";

// Ciclo de vida do chamado (spec 4.4). O banco tem um gatilho com esta mesma
// tabela e recusa qualquer outra troca de status: se mudar aqui, mude lá
// (nova migration) e vice-versa. Fechado e Cancelado são finais.

export const TRANSICOES: Record<StatusChamado, StatusChamado[]> = {
  aberto: ["em_andamento", "concluido", "fechado", "cancelado"],
  em_andamento: ["aberto", "aguardando", "concluido", "fechado", "cancelado"],
  aguardando: ["em_andamento", "concluido", "fechado", "cancelado"],
  concluido: ["fechado", "em_andamento"],
  fechado: [],
  cancelado: [],
};

export function podeIr(de: StatusChamado, para: StatusChamado): boolean {
  return TRANSICOES[de].includes(para);
}

export type AcaoChamado =
  | "assumir"
  | "iniciar"
  | "aguardar"
  | "retomar"
  | "concluir"
  | "confirmar"
  | "reabrir"
  | "cancelar"
  | "devolver";

export const ROTULOS_ACAO: Record<AcaoChamado, string> = {
  assumir: "Assumir",
  iniciar: "Iniciar",
  aguardar: "Colocar em espera…",
  retomar: "Retomar",
  concluir: "Concluir",
  confirmar: "Confirmar",
  reabrir: "Reabrir",
  cancelar: "Cancelar",
  devolver: "Devolver à fila",
};

/** Quem a pessoa é em relação ao chamado. */
export interface Papel {
  solicitante: boolean;
  /** É o responsável atual. */
  responsavel: boolean;
  /** É do setor que atende o chamado. */
  doSetor: boolean;
  gestor: boolean;
}

export interface ChamadoParaAcoes {
  status: StatusChamado;
  tipo: TipoChamado;
  pessoal: boolean;
  precisa_confirmacao: boolean;
  responsavel_id: string | null;
  /** Aviso para vários destinatários: cada destino anda sozinho. */
  multiplos: boolean;
}

/** Os botões que a pessoa vê no chamado, na ordem do fluxo. */
export function acoesDisponiveis(
  ch: ChamadoParaAcoes,
  papel: Papel,
): AcaoChamado[] {
  const acoes: AcaoChamado[] = [];
  const executa = papel.responsavel || papel.gestor;
  const { status } = ch;
  const cancela =
    podeIr(status, "cancelado") && (papel.solicitante || papel.gestor);

  // Aviso é para ser lido (os.leituras), não executado: só quem mandou ou
  // gerencia o retira.
  if (ch.tipo === "aviso") return cancela ? ["cancelar"] : [];

  if (status === "aberto") {
    // Sem dono: qualquer um do setor pega. Com dono: só o gestor toma para si.
    const livre = ch.responsavel_id === null && (papel.doSetor || papel.gestor);
    const tomar =
      ch.responsavel_id !== null && !papel.responsavel && papel.gestor;
    if (livre || tomar) acoes.push("assumir");
    if (papel.responsavel) acoes.push("iniciar");
  }
  if (status === "em_andamento" && executa) acoes.push("aguardar");
  if (status === "aguardando" && executa) acoes.push("retomar");
  // Aviso com vários destinos: cada um conclui o seu, não o chamado inteiro.
  // Tarefa rápida: o responsável conclui direto do Aberto, sem Iniciar.
  const tarefaRapida =
    status === "aberto" && ch.tipo === "tarefa" && papel.responsavel;
  if ((status === "em_andamento" || tarefaRapida) && executa && !ch.multiplos)
    acoes.push("concluir");
  if (status === "concluido") {
    if (papel.solicitante || papel.gestor) acoes.push("confirmar");
    if (papel.solicitante) acoes.push("reabrir");
  }
  // Concluído não cancela (só confirma ou reabre), como na tabela acima.
  if (cancela) acoes.push("cancelar");
  if (status === "em_andamento" && papel.responsavel) acoes.push("devolver");
  return acoes;
}

/**
 * Para onde vai ao concluir: tarefa pessoal, aviso e chamado que não pede
 * confirmação fecham direto; o resto espera o solicitante em Concluído.
 */
export function statusAoConcluir(
  ch: Pick<ChamadoParaAcoes, "tipo" | "pessoal" | "precisa_confirmacao">,
): "fechado" | "concluido" {
  const direto =
    (ch.tipo === "tarefa" && ch.pessoal) ||
    ch.tipo === "aviso" ||
    !ch.precisa_confirmacao;
  return direto ? "fechado" : "concluido";
}

export type StatusDestino =
  | "aberto"
  | "em_andamento"
  | "aguardando"
  | "concluido";

/** "3 de 5 concluídos" de um aviso com vários destinatários. */
export function andamentoDosDestinos(destinos: { status: StatusDestino }[]): {
  concluidos: number;
  total: number;
  faltam: number;
  texto: string;
  todosConcluidos: boolean;
} {
  const total = destinos.length;
  const concluidos = destinos.filter((d) => d.status === "concluido").length;
  return {
    concluidos,
    total,
    faltam: total - concluidos,
    texto: `${concluidos} de ${total} ${total === 1 ? "concluído" : "concluídos"}`,
    todosConcluidos: total > 0 && concluidos === total,
  };
}
