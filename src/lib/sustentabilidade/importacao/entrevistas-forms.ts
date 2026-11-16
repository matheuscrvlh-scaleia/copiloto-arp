import {
  type DefinicaoFormulario,
  NAO_SE_APLICA,
  NIVEIS_GRADE,
  type Pergunta,
  type Respostas,
} from "../formulario/tipos";
import {
  type Aba,
  type Aviso,
  abasDoArquivo,
  type Celula,
  type ContratoParaCasar,
  casarLuc,
  chaveLuc,
  type Decisao,
  isoDaData,
  type Leitura,
  lerData,
  lerHora,
  lerNumero,
  linhaVazia,
  lucsDoTexto,
  normalizar,
  periodoDe,
  type ResumoBase,
  similaridade,
  texto,
  vazia,
} from "./comum";

// Respostas do Forms "Questionário RSU" (spec 4.10): a aba de respostas,
// uma linha por entrevista, uma coluna por pergunta na ordem do
// questionário (46). O Forms põe "Carimbo de data/hora" antes e, numa
// pergunta em grade, uma coluna por linha ("20. Estimativa [Orgânico]").
//
// Cada coluna vira o id `q<n>` da versão 1 do questionário: pelo número no
// começo do título quando houver ("7. Grau de..."), senão pela ordem. A
// resposta fica como texto (o Forms grava o texto da opção);
// `mapearParaDefinicao` converte para ids quando a definição existir.

export type ValorLido = string | number | Record<string, string> | null;

export interface EntrevistaLida {
  aba: string;
  linha: number;
  /** Data da entrevista (pergunta Data; sem ela, o carimbo do Forms). */
  data: string | null;
  /** Carimbo de data/hora do Forms ("aaaa-mm-ddThh:mm"). */
  carimbo: string | null;
  tipo: "primeira" | "atualizacao" | null;
  empresa: string | null;
  luc_texto: string | null;
  lucs: string[];
  contrato_id: string | null;
  /** { q1..q46: texto como no Forms; grade: { linha: nível } }. */
  respostas: Record<string, ValorLido>;
}

export interface ResumoEntrevistas extends ResumoBase {
  primeira: number;
  atualizacao: number;
  sem_tipo: number;
  sem_luc: number;
  a_vincular: number;
  duplicadas: number;
  perguntas: number;
}

export interface ContextoEntrevistas {
  /** Contratos para casar a LUC (sem a lista, o vínculo não é conferido). */
  contratos?: ContratoParaCasar[];
  /** Entrevistas já gravadas (bloqueia repetir contrato + data). */
  existentes?: { contrato_id: string; data: string }[];
  /** Perguntas do questionário v1 (o Forms tem 46). */
  perguntasEsperadas?: number;
}

const PERGUNTAS_V1 = 46;

const META = [
  /^carimbo/,
  /^timestamp/,
  /^endereco de e-?mail/,
  /^e-?mail$/,
  /^pontuacao/,
  /^score/,
];
const GRADE = /^(.*?)\s*\[(.+)\]\s*$/;
const NUMERO = /^q?(\d{1,2})\s*(?:[.)\-–:]|\s)\s*/i;

interface ColunaDePergunta {
  indice: number;
  id: string;
  titulo: string;
  /** Linha da grade ("Orgânico") quando a pergunta é uma grade. */
  item: string | null;
}

/** Colunas → perguntas `q<n>` (grade: várias colunas, uma pergunta). */
export function colunasDoForms(cabecalho: Celula[]): {
  carimbo: number | null;
  perguntas: ColunaDePergunta[];
} {
  let carimbo: number | null = null;
  const perguntas: ColunaDePergunta[] = [];
  let n = 0;
  let baseAnterior: string | null = null;
  cabecalho.forEach((c, indice) => {
    const t = texto(c);
    if (!t) return;
    const nt = normalizar(t);
    if (META.some((re) => re.test(nt))) {
      if (/^(carimbo|timestamp)/.test(nt)) carimbo = indice;
      return;
    }
    const g = GRADE.exec(t);
    const base = (g ? g[1] : t) ?? t;
    const item = g ? (g[2] ?? "").trim() : null;
    if (!(g && baseAnterior !== null && normalizar(base) === baseAnterior)) {
      const num = NUMERO.exec(base);
      n = num ? Number(num[1]) : n + 1;
    }
    baseAnterior = g ? normalizar(base) : null;
    perguntas.push({ indice, id: `q${n}`, titulo: base.trim(), item });
  });
  return { carimbo, perguntas };
}

const TITULOS = {
  empresa: [
    /nome da empresa/,
    /^(\d+\W*)?empresa$/,
    /razao social/,
    /nome fantasia/,
  ],
  luc: [/\bluc\b/],
  situacao: [/situacao/],
  data: [/^(\d+\W*)?data( da entrevista)?$/],
} as const;
const POSICAO = {
  empresa: "q1",
  luc: "q2",
  situacao: "q4",
  data: "q5",
} as const;

function colunaChave(
  perguntas: ColunaDePergunta[],
  campo: keyof typeof TITULOS,
): ColunaDePergunta | null {
  return (
    perguntas.find(
      (p) =>
        !p.item && TITULOS[campo].some((re) => re.test(normalizar(p.titulo))),
    ) ??
    perguntas.find((p) => p.id === POSICAO[campo]) ??
    null
  );
}

function valorDaCelula(c: Celula): string | number | null {
  if (vazia(c)) return null;
  if (c instanceof Date) return isoDaData(c);
  if (typeof c === "number") return c;
  return texto(c);
}

function carimboDe(c: Celula): string | null {
  if (c instanceof Date) return `${isoDaData(c)}T${lerHora(c) ?? "00:00"}`;
  const d = lerData(c);
  if (!d) return null;
  const h = /\s(\d{1,2}:\d{2})/.exec(texto(c));
  return `${d}T${h ? lerHora(h[1]) : "00:00"}`;
}

export function tipoDaSituacao(t: string): "primeira" | "atualizacao" | null {
  const n = normalizar(t);
  if (/atualiz/.test(n)) return "atualizacao";
  if (/^1|primeir/.test(n)) return "primeira";
  return null;
}

/** Aba de respostas: nome com "respostas", senão a que tem o carimbo do Forms. */
function abaDeRespostas(abas: Aba[]): Aba | null {
  return (
    abas.find((a) => /respost/.test(normalizar(a.nome))) ??
    abas.find((a) =>
      (a.linhas[0] ?? []).some((c) =>
        /^(carimbo|timestamp)/.test(normalizar(c)),
      ),
    ) ??
    abas[0] ??
    null
  );
}

/**
 * Linhas que repetem uma entrevista (mesmo contrato e data, no arquivo ou
 * já gravada). Sem contrato, compara pela LUC e, sem LUC, pela empresa.
 * Exportada para a prévia refazer depois dos vínculos manuais.
 */
export function entrevistasRepetidas(
  linhas: Pick<
    EntrevistaLida,
    "linha" | "data" | "contrato_id" | "luc_texto" | "empresa"
  >[],
  existentes: { contrato_id: string; data: string }[] = [],
): Map<number, string> {
  const chave = (l: (typeof linhas)[number]) => {
    if (!l.data) return null;
    if (l.contrato_id) return `c:${l.contrato_id}|${l.data}`;
    if (l.luc_texto) return `l:${chaveLuc(l.luc_texto)}|${l.data}`;
    return l.empresa ? `e:${normalizar(l.empresa)}|${l.data}` : null;
  };
  const vistas = new Map<string, string>(
    existentes.map((e) => [
      `c:${e.contrato_id}|${e.data}`,
      "já importada antes",
    ]),
  );
  const repetidas = new Map<number, string>();
  for (const l of linhas) {
    const k = chave(l);
    if (!k) continue;
    const ja = vistas.get(k);
    if (ja) repetidas.set(l.linha, ja);
    else vistas.set(k, `repete a linha ${l.linha}`);
  }
  return repetidas;
}

function sugestoes(
  empresa: string | null,
  candidatos: ContratoParaCasar[],
  contratos: ContratoParaCasar[],
): Extract<Decisao, { tipo: "vincular_contrato" }>["sugestoes"] {
  const porLuc = candidatos.map((c) => ({
    contrato_id: c.id,
    cliente_nome: c.cliente_nome,
    motivo: `LUC ${c.lucs.join(", ")}`,
  }));
  const porNome = empresa
    ? contratos
        .map((c) => ({ c, s: similaridade(empresa, c.cliente_nome) }))
        .filter((x) => x.s >= 0.7 && !candidatos.includes(x.c))
        .sort((a, b) => b.s - a.s)
        .slice(0, 3)
        .map(({ c }) => ({
          contrato_id: c.id,
          cliente_nome: c.cliente_nome,
          motivo: "nome do cliente parecido",
        }))
    : [];
  return [...porLuc, ...porNome];
}

export function lerEntrevistasDasAbas(
  abas: Aba[],
  ctx: ContextoEntrevistas = {},
): Leitura<EntrevistaLida, ResumoEntrevistas> {
  const avisos: Aviso[] = [];
  const decisoes: Decisao[] = [];
  const aba = abaDeRespostas(abas);
  const vazio: ResumoEntrevistas = {
    linhas: 0,
    periodo: { de: null, ate: null },
    primeira: 0,
    atualizacao: 0,
    sem_tipo: 0,
    sem_luc: 0,
    a_vincular: 0,
    duplicadas: 0,
    perguntas: 0,
  };
  if (!aba) {
    avisos.push({ nivel: "erro", mensagem: "O arquivo não tem abas." });
    return { linhas: [], resumo: vazio, avisos, decisoes };
  }
  const iCab = aba.linhas.findIndex(
    (l) => l.filter((c) => !vazia(c)).length >= 5,
  );
  if (iCab < 0) {
    avisos.push({
      nivel: "erro",
      aba: aba.nome,
      mensagem: "Cabeçalho das perguntas não encontrado.",
    });
    return { linhas: [], resumo: vazio, avisos, decisoes };
  }
  const { carimbo, perguntas } = colunasDoForms(aba.linhas[iCab] ?? []);
  const ids = new Set(perguntas.map((p) => p.id));
  const esperadas = ctx.perguntasEsperadas ?? PERGUNTAS_V1;
  if (ids.size !== esperadas)
    avisos.push({
      nivel: "aviso",
      aba: aba.nome,
      mensagem: `O arquivo tem ${ids.size} perguntas; o questionário v1 tem ${esperadas}. Confira se as colunas estão na ordem.`,
    });
  const col = {
    empresa: colunaChave(perguntas, "empresa"),
    luc: colunaChave(perguntas, "luc"),
    situacao: colunaChave(perguntas, "situacao"),
    data: colunaChave(perguntas, "data"),
  };
  if (!ctx.contratos)
    avisos.push({
      nivel: "info",
      mensagem:
        "Sem a lista de contratos: o vínculo pela LUC não foi conferido.",
    });

  const lidas: EntrevistaLida[] = [];
  for (let i = iCab + 1; i < aba.linhas.length; i++) {
    const l = aba.linhas[i] ?? [];
    if (linhaVazia(l)) continue;
    const linha = i + 1;
    const respostas: Record<string, ValorLido> = {};
    for (const p of perguntas) {
      const v = valorDaCelula(l[p.indice] ?? null);
      if (p.item) {
        const g = (respostas[p.id] as Record<string, string> | null) ?? {};
        if (v !== null) g[p.item] = String(v);
        respostas[p.id] = Object.keys(g).length ? g : null;
      } else respostas[p.id] = v;
    }
    const carimboLido = carimbo === null ? null : carimboDe(l[carimbo] ?? null);
    let data = col.data ? lerData(l[col.data.indice] ?? null) : null;
    if (!data && carimboLido) {
      data = carimboLido.slice(0, 10);
      avisos.push({
        nivel: "info",
        aba: aba.nome,
        linha,
        mensagem: "Sem a data da entrevista: usada a data do carimbo do Forms.",
      });
    }
    if (!data)
      avisos.push({
        nivel: "aviso",
        aba: aba.nome,
        linha,
        mensagem: "Entrevista sem data.",
      });
    const situacao = col.situacao ? texto(l[col.situacao.indice]) : "";
    const tipo = tipoDaSituacao(situacao);
    if (!tipo)
      avisos.push({
        nivel: "aviso",
        aba: aba.nome,
        linha,
        mensagem: `Situação "${situacao}" não é "1ª vez" nem "Atualização".`,
      });
    const lucTexto =
      col.luc && !vazia(l[col.luc.indice]) ? texto(l[col.luc.indice]) : null;
    const empresa =
      col.empresa && !vazia(l[col.empresa.indice])
        ? texto(l[col.empresa.indice])
        : null;
    let contrato_id: string | null = null;
    if (ctx.contratos) {
      const casado = lucTexto
        ? casarLuc(lucTexto, ctx.contratos)
        : { contrato_id: null, candidatos: [] };
      contrato_id = casado.contrato_id;
      if (!contrato_id)
        decisoes.push({
          tipo: "vincular_contrato",
          id: `vincular:${aba.nome}:${linha}`,
          aba: aba.nome,
          linha,
          luc_texto: lucTexto,
          empresa,
          sugestoes: sugestoes(empresa, casado.candidatos, ctx.contratos),
          mensagem: !lucTexto
            ? `Linha ${linha}${empresa ? ` (${empresa})` : ""}: entrevista sem LUC. Vincule o contrato.`
            : casado.candidatos.length > 1
              ? `Linha ${linha}: a LUC "${lucTexto}" é de mais de um contrato. Escolha o contrato.`
              : `Linha ${linha}: LUC "${lucTexto}" não encontrada nos contratos. Vincule o contrato.`,
        });
    }
    lidas.push({
      aba: aba.nome,
      linha,
      data,
      carimbo: carimboLido,
      tipo,
      empresa,
      luc_texto: lucTexto,
      lucs: lucTexto ? lucsDoTexto(lucTexto) : [],
      contrato_id,
      respostas,
    });
  }

  const repetidas = entrevistasRepetidas(lidas, ctx.existentes);
  for (const [linha, motivo] of repetidas)
    avisos.push({
      nivel: "erro",
      aba: aba.nome,
      linha,
      mensagem: `Mesma entrevista (contrato e data) ${motivo}: esta linha não entra.`,
    });
  const linhas = lidas.filter((l) => !repetidas.has(l.linha));
  const bloqueadas = new Set(
    [...repetidas.keys()].map((l) => `vincular:${aba.nome}:${l}`),
  );
  const decisoesFinais = decisoes.filter((d) => !bloqueadas.has(d.id));

  return {
    linhas,
    resumo: {
      linhas: linhas.length,
      periodo: periodoDe(linhas.map((l) => l.data)),
      primeira: linhas.filter((l) => l.tipo === "primeira").length,
      atualizacao: linhas.filter((l) => l.tipo === "atualizacao").length,
      sem_tipo: linhas.filter((l) => !l.tipo).length,
      sem_luc: linhas.filter((l) => !l.luc_texto).length,
      a_vincular: decisoesFinais.length,
      duplicadas: repetidas.size,
      perguntas: ids.size,
    },
    avisos,
    decisoes: decisoesFinais,
  };
}

export async function lerEntrevistas(
  arquivo: ArrayBuffer | Uint8Array,
  ctx?: ContextoEntrevistas,
): Promise<Leitura<EntrevistaLida, ResumoEntrevistas>> {
  return lerEntrevistasDasAbas(await abasDoArquivo(arquivo), ctx);
}

// ---------------------------------------------------------------------------
// Texto do Forms → valores da definição (ids de opção)
// ---------------------------------------------------------------------------

export interface Mapeamento {
  respostas: Respostas;
  /** O que não deu para converter (fica para corrigir na entrevista). */
  pendentes: { pergunta_id: string; valor: ValorLido; motivo: string }[];
}

const ehNaoSeAplicaTexto = (t: string) =>
  /^n(ao)?\.? ?(se )?aplica|^n\/a$/.test(normalizar(t));

function opcaoPeloTexto(t: string, opcoes: { id: string; texto: string }[]) {
  const n = normalizar(t);
  return (
    opcoes.find((o) => normalizar(o.texto) === n) ??
    opcoes.find(
      (o) =>
        normalizar(o.texto).startsWith(n) || n.startsWith(normalizar(o.texto)),
    ) ??
    opcoes
      .map((o) => ({ o, s: similaridade(o.texto, t) }))
      .filter((x) => x.s >= 0.8)
      .sort((a, b) => b.s - a.s)[0]?.o ??
    null
  );
}

/** "Sim, 2" / "Não" / "sim - copa no 2º andar" → { r, resto }. */
function simNao(t: string): { r: "sim" | "nao"; resto: string } | null {
  const m = /^(sim|nao)\b[\s,;:.\-–]*(.*)$/.exec(normalizar(t));
  if (!m) return null;
  const resto = texto(t).slice(texto(t).length - (m[2] ?? "").length);
  return { r: m[1] as "sim" | "nao", resto: resto.trim() };
}

const UNIDADE = [
  { re: /(\d+[.,]?\d*)\s*(kg|quilos?)\b/, u: () => "kg" },
  {
    re: /(\d+[.,]?\d*)\s*sacos?\s*de\s*(\d+)\s*l/,
    u: (m: RegExpExecArray) => `saco de ${m[2]} L`,
  },
  { re: /(\d+[.,]?\d*)\s*(l|litros?)\b/, u: () => "litros" },
];

function numeroComUnidade(
  t: string,
  unidades: string[],
): { n: number; u: string } | null {
  const n = normalizar(t);
  for (const { re, u } of UNIDADE) {
    const m = re.exec(n);
    if (!m) continue;
    const num = lerNumero(m[1]);
    const un = u(m);
    if (num === null || Number.isNaN(num)) return null;
    if (unidades.length && !unidades.includes(un)) return null;
    return { n: num, u: un };
  }
  return null;
}

function converter(
  p: Pergunta,
  v: ValorLido,
): { ok: true; valor: unknown } | { ok: false; motivo: string } {
  const ativas = p.opcoes.filter((o) => o.ativa);
  if (typeof v === "string" && p.tipo !== "auto" && ehNaoSeAplicaTexto(v))
    return { ok: true, valor: NAO_SE_APLICA };
  switch (p.tipo) {
    case "grade": {
      if (!v || typeof v !== "object")
        return { ok: false, motivo: "esperava a grade" };
      const g: Record<string, string> = {};
      for (const [item, nivel] of Object.entries(v)) {
        const linha = opcaoPeloTexto(item, ativas);
        const niv = opcaoPeloTexto(nivel.replace(/^mediano$/i, "Médio"), [
          ...NIVEIS_GRADE,
        ]);
        if (!linha || !niv)
          return { ok: false, motivo: `"${item}: ${nivel}" fora das opções` };
        g[linha.id] = niv.id;
      }
      return { ok: true, valor: g };
    }
    case "numero":
    case "reais": {
      const n = lerNumero(v as Celula);
      return n === null || Number.isNaN(n)
        ? { ok: false, motivo: "não é número" }
        : { ok: true, valor: n };
    }
    case "data": {
      const d = lerData(v as Celula);
      return d
        ? { ok: true, valor: d }
        : { ok: false, motivo: "data inválida" };
    }
    case "hora": {
      const h = lerHora(v as Celula);
      return h
        ? { ok: true, valor: h }
        : { ok: false, motivo: "hora inválida" };
    }
    case "numero_unidade": {
      const q = numeroComUnidade(String(v), p.unidades);
      return q
        ? { ok: true, valor: q }
        : { ok: false, motivo: "quantidade em texto livre" };
    }
    case "uma": {
      const o = opcaoPeloTexto(String(v), ativas);
      return o
        ? { ok: true, valor: o.id }
        : { ok: false, motivo: "opção não encontrada" };
    }
    case "varias": {
      let resto = normalizar(String(v));
      const ids: string[] = [];
      for (const o of [...ativas].sort(
        (a, b) => b.texto.length - a.texto.length,
      )) {
        const n = normalizar(o.texto);
        if (n && resto.includes(n)) {
          ids.push(o.id);
          resto = resto.replace(n, " ");
        }
      }
      return resto.replace(/[\s,;]+/g, "")
        ? {
            ok: false,
            motivo: `parte não reconhecida: "${resto.replace(/^[\s,;]+|[\s,;]+$/g, "")}"`,
          }
        : { ok: true, valor: ids };
    }
    case "sim_nao":
    case "sim_nao_quantidade":
    case "sim_nao_descricao": {
      const s = simNao(String(v));
      if (!s) return { ok: false, motivo: "não começa com sim ou não" };
      if (p.tipo === "sim_nao" || !s.resto)
        return { ok: true, valor: { r: s.r } };
      if (p.tipo === "sim_nao_descricao")
        return { ok: true, valor: { r: s.r, d: s.resto } };
      const n = lerNumero(/[\d.,]+/.exec(s.resto)?.[0] ?? null);
      return n === null || Number.isNaN(n)
        ? { ok: false, motivo: "quantidade não é número" }
        : { ok: true, valor: { r: s.r, d: n } };
    }
    default:
      return {
        ok: true,
        valor: typeof v === "object" ? JSON.stringify(v) : String(v),
      };
  }
}

/**
 * Respostas lidas (`q<n>` → texto) → valores da definição: casa a pergunta
 * pelo id ou pelo número ("q7" ↔ número "7") e o texto da opção pelo id
 * da opção (sem acento/caixa, começo ou nome parecido).
 */
export function mapearParaDefinicao(
  respostas: Record<string, ValorLido>,
  definicao: DefinicaoFormulario,
): Mapeamento {
  const perguntas = definicao.secoes.flatMap((s) => s.perguntas);
  const saida: Respostas = {};
  const pendentes: Mapeamento["pendentes"] = [];
  for (const [chave, v] of Object.entries(respostas)) {
    if (v === null || v === "") continue;
    const num = /^q(\d+)$/.exec(chave)?.[1];
    const p =
      perguntas.find((x) => x.id === chave) ??
      (num ? perguntas.find((x) => x.numero.trim() === num) : undefined);
    if (!p) {
      pendentes.push({
        pergunta_id: chave,
        valor: v,
        motivo: "pergunta fora da definição",
      });
      continue;
    }
    const r = converter(p, v);
    if (r.ok) saida[p.id] = r.valor;
    else pendentes.push({ pergunta_id: p.id, valor: v, motivo: r.motivo });
  }
  return { respostas: saida, pendentes };
}
