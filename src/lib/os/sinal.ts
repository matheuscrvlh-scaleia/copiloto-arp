import type { SituacaoAtivo } from "./rotulos";
import { deBrasilia, diasEntre, instante, MS_DIA, somarDias } from "./tempo";

// Sinal de troca do ativo (spec 4.9): manter, avaliar ou trocar, pelo pior
// de três critérios. As faixas vêm de Parâmetros.

export interface FaixasSinal {
  /** Custo de manutenção em 12 meses ÷ valor de reposição, em %. */
  pesoAvaliar: number;
  pesoTrocar: number;
  /** Corretivas nos últimos 12 meses. */
  corretivasAvaliar: number;
  corretivasTrocar: number;
  /** Idade em % da vida útil. */
  idadeAvaliarPct: number;
  idadeTrocarPct: number;
}

/** Sugestão para a tela de parâmetros e o seed. */
export const FAIXAS_SINAL_PADRAO: FaixasSinal = {
  pesoAvaliar: 30,
  pesoTrocar: 60,
  corretivasAvaliar: 3,
  corretivasTrocar: 5,
  idadeAvaliarPct: 80,
  idadeTrocarPct: 100,
};

export type Sinal = "manter" | "avaliar" | "trocar" | "incompleto";
export type Criterio = "manter" | "avaliar" | "trocar" | "sem_dado";

export const SINAIS: Record<Sinal, string> = {
  manter: "Manter",
  avaliar: "Avaliar",
  trocar: "Trocar",
  incompleto: "Cadastro incompleto",
};

export interface DadosDoAtivo {
  custo12m: number;
  valorReposicao: number | null;
  corretivas12m: number;
  /** aaaa-mm-dd */
  compraData: string | null;
  vidaUtilAnos: number | null;
}

export interface ResultadoSinal {
  sinal: Sinal;
  pesoPct: number | null;
  idadePct: number | null;
  criterios: { peso: Criterio; corretivas: Criterio; idade: Criterio };
}

// Peso e idade: o limite de "trocar" ainda é "avaliar" (inclusive).
const porFaixa = (v: number, avaliar: number, trocar: number): Criterio =>
  v < avaliar ? "manter" : v <= trocar ? "avaliar" : "trocar";

const GRAVIDADE: Criterio[] = ["sem_dado", "manter", "avaliar", "trocar"];

export function sinalDoAtivo(
  a: DadosDoAtivo,
  faixas: FaixasSinal,
  hoje: string,
): ResultadoSinal {
  const pesoPct =
    a.valorReposicao && a.valorReposicao > 0
      ? (a.custo12m / a.valorReposicao) * 100
      : null;
  const idadePct =
    a.compraData && a.vidaUtilAnos && a.vidaUtilAnos > 0
      ? (diasEntre(a.compraData, hoje) / 365.25 / a.vidaUtilAnos) * 100
      : null;

  const criterios = {
    peso:
      pesoPct === null
        ? ("sem_dado" as const)
        : porFaixa(pesoPct, faixas.pesoAvaliar, faixas.pesoTrocar),
    corretivas:
      a.corretivas12m >= faixas.corretivasTrocar
        ? ("trocar" as const)
        : a.corretivas12m >= faixas.corretivasAvaliar
          ? ("avaliar" as const)
          : ("manter" as const),
    idade:
      idadePct === null
        ? ("sem_dado" as const)
        : porFaixa(idadePct, faixas.idadeAvaliarPct, faixas.idadeTrocarPct),
  };

  // Sem reposição, vida útil ou compra não dá para dizer que está tudo bem.
  const incompleto = pesoPct === null || idadePct === null;
  const pior = Object.values(criterios).reduce((p, c) =>
    GRAVIDADE.indexOf(c) > GRAVIDADE.indexOf(p) ? c : p,
  );
  return {
    sinal: incompleto ? "incompleto" : (pior as Exclude<Criterio, "sem_dado">),
    pesoPct,
    idadePct,
    criterios,
  };
}

/** Média de dias entre corretivas seguidas (1 casa); null com menos de 2. */
export function tempoMedioEntreFalhasDias(datas: string[]): number | null {
  if (datas.length < 2) return null;
  const ordem = datas.map((d) => d.slice(0, 10)).sort();
  const primeira = ordem[0] as string;
  const ultima = ordem.at(-1) as string;
  return (
    Math.round((diasEntre(primeira, ultima) / (ordem.length - 1)) * 10) / 10
  );
}

/**
 * Dias (1 casa) em que o ativo ficou parado ou em manutenção dentro da janela
 * `de`..`ate` (datas inclusive). Período sem fim vai até agora.
 */
export function diasParado(
  periodos: { situacao: SituacaoAtivo; desde: string; ate: string | null }[],
  de: string,
  ate: string,
  agora: Date,
): number {
  const ini = deBrasilia(de).getTime();
  const fim = Math.min(
    deBrasilia(somarDias(ate, 1)).getTime(),
    agora.getTime(),
  );
  let ms = 0;
  for (const p of periodos) {
    if (p.situacao !== "parado" && p.situacao !== "em_manutencao") continue;
    const a = Math.max(instante(p.desde).getTime(), ini);
    const b = Math.min(
      p.ate ? instante(p.ate).getTime() : agora.getTime(),
      fim,
    );
    if (b > a) ms += b - a;
  }
  return Math.round((ms / MS_DIA) * 10) / 10;
}
