import type { Opcao } from "@/components/selecao";
import {
  AGRUPAMENTOS,
  RECORTES,
  type Recorte,
  VISOES_CALENDARIO,
} from "@/lib/os/lista";
import { PRIORIDADES, STATUS, TIPOS } from "@/lib/os/rotulos";
import type { CampoBarra } from "./barra-filtros";

// Opções dos filtros das visões (servem no servidor e no cliente).

const de = (o: Record<string, string>): Opcao[] =>
  Object.entries(o).map(([valor, rotulo]) => ({ valor, rotulo }));

export const campoTipo: CampoBarra = {
  chave: "tipo",
  rotulo: "Tipo",
  todos: "Todos os tipos",
  // A OS tem a tela própria (Ordens de serviço).
  opcoes: de(TIPOS).filter((o) => o.valor !== "os"),
  largura: "w-48",
};

/** Calendário: chamados e OS juntos (o tipo OS lê só as OS). */
export const campoTipoComOS: CampoBarra = {
  ...campoTipo,
  opcoes: de(TIPOS),
};

/** Abas de tickets: os avisos têm a aba deles. */
export const campoTipoSemAviso: CampoBarra = {
  ...campoTipo,
  opcoes: campoTipo.opcoes.filter((o) => o.valor !== "aviso"),
};

export const campoPrioridade: CampoBarra = {
  chave: "prioridade",
  rotulo: "Prioridade",
  todos: "Qualquer prioridade",
  opcoes: de(PRIORIDADES),
  largura: "w-48",
};

/** Padrão: o que não está fechado nem cancelado. */
export const campoStatus: CampoBarra = {
  chave: "status",
  rotulo: "Status",
  todos: "Em aberto",
  opcoes: [...de(STATUS), { valor: "todos", rotulo: "Todos os status" }],
  largura: "w-44",
};

export const campoAgrupar: CampoBarra = {
  chave: "agrupar",
  rotulo: "Agrupar por",
  todos: `Por ${AGRUPAMENTOS.responsavel.toLowerCase()}`,
  opcoes: de(AGRUPAMENTOS)
    .filter((o) => o.valor !== "responsavel")
    .map((o) => ({ ...o, rotulo: `Por ${o.rotulo.toLowerCase()}` })),
  largura: "w-48",
};

export const campoVisao: CampoBarra = {
  chave: "visao",
  rotulo: "Visão",
  todos: "Mês",
  opcoes: de(VISOES_CALENDARIO).filter((o) => o.valor !== "mes"),
  largura: "w-32",
};

/** Recortes que a pessoa pode ver (Meu setor e Todos dependem de permissão). */
export function campoRecorte(permitidos: Recorte[]): CampoBarra {
  return {
    chave: "recorte",
    rotulo: "O que mostrar",
    todos: RECORTES.minha_caixa,
    opcoes: permitidos
      .filter((r) => r !== "minha_caixa")
      .map((r) => ({ valor: r, rotulo: RECORTES[r] })),
    largura: "w-52",
  };
}

export function campoSetor(
  setores: { id: string; nome: string }[],
  todos: string | undefined = "Todos os setores",
): CampoBarra {
  return {
    chave: "setor",
    rotulo: "Setor",
    todos,
    opcoes: setores.map((s) => ({ valor: s.id, rotulo: s.nome })),
    largura: "w-52",
  };
}
