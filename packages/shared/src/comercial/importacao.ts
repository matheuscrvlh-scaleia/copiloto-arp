// Contrato comum das importações do histórico (spec 4.13): escolher o tipo e
// o arquivo → prévia (linhas, duplicadas, avisos) → confirmar → histórico com
// desfazer. Cada tipo escreve só o leitor (puro) e a gravação; a tela de
// Configurações › Importações chama as duas ações de cada tipo:
//
//   previaImportacao<Tipo>(anterior: EstadoPrevia, form: FormData): Promise<EstadoPrevia>
//     form: "arquivo" (File)
//   confirmarImportacao<Tipo>(anterior: EstadoConfirmacao, form: FormData): Promise<EstadoConfirmacao>
//     form: "importacao_id", "substituir" ("on" quando o arquivo já foi
//     importado e a pessoa aceitou substituir), "escolha.<grupo>" (linha
//     escolhida em cada grupo de duplicadas)
//
// O trabalho comum (permissão por tipo, hash, Storage, linha em
// comercial.importacoes, "arquivo já importado", substituir) está em
// prepararPrevia/confirmarImportacao de src/server/comercial/importacoes.ts.

export type TipoImportacao = "censo" | "fichas" | "pesquisa" | "contatos";

export const TIPOS_IMPORTACAO: Record<
  TipoImportacao,
  { rotulo: string; arquivo: string; destino: string }
> = {
  censo: {
    rotulo: "Censo 2026",
    arquivo:
      "Planilha de respostas do Censo 2026 (com a coluna Ticket ajustado)",
    destino: "Rodada “Censo 2026” fechada",
  },
  fichas: {
    rotulo: "Forms cadastral",
    arquivo: "Respostas do Google Forms cadastral (coluna 1 = data e hora)",
    destino: "Fichas com origem “Google Forms”",
  },
  pesquisa: {
    rotulo: "Pesquisa de mercado",
    arquivo: "Aba Base de Dados da pesquisa de preços",
    destino: "Imóveis da Pesquisa de mercado",
  },
  contatos: {
    rotulo: "Feedbacks antigos",
    arquivo: "Aba Feedbacks da planilha Gestão Comercial",
    destino: "Registros de contato do tipo Feedback",
  },
};

export const TIPOS_ORDEM: TipoImportacao[] = [
  "censo",
  "fichas",
  "pesquisa",
  "contatos",
];

/** Nomes dos campos do formulário. */
export const CAMPO_ARQUIVO = "arquivo";
export const CAMPO_IMPORTACAO = "importacao_id";
export const CAMPO_SUBSTITUIR = "substituir";
export const campoEscolha = (grupo: string) => `escolha.${grupo}`;

export const LIMITE_ARQUIVO_MB = 10;

// ---------------------------------------------------------------------------
// Tipos do contrato
// ---------------------------------------------------------------------------

export type Celula = string | number | boolean | Date | null;

/** Uma aba do arquivo (CSV vira uma aba só, com o nome do arquivo). */
export interface Aba {
  nome: string;
  linhas: Celula[][];
}

export interface AvisoImportacao {
  /** Linha no arquivo (cabeçalho = 1); null = aviso do arquivo inteiro. */
  linha: number | null;
  /** Coluna ou campo, como está no arquivo. */
  campo?: string;
  mensagem: string;
  /** Registro que já existe no sistema (ex.: a ficha atual com o mesmo CPF). */
  href?: string;
}

export interface LinhaDaPrevia {
  /** Linha no arquivo (cabeçalho = 1). */
  linha: number;
  /** Valores já formatados, na ordem de `colunas` da prévia. */
  valores: string[];
  /** Repetida no arquivo ou já no sistema. */
  duplicada: boolean;
  /** Entra na importação (uma duplicada que não conta fica false). */
  entra: boolean;
  /** Avisos desta linha (texto curto; a linha entra mesmo assim se `entra`). */
  avisos: string[];
  /**
   * Grupo de duplicadas que a pessoa pode trocar (ex.: a mesma empresa duas
   * vezes no Censo: entra a mais recente; "escolha.<grupo>" = outra linha).
   */
  grupo?: string;
}

/** Linha lida com o dado que a gravação usa. */
export interface LinhaLida<T> extends LinhaDaPrevia {
  dados: T;
}

export interface CabecalhoDiferente {
  /** Aba onde se esperava o cabeçalho. */
  aba: string;
  esperado: string[];
  recebido: string[];
  /** Colunas esperadas que não estão no arquivo (ou mudaram de nome). */
  faltam: string[];
  /** Colunas do arquivo que não estão no esperado. */
  sobram: string[];
  /** Mesmas colunas, fora da ordem esperada (quando a ordem importa). */
  foraDeOrdem: boolean;
}

/** O que o leitor de cada tipo devolve. */
export type ResultadoLeitura<T> =
  | {
      ok: {
        colunas: string[];
        linhas: LinhaLida<T>[];
        /** Avisos do arquivo inteiro (os de linha vão em cada linha). */
        avisos: AvisoImportacao[];
      };
    }
  | { cabecalho: CabecalhoDiferente }
  | { erro: string };

export interface ImportacaoAnterior {
  importacaoId: string;
  /** ISO. */
  em: string;
  por: string;
  linhas: number;
}

export interface PreviaImportacao {
  importacaoId: string;
  tipo: TipoImportacao;
  arquivo: string;
  linhas: number;
  duplicadas: number;
  comAviso: number;
  /** Quantas entram como está (sem escolhas). */
  entram: number;
  colunas: string[];
  itens: LinhaDaPrevia[];
  /** Avisos do arquivo inteiro e de cada linha (com `linha`). */
  avisos: AvisoImportacao[];
  /** O mesmo arquivo já foi importado: a tela pergunta se substitui. */
  jaImportado: ImportacaoAnterior | null;
}

export interface EstadoPrevia {
  previa?: PreviaImportacao;
  /** Cabeçalho diferente: bloqueia e mostra as colunas. */
  cabecalho?: CabecalhoDiferente;
  erro?: string;
}

export interface EstadoConfirmacao {
  ok?: string;
  erro?: string;
  importacaoId?: string;
  /** Linhas gravadas. */
  gravadas?: number;
}

export type AcaoPrevia = (
  anterior: EstadoPrevia,
  form: FormData,
) => Promise<EstadoPrevia>;
export type AcaoConfirmacao = (
  anterior: EstadoConfirmacao,
  form: FormData,
) => Promise<EstadoConfirmacao>;

// ---------------------------------------------------------------------------
// Regras puras usadas pelos leitores e pela tela
// ---------------------------------------------------------------------------

/** Cabeçalho comparável: sem acento, caixa, espaços repetidos e pontuação final. */
export function normalizarCabecalho(v: Celula | undefined): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\s:?.]+$/, "")
    .trim();
}

/**
 * Confere o cabeçalho do arquivo com o esperado. null = confere. Colunas
 * vazias no fim do arquivo são ignoradas; `emOrdem` exige a mesma ordem
 * (Forms: perguntas 1 a 48 na ordem).
 */
export function conferirCabecalho(
  aba: string,
  esperado: string[],
  recebido: Celula[],
  { emOrdem = false, sobrasPermitidas = false } = {},
): CabecalhoDiferente | null {
  const rec = recebido.map((c) => String(c ?? "").trim());
  while (rec.length && !rec[rec.length - 1]) rec.pop();
  const chavesRec = rec.map(normalizarCabecalho);
  const chavesEsp = esperado.map(normalizarCabecalho);
  const faltam = esperado.filter(
    (_, i) => !chavesRec.includes(chavesEsp[i] ?? ""),
  );
  const sobram = rec.filter(
    (c, i) => c && !chavesEsp.includes(chavesRec[i] ?? ""),
  );
  const foraDeOrdem =
    emOrdem && !faltam.length && chavesEsp.some((c, i) => chavesRec[i] !== c);
  if (!faltam.length && (sobrasPermitidas || !sobram.length) && !foraDeOrdem)
    return null;
  return {
    aba,
    esperado,
    recebido: rec,
    faltam,
    sobram: sobrasPermitidas ? [] : sobram,
    foraDeOrdem,
  };
}

/** Índice de cada coluna esperada no cabeçalho do arquivo (-1 se faltar). */
export function indicesDasColunas<K extends string>(
  colunas: Record<K, string>,
  cabecalho: Celula[],
): Record<K, number> {
  const chaves = cabecalho.map(normalizarCabecalho);
  const r = {} as Record<K, number>;
  for (const k of Object.keys(colunas) as K[])
    r[k] = chaves.indexOf(normalizarCabecalho(colunas[k]));
  return r;
}

/** Aba pelo nome (sem acento/caixa); sem nome, a primeira. */
export function abaPorNome(abas: Aba[], ...nomes: string[]): Aba | null {
  if (!nomes.length) return abas[0] ?? null;
  const alvo = nomes.map(normalizarCabecalho);
  return abas.find((a) => alvo.includes(normalizarCabecalho(a.nome))) ?? null;
}

/** Linha do arquivo toda vazia. */
export const linhaVazia = (l: Celula[] | undefined) =>
  !l || l.every((c) => c === null || String(c).trim() === "");

/** Contagens da prévia (o que vai em comercial.importacoes). */
export function contarPrevia(itens: LinhaDaPrevia[]) {
  return {
    linhas: itens.length,
    duplicadas: itens.filter((i) => i.duplicada).length,
    comAviso: itens.filter((i) => i.avisos.length > 0).length,
    entram: itens.filter((i) => i.entra).length,
  };
}

/** Linha escolhida em cada grupo ("escolha.<grupo>" = número da linha). */
export function escolhasDoForm(form: FormData): Map<string, number> {
  const r = new Map<string, number>();
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("escolha.") || typeof v !== "string") continue;
    const n = Number(v);
    if (Number.isInteger(n) && n > 0) r.set(k.slice("escolha.".length), n);
  }
  return r;
}

/**
 * Aplica as escolhas da pessoa: no grupo escolhido entra só a linha marcada;
 * grupo sem escolha fica como o leitor deixou. Escolha de linha que não é do
 * grupo é ignorada.
 */
export function aplicarEscolhas<L extends LinhaDaPrevia>(
  itens: L[],
  escolhas: Map<string, number>,
): L[] {
  return itens.map((i) => {
    if (!i.grupo || !escolhas.has(i.grupo)) return i;
    const escolhida = escolhas.get(i.grupo);
    const valida = itens.some(
      (o) => o.grupo === i.grupo && o.linha === escolhida,
    );
    return valida ? { ...i, entra: i.linha === escolhida } : i;
  });
}

/** Grupos com mais de uma linha (para a tela montar a escolha). */
export function gruposDeDuplicadas(
  itens: LinhaDaPrevia[],
): { grupo: string; linhas: LinhaDaPrevia[] }[] {
  const mapa = new Map<string, LinhaDaPrevia[]>();
  for (const i of itens) {
    if (!i.grupo) continue;
    mapa.set(i.grupo, [...(mapa.get(i.grupo) ?? []), i]);
  }
  return [...mapa]
    .filter(([, ls]) => ls.length > 1)
    .map(([grupo, linhas]) => ({ grupo, linhas }));
}

/** Avisos da prévia: os do arquivo e os de cada linha, por linha. */
export function juntarAvisos<T>(
  gerais: AvisoImportacao[],
  linhas: LinhaLida<T>[],
): AvisoImportacao[] {
  return [
    ...gerais,
    ...linhas.flatMap((l) =>
      l.avisos.map((mensagem) => ({ linha: l.linha, mensagem })),
    ),
  ];
}

/** Texto da célula (data vira dd/mm/aaaa). */
export function textoDaCelula(c: Celula | undefined): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) {
    const d = String(c.getUTCDate()).padStart(2, "0");
    const m = String(c.getUTCMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${c.getUTCFullYear()}`;
  }
  return String(c).trim();
}
