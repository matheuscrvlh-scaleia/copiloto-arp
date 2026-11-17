// Quadros de medidores (spec 4.5): status, disjuntor e medidor como a carga
// do catálogo padroniza, filtro e busca das caixas, o desenho do painel
// (lado, coluna e linha), a navegação por teclado na grade, os avisos da
// ficha e a ligação com o contrato vigente do ENET. Funções puras.

export const STATUS_CAIXA = ["ocupado", "reservado", "livre"] as const;
export type StatusCaixa = (typeof STATUS_CAIXA)[number];

export const STATUS: Record<
  StatusCaixa,
  { rotulo: string; plural: string; descricao: string }
> = {
  ocupado: {
    rotulo: "Ocupado",
    plural: "Ocupadas",
    descricao: "Ocupado (com medidor)",
  },
  reservado: {
    rotulo: "Reservado",
    plural: "Reservadas",
    descricao: "Reservado (em ligação ou obra)",
  },
  livre: {
    rotulo: "Livre",
    plural: "Livres",
    descricao: "Livre (sem medidor, em espera)",
  },
};

/** Filtro de status da tela: os três e "ocupadas sem termo". */
export const FILTROS_STATUS = [...STATUS_CAIXA, "semtermo"] as const;
export type FiltroStatus = (typeof FILTROS_STATUS)[number];

export function ehFiltroStatus(v: string): v is FiltroStatus {
  return (FILTROS_STATUS as readonly string[]).includes(v);
}

/** Ligações aceitas pelo banco (check de operacoes.caixas.ligacao). */
export const LIGACOES = ["Monofásica", "Bifásica", "Trifásica"] as const;
export type Ligacao = (typeof LIGACOES)[number];

export const LADOS = ["esquerdo", "direito"] as const;
export type Lado = (typeof LADOS)[number];

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Texto comparável: sem acento, minúsculo e com um espaço só. */
export function normalizar(t: string | null | undefined): string {
  return semAcento(t ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Regras da carga do catálogo
// ---------------------------------------------------------------------------

/**
 * Status do arquivo → status da caixa: "ocupado" e "OCUPADO COM MEDIDOR"
 * viram Ocupado; "livre" e "VAZIO (EM ESPERA / GIZ)" viram Livre; "reserva"
 * vira Reservado. Fora disso, null (a carga mostra o aviso).
 */
export function statusDaCarga(texto: string): StatusCaixa | null {
  const t = normalizar(texto);
  if (/^ocupad/.test(t)) return "ocupado";
  if (/^reserv/.test(t)) return "reservado";
  if (/^(livre|vazi)/.test(t)) return "livre";
  return null;
}

/** "Monofásico", "mono", "3x" → a ligação; null se o texto não diz. */
export function ligacaoDoTexto(texto: string): Ligacao | null {
  const t = normalizar(texto);
  if (/\bmono/.test(t)) return "Monofásica";
  if (/\bbif|\bbi\b/.test(t)) return "Bifásica";
  if (/\btrif|\btri\b|\b3\s*x\s*\d/.test(t)) return "Trifásica";
  if (/\b2\s*x\s*\d/.test(t)) return "Bifásica";
  return null;
}

/**
 * Disjuntor em texto livre ("40A Monofásico", "Disj. 3x40A Trifásico",
 * "40A em espera") → amperes e ligação. O texto original fica guardado à
 * parte (disjuntor_texto); o que não dá para ler volta null.
 */
export function separarDisjuntor(texto: string): {
  amperes: number | null;
  ligacao: Ligacao | null;
} {
  const t = normalizar(texto);
  const m = /(?:\d\s*x\s*)?(\d{1,3})\s*a\b/.exec(t);
  const amperes = m ? Number(m[1]) : null;
  return {
    amperes: amperes && amperes > 0 ? amperes : null,
    ligacao: ligacaoDoTexto(t),
  };
}

/** 40 + "Monofásica" → "40A Monofásico" (como na lista dos parâmetros). */
export function textoDoDisjuntor(
  amperes: number | null,
  ligacao: string | null,
): string {
  if (!amperes && !ligacao) return "";
  const lig = ligacao ? ligacao.replace(/a$/, "o") : "";
  return [amperes ? `${amperes}A` : "", lig].filter(Boolean).join(" ");
}

/** Chave do disjuntor no formulário ("40|Monofásica"). */
export function chaveDoDisjuntor(
  amperes: number | null,
  ligacao: string | null,
): string {
  return amperes || ligacao ? `${amperes ?? ""}|${ligacao ?? ""}` : "";
}

export interface OpcaoDisjuntor {
  valor: string;
  rotulo: string;
  amperes: number;
  ligacao: Ligacao;
}

/**
 * Opções do disjuntor a partir da lista dos parâmetros
 * (energia_disjuntores), só as que dá para separar em amperes e ligação, e
 * só as ligações da lista energia_ligacoes. Mais o valor atual da caixa,
 * quando ele não está na lista (dado antigo continua salvável).
 */
export function opcoesDeDisjuntor(
  lista: string[],
  ligacoes: string[],
  atual?: { amperes: number | null; ligacao: string | null },
): OpcaoDisjuntor[] {
  const vistas = new Set<string>();
  const saida: OpcaoDisjuntor[] = [];
  const incluir = (amperes: number | null, ligacao: Ligacao | null) => {
    if (!amperes || !ligacao) return;
    const valor = chaveDoDisjuntor(amperes, ligacao);
    if (vistas.has(valor)) return;
    vistas.add(valor);
    saida.push({
      valor,
      rotulo: textoDoDisjuntor(amperes, ligacao),
      amperes,
      ligacao,
    });
  };
  for (const item of lista) {
    const d = separarDisjuntor(item);
    if (d.ligacao && ligacoes.includes(d.ligacao))
      incluir(d.amperes, d.ligacao);
  }
  if (atual?.ligacao && (LIGACOES as readonly string[]).includes(atual.ligacao))
    incluir(atual.amperes, atual.ligacao as Ligacao);
  return saida;
}

/**
 * Disjuntor escolhido × lista: vazio vale (caixa sem disjuntor); senão
 * precisa ser uma das opções (amperes e ligação juntos). Devolve o erro.
 */
export function validarDisjuntor(
  chave: string,
  opcoes: OpcaoDisjuntor[],
): { amperes: number | null; ligacao: Ligacao | null; erro?: string } {
  if (!chave) return { amperes: null, ligacao: null };
  const o = opcoes.find((x) => x.valor === chave);
  if (!o)
    return {
      amperes: null,
      ligacao: null,
      erro: "escolha um disjuntor da lista (amperes e ligação)",
    };
  return { amperes: o.amperes, ligacao: o.ligacao };
}

/** Situações do medidor reconhecidas no texto do catálogo. */
const MEDIDOR: [RegExp, string][] = [
  [/chicote/, "Chicote de espera"],
  [/cabos?\s+de\s+espera/, "Cabos de espera"],
  [/tampa\s+cega/, "Tampa cega"],
  [/ativo|display|digital/, "Medidor ativo"],
];

/**
 * Medidor em texto livre ("Vazio (Chicote de Espera)", "Medidor Digital
 * Ativo"…) → uma das situações da lista dos parâmetros. O que não bate com
 * nenhuma vira "Outro" (se a lista tiver) e o texto original vai para as
 * observações.
 */
export function padronizarMedidor(
  texto: string,
  situacoes: string[],
): string | null {
  const t = normalizar(texto);
  if (!t) return null;
  const naLista = (rotulo: string) =>
    situacoes.find((s) => normalizar(s) === normalizar(rotulo)) ?? null;
  for (const [re, rotulo] of MEDIDOR)
    if (re.test(t)) return naLista(rotulo) ?? naLista("Outro");
  return naLista("Outro");
}

/** Medidor instalado e ligado (pela situação). */
export function medidorAtivo(situacao: string | null): boolean {
  return /ativo/.test(normalizar(situacao));
}

// ---------------------------------------------------------------------------
// ENET: contrato vigente da sala
// ---------------------------------------------------------------------------

export interface ContratoEnet {
  bloco: string | null;
  luc: string;
  nome: string;
  locatario: string;
  documento: string | null;
  contrato: string | null;
  inicio: string | null;
  fim: string | null;
}

/** "Bloco 4", "BL04", "04 & 03", "4" → "04"; null sem número. */
export function normalizarBloco(
  texto: string | null | undefined,
): string | null {
  const m = /(\d{1,2})(?!\d)/.exec(texto ?? "");
  return m ? (m[1] as string).padStart(2, "0") : null;
}

/** Números de unidade no texto: "101-102" → 101 e 102; "Sala 228" → 228. */
export function unidadesDoTexto(texto: string | null | undefined): string[] {
  return [
    ...new Set(
      [...(texto ?? "").matchAll(/\d+/g)].map((m) => String(Number(m[0]))),
    ),
  ];
}

/** LUC do ENET ("12_104") → bloco e unidades. */
export function lerLuc(
  luc: string,
  bloco: string | null,
): { bloco: string | null; unidades: string[] } {
  const partes = luc.split("_");
  const temPrefixo = partes.length > 1;
  return {
    bloco:
      normalizarBloco(bloco) ??
      (temPrefixo ? normalizarBloco(partes[0]) : null),
    unidades: unidadesDoTexto(temPrefixo ? partes.slice(1).join("_") : luc),
  };
}

/**
 * Contrato vigente da sala: mesmo bloco e uma unidade em comum. Havendo
 * mais de um, vale o que começou por último.
 */
export function contratoDaSala(
  contratos: ContratoEnet[],
  sala: { bloco: string | null; sala: string | null },
): ContratoEnet | null {
  const bloco = normalizarBloco(sala.bloco);
  const unidades = unidadesDoTexto(sala.sala);
  if (!bloco || !unidades.length) return null;
  let melhor: ContratoEnet | null = null;
  for (const c of contratos) {
    const l = lerLuc(c.luc, c.bloco);
    if (l.bloco !== bloco || !l.unidades.some((u) => unidades.includes(u)))
      continue;
    if (!melhor || (c.inicio ?? "") > (melhor.inicio ?? "")) melhor = c;
  }
  return melhor;
}

/** Mesmo locatário, sem olhar acento, caixa e espaços. */
export function mesmoLocatario(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normalizar(a) !== "" && normalizar(a) === normalizar(b);
}

// ---------------------------------------------------------------------------
// Caixas: filtro, contagem e avisos
// ---------------------------------------------------------------------------

/** O que a grade, a lista e os avisos usam de cada caixa. */
export interface CaixaBase {
  id: string;
  numero: string;
  numero_antigo: string | null;
  lado: string;
  coluna: number;
  linha: number;
  status: string;
  sala: string | null;
  ocupante: string | null;
  locatario_novo: boolean;
  /** Tem termo (no sistema ou da carga) do locatário atual. */
  com_termo: boolean;
}

/** Ocupada e sem termo do locatário atual (ou locatário novo). */
export function semTermo(c: CaixaBase): boolean {
  return c.status === "ocupado" && (c.locatario_novo || !c.com_termo);
}

/** A caixa entra no filtro da tela (status e busca por número, sala e ocupante). */
export function caixaNoFiltro(
  c: CaixaBase,
  filtro: { status: FiltroStatus | ""; busca: string },
): boolean {
  if (
    filtro.status === "semtermo"
      ? !semTermo(c)
      : filtro.status && c.status !== filtro.status
  )
    return false;
  const b = normalizar(filtro.busca);
  if (!b) return true;
  return normalizar(
    [c.numero, c.numero_antigo, c.sala, c.ocupante].filter(Boolean).join(" "),
  ).includes(b);
}

export interface Contagem {
  caixas: number;
  ocupadas: number;
  reservadas: number;
  livres: number;
  semTermo: number;
}

export function contar(caixas: CaixaBase[]): Contagem {
  const n: Contagem = {
    caixas: caixas.length,
    ocupadas: 0,
    reservadas: 0,
    livres: 0,
    semTermo: 0,
  };
  for (const c of caixas) {
    if (c.status === "ocupado") n.ocupadas++;
    else if (c.status === "reservado") n.reservadas++;
    else n.livres++;
    if (semTermo(c)) n.semTermo++;
  }
  return n;
}

/** "% ocupado", inteiro (arredonda para o mais próximo). */
export function pctOcupado(n: Pick<Contagem, "caixas" | "ocupadas">): number {
  return n.caixas ? Math.round((n.ocupadas / n.caixas) * 100) : 0;
}

/** Nome do aviso de troca sem termo (provisório na spec, seção 10). */
export const AVISO_LOCATARIO_NOVO = "Locatário novo sem termo de energia";

export interface Aviso {
  tipo: "erro" | "atencao";
  texto: string;
}

/** Avisos da ficha: o que está incoerente ou pendente na caixa. */
export function avisosDaCaixa(
  c: CaixaBase & {
    medidor_situacao: string | null;
    disjuntor_amperes: number | null;
    ligacao: string | null;
  },
  enet: ContratoEnet | null,
): Aviso[] {
  const avisos: Aviso[] = [];
  if (c.locatario_novo)
    avisos.push({ tipo: "erro", texto: `${AVISO_LOCATARIO_NOVO}.` });
  else if (semTermo(c))
    avisos.push({
      tipo: "atencao",
      texto: "Caixa ocupada sem termo de energia.",
    });
  if (c.status === "ocupado" && !normalizar(c.ocupante))
    avisos.push({ tipo: "atencao", texto: "Caixa ocupada sem ocupante." });
  if (c.status === "ocupado" && !medidorAtivo(c.medidor_situacao))
    avisos.push({
      tipo: "atencao",
      texto: "Caixa ocupada sem medidor ativo: confira o medidor ou o status.",
    });
  if (c.status === "livre" && medidorAtivo(c.medidor_situacao))
    avisos.push({
      tipo: "atencao",
      texto: "Caixa livre com medidor ativo: confira o status.",
    });
  if (!!c.disjuntor_amperes !== !!c.ligacao)
    avisos.push({
      tipo: "atencao",
      texto: "Disjuntor incompleto: informe amperes e ligação.",
    });
  if (enet && !mesmoLocatario(enet.locatario, c.ocupante))
    avisos.push({
      tipo: "erro",
      texto: `O ENET mostra outro locatário nesta sala: ${enet.locatario}.`,
    });
  return avisos;
}

// ---------------------------------------------------------------------------
// Desenho do painel e navegação
// ---------------------------------------------------------------------------

export interface LadoDoPainel<T> {
  colunas: number;
  /** Linhas × colunas; null é espaço vazio. */
  grade: (T | null)[][];
}

/**
 * Monta os dois lados do painel pelas posições gravadas (coluna e linha).
 * Duas caixas na mesma posição: a segunda vai para o primeiro espaço livre
 * depois dela (nenhuma some do desenho).
 */
export function montarPainel<
  T extends Pick<CaixaBase, "lado" | "coluna" | "linha" | "numero">,
>(caixas: T[]): { esquerdo: LadoDoPainel<T>; direito: LadoDoPainel<T> } {
  const lado = (qual: Lado): LadoDoPainel<T> => {
    const doLado = caixas
      .filter((c) => (c.lado === "direito" ? "direito" : "esquerdo") === qual)
      .sort(
        (a, b) =>
          a.linha - b.linha ||
          a.coluna - b.coluna ||
          a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }),
      );
    const colunas = Math.max(1, ...doLado.map((c) => c.coluna));
    const grade: (T | null)[][] = [];
    const vaga = (l: number, c: number) => !grade[l]?.[c];
    const por = (l: number, c: number, x: T) => {
      while (grade.length <= l) grade.push(Array(colunas).fill(null));
      (grade[l] as (T | null)[])[c] = x;
    };
    for (const x of doLado) {
      let l = Math.max(0, x.linha - 1);
      let c = Math.max(0, x.coluna - 1);
      while (!vaga(l, c)) {
        c++;
        if (c >= colunas) {
          c = 0;
          l++;
        }
      }
      por(l, c, x);
    }
    return { colunas, grade };
  };
  return { esquerdo: lado("esquerdo"), direito: lado("direito") };
}

export type Tecla =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Home"
  | "End";

/**
 * Próxima caixa na grade a partir de (linha, coluna), pulando os espaços
 * vazios. null quando não há caixa naquela direção (a grade do outro lado
 * do barramento decide).
 */
export function proximaPosicao(
  grade: (unknown | null)[][],
  de: { linha: number; coluna: number },
  tecla: Tecla,
): { linha: number; coluna: number } | null {
  const tem = (l: number, c: number) => !!grade[l]?.[c];
  const linhas = grade.length;
  const colunas = Math.max(0, ...grade.map((r) => r.length));
  if (tecla === "Home" || tecla === "End") {
    const r = grade[de.linha] ?? [];
    const idx = r.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
    const alvo = tecla === "Home" ? idx[0] : idx.at(-1);
    return alvo === undefined ? null : { linha: de.linha, coluna: alvo };
  }
  const [dl, dc] = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  }[tecla] as [number, number];
  let l = de.linha + dl;
  let c = de.coluna + dc;
  while (l >= 0 && l < linhas && c >= 0 && c < colunas) {
    if (tem(l, c)) return { linha: l, coluna: c };
    l += dl;
    c += dc;
  }
  return null;
}

/** Primeira caixa de uma coluna a partir de uma linha (ao cruzar o barramento). */
export function entrarNaGrade(
  grade: (unknown | null)[][],
  linha: number,
  pela: "esquerda" | "direita",
): { linha: number; coluna: number } | null {
  const colunas = Math.max(0, ...grade.map((r) => r.length));
  const ordem = [...Array(colunas).keys()];
  if (pela === "direita") ordem.reverse();
  // Mesma linha primeiro; depois as mais próximas.
  const linhas = [...grade.keys()].sort(
    (a, b) => Math.abs(a - linha) - Math.abs(b - linha) || a - b,
  );
  for (const l of linhas)
    for (const c of ordem) if (grade[l]?.[c]) return { linha: l, coluna: c };
  return null;
}
