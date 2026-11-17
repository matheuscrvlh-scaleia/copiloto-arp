// Entrevista dos contratos de um cliente, para a coluna "Entrevista" da lista
// do Clube e para a visão "Sustentabilidade" do detalhe do participante (4.5).
// Usa as regras de situacao.ts; aqui só se escolhe a ativação e o pior caso.
// Funções puras.

import {
  contratoEntraNaLista,
  type ParametrosEntrevista,
  type SituacaoEntrevista,
  situacaoDaEntrevista,
} from "./situacao";

export interface ContratoDoCliente {
  id: string;
  contrato: string | null;
  clienteDoc: string | null;
  lucs: string[];
  bloco: string | null;
  tipoLoja: string | null;
  situacao: "vigente" | "encerrado";
  rescisao: string | null;
  ativacao: string | null;
  inicio: string | null;
  ativacaoCorrigida: string | null;
  validadeMesesEspecifica: number | null;
  dispensada: boolean;
}

export interface UltimaEntrevista {
  contratoId: string;
  data: string;
  setor: string | null;
}

export interface ConfigEntrevista {
  hoje: string;
  parametros: ParametrosEntrevista;
  tiposLojaDispensados: readonly string[];
  /** Qual data do contrato conta como inauguração (Parâmetros). */
  dataInauguracao: "ativacao" | "inicio";
}

export interface EntrevistaDoContrato {
  contratoId: string;
  contrato: ContratoDoCliente;
  /** Fora da lista de entrevistas (encerrado ou tipo dispensado). */
  foraDaLista: boolean;
  situacao: SituacaoEntrevista;
  ultimaData: string | null;
  validaAte: string | null;
  dataPrevista: string | null;
}

/** Vigente e sem rescisão até hoje (a rescisão futura ainda vale). */
export function contratoVigente(
  c: { situacao: string; rescisao: string | null },
  hoje: string,
): boolean {
  return c.situacao === "vigente" && !(c.rescisao && c.rescisao <= hoje);
}

/** A última entrevista salva de cada contrato. */
export function ultimasPorContrato(
  entrevistas: readonly UltimaEntrevista[],
): Map<string, UltimaEntrevista> {
  const mapa = new Map<string, UltimaEntrevista>();
  for (const e of entrevistas) {
    const atual = mapa.get(e.contratoId);
    if (!atual || e.data > atual.data) mapa.set(e.contratoId, e);
  }
  return mapa;
}

/** Situação da entrevista de cada contrato (4.4), na ordem recebida. */
export function entrevistasDosContratos(
  contratos: readonly ContratoDoCliente[],
  entrevistas: readonly UltimaEntrevista[],
  cfg: ConfigEntrevista,
): EntrevistaDoContrato[] {
  const ultimas = ultimasPorContrato(entrevistas);
  return contratos.map((c) => {
    const ultima = ultimas.get(c.id) ?? null;
    const ativacao =
      c.ativacaoCorrigida ??
      (cfg.dataInauguracao === "inicio" ? c.inicio : c.ativacao);
    const r = situacaoDaEntrevista({
      hoje: cfg.hoje,
      ativacao,
      dispensada: c.dispensada,
      ultimaEntrevista: ultima
        ? { data: ultima.data, setor: ultima.setor }
        : null,
      validadeEspecificaMeses: c.validadeMesesEspecifica,
      parametros: cfg.parametros,
    });
    return {
      contratoId: c.id,
      contrato: c,
      foraDaLista: !(
        contratoVigente(c, cfg.hoje) &&
        contratoEntraNaLista(
          {
            situacao: c.situacao,
            rescisao: c.rescisao,
            tipoLoja: c.tipoLoja,
          },
          { hoje: cfg.hoje, tiposLojaDispensados: cfg.tiposLojaDispensados },
        )
      ),
      situacao: r.situacao,
      ultimaData: ultima?.data ?? null,
      validaAte: r.validaAte,
      dataPrevista: r.dataPrevista,
    };
  });
}

// Do pior para o melhor: o que pede ação da equipe vem primeiro.
const GRAVIDADE: Record<SituacaoEntrevista, number> = {
  vencida: 6,
  pendente: 5,
  a_vencer: 4,
  aguardando: 3,
  em_dia: 2,
  dispensada: 1,
};

/**
 * Uma situação para o cliente: a pior entre os contratos que entram na
 * lista de entrevistas. Sem contrato nessa lista, null (a tela mostra "—").
 */
export function piorEntrevista(
  itens: readonly Pick<EntrevistaDoContrato, "situacao" | "foraDaLista">[],
): SituacaoEntrevista | null {
  let pior: SituacaoEntrevista | null = null;
  for (const i of itens) {
    if (i.foraDaLista) continue;
    if (!pior || GRAVIDADE[i.situacao] > GRAVIDADE[pior]) pior = i.situacao;
  }
  return pior;
}

/** Entrevista de cada cliente (por documento), só com contratos vigentes. */
export function entrevistaPorCliente(
  contratos: readonly ContratoDoCliente[],
  entrevistas: readonly UltimaEntrevista[],
  cfg: ConfigEntrevista,
): Map<string, SituacaoEntrevista | null> {
  const vigentes = contratos.filter(
    (c) => c.clienteDoc && contratoVigente(c, cfg.hoje),
  );
  const itens = entrevistasDosContratos(vigentes, entrevistas, cfg);
  const porDoc = new Map<string, EntrevistaDoContrato[]>();
  for (const i of itens) {
    const doc = i.contrato.clienteDoc as string;
    porDoc.set(doc, [...(porDoc.get(doc) ?? []), i]);
  }
  return new Map(
    [...porDoc].map(([doc, lista]) => [doc, piorEntrevista(lista)]),
  );
}
