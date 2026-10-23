import type {
  MotivoAguardando,
  StatusChamado,
  StatusVistoria,
} from "./rotulos";

// De-para dos status do sistema antigo (spec 4.14). Status fora da tabela
// devolve null: a importação para e pede para a pessoa escolher, em vez de
// adivinhar.

export interface StatusImportado {
  status: StatusChamado;
  aguardando_tipo?: MotivoAguardando;
  /** Tarefa "Convertida em O.S": fecha e liga à O.S. que nasceu dela. */
  convertida_em_os?: true;
}

/** "  Em  Análise " → "em analise"; "O.S." → "os". */
function chave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const STATUS_OS: Record<string, StatusImportado> = {
  aberto: { status: "aberto" },
  "em analise": { status: "em_andamento" },
  "em andamento": { status: "em_andamento" },
  "aguardando material": { status: "aguardando", aguardando_tipo: "material" },
  finalizado: { status: "fechado" },
  concluida: { status: "fechado" },
  cancelado: { status: "cancelado" },
  cancelada: { status: "cancelado" },
};

const STATUS_TAREFA: Record<string, StatusImportado> = {
  pendente: { status: "aberto" },
  "em andamento": { status: "em_andamento" },
  concluida: { status: "fechado" },
  cancelada: { status: "cancelado" },
  "convertida em os": { status: "fechado", convertida_em_os: true },
};

const STATUS_VISTORIA: Record<string, StatusVistoria> = {
  andamento: "andamento",
  finalizado: "finalizado",
  cancelado: "cancelado",
};

const buscar = <T>(tabela: Record<string, T>, texto: string): T | null =>
  Object.hasOwn(tabela, chave(texto)) ? (tabela[chave(texto)] ?? null) : null;

export function mapearStatusOS(texto: string): StatusImportado | null {
  const r = buscar(STATUS_OS, texto);
  return r ? { ...r } : null;
}

export function mapearStatusTarefa(texto: string): StatusImportado | null {
  const r = buscar(STATUS_TAREFA, texto);
  return r ? { ...r } : null;
}

export function mapearStatusVistoria(
  texto: string,
): { status: StatusVistoria } | null {
  const status = buscar(STATUS_VISTORIA, texto);
  return status ? { status } : null;
}
