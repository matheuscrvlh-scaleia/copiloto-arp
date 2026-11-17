import { lerAtracoes } from "./atracoes";
import type { ContratoParaCasar, Leitura, ResumoBase } from "./comum";
import { lerEcocopos } from "./ecocopos";
import { lerEntrevistas } from "./entrevistas-forms";
import { lerProdutores } from "./produtores";
import { lerQuiosque } from "./quiosque";
import { lerTour } from "./tour";

// Os seis tipos de importação do histórico (spec 4.10), com o nome na tela
// e o leitor. `sustentabilidade.importacoes.tipo` usa as mesmas chaves.

export type TipoDeImportacao =
  | "entrevistas"
  | "atracoes"
  | "produtores"
  | "ecocopos"
  | "quiosque"
  | "tour";

/** O que o servidor passa a todos os leitores (cada um usa o que precisa). */
export interface ContextoDeImportacao {
  contratos?: ContratoParaCasar[];
  existentes?: { contrato_id: string; data: string }[];
  publicos?: string[];
}

export const TIPOS_DE_IMPORTACAO: Record<
  TipoDeImportacao,
  {
    rotulo: string;
    ler: (
      arquivo: ArrayBuffer | Uint8Array,
      ctx?: ContextoDeImportacao,
    ) => Promise<Leitura<unknown, ResumoBase>>;
  }
> = {
  entrevistas: {
    rotulo: "Respostas da entrevista (Questionário RSU)",
    ler: lerEntrevistas,
  },
  atracoes: { rotulo: "Atrações do Mercado Local", ler: (a) => lerAtracoes(a) },
  produtores: { rotulo: "Produtores da feira", ler: (a) => lerProdutores(a) },
  ecocopos: { rotulo: "Ecocopos (Souvenir)", ler: (a) => lerEcocopos(a) },
  quiosque: { rotulo: "Perguntas no quiosque", ler: lerQuiosque },
  tour: { rotulo: "Tour guiado", ler: (a) => lerTour(a) },
};

export * from "./atracoes";
export * from "./comum";
export * from "./ecocopos";
export * from "./entrevistas-forms";
export * from "./produtores";
export * from "./quiosque";
export * from "./tour";
