import type { CampoExtra, Prioridade, TipoChamado } from "@/lib/os/rotulos";

// Dados que o servidor entrega ao formulário de abrir chamado (só o que a
// tela usa, sem colunas internas).

export interface SetorDoFormulario {
  id: string;
  nome: string;
  cor: string;
  icone: string;
}

export interface CategoriaDoFormulario {
  id: string;
  setorId: string;
  paiId: string | null;
  nome: string;
  icone: string;
  cor: string | null;
  tipo: TipoChamado;
  prioridade: Prioridade;
  responsavelId: string | null;
  /** "2 dias úteis", "4 horas"; null sem prazo padrão. */
  prazo: string | null;
  precisaConfirmacao: boolean;
  vincularAtivo: boolean;
  vincularLoja: boolean;
  agendaId: string | null;
  campos: CampoExtra[];
  itensChecklist: number;
}

export interface DadosDoFormulario {
  eu: { id: string; nome: string };
  meusSetores: string[];
  setores: SetorDoFormulario[];
  categorias: CategoriaDoFormulario[];
  pessoas: { id: string; nome: string; setores: string[] }[];
  agendas: { id: string; nome: string }[];
}

/** Contexto que chega pela URL ou pelo botão de outra tela. */
export interface InicialDoFormulario {
  setorId?: string;
  categoriaId?: string | null;
  tipo?: TipoChamado;
  titulo?: string;
  descricao?: string;
  prioridade?: Prioridade;
  etiquetas?: string;
  lojaId?: string;
  ativoId?: string;
  vistoriaId?: string;
  ambienteId?: string;
  vinculadoAId?: string;
  /** O que já vem ligado, para mostrar no topo ("Ativo AT-0012 · Bomba"). */
  contexto: { rotulo: string; valor: string }[];
}
