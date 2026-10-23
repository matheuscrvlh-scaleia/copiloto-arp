import type {
  RespostaAmbiente,
  StatusVistoria,
  TipoVistoria,
} from "@/lib/os/rotulos";
import type {
  AmbienteDaEntrada,
  ChamadoDaVistoria,
  Foto,
} from "@/server/os/vistorias";

// Estado da tela de vistoria (cliente). Os tipos do servidor entram só como
// tipo (somem no build).

export type { AmbienteDaEntrada, ChamadoDaVistoria, Foto };

export interface AmbienteEditado {
  id: string;
  titulo: string;
  resposta: RespostaAmbiente;
  descricao: string;
  problema: boolean;
  fotos: Foto[];
  entrada: AmbienteDaEntrada | null;
}

export type CampoDoTipo = "sim" | "nao" | "nao_se_aplica";

export interface CamposVistoria {
  tipo: TipoVistoria;
  codigo: string;
  status: StatusVistoria;
  data: string;
  hora: string;
  vistoriador_id: string | null;
  vistoriador_nome: string;
  locador: string;
  loja_id: string | null;
  locatario: string;
  bloco: string;
  unidade: string;
  campo_tipo: CampoDoTipo | null;
  itens_anteriores: string;
  observacao: string;
  consideracoes: string;
  termo: string;
  local_data: string;
  comparar_no_laudo: boolean;
}

/** Loja (contrato) na escolha: o que ela preenche na vistoria. */
export interface LojaEscolhida {
  id: string;
  rotulo: string;
  descricao: string;
  locatario: string;
  bloco: string;
  unidade: string;
}

export const OPCOES_CAMPO_DO_TIPO: { valor: CampoDoTipo; rotulo: string }[] = [
  { valor: "sim", rotulo: "Sim" },
  { valor: "nao", rotulo: "Não" },
  { valor: "nao_se_aplica", rotulo: "Não se aplica" },
];
