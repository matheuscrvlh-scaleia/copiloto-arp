import type { Parametros } from "@arp/shared/operacoes/contratos/base";
import type { RespostaFichaDaCaixa } from "@arp/shared/operacoes/contratos/energia";
import type { ContextoOp } from "./contexto";

// Os tipos que os componentes portados importavam de src/server/operacoes
// (agua, contas, painel, quadros), agora vindos dos contratos da API.

export type {
  Leitura,
  LeituraComAlertas,
} from "@arp/shared/operacoes/contratos/agua";
export type {
  Caixa,
  FaturaDetalhe,
  ItemDaFatura,
  Quadro,
  ResumoDoQuadro,
  Sala,
  TermoEmitido,
  TermoRecente,
} from "@arp/shared/operacoes/contratos/energia";
export type {
  DadosDoPainel,
  ObraNoPainel,
  PainelAgua,
  PainelContas,
  PainelDiario,
  PainelEnergia,
  PainelLimpeza,
  PainelObras,
} from "@arp/shared/operacoes/contratos/painel";
export type { ContextoOp } from "./contexto";

/** Tudo o que a ficha da caixa mostra (a API e o contexto da tela). */
export type DadosDaFicha = RespostaFichaDaCaixa & {
  ctx: ContextoOp;
  parametros: Parametros;
};
