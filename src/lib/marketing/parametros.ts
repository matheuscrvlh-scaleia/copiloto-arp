import { formatarData, formatarMes, lerValorBr } from "@/lib/formato";

// Configurações e cadastros do Marketing (spec 4.12): nomes na tela, as
// conferências automáticas (link do Google, nome repetido, faixas da
// reputação, nomes do Asana, landing pages sem tipo), a leitura da planilha
// de locatários e o "voltar" de uma alteração do histórico. Funções puras: a
// tela mostra a conferência na hora e a ação confere de novo antes de gravar.

export const BLOCOS = {
  locatarios: "Locatários",
  landing_pages: "Landing pages",
  metas: "Metas mensais",
  regras: "Regras de alerta",
  reputacao: "Reputação",
  asana: "Asana",
  ronda: "Ronda de ambiência",
  benchmark: "Benchmark e marca",
  visualizacao: "Visualização padrão",
  historico: "Histórico",
} as const;
export type Bloco = keyof typeof BLOCOS;

export const FORMAS_ACESSO = {
  gerente: "Gerente do perfil",
  consulta_publica: "Consulta pública (dados parciais)",
  sem_acesso: "Sem acesso",
} as const;
export type FormaAcesso = keyof typeof FORMAS_ACESSO;

export const INTERESSES_LP = {
  evento: "Evento",
  locacao: "Locação",
  outro: "Outro",
} as const;
export type InteresseLp = keyof typeof INTERESSES_LP;

export const NIVEIS = {
  urgente: "Urgente",
  atencao: "Atenção",
  aviso: "Aviso",
} as const;
export type Nivel = keyof typeof NIVEIS;

export const AREAS = {
  marketing: "Marketing",
  operacoes: "Operações",
} as const;
export type Area = keyof typeof AREAS;

/**
 * Regras de alerta do Painel (lista fixa do banco). `limite`: o que o número
 * da regra conta; null nas que comparam com a meta ou só com a situação.
 */
export const REGRAS = {
  sinalizacoes_abertas: {
    rotulo: "Sinalizações do Marketing abertas ≥ limite",
    limite: "quantidade",
  },
  locatario_em_alerta: {
    rotulo: "Locatário em situação Alerta",
    limite: null,
  },
  avaliacao_sem_resposta: {
    rotulo:
      "Avaliação da ARP com estrelas de reclamação sem resposta há mais de N dias",
    limite: "dias",
  },
  custo_por_lead_acima_meta: {
    rotulo: "Custo por lead da semana acima da meta",
    limite: null,
  },
  campanha_sem_lead: {
    rotulo: "Campanha com investimento na semana e nenhum lead no RD",
    limite: null,
  },
  avaliacoes_abaixo_do_ritmo: {
    rotulo: "Avaliações novas da ARP abaixo do ritmo da meta do mês",
    limite: null,
  },
  tarefa_atrasada: {
    rotulo: "Tarefa atrasada há mais de N dias",
    limite: "dias",
  },
  landing_page_sem_tipo: {
    rotulo: "Landing page nova sem tipo",
    limite: null,
  },
} as const satisfies Record<
  string,
  { rotulo: string; limite: "quantidade" | "dias" | null }
>;
export type CodigoRegra = keyof typeof REGRAS;

// ---------------------------------------------------------------------------
// Conferências dos locatários
// ---------------------------------------------------------------------------

/** Domínios dos links de perfil do Google (Maps, Perfil da Empresa, atalhos). */
const HOST_GOOGLE =
  /^(?:www\.)?(?:(?:maps\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?|maps\.app\.goo\.gl|goo\.gl|g\.page|g\.co|business\.google\.com)$/;

export interface ConferenciaLink {
  valido: boolean;
  /** Aviso para a tela (null quando o link é de um perfil). */
  aviso: string | null;
}

/**
 * O link aponta para um perfil do Google? Não bloqueia: link ruim salva com
 * aviso e o locatário aparece com "sem dados" na Reputação.
 */
/** Link colado sem "https://" (comum em planilha) ganha o protocolo; vazio → null. */
export function normalizarLink(url: string | null | undefined): string | null {
  const t = (url ?? "").trim();
  if (!t) return null;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
}

export function conferirLinkGoogle(
  url: string | null | undefined,
): ConferenciaLink {
  const t = normalizarLink(url) ?? "";
  if (!t)
    return {
      valido: false,
      aviso: "Sem link do perfil: aparece com “sem dados” na Reputação.",
    };
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return {
      valido: false,
      aviso: "Link inválido: copie o endereço completo (https://…).",
    };
  }
  const host = u.hostname.toLowerCase();
  if (!/^https?:$/.test(u.protocol) || !HOST_GOOGLE.test(host))
    return {
      valido: false,
      aviso: "O link não é do Google: perfil do Google não encontrado.",
    };
  const caminho = u.pathname.toLowerCase();
  const perfil =
    host === "maps.app.goo.gl" || host === "g.page" || host === "g.co"
      ? caminho.length > 1
      : host === "goo.gl"
        ? caminho.startsWith("/maps")
        : host.startsWith("business.")
          ? caminho.length > 1
          : caminho.startsWith("/maps") ||
            u.searchParams.has("cid") ||
            u.searchParams.has("place_id") ||
            host.startsWith("maps.");
  return perfil
    ? { valido: true, aviso: null }
    : {
        valido: false,
        aviso:
          "Perfil do Google não encontrado no link: use o “Compartilhar” do perfil no Google Maps.",
      };
}

/**
 * Marca "sem dados" do locatário (aqui e na Reputação): sem acesso ao perfil
 * ou link que não é de um perfil do Google. Null quando há dado.
 */
export function avisoSemDados(l: {
  perfil_url: string | null;
  forma_acesso: string;
}): string | null {
  if (l.forma_acesso === "sem_acesso")
    return "Sem acesso ao perfil: aparece com “sem dados” na Reputação.";
  return conferirLinkGoogle(l.perfil_url).aviso;
}

/** Mesma chave do índice único do banco (lower(btrim(nome))), sem espaço duplo. */
export const chaveDoNome = (nome: string) =>
  nome.trim().replace(/\s+/g, " ").toLowerCase();

/** Nome do locatário já cadastrado com o mesmo nome (fora o próprio), ou null. */
export function locatarioRepetido(
  nome: string,
  lista: { id: string; nome: string }[],
  id?: string | null,
): string | null {
  const chave = chaveDoNome(nome);
  if (!chave) return null;
  return (
    lista.find((l) => l.id !== id && chaveDoNome(l.nome) === chave)?.nome ??
    null
  );
}

// ---------------------------------------------------------------------------
// Reputação, Asana e landing pages
// ---------------------------------------------------------------------------

/** "Alerta > Atenção": o banco recusa o contrário. Null quando está certo. */
export function conferirFaixasReputacao(
  atencao: number,
  alerta: number,
): string | null {
  return alerta > atencao
    ? null
    : "O limite de Alerta precisa ser maior que o de Atenção.";
}

export const CAMPOS_ASANA = {
  asana_projeto_calendario: {
    rotulo: "Projeto do calendário",
    tipo: "projeto",
  },
  asana_projeto_ronda: { rotulo: "Projeto da ronda", tipo: "projeto" },
  asana_tag_locatario: { rotulo: "Tag de locatário", tipo: "tag" },
  asana_tag_terceiro: { rotulo: "Tag de terceiro", tipo: "tag" },
  asana_tag_gratuita: { rotulo: "Tag de gratuita", tipo: "tag" },
  asana_tag_paga: { rotulo: "Tag de paga", tipo: "tag" },
} as const;
export type CampoAsana = keyof typeof CAMPOS_ASANA;

export interface ConferenciaAsana {
  campo: CampoAsana | "asana_projetos_marketing";
  rotulo: string;
  tipo: "projeto" | "tag";
  nome: string;
  existe: boolean;
}

/** Projetos e tags que existem hoje no Asana (sem diferença de maiúsculas). */
export function nomesDoAsana(asana: {
  projetos: { name: string; archived: boolean }[];
  tarefas: { tags: { name: string }[] }[];
}): { projetos: string[]; tags: string[] } {
  const tags = new Set<string>();
  for (const t of asana.tarefas) for (const g of t.tags) tags.add(g.name);
  return {
    projetos: asana.projetos.filter((p) => !p.archived).map((p) => p.name),
    tags: [...tags].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

/**
 * Cada nome de projeto ou tag das Configurações e se ele existe no Asana
 * (projeto arquivado conta como não existe). Resumo também para o topo do
 * Radar: `.filter((c) => !c.existe)`.
 */
export function conferirAsana(
  p: { asana_projetos_marketing: string[] } & Record<CampoAsana, string | null>,
  asana: { projetos: string[]; tags: string[] },
): ConferenciaAsana[] {
  const tem = (lista: string[], nome: string) =>
    lista.some((n) => chaveDoNome(n) === chaveDoNome(nome));
  const saida: ConferenciaAsana[] = p.asana_projetos_marketing
    .filter((n) => n.trim())
    .map((nome) => ({
      campo: "asana_projetos_marketing",
      rotulo: "Projeto do Marketing",
      tipo: "projeto",
      nome,
      existe: tem(asana.projetos, nome),
    }));
  for (const [campo, def] of Object.entries(CAMPOS_ASANA) as [
    CampoAsana,
    (typeof CAMPOS_ASANA)[CampoAsana],
  ][]) {
    const nome = p[campo]?.trim();
    if (!nome) continue;
    saida.push({
      campo,
      rotulo: def.rotulo,
      tipo: def.tipo,
      nome,
      existe: tem(def.tipo === "projeto" ? asana.projetos : asana.tags, nome),
    });
  }
  return saida;
}

export interface LinhaLandingPage {
  identificador: string;
  nome: string;
  /** Null: "Sem tipo" (precisa classificar). */
  interesse: InteresseLp | null;
  /** Já tem linha no cadastro. */
  cadastrada: boolean;
  /** Aparece nos dados do RD. */
  noRd: boolean;
}

/**
 * Landing pages do RD com o interesse do cadastro. A do RD que não está no
 * cadastro entra como "Sem tipo" (primeiro na lista, para classificar).
 */
export function classificarLandingPages(
  doRd: { conversion_identifier: string; nome: string }[],
  cadastro: { identificador: string; nome: string; interesse: string | null }[],
): LinhaLandingPage[] {
  const mapa = new Map<string, LinhaLandingPage>();
  for (const c of cadastro)
    mapa.set(c.identificador, {
      identificador: c.identificador,
      nome: c.nome,
      interesse: (c.interesse as InteresseLp | null) ?? null,
      cadastrada: true,
      noRd: false,
    });
  for (const r of doRd) {
    const ja = mapa.get(r.conversion_identifier);
    if (ja) ja.noRd = true;
    else
      mapa.set(r.conversion_identifier, {
        identificador: r.conversion_identifier,
        nome: r.nome || r.conversion_identifier,
        interesse: null,
        cadastrada: false,
        noRd: true,
      });
  }
  return [...mapa.values()].sort(
    (a, b) =>
      Number(a.interesse !== null) - Number(b.interesse !== null) ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

/** Quantas landing pages do RD estão "Sem tipo" (aviso do Painel). */
export const landingPagesSemTipo = (ls: LinhaLandingPage[]) =>
  ls.filter((l) => l.noRd && l.interesse === null);

// ---------------------------------------------------------------------------
// Planilha de locatários (carga inicial): .xlsx ou .csv, como ela está
// ---------------------------------------------------------------------------

export type Celula = string | number | boolean | Date | null;

type CampoCarga =
  | "nome"
  | "categoria"
  | "perfil_url"
  | "forma_acesso"
  | "entrada_em";

const NOMES_CAMPO: Record<CampoCarga, string> = {
  nome: "nome",
  categoria: "categoria",
  perfil_url: "link do perfil",
  forma_acesso: "forma de acesso",
  entrada_em: "data de entrada",
};

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Ordem importa: "Tipo de acesso" é acesso (não categoria), "Link do perfil"
// é link, "Categoria da loja" é categoria e "Nome da loja" é nome.
const CABECALHOS: [CampoCarga, RegExp][] = [
  ["forma_acesso", /acesso/],
  ["entrada_em", /entrada|desde|inicio/],
  ["perfil_url", /link|perfil|google|url|maps/],
  ["categoria", /categoria|segmento|ramo|tipo/],
  ["nome", /nome|locatari|loja|estabelecimento|marca|empresa/],
];

export class ErroPlanilha extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroPlanilha";
  }
}

export interface LinhaDaCarga {
  /** Número da linha na planilha (para a pessoa achar). */
  linha: number;
  nome: string;
  categoria: string;
  perfil_url: string | null;
  forma_acesso: FormaAcesso;
  entrada_em: string | null;
  /** Impede a linha de entrar (falta nome ou categoria, repetida). */
  problemas: string[];
  /** Entra assim mesmo (ex.: link sem perfil → "sem dados"). */
  avisos: string[];
}

export interface CargaLida {
  /** Cabeçalho da planilha usado para cada campo (null: não achou). */
  colunas: Record<CampoCarga, string | null>;
  /** Colunas que faltam ("categoria", "link do perfil"…). */
  faltando: string[];
  linhas: LinhaDaCarga[];
}

function textoDaCelula(c: Celula | undefined): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date)
    return Number.isNaN(c.getTime()) ? "" : c.toISOString().slice(0, 10);
  return String(c).trim();
}

/** "dd/mm/aaaa", "aaaa-mm-dd" ou data do Excel → "aaaa-mm-dd"; senão null. */
function dataDaCelula(c: Celula | undefined): string | null {
  if (c instanceof Date)
    return Number.isNaN(c.getTime()) ? null : c.toISOString().slice(0, 10);
  const t = textoDaCelula(c);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  const iso = br
    ? `${br[3]}-${br[2]?.padStart(2, "0")}-${br[1]?.padStart(2, "0")}`
    : /^\d{4}-\d{2}-\d{2}$/.test(t)
      ? t
      : null;
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}

/** "Gerente", "consulta pública", "sem acesso"… → código; vazio/desconhecido → null. */
export function formaDeAcessoDoTexto(texto: string): FormaAcesso | null {
  const t = semAcento(texto);
  if (!t) return null;
  if (t.includes("sem")) return "sem_acesso";
  if (t.includes("gerent") || t.includes("propriet")) return "gerente";
  if (/public|consulta|parcia/.test(t)) return "consulta_publica";
  return null;
}

/**
 * Confere uma linha da carga (também depois de a pessoa corrigir na prévia).
 * O link nunca impede: sem perfil, entra com "sem dados".
 */
export function conferirLinhaDaCarga(
  l: Omit<LinhaDaCarga, "problemas" | "avisos">,
  avisosDaLeitura: string[] = [],
): LinhaDaCarga {
  const problemas: string[] = [];
  if (!l.nome.trim()) problemas.push("Sem nome");
  if (!l.categoria.trim()) problemas.push("Sem categoria");
  const avisos = [...avisosDaLeitura];
  const semDados = avisoSemDados(l);
  if (semDados) avisos.push(semDados);
  return { ...l, problemas, avisos };
}

const REPETIDO = "Repetido na planilha";

/** Marca a segunda (e seguintes) linhas com o mesmo nome. */
export function marcarRepetidas(linhas: LinhaDaCarga[]): LinhaDaCarga[] {
  const primeira = new Map<string, number>();
  return linhas.map((l) => {
    const chave = chaveDoNome(l.nome);
    if (!chave) return l;
    const ja = primeira.get(chave);
    if (ja === undefined) {
      primeira.set(chave, l.linha);
      return l;
    }
    return {
      ...l,
      problemas: [...l.problemas, `${REPETIDO} (linha ${ja})`],
    };
  });
}

/** Correção feita na prévia: confere a linha de novo e refaz as repetidas. */
export function corrigirLinhaDaCarga(
  linhas: LinhaDaCarga[],
  i: number,
  mudanca: Partial<
    Pick<LinhaDaCarga, "nome" | "categoria" | "perfil_url" | "forma_acesso">
  >,
): LinhaDaCarga[] {
  return marcarRepetidas(
    linhas.map((l, j) => {
      if (j !== i)
        return {
          ...l,
          problemas: l.problemas.filter((p) => !p.startsWith(REPETIDO)),
        };
      const { problemas: _p, avisos: _a, ...base } = { ...l, ...mudanca };
      return conferirLinhaDaCarga(base);
    }),
  );
}

/**
 * Lê a planilha como ela está: acha a linha de cabeçalho (nome/locatário/
 * loja; categoria/segmento; link/perfil/google; acesso), ignora linhas
 * vazias e devolve cada linha com seus problemas, para a prévia.
 */
export function lerPlanilhaDeLocatarios(linhas: Celula[][]): CargaLida {
  // Cabeçalho: das 10 primeiras linhas, a que tem a coluna do nome e mais
  // colunas reconhecidas (um título "Locatários 2026" em cima não engana).
  let topo = -1;
  let colunas: Record<CampoCarga, number> | null = null;
  let melhor = 0;
  for (let i = 0; i < Math.min(linhas.length, 10); i++) {
    const achadas: Partial<Record<CampoCarga, number>> = {};
    (linhas[i] ?? []).forEach((c, j) => {
      const t = semAcento(textoDaCelula(c));
      if (!t) return;
      const campo = CABECALHOS.find(
        ([k, re]) => achadas[k] === undefined && re.test(t),
      )?.[0];
      if (campo) achadas[campo] = j;
    });
    const nota = Object.keys(achadas).length;
    if (achadas.nome !== undefined && nota > melhor) {
      melhor = nota;
      topo = i;
      colunas = {
        nome: achadas.nome,
        categoria: achadas.categoria ?? -1,
        perfil_url: achadas.perfil_url ?? -1,
        forma_acesso: achadas.forma_acesso ?? -1,
        entrada_em: achadas.entrada_em ?? -1,
      };
    }
  }
  if (!colunas)
    throw new ErroPlanilha(
      "Não achei a coluna do nome do locatário (cabeçalho “Nome”, “Locatário” ou “Loja”) nas 10 primeiras linhas.",
    );
  const col = colunas;
  const cab = linhas[topo] ?? [];
  const nomes = Object.fromEntries(
    (Object.keys(col) as CampoCarga[]).map((k) => [
      k,
      col[k] >= 0 ? textoDaCelula(cab[col[k]]) : null,
    ]),
  ) as Record<CampoCarga, string | null>;
  // Forma de acesso e entrada são opcionais: sem a coluna, valem o padrão.
  const faltando = (["categoria", "perfil_url"] as const)
    .filter((k) => col[k] < 0)
    .map((k) => NOMES_CAMPO[k]);

  const lidas: LinhaDaCarga[] = [];
  for (let i = topo + 1; i < linhas.length; i++) {
    const l = linhas[i] ?? [];
    if (l.every((c) => textoDaCelula(c) === "")) continue;
    const pega = (k: CampoCarga) => (col[k] >= 0 ? l[col[k]] : undefined);
    const avisos: string[] = [];
    const perfil = normalizarLink(textoDaCelula(pega("perfil_url")));
    const textoAcesso = textoDaCelula(pega("forma_acesso"));
    let forma = formaDeAcessoDoTexto(textoAcesso);
    if (textoAcesso && !forma)
      avisos.push(`Forma de acesso “${textoAcesso}” não reconhecida.`);
    // Sem a forma de acesso: com link de perfil, a consulta pública (dados
    // parciais); a pessoa marca "gerente" na tela quando a ARP tiver acesso.
    forma ??= conferirLinkGoogle(perfil).valido
      ? "consulta_publica"
      : "sem_acesso";
    const textoEntrada = textoDaCelula(pega("entrada_em"));
    const entrada = dataDaCelula(pega("entrada_em"));
    if (textoEntrada && !entrada)
      avisos.push(
        `Data de entrada “${textoEntrada}” não entendida: fica hoje.`,
      );
    lidas.push(
      conferirLinhaDaCarga(
        {
          linha: i + 1,
          nome: textoDaCelula(pega("nome")).replace(/\s+/g, " "),
          categoria: textoDaCelula(pega("categoria")),
          perfil_url: perfil,
          forma_acesso: forma,
          entrada_em: entrada,
        },
        avisos,
      ),
    );
  }
  return { colunas: nomes, faltando, linhas: marcarRepetidas(lidas) };
}

/** Texto do arquivo: UTF-8 (com ou sem BOM) ou, se não for, Windows-1252 (CSV do Excel). */
export function decodificarTexto(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true })
      .decode(bytes)
      .replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** CSV com ";" (Excel em português), "," ou tab, com aspas. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const primeira = t.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const sep = [";", ",", "\t"].reduce((melhor, s) =>
    primeira.split(s).length > primeira.split(melhor).length ? s : melhor,
  );
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"' && campo === "") aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

export interface PlanoDaCarga {
  incluir: Omit<LinhaDaCarga, "linha" | "problemas" | "avisos">[];
  /** Já cadastrados (mesmo nome): atualiza categoria, link e acesso. */
  atualizar: (Omit<
    LinhaDaCarga,
    "linha" | "problemas" | "avisos" | "entrada_em"
  > & {
    id: string;
  })[];
  /** Cadastrados que não estão na planilha (só com "tirar os ausentes"). */
  tirar: { id: string; nome: string }[];
  /** Linhas com problema: ficam de fora. */
  deFora: number;
}

/**
 * O que a carga faz: linha sem problema com nome novo é incluída; com nome
 * já cadastrado, atualiza (volta a ficar ativo). Com `tirarAusentes`, quem
 * está ativo e não veio na planilha sai da lista (saída hoje), sem apagar.
 */
export function planoDaCarga(
  linhas: LinhaDaCarga[],
  existentes: { id: string; nome: string; ativo: boolean }[],
  tirarAusentes: boolean,
): PlanoDaCarga {
  const porNome = new Map(existentes.map((e) => [chaveDoNome(e.nome), e]));
  const vistos = new Set<string>();
  const plano: PlanoDaCarga = {
    incluir: [],
    atualizar: [],
    tirar: [],
    deFora: 0,
  };
  for (const l of linhas) {
    if (l.problemas.length) {
      plano.deFora++;
      continue;
    }
    const chave = chaveDoNome(l.nome);
    vistos.add(chave);
    const dados = {
      nome: l.nome.trim(),
      categoria: l.categoria.trim(),
      perfil_url: l.perfil_url?.trim() || null,
      forma_acesso: l.forma_acesso,
    };
    const ja = porNome.get(chave);
    if (ja) plano.atualizar.push({ id: ja.id, ...dados });
    else plano.incluir.push({ ...dados, entrada_em: l.entrada_em });
  }
  if (tirarAusentes)
    plano.tirar = existentes
      .filter((e) => e.ativo && !vistos.has(chaveDoNome(e.nome)))
      .map(({ id, nome }) => ({ id, nome }));
  return plano;
}

// ---------------------------------------------------------------------------
// Histórico (core.auditoria) e o "voltar"
// ---------------------------------------------------------------------------

export interface LinhaAuditoria {
  id: number;
  tabela: string;
  registro_id: string;
  acao: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  usuario_id: string | null;
  em: string;
}

interface TabelaMkt {
  bloco: Bloco;
  rotulo: string;
  /** Chave primária (uma coluna). */
  chave: string;
  /** Colunas que a tela edita: o "voltar" de uma alteração regrava estas. */
  editaveis: string[];
  /** Colunas fixas que também voltam ao reincluir uma linha removida. */
  fixas: string[];
  /** A tela inclui e remove linhas (regras e parâmetros, não). */
  incluiRemove: boolean;
}

export const TABELAS_MKT: Record<string, TabelaMkt> = {
  "marketing.locatarios": {
    bloco: "locatarios",
    rotulo: "Locatário",
    chave: "id",
    editaveis: [
      "nome",
      "categoria",
      "perfil_url",
      "forma_acesso",
      "ativo",
      "entrada_em",
      "saida_em",
    ],
    fixas: [],
    incluiRemove: true,
  },
  "marketing.landing_pages": {
    bloco: "landing_pages",
    rotulo: "Landing page",
    chave: "identificador",
    editaveis: ["nome", "interesse"],
    fixas: [],
    incluiRemove: true,
  },
  "core.metas": {
    bloco: "metas",
    rotulo: "Meta",
    chave: "id",
    editaveis: ["meta", "limite_atencao"],
    fixas: ["indicador", "direcao", "vigente_desde"],
    incluiRemove: true,
  },
  "marketing.regras_alerta": {
    bloco: "regras",
    rotulo: "Regra de alerta",
    chave: "regra",
    editaveis: ["limite", "nivel", "ativa"],
    fixas: [],
    incluiRemove: false,
  },
  "marketing.temas": {
    bloco: "reputacao",
    rotulo: "Tema",
    chave: "id",
    editaveis: ["nome", "ativo", "ordem"],
    fixas: [],
    incluiRemove: true,
  },
  "marketing.ronda_codigos": {
    bloco: "ronda",
    rotulo: "Código da ronda",
    chave: "codigo",
    editaveis: ["descricao", "area"],
    fixas: [],
    incluiRemove: true,
  },
  "marketing.parametros": {
    bloco: "reputacao",
    rotulo: "Configurações",
    chave: "id",
    editaveis: [
      "estrelas_reclamacao",
      "janela_reputacao_dias",
      "reclamacoes_atencao",
      "reclamacoes_alerta",
      "nota_atencao",
      "asana_projetos_marketing",
      "asana_projeto_calendario",
      "asana_projeto_ronda",
      "asana_tag_locatario",
      "asana_tag_terceiro",
      "asana_tag_gratuita",
      "asana_tag_paga",
      "sinalizacao_antiga_dias",
      "quadros_ocultos",
      "termos_marca",
    ],
    fixas: [],
    incluiRemove: false,
  },
  "marketing.benchmark": {
    bloco: "benchmark",
    rotulo: "Referência do benchmark",
    chave: "id",
    editaveis: ["nome", "cidade", "instagram", "site", "ativo"],
    fixas: [],
    incluiRemove: true,
  },
};

/** A linha única de parâmetros guarda dois blocos: o da alteração vem dos campos. */
function blocoDosParametros(campos: string[]): Bloco {
  if (campos.includes("quadros_ocultos")) return "visualizacao";
  if (campos.includes("termos_marca")) return "benchmark";
  if (
    campos.some(
      (c) => c.startsWith("asana_") || c === "sinalizacao_antiga_dias",
    )
  )
    return "asana";
  return "reputacao";
}

export const CAMPOS: Record<string, string> = {
  nome: "Nome",
  categoria: "Categoria",
  perfil_url: "Link do perfil",
  forma_acesso: "Forma de acesso",
  ativo: "Ativo",
  entrada_em: "Entrada na lista",
  saida_em: "Saída da lista",
  identificador: "Identificador",
  interesse: "Interesse",
  indicador: "Indicador",
  direcao: "Direção",
  meta: "Meta",
  limite_atencao: "Limite de atenção",
  vigente_desde: "Vale a partir de",
  regra: "Regra",
  limite: "Limite",
  nivel: "Nível",
  ativa: "Ativa",
  ordem: "Ordem",
  codigo: "Código",
  descricao: "Descrição",
  area: "Área",
  estrelas_reclamacao: "Estrelas de reclamação",
  janela_reputacao_dias: "Janela da reputação (dias)",
  reclamacoes_atencao: "Reclamações para Atenção",
  reclamacoes_alerta: "Reclamações para Alerta",
  nota_atencao: "Nota das novas para Atenção",
  asana_projetos_marketing: "Projetos do Marketing",
  asana_projeto_calendario: "Projeto do calendário",
  asana_projeto_ronda: "Projeto da ronda",
  asana_tag_locatario: "Tag de locatário",
  asana_tag_terceiro: "Tag de terceiro",
  asana_tag_gratuita: "Tag de gratuita",
  asana_tag_paga: "Tag de paga",
  sinalizacao_antiga_dias: "Sinalização antiga (dias)",
  quadros_ocultos: "Quadros escondidos",
  termos_marca: "Termos da marca",
  cidade: "Cidade",
  instagram: "Instagram",
  site: "Site",
};

/** Colunas que mudam sozinhas ou são a identidade da linha. */
const IGNORAR = new Set(["id", "atualizado_em", "criado_em"]);

/** Valor do banco como se lê na tela. */
export function valorLegivel(
  campo: string,
  v: unknown,
  nomeIndicador: (i: string) => string = (i) => i,
): string {
  if (campo === "interesse" && (v === null || v === undefined))
    return "Sem tipo";
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  const t = String(v);
  switch (campo) {
    case "forma_acesso":
      return FORMAS_ACESSO[t as FormaAcesso] ?? t;
    case "interesse":
      return INTERESSES_LP[t as InteresseLp] ?? t;
    case "nivel":
      return NIVEIS[t as Nivel] ?? t;
    case "area":
      return AREAS[t as Area] ?? t;
    case "regra":
      return REGRAS[t as CodigoRegra]?.rotulo ?? t;
    case "direcao":
      return t === "menor_melhor" ? "menor é melhor" : "maior é melhor";
    case "indicador":
      return nomeIndicador(t);
    case "vigente_desde":
      return formatarMes(t);
    case "entrada_em":
    case "saida_em":
      return formatarData(t);
  }
  return typeof v === "number" ? t.replace(".", ",") : t;
}

const igual = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export interface Mudanca {
  campo: string;
  rotulo: string;
  antes: string;
  depois: string;
}

/**
 * Campos que a alteração mudou, legíveis. Ao incluir, os preenchidos; ao
 * remover, os que havia; ao alterar, só os diferentes.
 */
export function mudancas(
  l: Pick<LinhaAuditoria, "acao" | "antes" | "depois">,
  nomeIndicador?: (i: string) => string,
): Mudanca[] {
  const campos = [
    ...new Set([...Object.keys(l.antes ?? {}), ...Object.keys(l.depois ?? {})]),
  ].filter((c) => !IGNORAR.has(c));
  return campos
    .filter((c) =>
      l.antes && l.depois
        ? !igual(l.antes[c], l.depois[c])
        : (l.antes ?? l.depois)?.[c] !== null,
    )
    .map((campo) => ({
      campo,
      rotulo: CAMPOS[campo] ?? campo,
      antes: l.antes ? valorLegivel(campo, l.antes[campo], nomeIndicador) : "",
      depois: l.depois
        ? valorLegivel(campo, l.depois[campo], nomeIndicador)
        : "",
    }));
}

/** Bloco da tela de uma linha do histórico (null: não é das Configurações). */
export function blocoDaAuditoria(
  l: Pick<LinhaAuditoria, "tabela" | "acao" | "antes" | "depois">,
): Bloco | null {
  const t = TABELAS_MKT[l.tabela];
  if (!t) return null;
  if (l.tabela !== "marketing.parametros") return t.bloco;
  return blocoDosParametros(mudancas(l).map((m) => m.campo));
}

/** Do que é a linha alterada ("Bistrô Tear", "Custo por lead · jan/2026"). */
export function descreverRegistro(
  l: Pick<LinhaAuditoria, "tabela" | "registro_id" | "antes" | "depois">,
  nomeIndicador: (i: string) => string = (i) => i,
): string {
  const r = { ...(l.antes ?? {}), ...(l.depois ?? {}) };
  switch (l.tabela) {
    case "marketing.locatarios":
    case "marketing.landing_pages":
    case "marketing.temas":
      return String(r.nome ?? l.registro_id);
    case "marketing.regras_alerta":
      return valorLegivel("regra", r.regra ?? l.registro_id);
    case "marketing.ronda_codigos":
      return `${r.codigo ?? l.registro_id} · ${r.descricao ?? ""}`.trim();
    case "core.metas":
      return `${nomeIndicador(String(r.indicador ?? ""))} · desde ${valorLegivel("vigente_desde", r.vigente_desde)}`;
    case "marketing.parametros":
      return BLOCOS[blocoDaAuditoria({ ...l, acao: "update" }) ?? "reputacao"];
  }
  return l.registro_id;
}

export type Voltar =
  | {
      tipo: "alterar";
      tabela: string;
      chave: { coluna: string; valor: string | boolean };
      valores: Record<string, unknown>;
    }
  | {
      tipo: "apagar";
      tabela: string;
      chave: { coluna: string; valor: string | boolean };
    }
  | { tipo: "incluir"; tabela: string; valores: Record<string, unknown> }
  | { tipo: "impossivel"; motivo: string };

const ehMetaDoMarketing = (r: Record<string, unknown> | null) =>
  typeof r?.indicador === "string" && r.indicador.startsWith("marketing.");

/**
 * O que desfaz uma alteração do histórico: alteração → regrava o "antes" só
 * dos campos editáveis que ela mudou (o resto, mudado depois, fica);
 * inclusão → apaga a linha; remoção → reinclui a linha como era.
 */
export function montarVoltar(l: LinhaAuditoria): Voltar {
  const t = TABELAS_MKT[l.tabela];
  if (!t)
    return {
      tipo: "impossivel",
      motivo: "Esta alteração não é das Configurações do Marketing.",
    };
  if (l.tabela === "core.metas" && !ehMetaDoMarketing(l.antes ?? l.depois))
    return { tipo: "impossivel", motivo: "Esta meta não é do Marketing." };
  const chaveDe = (r: Record<string, unknown> | null) => {
    const v = r?.[t.chave];
    return typeof v === "string" || typeof v === "boolean"
      ? { coluna: t.chave, valor: v }
      : null;
  };
  if (l.acao === "update") {
    const chave = chaveDe(l.antes);
    if (!chave || !l.antes || !l.depois)
      return {
        tipo: "impossivel",
        motivo: "Registro incompleto no histórico.",
      };
    const antes = l.antes;
    const depois = l.depois;
    const campos = t.editaveis.filter((c) => !igual(antes[c], depois[c]));
    if (!campos.length)
      return {
        tipo: "impossivel",
        motivo: "Nada para voltar: só mudaram campos automáticos.",
      };
    return {
      tipo: "alterar",
      tabela: l.tabela,
      chave,
      valores: Object.fromEntries(campos.map((c) => [c, antes[c] ?? null])),
    };
  }
  if (!t.incluiRemove)
    return {
      tipo: "impossivel",
      motivo: "Este cadastro não inclui nem remove linhas.",
    };
  if (l.acao === "insert") {
    const chave = chaveDe(l.depois);
    return chave
      ? { tipo: "apagar", tabela: l.tabela, chave }
      : { tipo: "impossivel", motivo: "Registro incompleto no histórico." };
  }
  if (l.acao === "delete") {
    const antes = l.antes;
    if (!antes || !chaveDe(antes))
      return {
        tipo: "impossivel",
        motivo: "Registro incompleto no histórico.",
      };
    return {
      tipo: "incluir",
      tabela: l.tabela,
      valores: Object.fromEntries(
        [t.chave, ...t.fixas, ...t.editaveis].map((c) => [c, antes[c] ?? null]),
      ),
    };
  }
  return { tipo: "impossivel", motivo: "Ação desconhecida no histórico." };
}

/** Texto da confirmação do "Voltar". */
export function perguntaDoVoltar(v: Voltar, descricao: string): string {
  switch (v.tipo) {
    case "alterar":
      return `Voltar “${descricao}” aos valores de antes desta alteração? A mudança também fica no histórico.`;
    case "apagar":
      return `Desfazer a inclusão apaga “${descricao}”. Continuar?`;
    case "incluir":
      return `Incluir de novo “${descricao}”, como estava antes de ser removido?`;
    case "impossivel":
      return v.motivo;
  }
}

/** Valor de número digitado ("1.234,5", "45") → número; vazio → undefined. */
export function numeroDigitado(v: unknown): number | undefined {
  const n = lerValorBr(String(v ?? ""));
  return n === null ? undefined : n;
}
