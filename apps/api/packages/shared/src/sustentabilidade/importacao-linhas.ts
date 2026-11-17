import { z } from "zod";
import type {
  DefinicaoFormulario,
  Pergunta,
  Respostas,
} from "./formulario/tipos";
import {
  type Aba,
  type Decisao,
  type EntrevistaLida,
  entrevistasRepetidas,
  lerData,
  lerHora,
  lerNumero,
  mapearParaDefinicao,
  normalizar,
  type ParticipacaoLida,
  type TipoDeImportacao,
  type ValorLido,
} from "./importacao";
import { type ParametrosEntrevista, proximaDataDaEntrevista } from "./situacao";

// Da leitura (src/lib/sustentabilidade/importacao) às linhas do banco (spec
// 4.10): o programa e o formulário de cada tipo, o casamento das colunas
// lidas com os campos do formulário publicado (pelo nome do campo), a
// conversão de cada valor para o formato da definição (com os campos em
// reais à parte), a entrevista do Forms na versão 1 do questionário e as
// decisões da prévia (vincular contrato, unificar nomes, motivo). Puro.

export type TipoDeLancamento = Exclude<TipoDeImportacao, "entrevistas">;

export const TIPOS_DE_LANCAMENTO: TipoDeLancamento[] = [
  "atracoes",
  "produtores",
  "ecocopos",
  "quiosque",
  "tour",
];

export const ehTipoDeLancamento = (t: string): t is TipoDeLancamento =>
  (TIPOS_DE_LANCAMENTO as string[]).includes(t);

/** Programa e formulário padrão de cada tipo (escolhidos por nome; a prévia troca). */
export const DESTINO_DO_TIPO: Record<
  TipoDeLancamento,
  { programa: string; formulario: string }
> = {
  atracoes: { programa: "Mercado Local", formulario: "Atrações do mês" },
  produtores: { programa: "Mercado Local", formulario: "Produtores na feira" },
  ecocopos: { programa: "Mercado Local", formulario: "Ecocopos" },
  quiosque: { programa: "Turismo", formulario: "Perguntas no quiosque" },
  tour: { programa: "Turismo", formulario: "Tour guiado" },
};

/**
 * Coluna lida (chave do leitor) → nomes aceitos do campo no formulário. Sem
 * nome que case, vale o id do campo igual à chave.
 */
export const CAMPOS_DO_TIPO: Record<
  TipoDeLancamento,
  Record<string, string[]>
> = {
  atracoes: {
    data: ["Data", "Dia"],
    horario: ["Horário", "Hora"],
    tipo: ["Tipo", "Atividade"],
    tema: ["Tema", "Descrição"],
    local: ["Local"],
    horas_experiencia: ["Horas de experiência"],
    horas_oficina: ["Horas de oficina"],
    inscricao: ["Inscrição"],
    valor: ["Valor"],
    observacao: ["Observação", "Observações"],
  },
  produtores: {
    data: ["Data da feira", "Data"],
    produtor: ["Produtor", "Produtora", "Produtores"],
  },
  ecocopos: {
    data: ["Data"],
    tipo: ["Tipo", "Produto"],
    quantidade: ["Quantidade"],
    valor: ["Valor"],
  },
  quiosque: {
    pergunta: ["Pergunta"],
    data: ["Data"],
    horario: ["Horário", "Hora"],
    publico: ["Público"],
    cidade: ["Cidade de origem", "Cidade"],
    pessoas: ["Número de pessoas", "Pessoas"],
    dificuldade: ["Dificuldade na resposta", "Dificuldade"],
  },
  tour: {
    data: ["Data"],
    grupo: ["Grupo ou descrição", "Grupo"],
    tipo: ["Tipo"],
    participantes: ["Participantes"],
    receita_parceiro: ["Receita do parceiro"],
    receita_arp: ["Receita da ARP"],
    custo_parceiro: ["Custo do parceiro"],
    custo_album: ["Custo do álbum"],
    custo_copo: ["Custo do copo"],
    outros_custos: ["Outros custos"],
    resultado: ["Resultado"],
  },
};

/** Nome da coluna lida para a prévia ("horas_experiencia" → "Horas de experiência"). */
export const rotuloDaColuna = (tipo: TipoDeLancamento, chave: string) =>
  CAMPOS_DO_TIPO[tipo][chave]?.[0] ?? chave;

// ---------------------------------------------------------------------------
// Abas de orçamento (spec seção 1: não importar aqui)
// ---------------------------------------------------------------------------

const ORCAMENTO = /^(plano b|plano de midia|local working)\b/;

/** Tira as abas de orçamento de eventos ("Plano B", "Plano de Mídia", "Local Working"). */
export function abasSemOrcamento(abas: Aba[]): {
  abas: Aba[];
  ignoradas: string[];
} {
  const ignoradas = abas
    .filter((a) => ORCAMENTO.test(normalizar(a.nome)))
    .map((a) => a.nome);
  return {
    abas: abas.filter((a) => !ignoradas.includes(a.nome)),
    ignoradas,
  };
}

// ---------------------------------------------------------------------------
// Colunas lidas × campos do formulário publicado
// ---------------------------------------------------------------------------

export const perguntasDe = (d: DefinicaoFormulario): Pergunta[] =>
  d.secoes.flatMap((s) => s.perguntas);

export interface Casamento {
  /** Coluna lida → campo do formulário. */
  porColuna: Record<string, Pergunta>;
  /** Colunas lidas sem campo no formulário (não entram). */
  semCampo: string[];
  /** Campos ativos do formulário sem coluna no arquivo (ficam vazios). */
  semColuna: Pergunta[];
}

export function casarCampos(
  tipo: TipoDeLancamento,
  definicao: DefinicaoFormulario,
): Casamento {
  const perguntas = perguntasDe(definicao).filter((p) => p.tipo !== "anexo");
  const usadas = new Set<string>();
  const porColuna: Record<string, Pergunta> = {};
  const semCampo: string[] = [];
  for (const [coluna, nomes] of Object.entries(CAMPOS_DO_TIPO[tipo])) {
    const aceitos = new Set(nomes.map(normalizar));
    const livre = (p: Pergunta) => !usadas.has(p.id);
    const p =
      perguntas.find(
        (x) => livre(x) && x.ativa && aceitos.has(normalizar(x.texto)),
      ) ??
      perguntas.find((x) => livre(x) && aceitos.has(normalizar(x.texto))) ??
      perguntas.find((x) => livre(x) && x.id === coluna);
    if (p) {
      porColuna[coluna] = p;
      usadas.add(p.id);
    } else semCampo.push(coluna);
  }
  return {
    porColuna,
    semCampo,
    semColuna: perguntas.filter((p) => p.ativa && !usadas.has(p.id)),
  };
}

// ---------------------------------------------------------------------------
// Valor lido → valor do campo
// ---------------------------------------------------------------------------

export type Conversao =
  | { ok: true; valor: unknown }
  | { ok: false; motivo: string };

const vazio = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && !v.trim());

/** Um valor lido no formato do tipo do campo (null/"" → { ok, valor: null }). */
export function converterValor(p: Pergunta, v: unknown): Conversao {
  if (vazio(v)) return { ok: true, valor: null };
  switch (p.tipo) {
    case "texto":
    case "texto_longo":
    case "lista_cadastro":
    case "auto":
      return { ok: true, valor: String(v).trim() };
    case "numero":
    case "reais": {
      const n = typeof v === "number" ? v : lerNumero(String(v));
      return n === null || !Number.isFinite(n)
        ? { ok: false, motivo: "não é número" }
        : { ok: true, valor: n };
    }
    case "numero_unidade": {
      const n = typeof v === "number" ? v : lerNumero(String(v));
      const u = p.unidades[0];
      if (n === null || !Number.isFinite(n) || n < 0)
        return { ok: false, motivo: "não é número" };
      return u
        ? { ok: true, valor: { n, u } }
        : { ok: false, motivo: "o campo não tem unidade" };
    }
    case "data": {
      const d = lerData(v as string);
      return d
        ? { ok: true, valor: d }
        : { ok: false, motivo: "data inválida" };
    }
    case "hora": {
      const h = lerHora(v as string);
      return h
        ? { ok: true, valor: h }
        : { ok: false, motivo: "hora inválida" };
    }
    default: {
      // Opções, sim/não e grade: a mesma conversão das respostas do Forms.
      const m = mapearParaDefinicao(
        { [p.id]: v as ValorLido },
        {
          secoes: [{ id: "s", nome: "", ativa: true, perguntas: [p] }],
        },
      );
      const pend = m.pendentes[0];
      return pend
        ? { ok: false, motivo: pend.motivo }
        : { ok: true, valor: m.respostas[p.id] ?? null };
    }
  }
}

export interface Pendente {
  coluna: string;
  valor: string;
  motivo: string;
}

export interface LancamentoMontado {
  data: string | null;
  /** { campo_id: valor } sem os campos em reais. */
  valores: Respostas;
  /** { campo_id: número } dos campos em reais (vão para lancamento_valores). */
  reais: Record<string, number>;
  /** O que não converteu (a linha entra sem esse campo). */
  pendentes: Pendente[];
}

/** Linha do leitor → lançamento: só as colunas casadas; reais à parte. */
export function lancamentoDaLinha(
  casamento: Casamento,
  linha: Record<string, unknown>,
): LancamentoMontado {
  const valores: Respostas = {};
  const reais: Record<string, number> = {};
  const pendentes: Pendente[] = [];
  for (const [coluna, p] of Object.entries(casamento.porColuna)) {
    const bruto = linha[coluna];
    const c = converterValor(p, bruto);
    if (!c.ok) {
      pendentes.push({ coluna, valor: String(bruto), motivo: c.motivo });
      continue;
    }
    if (c.valor === null) continue;
    if (p.tipo === "reais") reais[p.id] = c.valor as number;
    else valores[p.id] = c.valor;
  }
  const data = typeof linha.data === "string" ? lerData(linha.data) : null;
  return { data, valores, reais, pendentes };
}

/** Separa os campos em reais de um { campo_id: valor } já no formato da definição. */
export function separarReais(
  definicao: DefinicaoFormulario,
  valores: Respostas,
): { valores: Respostas; reais: Record<string, number> } {
  const emReais = new Set(
    perguntasDe(definicao)
      .filter((p) => p.tipo === "reais")
      .map((p) => p.id),
  );
  const fora: Respostas = {};
  const reais: Record<string, number> = {};
  for (const [k, v] of Object.entries(valores)) {
    if (!emReais.has(k)) fora[k] = v;
    else if (typeof v === "number" && Number.isFinite(v)) reais[k] = v;
  }
  return { valores: fora, reais };
}

// ---------------------------------------------------------------------------
// Entrevistas do Forms
// ---------------------------------------------------------------------------

export interface ContratoDaImportacao {
  id: string;
  lucs: string[];
  cliente_nome: string;
  cliente_doc: string | null;
  validade_meses_especifica: number | null;
}

export interface EntrevistaMontada {
  linha: number;
  contrato_id: string;
  lucs: string[];
  cliente_doc: string | null;
  data: string;
  tipo: "primeira" | "atualizacao";
  setor: string | null;
  respostas: Respostas;
  respondente_nome: string | null;
  valida_ate: string;
  /** Respostas que não casaram com as opções (ficam para corrigir na entrevista). */
  pendentes: { pergunta_id: string; valor: string; motivo: string }[];
}

/** Setor econômico (pergunta 3): o texto da primeira opção marcada. */
export function setorDasRespostas(
  respostas: Respostas,
  definicao: DefinicaoFormulario,
): string | null {
  const p3 = perguntasDe(definicao).find((p) => p.numero.trim() === "3");
  if (!p3) return null;
  const v = respostas[p3.id];
  const ids = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
  const opcao = p3.opcoes.find((o) => o.id === ids[0]);
  return opcao?.texto ?? null;
}

/** Entrevista lida (já com o contrato) → linha de `entrevistas` (versão 1). */
export function entrevistaDaLinha(
  lida: EntrevistaLida,
  contrato: ContratoDaImportacao,
  definicao: DefinicaoFormulario,
  parametros: Pick<
    ParametrosEntrevista,
    "validadePadraoMeses" | "validadePorSetor"
  >,
): EntrevistaMontada | null {
  if (!lida.data) return null;
  const m = mapearParaDefinicao(lida.respostas, definicao);
  const setor = setorDasRespostas(m.respostas, definicao);
  const q6 = lida.respostas.q6;
  return {
    linha: lida.linha,
    contrato_id: contrato.id,
    lucs: lida.lucs.length ? lida.lucs : contrato.lucs,
    cliente_doc: contrato.cliente_doc,
    data: lida.data,
    tipo: lida.tipo ?? "primeira",
    setor,
    respostas: m.respostas,
    respondente_nome: typeof q6 === "string" && q6.trim() ? q6.trim() : null,
    valida_ate: proximaDataDaEntrevista(
      lida.data,
      setor,
      contrato.validade_meses_especifica,
      parametros,
    ),
    pendentes: m.pendentes.map((p) => ({
      pergunta_id: p.pergunta_id,
      valor:
        typeof p.valor === "object" ? JSON.stringify(p.valor) : String(p.valor),
      motivo: p.motivo,
    })),
  };
}

/** Quantas respostas de cada texto numa pergunta (conferência da seção 8). */
export function contagemPorResposta(
  linhas: Pick<EntrevistaLida, "respostas">[],
  perguntaId: string,
): { resposta: string; n: number }[] {
  const mapa = new Map<string, { resposta: string; n: number }>();
  for (const l of linhas) {
    const v = l.respostas[perguntaId];
    const t =
      v === null || v === undefined || v === ""
        ? "Em branco"
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);
    const k = normalizar(t);
    const atual = mapa.get(k) ?? { resposta: t, n: 0 };
    atual.n++;
    mapa.set(k, atual);
  }
  return [...mapa.values()].sort(
    (a, b) => b.n - a.n || a.resposta.localeCompare(b.resposta, "pt-BR"),
  );
}

// ---------------------------------------------------------------------------
// Decisões da prévia
// ---------------------------------------------------------------------------

/** Na decisão de vínculo: a linha não entra. */
export const PULAR = "pular";
/** Na decisão de nomes: manter as grafias separadas. */
export const SEPARADOS = "__separados__";

const id = z.string().trim().min(1).max(200);

/** O que a pessoa escolheu na prévia (`importacoes.decisoes`). */
export const escolhasSchema = z.object({
  programa_id: z.uuid().optional(),
  formulario_id: z.uuid().optional(),
  /** Decisão de vínculo → id do contrato ou "pular". */
  vinculos: z.record(id, id).default({}),
  /** Decisão de nomes → nome escolhido ou SEPARADOS. */
  nomes: z.record(id, z.string().trim().min(1).max(200)).default({}),
  /** Decisão de conferência → motivo. */
  motivos: z.record(id, z.string().trim().max(500)).default({}),
});
export type Escolhas = z.infer<typeof escolhasSchema>;

/** Escolhas guardadas (jsonb) → objeto válido (o que não vale é ignorado). */
export function lerEscolhas(json: unknown): Escolhas {
  const r = escolhasSchema.safeParse(json ?? {});
  return r.success ? r.data : { vinculos: {}, nomes: {}, motivos: {} };
}

export const MOTIVO_MINIMO = 5;

/** Decisões ainda sem resposta (a confirmação espera por elas). */
export function decisoesPendentes(decisoes: Decisao[], e: Escolhas): Decisao[] {
  return decisoes.filter((d) => {
    if (d.tipo === "vincular_contrato") return !e.vinculos[d.id];
    if (d.tipo === "unificar_nomes") return !e.nomes[d.id];
    return (e.motivos[d.id]?.trim().length ?? 0) < MOTIVO_MINIMO;
  });
}

/**
 * Aplica os vínculos escolhidos às entrevistas lidas: a linha ganha o
 * contrato ou sai ("pular"). Linha sem contrato e sem escolha fica de fora
 * (a confirmação já exige a escolha). Depois refaz a conferência de
 * duplicidade (contrato e data), agora com os contratos escolhidos.
 */
export function aplicarVinculos(
  linhas: EntrevistaLida[],
  decisoes: Decisao[],
  vinculos: Escolhas["vinculos"],
  existentes: { contrato_id: string; data: string }[] = [],
): {
  linhas: EntrevistaLida[];
  puladas: number;
  repetidas: Map<number, string>;
} {
  const porLinha = new Map<string, string>();
  for (const d of decisoes)
    if (d.tipo === "vincular_contrato") {
      const escolha = vinculos[d.id];
      if (escolha) porLinha.set(`${d.aba ?? ""}:${d.linha}`, escolha);
    }
  let puladas = 0;
  const vinculadas: EntrevistaLida[] = [];
  for (const l of linhas) {
    const escolha = porLinha.get(`${l.aba}:${l.linha}`);
    if (escolha === PULAR) {
      puladas++;
      continue;
    }
    const contrato_id = l.contrato_id ?? escolha ?? null;
    if (contrato_id) vinculadas.push({ ...l, contrato_id });
  }
  const repetidas = entrevistasRepetidas(vinculadas, existentes);
  return {
    linhas: vinculadas.filter((l) => !repetidas.has(l.linha)),
    puladas,
    repetidas,
  };
}

/**
 * Aplica a unificação de nomes de produtor: em cada grupo escolhido, todas
 * as grafias viram o nome escolhido; "separados" mantém cada grafia. A
 * mesma grafia sem acento/caixa vira sempre a mais usada (ou a que já
 * está no cadastro, em `cadastro`: normalizado → valor).
 */
export function aplicarNomes(
  linhas: ParticipacaoLida[],
  decisoes: Decisao[],
  nomes: Escolhas["nomes"],
  cadastro: Map<string, string> = new Map(),
): ParticipacaoLida[] {
  const troca = new Map<string, string>();
  for (const d of decisoes) {
    if (d.tipo !== "unificar_nomes") continue;
    const escolhido = nomes[d.id];
    if (!escolhido || escolhido === SEPARADOS) continue;
    for (const n of d.nomes) troca.set(normalizar(n.nome), escolhido);
  }
  const contagem = new Map<string, Map<string, number>>();
  for (const l of linhas) {
    const g = contagem.get(l.chave) ?? new Map<string, number>();
    g.set(l.produtor, (g.get(l.produtor) ?? 0) + 1);
    contagem.set(l.chave, g);
  }
  const grafia = (chave: string, atual: string) =>
    [...(contagem.get(chave)?.entries() ?? [])].sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0] ?? atual;
  return linhas.map((l) => {
    const unificado = troca.get(l.chave);
    const base = unificado ?? grafia(l.chave, l.produtor);
    const produtor = cadastro.get(normalizar(base)) ?? base;
    return { ...l, produtor, chave: normalizar(produtor) };
  });
}

/** Nomes novos para `cadastros_lista` (os que o cadastro ainda não tem). */
export function nomesNovos(
  linhas: Pick<ParticipacaoLida, "produtor">[],
  cadastro: Map<string, string>,
): { valor: string; normalizado: string }[] {
  const novos = new Map<string, string>();
  for (const l of linhas) {
    const k = normalizar(l.produtor);
    if (k && !cadastro.has(k) && !novos.has(k)) novos.set(k, l.produtor);
  }
  return [...novos.entries()].map(([normalizado, valor]) => ({
    valor,
    normalizado,
  }));
}

// ---------------------------------------------------------------------------
// Totais da prévia
// ---------------------------------------------------------------------------

export interface TotalDoMes {
  competencia: string;
  linhas: number;
  /** Soma de uma quantidade do tipo (ecocopos, participantes do tour). */
  quantidade: number | null;
}

/** Linhas (e a quantidade, quando há) por mês, em ordem. */
export function totaisPorMes(
  itens: { data: string | null; quantidade?: number | null }[],
): TotalDoMes[] {
  const mapa = new Map<string, TotalDoMes>();
  for (const i of itens) {
    if (!i.data) continue;
    const k = i.data.slice(0, 7);
    const t = mapa.get(k) ?? { competencia: k, linhas: 0, quantidade: null };
    t.linhas++;
    if (typeof i.quantidade === "number" && Number.isFinite(i.quantidade))
      t.quantidade = (t.quantidade ?? 0) + i.quantidade;
    mapa.set(k, t);
  }
  return [...mapa.values()].sort((a, b) =>
    a.competencia.localeCompare(b.competencia),
  );
}

/** Totais por ano a partir dos totais por mês. */
export function totaisPorAno(meses: TotalDoMes[]): TotalDoMes[] {
  const mapa = new Map<string, TotalDoMes>();
  for (const m of meses) {
    const k = m.competencia.slice(0, 4);
    const t = mapa.get(k) ?? { competencia: k, linhas: 0, quantidade: null };
    t.linhas += m.linhas;
    if (m.quantidade !== null)
      t.quantidade = (t.quantidade ?? 0) + m.quantidade;
    mapa.set(k, t);
  }
  return [...mapa.values()];
}

/** Soma dos campos em reais por campo (só para quem vê valores). */
export function somaDosReais(
  linhas: { reais: Record<string, number> }[],
): Record<string, number> {
  const soma: Record<string, number> = {};
  for (const l of linhas)
    for (const [k, v] of Object.entries(l.reais))
      soma[k] = Math.round(((soma[k] ?? 0) + v) * 100) / 100;
  return soma;
}
