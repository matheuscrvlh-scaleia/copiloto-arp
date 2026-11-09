import type { AvisoAgua, CampoAgua, ColunasPedidas, TipoAgua } from "./agua";

// Contrato entre a tela de importação da água (ImportarAgua, no navegador) e
// as ações do servidor: o que se envia, a prévia que volta e os limites.
// Sem "server-only": o componente cliente importa os tipos e os limites.

/** Limites técnicos do envio (não são regra de negócio). */
export const LIMITES_AGUA = {
  arquivos: 30,
  fotos: 800,
  planilhaBytes: 20 * 1024 * 1024,
  fotoBytes: 15 * 1024 * 1024,
} as const;

export type TipoArquivoAgua = "planilha" | "pdf" | "foto";

/** Pelo nome: .xlsx/.csv planilha, .pdf, .jpg/.jpeg/.png/.webp foto. */
export function tipoDoArquivo(nome: string): TipoArquivoAgua | null {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "xlsx" || ext === "csv") return "planilha";
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "foto";
  return null;
}

export interface ArquivoParaEnviar {
  nome: string;
  tamanho: number;
}

export type EnvioPreparado =
  | {
      envio: string;
      itens: { nome: string; caminho: string; url: string }[];
    }
  | { erro: string };

export interface PedidoDePrevia {
  envio: string;
  arquivos: { nome: string; caminho: string }[];
  /** "aaaa-mm", quando a pessoa escolheu o mês (o arquivo não dizia). */
  referencia?: string;
  /** Coluna escolhida para cada campo (índice), quando o arquivo pediu. */
  mapeamento?: Partial<Record<CampoAgua, number>>;
  /** Guardar o mapeamento como modelo de importação (Parâmetros). */
  salvarModelo?: boolean;
}

/** Conferência de um arquivo (um bloco) com o resumo dele. */
export interface ConferenciaArquivo {
  arquivo: string;
  blocos: string[];
  fonte: "planilha" | "pdf";
  linhas: number;
  resumoLinhas: number | null;
  /** m³ (duas casas na tela). */
  consumo: number;
  resumoConsumo: number | null;
  volume: number;
  resumoVolume: number | null;
  /** Reais; null sem a permissão de ver valores. */
  valor: number | null;
  resumoValor: number | null;
  bate: boolean;
  diferencas: string[];
}

export interface LinhaPrevia {
  id: string;
  bloco: string;
  sala: string;
  cliente: string;
  hidrometro: string;
  leituraAnterior: number | null;
  leituraAtual: number | null;
  consumo: number;
  volume: number;
  valor: number | null;
  tipo: TipoAgua;
  foto: boolean;
  /** Linha no arquivo (null: veio da importação anterior). */
  linha: number | null;
}

export interface PreviaAgua {
  id: string;
  referencia: string;
  bate: boolean;
  comValores: boolean;
  conferencias: ConferenciaArquivo[];
  /** Blocos que não vieram agora e continuam como estavam no mês. */
  mantidos: string[];
  /** O mês já confirmado que esta prévia substitui. */
  substitui: { em: string | null; por: string; incompleta: boolean } | null;
  totais: {
    linhas: number;
    consumo: number;
    volume: number;
    valor: number | null;
  };
  avisos: AvisoAgua[];
  ignoradas: { arquivo: string; linha: number; motivo: string }[];
  fotos: {
    ligadas: number;
    semLeitura: string[];
    recusadas: { nome: string; motivo: string }[];
    semFoto: number;
  };
  /** Hidrômetros que não existiam antes (conferir sala e bloco). */
  novos: string[];
  linhas: LinhaPrevia[];
}

export type RespostaPrevia =
  | { previa: PreviaAgua }
  | { colunas: ColunasPedidas & { podeSalvarModelo: boolean } }
  | { erro: string };

/** O que fica em operacoes.importacoes.resumo (sem reais: valores à parte). */
export interface ResumoGuardado {
  pasta: string;
  conferencias: Omit<ConferenciaArquivo, "valor" | "resumoValor">[];
  mantidos: string[];
  totais: { linhas: number; consumo: number; volume: number };
  fotos: PreviaAgua["fotos"];
  novos: string[];
  ignoradas: PreviaAgua["ignoradas"];
}

/** Valores em reais da conferência (operacoes.importacao_valores.por_bloco). */
export type ValoresPorArquivo = Record<
  string,
  { arquivo: number | null; lido: number }
>;
