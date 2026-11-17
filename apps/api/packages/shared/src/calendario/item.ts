import type { EntradaItem, Tipo } from "./contratos";

// O que se grava de um item, conforme o tipo: só os campos que o tipo usa
// (o resto fica vazio) e as regras entre campos. Puro: o service chama
// antes de gravar. Mensagens "Campo: problema", como as do formulário.

export interface LinhaDoItem {
  tipo_id: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  inicio: string;
  fim: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  responsavel_id: string | null;
  recorrencia: EntradaItem["recorrencia"];
  recorrencia_ate: string | null;
  visibilidade: EntradaItem["visibilidade"];
  setores: string[];
  cargos: string[];
  usuarios: string[];
}

type CamposDoTipo = Pick<
  Tipo,
  | "usa_horario"
  | "usa_periodo"
  | "usa_local"
  | "usa_responsavel"
  | "usa_recorrencia"
>;

export function linhaDoItem(
  tipo: CamposDoTipo,
  v: EntradaItem,
): { linha: LinhaDoItem } | { erro: string } {
  const fim = tipo.usa_periodo && v.fim ? v.fim : v.inicio;
  const comHora = tipo.usa_horario && !v.dia_inteiro && !!v.hora_inicio;
  const recorrencia = tipo.usa_recorrencia ? v.recorrencia : null;
  const restrito = v.visibilidade === "restrito";
  if (fim < v.inicio) return { erro: "Fim: não pode ser antes do início." };
  if (
    comHora &&
    v.hora_fim &&
    fim === v.inicio &&
    v.hora_fim <= (v.hora_inicio ?? "")
  )
    return { erro: "Hora de fim: precisa ser depois do início." };
  if (tipo.usa_horario && !v.dia_inteiro && !v.hora_inicio)
    return { erro: "Hora de início: informe ou marque Dia inteiro." };
  if (restrito && !v.setores.length && !v.cargos.length && !v.usuarios.length)
    return { erro: "Quem vê: escolha ao menos um setor, cargo ou pessoa." };
  if (recorrencia && v.recorrencia_ate && v.recorrencia_ate < v.inicio)
    return { erro: "Repetir até: não pode ser antes do início." };

  return {
    linha: {
      tipo_id: v.tipo_id,
      titulo: v.titulo,
      descricao: v.descricao,
      local: tipo.usa_local ? v.local : null,
      inicio: v.inicio,
      fim,
      hora_inicio: comHora ? v.hora_inicio : null,
      hora_fim: comHora ? v.hora_fim : null,
      responsavel_id: tipo.usa_responsavel ? v.responsavel_id : null,
      recorrencia,
      recorrencia_ate: recorrencia ? v.recorrencia_ate : null,
      visibilidade: v.visibilidade,
      setores: restrito ? v.setores : [],
      cargos: restrito ? v.cargos : [],
      usuarios: restrito ? v.usuarios : [],
    },
  };
}

/** O que a pessoa pode fazer no item (mesma regra do RLS e de calendario.concluir()). */
export function acoesNoItem(
  item: {
    criado_por: string | null;
    responsavel_id: string | null;
    visibilidade: string;
    recorrencia: string | null;
  },
  tipo: { usa_conclusao: boolean } | undefined,
  eu: { id: string; criar: boolean; editarTodos: boolean },
): { podeEditar: boolean; podeConcluir: boolean } {
  const meu = item.criado_por === eu.id;
  const outroVisivel = eu.editarTodos && item.visibilidade !== "privado";
  return {
    podeEditar: (meu && eu.criar) || outroVisivel,
    podeConcluir:
      !!tipo?.usa_conclusao &&
      !item.recorrencia &&
      (meu || item.responsavel_id === eu.id || outroVisivel),
  };
}
