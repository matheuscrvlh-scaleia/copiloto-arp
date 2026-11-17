import { COLUNAS_CENSO } from "./censo-importacao";
import { ABA_FEEDBACKS, COLUNAS_FEEDBACKS } from "./feedbacks-importacao";
import { COLUNAS_FORMS } from "./ficha-importacao";
import type { Celula, TipoImportacao } from "./importacao";
import {
  COM_META,
  campoMeta,
  chaveMeta,
  competencia,
  INDICADORES_PAINEL,
  type IndicadorPainel,
  MESES_CURTOS,
} from "./painel";
import { CABECALHOS_PESQUISA } from "./pesquisa-importacao";

// Biblioteca de gabaritos: a planilha vazia (ou com o que já está no
// sistema) no formato que cada importação lê, para montar o arquivo sem
// erro de cabeçalho. Funções puras: a tela só desenha o .xlsx.

export interface Gabarito {
  aba: string;
  /** Primeira linha = cabeçalho; as outras, valores já preenchidos. */
  linhas: Celula[][];
  nomeArquivo: string;
}

/** Gabarito de cada tipo de importação do histórico (só o cabeçalho). */
export function gabaritoDeImportacao(tipo: TipoImportacao): Gabarito {
  switch (tipo) {
    case "censo":
      return {
        aba: "Respostas",
        linhas: [COLUNAS_CENSO.map((c) => c.rotulo)],
        nomeArquivo: "gabarito-censo.xlsx",
      };
    case "fichas":
      return {
        aba: "Respostas",
        linhas: [COLUNAS_FORMS.map((c) => c.titulo)],
        nomeArquivo: "gabarito-fichas.xlsx",
      };
    case "pesquisa":
      return {
        aba: "Base de Dados",
        linhas: [Object.values(CABECALHOS_PESQUISA).map((c) => c.rotulo)],
        nomeArquivo: "gabarito-pesquisa-de-mercado.xlsx",
      };
    case "contatos":
      return {
        aba: ABA_FEEDBACKS,
        linhas: [Object.values(COLUNAS_FEEDBACKS).map((c) => c.nome)],
        nomeArquivo: "gabarito-feedbacks.xlsx",
      };
  }
}

// ---------------------------------------------------------------------------
// Metas do Painel: indicador × mês do ano
// ---------------------------------------------------------------------------

const CABECALHO_METAS = ["Código", "Indicador"] as const;

const mesDoAno = (ano: number, m: number) =>
  `${MESES_CURTOS[m - 1]}/${String(ano).slice(2)}`;

/**
 * Gabarito das metas do ano: uma linha por indicador (o código fica na
 * coluna A para a leitura não depender do nome) e um mês por coluna, já com
 * as metas cadastradas.
 */
export function gabaritoDeMetas(
  ano: number,
  metas: { indicador: string; vigente_desde: string; meta: number }[],
): Gabarito {
  const valor = new Map(
    metas.map((m) => [`${m.indicador}|${m.vigente_desde}`, m.meta]),
  );
  const meses = MESES_CURTOS.map((_, i) => i + 1);
  return {
    aba: `Metas ${ano}`,
    linhas: [
      [...CABECALHO_METAS, ...meses.map((m) => mesDoAno(ano, m))],
      ...COM_META.map((i) => [
        i,
        INDICADORES_PAINEL[i].nome,
        ...meses.map(
          (m) => valor.get(`${chaveMeta(i)}|${competencia(ano, m)}`) ?? null,
        ),
      ]),
    ],
    nomeArquivo: `gabarito-metas-${ano}.xlsx`,
  };
}

const semAcento = (v: string) =>
  v.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();

/** Número da célula: número direto ou texto "1.234,5" / "1234.5". */
function numero(c: Celula | undefined): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  if (typeof c !== "string" || !c.trim()) return null;
  const t = c.trim().replace(/[R$%\s]/g, "");
  const n = Number(
    t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t,
  );
  return Number.isFinite(n) ? n : null;
}

export interface MetasLidas {
  /** Campo da grade (indicador.mês) → valor. */
  valores: Map<string, number>;
  avisos: string[];
}

/**
 * Lê o gabarito de metas (ou uma planilha no mesmo formato): acha o
 * indicador pelo código ou pelo nome e o mês pela coluna. Célula vazia não
 * mexe na grade. Nada é gravado: a tela preenche e a pessoa salva.
 */
export function lerGabaritoDeMetas(
  linhas: Celula[][],
  ano: number,
): MetasLidas {
  const valores = new Map<string, number>();
  const avisos: string[] = [];
  const [cabecalho, ...corpo] = linhas;
  if (!cabecalho) return { valores, avisos: ["A planilha está vazia."] };
  const colunaDoMes = new Map<number, number>();
  cabecalho.forEach((c, i) => {
    const t = semAcento(String(c ?? ""));
    const m = MESES_CURTOS.findIndex(
      (mes, k) =>
        t === semAcento(mesDoAno(ano, k + 1)) ||
        t === mes ||
        t.startsWith(`${mes}/`),
    );
    if (m >= 0) colunaDoMes.set(i, m + 1);
  });
  if (!colunaDoMes.size)
    return {
      valores,
      avisos: [
        "Não achei as colunas dos meses (jan/aa a dez/aa). Use o gabarito.",
      ],
    };
  const porNome = new Map(
    COM_META.map((i) => [semAcento(INDICADORES_PAINEL[i].nome), i]),
  );
  for (const [n, l] of corpo.entries()) {
    const codigo = String(l[0] ?? "").trim();
    const nome = semAcento(String(l[1] ?? l[0] ?? ""));
    const indicador: IndicadorPainel | undefined =
      COM_META.find((i) => i === codigo) ?? porNome.get(nome);
    if (!indicador) {
      if (codigo || nome)
        avisos.push(
          `Linha ${n + 2}: indicador “${codigo || nome}” não existe.`,
        );
      continue;
    }
    for (const [coluna, mes] of colunaDoMes) {
      const c = l[coluna];
      if (c === null || c === undefined || c === "") continue;
      const v = numero(c);
      if (v === null) {
        avisos.push(
          `${INDICADORES_PAINEL[indicador].nome}, ${MESES_CURTOS[mes - 1]}: “${String(c)}” não é número.`,
        );
        continue;
      }
      valores.set(campoMeta(indicador, mes), v);
    }
  }
  return { valores, avisos };
}
