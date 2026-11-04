import type { OpcoesQuestionario } from "@/lib/comercial/censo";
import type { ResultadoLeitura } from "@/lib/comercial/importacao";

// Leitura da planilha de respostas do Censo 2026 (Google Forms + a coluna
// "Ticket ajustado") e as conferências de 4.13: cabeçalho diferente
// bloqueia; empresa repetida conta só a mais recente; texto em número fica
// fora daquele indicador; bloco ou segmento fora da lista entra "(vazio)".
// Puro: quem lê o arquivo (xlsx ou csv) e grava é o servidor.

export type CelulaCenso = string | number | boolean | Date | null;

export type ColunaCenso =
  | "carimbo"
  | "email"
  | "bloco"
  | "segmento"
  | "empresa"
  | "colaboradores"
  | "visitantes"
  | "ticket"
  | "conversoes"
  | "expectativas"
  | "sugestao"
  | "ticketAjustado";

/**
 * Colunas esperadas, na ordem do Forms. O cabeçalho bate pelo começo do
 * texto, sem diferença de acento, maiúscula e espaço (o Forms escreve a
 * pergunta inteira, com os exemplos).
 */
export const COLUNAS_CENSO: {
  chave: ColunaCenso;
  rotulo: string;
  comeca: string[];
}[] = [
  {
    chave: "carimbo",
    rotulo: "Carimbo de data/hora",
    comeca: ["carimbo de data/hora", "carimbo de data", "timestamp"],
  },
  {
    chave: "email",
    rotulo: "Endereço de e-mail",
    comeca: ["endereco de e-mail", "e-mail", "email"],
  },
  { chave: "bloco", rotulo: "Bloco", comeca: ["bloco"] },
  { chave: "segmento", rotulo: "Segmento", comeca: ["segmento"] },
  {
    chave: "empresa",
    rotulo: "Qual o nome de sua empresa? (nome comercial)",
    comeca: ["qual o nome de sua empresa"],
  },
  {
    chave: "colaboradores",
    rotulo: "Sua empresa tem quantos colaboradores, incluindo os sócios?",
    comeca: ["sua empresa tem quantos colaboradores"],
  },
  {
    chave: "visitantes",
    rotulo:
      "Em média, quantas pessoas (usuários ou clientes finais) visitam ou frequentam sua empresa diariamente…",
    comeca: ["em media, quantas pessoas"],
  },
  {
    chave: "ticket",
    rotulo:
      "Quanto, normalmente, o seu cliente está disposto a consumir no seu negócio? (ticket médio)",
    comeca: ["quanto, normalmente, o seu cliente"],
  },
  {
    chave: "conversoes",
    rotulo:
      "Qual o volume médio de conversões (vendas) por dia no seu negócio?",
    comeca: ["qual o volume medio de conversoes"],
  },
  {
    chave: "expectativas",
    rotulo:
      "Pensando nas expectativas para o ano, o planejamento da sua empresa no Espaço ARP é:",
    comeca: ["pensando nas expectativas"],
  },
  {
    chave: "sugestao",
    rotulo: "Para finalizar: recebeu alguma sugestão de clientes…",
    comeca: ["para finalizar"],
  },
  {
    chave: "ticketAjustado",
    rotulo: "Ticket ajustado",
    comeca: ["ticket ajustado"],
  },
];

const normal = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const texto = (c: CelulaCenso | undefined): string =>
  c === null || c === undefined
    ? ""
    : c instanceof Date
      ? c.toISOString()
      : String(c).trim();

export interface CabecalhoCenso {
  /** Índice da coluna na planilha, por campo. */
  indices: Record<ColunaCenso, number>;
  faltam: string[];
  /** Cabeçalhos que não são de nenhuma pergunta (mudaram ou sobraram). */
  desconhecidas: string[];
}

export function lerCabecalho(linha: CelulaCenso[]): CabecalhoCenso {
  const indices = {} as Record<ColunaCenso, number>;
  const desconhecidas: string[] = [];
  linha.forEach((c, i) => {
    const t = normal(texto(c));
    if (!t) return;
    // A mais específica primeiro: "e-mail" não pode pegar outra pergunta.
    const col = COLUNAS_CENSO.find(
      (k) =>
        indices[k.chave] === undefined &&
        k.comeca.some((p) => (p.length <= 8 ? t === p : t.startsWith(p))),
    );
    if (col) indices[col.chave] = i;
    else desconhecidas.push(texto(c));
  });
  const faltam = COLUNAS_CENSO.filter(
    (k) => indices[k.chave] === undefined,
  ).map((k) => k.rotulo);
  return { indices, faltam, desconhecidas };
}

export interface LinhaCenso {
  /** Linha na planilha (a 1 é o cabeçalho). */
  linha: number;
  /** ISO com o fuso de Brasília (ou null se a data não veio). */
  carimbo: string | null;
  email: string | null;
  bloco: string | null;
  segmento: string | null;
  empresa: string;
  colaboradores: number | null;
  visitantes: number | null;
  ticket: number | null;
  ticketAjustado: number | null;
  mensalidade: boolean | null;
  dias: number | null;
  conversoes: number | null;
  expectativas: string[];
  sugestao: string | null;
  /** Só uma por empresa conta (a mais recente, ou a que o usuário escolher). */
  considerada: boolean;
  /** Chave da empresa para achar as repetidas. */
  chaveEmpresa: string;
  avisos: string[];
}

export interface LeituraCenso {
  linhas: LinhaCenso[];
  /** Linhas de empresa repetida que não contam. */
  duplicadas: number;
  comAviso: number;
  /** Data da primeira e da última resposta (aaaa-mm-dd). */
  inicio: string | null;
  fim: string | null;
}

export type ResultadoCenso =
  | { ok: true; leitura: LeituraCenso }
  | { ok: false; erro: string; faltam: string[]; desconhecidas: string[] };

const pad = (n: number) => String(n).padStart(2, "0");

/** Data e hora do Forms: Date do Excel ou "dd/mm/aaaa hh:mm:ss". */
export function lerCarimbo(c: CelulaCenso | undefined): string | null {
  if (c instanceof Date && !Number.isNaN(c.getTime()))
    // O Excel não guarda fuso: o leitor devolve a hora escrita em UTC.
    return `${c.getUTCFullYear()}-${pad(c.getUTCMonth() + 1)}-${pad(c.getUTCDate())}T${pad(c.getUTCHours())}:${pad(c.getUTCMinutes())}:${pad(c.getUTCSeconds())}-03:00`;
  const t = texto(c);
  const m =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      t,
    );
  if (m) {
    const [, d, mes, a, h = "0", mi = "0", s = "0"] = m;
    return `${a}-${pad(Number(mes))}-${pad(Number(d))}T${pad(Number(h))}:${pad(Number(mi))}:${pad(Number(s))}-03:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return t;
  return null;
}

type Numero = number | null | "texto";

/** Inteiro >= 0, aceitando "1.200"; texto ("-", "cerca de 20") é recusado. */
export function lerInteiro(c: CelulaCenso | undefined): Numero {
  if (typeof c === "number") return Number.isInteger(c) && c >= 0 ? c : "texto";
  const t = texto(c).replace(/\s/g, "");
  if (!t) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return /^\d+$/.test(t) ? Number(t) : "texto";
}

/** Valor em reais >= 0 ("R$ 45,90", "1.234,56", 45.9). */
export function lerValor(c: CelulaCenso | undefined): Numero {
  if (typeof c === "number") return c >= 0 && Number.isFinite(c) ? c : "texto";
  const t = texto(c).replace(/R\$|\s/g, "");
  if (!t) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$|^\d+,\d+$/.test(t))
    return Number(t.replace(/\./g, "").replace(",", "."));
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : "texto";
}

const chaveDe = (nome: string) =>
  normal(nome)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function daLista(valor: string, lista: string[]): string | null {
  const n = normal(valor);
  return lista.find((o) => normal(o) === n) ?? null;
}

/** "Bloco 09" ou "09" → "9" (se estiver na lista). */
function blocoDa(valor: string, blocos: string[]): string | null {
  const t = valor.replace(/^bloco\s*/i, "").replace(/^0+(?=\w)/, "");
  return daLista(t, blocos);
}

/** As opções marcadas no Forms vêm numa célula, separadas por vírgula. */
function expectativasDa(
  valor: string,
  opcoes: string[],
): { marcadas: string[]; fora: string[] } {
  const marcadas: string[] = [];
  const fora: string[] = [];
  let resto = normal(valor);
  // As opções podem ter vírgula no meio: procura cada uma inteira.
  for (const o of [...opcoes].sort((a, b) => b.length - a.length)) {
    const n = normal(o);
    if (resto.includes(n)) {
      marcadas.push(o);
      resto = resto.replace(n, "");
    }
  }
  for (const s of resto.split(/[,;]/)) if (s.trim()) fora.push(s.trim());
  return { marcadas: opcoes.filter((o) => marcadas.includes(o)), fora };
}

const AVISO_TEXTO = (rotulo: string, valor: string) =>
  `Texto em "${rotulo}" ("${valor}"): fica fora desse indicador.`;

/**
 * Lê as linhas da planilha (a primeira é o cabeçalho). As opções são as
 * listas do Censo (Configurações). O dia de mensalidade sai da coluna
 * "Ticket ajustado": ticket ÷ ajustado.
 */
export function lerPlanilhaCenso(
  planilha: CelulaCenso[][],
  opcoes: OpcoesQuestionario,
): ResultadoCenso {
  const [cabecalho = [], ...corpo] = planilha;
  const cab = lerCabecalho(cabecalho);
  if (cab.faltam.length)
    return {
      ok: false,
      erro: "Os cabeçalhos são diferentes do esperado. Confira as colunas que faltam ou mudaram.",
      faltam: cab.faltam,
      desconhecidas: cab.desconhecidas,
    };
  const ix = cab.indices;
  const linhas: LinhaCenso[] = [];
  corpo.forEach((celulas, i) => {
    if (!celulas.some((c) => texto(c) !== "")) return;
    const numero = i + 2;
    const avisos: string[] = [];
    const cel = (k: ColunaCenso) => celulas[ix[k]];
    const num = (k: ColunaCenso, rotulo: string, ler: typeof lerInteiro) => {
      const v = ler(cel(k));
      if (v === "texto") {
        avisos.push(AVISO_TEXTO(rotulo, texto(cel(k))));
        return null;
      }
      return v;
    };

    const empresa = texto(cel("empresa")) || `(sem nome, linha ${numero})`;
    if (!texto(cel("empresa"))) avisos.push("Sem o nome da empresa.");
    const carimbo = lerCarimbo(cel("carimbo"));
    if (!carimbo) avisos.push("Sem data e hora da resposta.");

    const blocoLido = texto(cel("bloco"));
    const bloco = blocoLido ? blocoDa(blocoLido, opcoes.blocos) : null;
    if (blocoLido && !bloco)
      avisos.push(`Bloco "${blocoLido}" fora da lista: entra como (vazio).`);
    const segLido = texto(cel("segmento"));
    const segmento = segLido ? daLista(segLido, opcoes.segmentos) : null;
    if (segLido && !segmento)
      avisos.push(`Segmento "${segLido}" fora da lista: entra como (vazio).`);

    const ticket = num("ticket", "ticket médio", lerValor);
    let ajustado = num("ticketAjustado", "Ticket ajustado", lerValor);
    if (ajustado === null && ticket !== null) ajustado = ticket;
    if (ticket === null) ajustado = null;
    const mensal =
      ticket !== null &&
      ajustado !== null &&
      ajustado > 0 &&
      Math.abs(ticket - ajustado) > 0.005;
    const diasLidos = mensal
      ? Math.round((ticket as number) / (ajustado as number))
      : null;

    const { marcadas, fora } = expectativasDa(
      texto(cel("expectativas")),
      opcoes.expectativas,
    );
    if (fora.length)
      avisos.push(
        `Expectativa fora da lista: ${fora.map((f) => `"${f}"`).join(", ")}.`,
      );

    linhas.push({
      linha: numero,
      carimbo,
      email: texto(cel("email")) || null,
      bloco,
      segmento,
      empresa,
      colaboradores: num("colaboradores", "colaboradores", lerInteiro),
      visitantes: num("visitantes", "visitantes por dia", lerInteiro),
      ticket,
      ticketAjustado: ajustado,
      mensalidade: ticket === null ? null : mensal,
      dias:
        diasLidos !== null && diasLidos >= 1 && diasLidos <= 31
          ? diasLidos
          : null,
      conversoes: num("conversoes", "conversões por dia", lerInteiro),
      expectativas: marcadas,
      sugestao: texto(cel("sugestao")) || null,
      considerada: true,
      chaveEmpresa: chaveDe(empresa),
      avisos,
    });
  });

  // Empresa repetida: conta a mais recente (empate: a de baixo).
  const grupos = new Map<string, LinhaCenso[]>();
  for (const l of linhas)
    grupos.set(l.chaveEmpresa, [...(grupos.get(l.chaveEmpresa) ?? []), l]);
  for (const g of grupos.values()) {
    if (g.length < 2) continue;
    const vale = g.reduce((a, b) =>
      (b.carimbo ?? "") >= (a.carimbo ?? "") ? b : a,
    );
    for (const l of g) {
      l.considerada = l === vale;
      const outras = g
        .filter((o) => o !== l)
        .map((o) => o.linha)
        .join(", ");
      l.avisos.push(
        l === vale
          ? `Empresa repetida (linhas ${outras}): conta esta, a mais recente.`
          : `Empresa repetida: não conta; vale a linha ${vale.linha}, mais recente.`,
      );
    }
  }

  const datas = linhas
    .map((l) => l.carimbo?.slice(0, 10))
    .filter((d): d is string => !!d)
    .sort();
  return {
    ok: true,
    leitura: {
      linhas,
      duplicadas: linhas.filter((l) => !l.considerada).length,
      comAviso: linhas.filter((l) => l.avisos.length).length,
      inicio: datas[0] ?? null,
      fim: datas.at(-1) ?? null,
    },
  };
}

/**
 * Troca qual das repetidas conta: as linhas escolhidas passam a contar e as
 * outras da mesma empresa saem. Escolha que não é de repetida é ignorada.
 */
export function escolherConsideradas(
  leitura: LeituraCenso,
  escolhidas: number[],
): LeituraCenso {
  const marcadas = new Set(escolhidas);
  const linhas = leitura.linhas.map((l) => ({ ...l }));
  const grupos = new Map<string, LinhaCenso[]>();
  for (const l of linhas)
    grupos.set(l.chaveEmpresa, [...(grupos.get(l.chaveEmpresa) ?? []), l]);
  for (const g of grupos.values()) {
    if (g.length < 2) continue;
    const escolhida = g.find((l) => marcadas.has(l.linha));
    if (!escolhida) continue;
    for (const l of g) l.considerada = l === escolhida;
  }
  return {
    ...leitura,
    linhas,
    duplicadas: linhas.filter((l) => !l.considerada).length,
  };
}

/** Ano da rodada pelas respostas ("Censo 2026"). */
export function nomeDaRodada(leitura: LeituraCenso): string | null {
  return leitura.fim ? `Censo ${leitura.fim.slice(0, 4)}` : null;
}

// ---------------------------------------------------------------------------
// Contrato comum das importações (lib/comercial/importacao.ts)
// ---------------------------------------------------------------------------

/** Colunas da prévia, na ordem de `valores`. */
export const COLUNAS_PREVIA_CENSO = [
  "Data",
  "Empresa",
  "Bloco",
  "Segmento",
  "Colaboradores",
  "Visitantes por dia",
  "Ticket",
  "Ticket ajustado",
  "Conversões por dia",
  "Expectativas",
];

const numeroBr = (v: number | null, casas = 0) =>
  v === null
    ? "—"
    : v.toLocaleString("pt-BR", {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
      });

/** A leitura no formato que a tela de Importações mostra e a gravação recebe. */
export function paraResultadoLeitura(
  r: ResultadoCenso,
  aba: string,
  recebido: CelulaCenso[],
): ResultadoLeitura<LinhaCenso> {
  if (!r.ok)
    return {
      cabecalho: {
        aba,
        esperado: COLUNAS_CENSO.map((c) => c.rotulo),
        recebido: recebido.map((c) => texto(c)),
        faltam: r.faltam,
        sobram: r.desconhecidas,
        foraDeOrdem: false,
      },
    };
  const porEmpresa = new Map<string, number>();
  for (const l of r.leitura.linhas)
    porEmpresa.set(l.chaveEmpresa, (porEmpresa.get(l.chaveEmpresa) ?? 0) + 1);
  if (!r.leitura.linhas.length)
    return { erro: "A planilha não tem nenhuma resposta." };
  return {
    ok: {
      colunas: COLUNAS_PREVIA_CENSO,
      avisos: [],
      linhas: r.leitura.linhas.map((l) => {
        const repetida = (porEmpresa.get(l.chaveEmpresa) ?? 0) > 1;
        return {
          linha: l.linha,
          valores: [
            l.carimbo
              ? `${l.carimbo.slice(8, 10)}/${l.carimbo.slice(5, 7)}/${l.carimbo.slice(0, 4)}`
              : "—",
            l.empresa,
            l.bloco ?? "(vazio)",
            l.segmento ?? "(vazio)",
            numeroBr(l.colaboradores),
            numeroBr(l.visitantes),
            numeroBr(l.ticket, 2),
            numeroBr(l.ticketAjustado, 2),
            numeroBr(l.conversoes),
            l.expectativas.join("; "),
          ],
          duplicada: repetida,
          entra: l.considerada,
          avisos: l.avisos,
          grupo: repetida ? l.chaveEmpresa : undefined,
          dados: l,
        };
      }),
    },
  };
}
