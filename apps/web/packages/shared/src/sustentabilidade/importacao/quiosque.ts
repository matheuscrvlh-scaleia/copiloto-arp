import {
  type Aba,
  type Aviso,
  abasDoArquivo,
  acharColunas,
  type Celula,
  isoDe,
  type Leitura,
  lerHora,
  lerNumero,
  linhaVazia,
  mesDoNome,
  normalizar,
  partesDaData,
  periodoDe,
  type RegrasDeColunas,
  type ResumoBase,
  similaridade,
  texto,
  vazia,
} from "./comum";

// "Tour Guiado ARP", abas "Quiosque_Nov25" a "Quiosque_Set26" (spec 4.10):
// uma pergunta por linha. As colunas mudam de mês para mês (número de
// pessoas e dificuldade só a partir de jul/2026), então o cabeçalho é
// procurado em cada aba. O mês da aba manda: data em outro mês com dia e
// mês trocados que batem com a aba é invertida (com aviso); senão a linha
// fica marcada para conferir. Público padronizado pela lista do formulário.
// Linhas vazias ou só com "." não entram.

export interface PerguntaQuiosque {
  aba: string;
  linha: number;
  data: string | null;
  horario: string | null;
  pergunta: string | null;
  /** Público já padronizado (valor da lista) ou como escrito, se fora dela. */
  publico: string;
  publico_original: string | null;
  cidade: string | null;
  pessoas: number | null;
  dificuldade: string | null;
  /** Dia e mês estavam trocados e foram invertidos. */
  invertida: boolean;
  /** Data fora do mês da aba sem correção possível. */
  conferir: boolean;
}

export interface ResumoQuiosque extends ResumoBase {
  por_mes: {
    competencia: string;
    aba: string;
    perguntas: number;
    invertidas: number;
    conferir: number;
    colunas: string[];
  }[];
  publico: Record<string, number>;
}

export interface ContextoQuiosque {
  /** Opções do campo público do formulário do programa. */
  publicos?: string[];
}

/** Opções do spec 4.8 (o formulário do programa pode trocar). */
export const PUBLICOS_PADRAO = [
  "Turista",
  "Friburguense",
  "Entrega",
  "Trabalhador",
  "Não informado",
];
const NAO_INFORMADO = /^nao informad/;

const REGRAS = {
  dia_semana: [/semana/],
  data: [/^data$/, /^data\b/, /^dia$/],
  horario: [/^hora(rio)?\b/],
  pergunta: [/pergunta/, /duvida/, /^assunto/, /informac/, /^o que/],
  publico: [/publico/, /^perfil/, /^tipo/],
  cidade: [/cidade/, /origem/, /procedencia/, /de onde/],
  pessoas: [/pessoas/, /^qtd/, /^quant/, /^n(o|umero)?\.? de/],
  dificuldade: [/dificuldade/],
} satisfies RegrasDeColunas<string>;
type Campo = keyof typeof REGRAS;

/** "Quiosque_Nov25", "Quiosque Set 2026" → mês e ano. */
export function mesDaAbaQuiosque(
  nome: string,
): { mes: number; ano: number } | null {
  const m = /^quiosque[\s_\-–]*([a-z]{3,9})[\s_\-–/]*(\d{2}|\d{4})$/.exec(
    normalizar(nome),
  );
  if (!m) return null;
  const mes = mesDoNome(m[1] ?? "");
  if (!mes) return null;
  const a = m[2] ?? "";
  return { mes, ano: a.length === 2 ? 2000 + Number(a) : Number(a) };
}

/** Público escrito → opção da lista (igual, começo ou nome parecido). */
export function padronizarPublico(
  t: string,
  lista: string[],
): { valor: string; naLista: boolean } {
  const n = normalizar(t);
  const naoInformado =
    lista.find((p) => NAO_INFORMADO.test(normalizar(p))) ?? "Não informado";
  if (!n) return { valor: naoInformado, naLista: true };
  const achada =
    lista.find((p) => normalizar(p) === n) ??
    lista.find((p) => {
      const pn = normalizar(p);
      const raiz = pn.slice(0, Math.max(5, pn.length - 2));
      return (
        n.startsWith(raiz) ||
        pn.startsWith(n.slice(0, Math.max(5, n.length - 2)))
      );
    }) ??
    lista
      .map((p) => ({ p, s: similaridade(p, t) }))
      .filter((x) => x.s >= 0.8)
      .sort((a, b) => b.s - a.s)[0]?.p;
  return achada
    ? { valor: achada, naLista: true }
    : { valor: texto(t), naLista: false };
}

/** Data do quiosque conferida com o mês da aba. */
export function dataNoMesDaAba(
  c: Celula | undefined,
  aba: { mes: number; ano: number },
): { data: string | null; invertida: boolean; conferir: boolean } {
  const p = partesDaData(c);
  if (!p) return { data: null, invertida: false, conferir: true };
  const ano = p.ano ?? aba.ano;
  if (p.mes === aba.mes && ano === aba.ano) {
    const data = isoDe(ano, p.mes, p.dia);
    return { data, invertida: false, conferir: !data };
  }
  if (p.dia === aba.mes && ano === aba.ano) {
    const data = isoDe(ano, aba.mes, p.mes);
    if (data) return { data, invertida: true, conferir: false };
  }
  return { data: isoDe(ano, p.mes, p.dia), invertida: false, conferir: true };
}

const cabecalhoDa = (l: Celula[]) => {
  const c = acharColunas(l, REGRAS);
  return (
    (c.pergunta !== undefined || c.data !== undefined) &&
    Object.keys(c).length >= 2
  );
};

export function lerQuiosqueDasAbas(
  abas: Aba[],
  ctx: ContextoQuiosque = {},
): Leitura<PerguntaQuiosque, ResumoQuiosque> {
  const lista = ctx.publicos?.length ? ctx.publicos : PUBLICOS_PADRAO;
  const avisos: Aviso[] = [];
  const linhas: PerguntaQuiosque[] = [];
  const porMes: ResumoQuiosque["por_mes"] = [];
  const doTipo = abas.filter((a) => /^quiosque/.test(normalizar(a.nome)));
  if (!doTipo.length)
    avisos.push({
      nivel: "erro",
      mensagem: 'Nenhuma aba "Quiosque_<mês><ano>" no arquivo.',
    });
  const padronizados = new Map<string, { valor: string; n: number }>();
  const foraDaLista = new Map<string, number>();

  for (const aba of doTipo) {
    const mesAba = mesDaAbaQuiosque(aba.nome);
    if (!mesAba) {
      avisos.push({
        nivel: "erro",
        aba: aba.nome,
        mensagem: "Nome da aba sem mês e ano (ex.: Quiosque_Nov25): não lida.",
      });
      continue;
    }
    const iCab = aba.linhas.findIndex(cabecalhoDa);
    if (iCab < 0) {
      avisos.push({
        nivel: "erro",
        aba: aba.nome,
        mensagem: "Cabeçalho (Pergunta, Data, Público...) não encontrado.",
      });
      continue;
    }
    const col = acharColunas(aba.linhas[iCab] ?? [], REGRAS);
    const get = (l: Celula[], k: Campo) => {
      const i = col[k];
      return i === undefined ? null : (l[i] ?? null);
    };
    const significativos: Campo[] = [
      "pergunta",
      "publico",
      "cidade",
      "pessoas",
      "dificuldade",
      "horario",
    ];
    const doMes: PerguntaQuiosque[] = [];
    const invertidas: number[] = [];
    for (let i = iCab + 1; i < aba.linhas.length; i++) {
      const l = aba.linhas[i] ?? [];
      if (linhaVazia(l) || significativos.every((k) => vazia(get(l, k))))
        continue;
      const linha = i + 1;
      if (cabecalhoDa(l)) continue; // cabeçalho repetido no meio da aba
      const d = dataNoMesDaAba(get(l, "data"), mesAba);
      if (d.invertida) invertidas.push(linha);
      if (d.conferir)
        avisos.push({
          nivel: "aviso",
          aba: aba.nome,
          linha,
          mensagem: vazia(get(l, "data"))
            ? "Pergunta sem data: conferir."
            : `Data "${texto(get(l, "data"))}" fora do mês da aba e sem inversão possível: conferir.`,
        });
      const pubTexto = vazia(get(l, "publico")) ? "" : texto(get(l, "publico"));
      const pub = padronizarPublico(pubTexto, lista);
      if (
        pubTexto &&
        pub.naLista &&
        normalizar(pub.valor) !== normalizar(pubTexto)
      ) {
        const k = `${pubTexto}→${pub.valor}`;
        padronizados.set(k, {
          valor: pub.valor,
          n: (padronizados.get(k)?.n ?? 0) + 1,
        });
      }
      if (!pub.naLista)
        foraDaLista.set(pub.valor, (foraDaLista.get(pub.valor) ?? 0) + 1);
      const pessoas = lerNumero(get(l, "pessoas"));
      if (pessoas !== null && Number.isNaN(pessoas))
        avisos.push({
          nivel: "aviso",
          aba: aba.nome,
          linha,
          mensagem: `Número de pessoas "${texto(get(l, "pessoas"))}" não é número.`,
        });
      if (vazia(get(l, "pergunta")))
        avisos.push({
          nivel: "info",
          aba: aba.nome,
          linha,
          mensagem:
            "Linha sem o texto da pergunta (entra pelos outros campos).",
        });
      doMes.push({
        aba: aba.nome,
        linha,
        data: d.data,
        horario: lerHora(get(l, "horario")),
        pergunta: vazia(get(l, "pergunta")) ? null : texto(get(l, "pergunta")),
        publico: pub.valor,
        publico_original: pubTexto || null,
        cidade: vazia(get(l, "cidade")) ? null : texto(get(l, "cidade")),
        pessoas: pessoas === null || Number.isNaN(pessoas) ? null : pessoas,
        dificuldade: vazia(get(l, "dificuldade"))
          ? null
          : texto(get(l, "dificuldade")),
        invertida: d.invertida,
        conferir: d.conferir,
      });
    }
    if (invertidas.length)
      avisos.push({
        nivel: "aviso",
        aba: aba.nome,
        mensagem: `${invertidas.length} data(s) com dia e mês trocados corrigidas para o mês da aba (linhas ${invertidas.join(", ")}).`,
      });
    porMes.push({
      competencia: `${mesAba.ano}-${String(mesAba.mes).padStart(2, "0")}`,
      aba: aba.nome,
      perguntas: doMes.length,
      invertidas: invertidas.length,
      conferir: doMes.filter((p) => p.conferir).length,
      colunas: (Object.keys(col) as Campo[]).filter((k) => k !== "dia_semana"),
    });
    linhas.push(...doMes);
  }

  for (const [k, { n }] of padronizados) {
    const [de, para] = k.split("→");
    avisos.push({
      nivel: "info",
      mensagem: `Público "${de}" padronizado como ${para} (${n}).`,
    });
  }
  for (const [v, n] of foraDaLista)
    avisos.push({
      nivel: "aviso",
      mensagem: `Público "${v}" fora da lista do formulário (${n}): entra como escrito.`,
    });

  const publico: Record<string, number> = {};
  for (const l of linhas) publico[l.publico] = (publico[l.publico] ?? 0) + 1;
  return {
    linhas,
    resumo: {
      linhas: linhas.length,
      periodo: periodoDe(linhas.map((l) => l.data)),
      por_mes: porMes.sort((a, b) =>
        a.competencia.localeCompare(b.competencia),
      ),
      publico,
    },
    avisos,
    decisoes: [],
  };
}

export async function lerQuiosque(
  arquivo: ArrayBuffer | Uint8Array,
  ctx?: ContextoQuiosque,
) {
  return lerQuiosqueDasAbas(await abasDoArquivo(arquivo), ctx);
}
