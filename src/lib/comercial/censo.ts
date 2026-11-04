import { ativoEm, type FontesEnet } from "@/lib/comercial/fontes";

// Regras do Censo (spec 4.8 e 4.9): ticket ajustado, os indicadores da
// rodada, os quadros por bloco e segmento, os convites a partir dos
// locatários ativos do ENET e o agrupamento das sugestões por tema.

/** Bloco ou segmento sem resposta válida (como na planilha de 2026). */
export const VAZIO = "(vazio)";

/** Rótulo fixo das telas e do PDF (o mesmo aviso do mapa mental). */
export const ROTULO_ESTIMADO =
  "Dados estimados informados pelas empresas; não são contagem real.";

/** Ticket ÷ dias de uso quando é mensalidade; senão o próprio ticket. */
export function ticketAjustado(
  ticket: number | null,
  mensalidade: boolean | null,
  dias: number | null,
): number | null {
  if (ticket === null) return null;
  if (mensalidade && dias && dias > 0)
    return Math.round((ticket / dias) * 10000) / 10000;
  return ticket;
}

// ---------------------------------------------------------------------------
// Indicadores (4.8)
// ---------------------------------------------------------------------------

export interface RespostaIndicador {
  bloco: string | null;
  segmento: string | null;
  colaboradores: number | null;
  visitantes_dia: number | null;
  ticket_ajustado: number | null;
  conversoes_dia: number | null;
  expectativas: string[];
}

export interface IndicadoresCenso {
  empresas: number;
  colaboradores: number;
  mediaColaboradores: number | null;
  medianaColaboradores: number | null;
  visitantes: number;
  /** Colaboradores + visitantes por dia. */
  pessoas: number;
  /** % (0 a 100) com visitantes > 0, entre as respostas válidas. */
  pctAtendimento: number | null;
  /** Respostas com número válido de visitantes. */
  visitantesValidos: number;
  /** Ponderado pelas conversões; só respostas com ticket e conversões. */
  ticketMedio: number | null;
  movimentacao: number;
  conversoes: number;
  /** % (0 a 100) de cada opção sobre o total de empresas (passa de 100). */
  expectativas: { opcao: string; empresas: number; pct: number }[];
}

export function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2
    ? (v[meio] as number)
    : ((v[meio - 1] as number) + (v[meio] as number)) / 2;
}

/** Movimentação diária de uma resposta (ticket ajustado × conversões). */
export function movimentacaoDa(r: RespostaIndicador): number | null {
  return r.ticket_ajustado !== null && r.conversoes_dia !== null
    ? r.ticket_ajustado * r.conversoes_dia
    : null;
}

export function indicadoresCenso(
  respostas: RespostaIndicador[],
  opcoesExpectativa: string[],
): IndicadoresCenso {
  const colab = respostas
    .map((r) => r.colaboradores)
    .filter((v): v is number => v !== null);
  const vis = respostas
    .map((r) => r.visitantes_dia)
    .filter((v): v is number => v !== null);
  const colaboradores = colab.reduce((s, v) => s + v, 0);
  const visitantes = vis.reduce((s, v) => s + v, 0);
  let movimentacao = 0;
  let conversoes = 0;
  for (const r of respostas) {
    const m = movimentacaoDa(r);
    if (m === null) continue;
    movimentacao += m;
    conversoes += r.conversoes_dia ?? 0;
  }
  const empresas = respostas.length;
  return {
    empresas,
    colaboradores,
    mediaColaboradores: colab.length ? colaboradores / colab.length : null,
    medianaColaboradores: mediana(colab),
    visitantes,
    pessoas: colaboradores + visitantes,
    pctAtendimento: vis.length
      ? (vis.filter((v) => v > 0).length / vis.length) * 100
      : null,
    visitantesValidos: vis.length,
    ticketMedio: conversoes > 0 ? movimentacao / conversoes : null,
    movimentacao,
    conversoes,
    expectativas: opcoesExpectativa.map((opcao) => {
      const n = respostas.filter((r) => r.expectativas.includes(opcao)).length;
      return { opcao, empresas: n, pct: empresas ? (n / empresas) * 100 : 0 };
    }),
  };
}

export interface FiltroCenso {
  bloco?: string;
  segmento?: string;
}

/** Bloco/segmento "" = todos; VAZIO = sem resposta. */
export function filtrarRespostas<
  T extends Pick<RespostaIndicador, "bloco" | "segmento">,
>(respostas: T[], f: FiltroCenso): T[] {
  const bate = (valor: string | null, filtro?: string) =>
    !filtro || (valor ?? VAZIO) === filtro;
  return respostas.filter(
    (r) => bate(r.bloco, f.bloco) && bate(r.segmento, f.segmento),
  );
}

export interface LinhaGrupo {
  grupo: string;
  empresas: number;
  colaboradores: number;
  visitantes: number;
  movimentacao: number;
}

/** Quadro por bloco ou segmento, do maior número de visitantes ao menor. */
export function porGrupo(
  respostas: RespostaIndicador[],
  chave: "bloco" | "segmento",
): LinhaGrupo[] {
  const grupos = new Map<string, LinhaGrupo>();
  for (const r of respostas) {
    const grupo = r[chave] ?? VAZIO;
    const g = grupos.get(grupo) ?? {
      grupo,
      empresas: 0,
      colaboradores: 0,
      visitantes: 0,
      movimentacao: 0,
    };
    g.empresas += 1;
    g.colaboradores += r.colaboradores ?? 0;
    g.visitantes += r.visitantes_dia ?? 0;
    g.movimentacao += movimentacaoDa(r) ?? 0;
    grupos.set(grupo, g);
  }
  return [...grupos.values()].sort(
    (a, b) => b.visitantes - a.visitantes || a.grupo.localeCompare(b.grupo),
  );
}

// ---------------------------------------------------------------------------
// Convites (link único por empresa) a partir dos locatários ativos do ENET
// ---------------------------------------------------------------------------

export interface ConviteNovo {
  locatario_enet_id: string;
  empresa_nome: string;
  luc: string;
  bloco: string | null;
}

/** "Bloco 03" → "3"; "Bloco 11" → "11"; o que não é bloco fica de fora. */
export function blocoDoLocal(local: string, blocos: string[]): string | null {
  const m = /^bloco\s+0*(\w+)$/i.exec(local.trim());
  if (!m) return null;
  const numero = (m[1] as string).toUpperCase();
  return blocos.find((b) => b.toUpperCase() === numero) ?? numero;
}

/**
 * Uma empresa por locatário com contrato ativo hoje, num LUC que conta na
 * ocupação (área publicitária, vaga e eventos não respondem o Censo). O LUC
 * e o bloco do convite são os do menor LUC do locatário.
 */
export function convitesDosLocatarios(
  enet: Pick<FontesEnet, "lucs" | "contratos" | "clientes">,
  hoje: string,
  tiposForaDaOcupacao: Set<string>,
  blocos: string[],
): ConviteNovo[] {
  const lucs = new Map(enet.lucs.map((l) => [l.numero, l]));
  const nomes = new Map(enet.clientes.map((c) => [c.codigo, c.nome]));
  const porCliente = new Map<string, string[]>();
  for (const c of enet.contratos) {
    const l = lucs.get(c.luc);
    if (!l || !ativoEm(c, hoje) || tiposForaDaOcupacao.has(l.tipo_loja))
      continue;
    porCliente.set(c.cliente, [...(porCliente.get(c.cliente) ?? []), c.luc]);
  }
  return [...porCliente.entries()]
    .map(([cliente, seus]) => {
      const luc = [...seus].sort()[0] as string;
      return {
        locatario_enet_id: cliente,
        empresa_nome: nomes.get(cliente) ?? cliente,
        luc,
        bloco: blocoDoLocal(lucs.get(luc)?.local ?? "", blocos),
      };
    })
    .sort((a, b) => a.empresa_nome.localeCompare(b.empresa_nome, "pt-BR"));
}

export interface ConviteAcompanhamento {
  bloco: string | null;
  respondeu: boolean;
}

export interface LinhaAcompanhamento {
  bloco: string;
  convites: number;
  responderam: number;
  faltam: number;
  pct: number;
}

/** Quadro de quem respondeu e quem falta, por bloco. */
export function acompanhamentoPorBloco(
  convites: ConviteAcompanhamento[],
  ordemBlocos: string[],
): LinhaAcompanhamento[] {
  const grupos = new Map<string, LinhaAcompanhamento>();
  for (const c of convites) {
    const bloco = c.bloco ?? VAZIO;
    const g = grupos.get(bloco) ?? {
      bloco,
      convites: 0,
      responderam: 0,
      faltam: 0,
      pct: 0,
    };
    g.convites += 1;
    if (c.respondeu) g.responderam += 1;
    else g.faltam += 1;
    g.pct = (g.responderam / g.convites) * 100;
    grupos.set(bloco, g);
  }
  const posicao = (b: string) => {
    const i = ordemBlocos.indexOf(b);
    return i < 0 ? ordemBlocos.length : i;
  };
  return [...grupos.values()].sort(
    (a, b) =>
      posicao(a.bloco) - posicao(b.bloco) ||
      a.bloco.localeCompare(b.bloco, "pt-BR", { numeric: true }),
  );
}

// ---------------------------------------------------------------------------
// Feedbacks (4.9): sugestões da pergunta 10 e registros de contato de
// feedback, agrupados por tema. O nome da empresa nunca aparece no exemplo.
// ---------------------------------------------------------------------------

export interface SugestaoFeedback {
  /** "r:<id da resposta>" ou "c:<id do contato>". */
  chave: string;
  origem: "censo" | "contato";
  texto: string;
  /** Identifica a empresa para contar uma vez só (não vai para a tela). */
  empresa: string;
  /** Nomes que não podem sair no trecho (empresa e locatário). */
  nomes: string[];
  bloco: string | null;
  segmento: string | null;
  /** Vínculos com temas (censo_sugestao_temas). */
  temas: { vinculo: string; tema: string; trecho: string | null }[];
}

export interface TemaCenso {
  id: string;
  nome: string;
}

export interface LinhaTema {
  /** null = sugestões ainda sem tema. */
  tema: string | null;
  nome: string;
  empresas: number;
  sugestoes: number;
  exemplos: string[];
}

export const SEM_TEMA = "Sem tema";

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Tira o nome da empresa do texto (sem diferença de maiúscula e acento). */
export function semNomeDaEmpresa(texto: string, nomes: string[]): string {
  let saida = texto.normalize("NFC");
  const base = semAcento(saida).toLowerCase();
  const trechos: [number, number][] = [];
  for (const nome of nomes) {
    const n = semAcento(nome.trim()).toLowerCase();
    if (n.length < 3) continue;
    for (let i = base.indexOf(n); i >= 0; i = base.indexOf(n, i + n.length))
      trechos.push([i, i + n.length]);
  }
  // Do fim para o começo: os índices de antes continuam valendo.
  for (const [de, ate] of trechos.sort((a, b) => b[0] - a[0]))
    saida = `${saida.slice(0, de)}[empresa]${saida.slice(ate)}`;
  return saida;
}

/** Trecho curto para a coluna Exemplos. */
export function trechoCurto(texto: string, max = 140): string {
  const t = texto.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Trecho do exemplo de uma sugestão num tema, já sem o nome da empresa. */
export function exemploDa(s: SugestaoFeedback, trecho: string | null): string {
  return trechoCurto(semNomeDaEmpresa(trecho?.trim() || s.texto, s.nomes));
}

/** Tema × empresas × até 3 exemplos; as sem tema numa linha à parte. */
export function linhasDosTemas(
  sugestoes: SugestaoFeedback[],
  temas: TemaCenso[],
): LinhaTema[] {
  const linhas = new Map<string | null, LinhaTema & { de: Set<string> }>();
  const linha = (tema: string | null, nome: string) => {
    const atual = linhas.get(tema);
    if (atual) return atual;
    const nova = {
      tema,
      nome,
      empresas: 0,
      sugestoes: 0,
      exemplos: [],
      de: new Set<string>(),
    };
    linhas.set(tema, nova);
    return nova;
  };
  const nomeDe = new Map(temas.map((t) => [t.id, t.nome]));
  for (const s of sugestoes) {
    const vinculos = s.temas.filter((t) => nomeDe.has(t.tema));
    const alvos = vinculos.length
      ? vinculos.map((v) => ({
          tema: v.tema as string | null,
          trecho: v.trecho,
        }))
      : [{ tema: null, trecho: null }];
    for (const a of alvos) {
      const l = linha(
        a.tema,
        a.tema ? (nomeDe.get(a.tema) as string) : SEM_TEMA,
      );
      l.sugestoes += 1;
      l.de.add(s.empresa);
      const ex = exemploDa(s, a.trecho);
      if (l.exemplos.length < 3 && !l.exemplos.includes(ex))
        l.exemplos.push(ex);
    }
  }
  return [...linhas.values()]
    .map(({ de, ...l }) => ({ ...l, empresas: de.size }))
    .sort(
      (a, b) =>
        Number(a.tema === null) - Number(b.tema === null) ||
        b.empresas - a.empresas ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

/** Empresas diferentes com sugestão (cartão de Feedbacks). */
export function empresasComSugestao(sugestoes: SugestaoFeedback[]): number {
  return new Set(sugestoes.map((s) => s.empresa)).size;
}

/**
 * Período dos registros de contato de uma rodada: depois do fim da rodada
 * anterior até o fim desta (a mais recente vai até hoje, se passar do fim).
 */
export function periodoDosContatos(
  rodadas: { id: string; inicio: string; fim: string }[],
  rodadaId: string,
  hoje: string,
): { de: string | null; ate: string } | null {
  const ordem = [...rodadas].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const i = ordem.findIndex((r) => r.id === rodadaId);
  if (i < 0) return null;
  const r = ordem[i] as (typeof ordem)[number];
  const anterior = ordem[i - 1];
  const ultima = i === ordem.length - 1;
  return {
    de: anterior ? anterior.fim : null,
    ate: ultima && hoje > r.fim ? hoje : r.fim,
  };
}

// ---------------------------------------------------------------------------
// Questionário (tabela de 4.8): textos de hoje, tipos e obrigatórias.
// ---------------------------------------------------------------------------

export const PERGUNTAS = {
  email: { n: "1", texto: "E-mail" },
  bloco: { n: "2", texto: "Bloco" },
  segmento: { n: "3", texto: "Segmento" },
  empresa: {
    n: "4",
    texto: "Qual o nome de sua empresa? (nome comercial)",
  },
  colaboradores: {
    n: "5",
    texto: "Sua empresa tem quantos colaboradores, incluindo os sócios?",
  },
  visitantes: {
    n: "6",
    texto:
      "Em média, quantas pessoas (usuários ou clientes finais) visitam ou frequentam sua empresa diariamente, sem contar os colaboradores?",
    ajuda: "Ex.: uma indústria sem venda ou visita direta coloca 0.",
  },
  ticket: {
    n: "7",
    texto:
      "Quanto, normalmente, o seu cliente está disposto a consumir no seu negócio? (ticket médio)",
  },
  mensalidade: {
    n: "7a",
    texto:
      "Esse valor é uma mensalidade? Se sim, quantos dias por mês o cliente usa?",
  },
  conversoes: {
    n: "8",
    texto: "Qual o volume médio de conversões (vendas) por dia no seu negócio?",
  },
  expectativas: {
    n: "9",
    texto:
      "Pensando nas expectativas para o ano, o planejamento da sua empresa no Espaço ARP é:",
  },
  sugestao: {
    n: "10",
    texto:
      "Para finalizar: recebeu alguma sugestão de clientes que possa ser uma oportunidade de melhoria, alguma insatisfação ou um feedback positivo que queira compartilhar?",
  },
} as const;

export interface OpcoesQuestionario {
  blocos: string[];
  segmentos: string[];
  expectativas: string[];
}

export interface RespostaQuestionario {
  email: string;
  bloco: string;
  segmento: string;
  empresa_nome: string;
  colaboradores: number;
  visitantes_dia: number;
  ticket: number | null;
  mensalidade: boolean | null;
  dias_uso: number | null;
  conversoes_dia: number | null;
  expectativas: string[];
  sugestao: string | null;
  ticket_ajustado: number | null;
}

export type CamposQuestionario = Record<string, string | string[] | undefined>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTEIRO = /^\d{1,7}$/;

/** "199" ou "199,90" (vírgula ou ponto, sem texto); null se vazio. */
export function lerReais(texto: string): number | null | "invalido" {
  const t = texto.replace(/R\$|\s/g, "");
  if (!t) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t))
    return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^\d+([.,]\d{1,2})?$/.test(t)) return Number(t.replace(",", "."));
  return "invalido";
}

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

/**
 * Confere as respostas como o servidor grava: números só com números (o
 * "-" de 2026 é recusado), 7a só com a 7 respondida, opções das listas.
 */
export function validarQuestionario(
  campos: CamposQuestionario,
  opcoes: OpcoesQuestionario,
):
  | { ok: true; dados: RespostaQuestionario }
  | { ok: false; erros: Record<string, string> } {
  const erros: Record<string, string> = {};
  const email = um(campos.email);
  if (!EMAIL.test(email) || email.length > 200)
    erros.email = "Informe um e-mail válido.";
  const bloco = um(campos.bloco);
  if (!opcoes.blocos.includes(bloco)) erros.bloco = "Escolha o bloco.";
  const segmento = um(campos.segmento);
  if (!opcoes.segmentos.includes(segmento))
    erros.segmento = "Escolha o segmento.";
  const empresa_nome = um(campos.empresa_nome);
  if (!empresa_nome || empresa_nome.length > 160)
    erros.empresa_nome = "Informe o nome da empresa.";

  const inteiro = (chave: string, obrigatoria: boolean): number | null => {
    const t = um(campos[chave]);
    if (!t) {
      if (obrigatoria) erros[chave] = "Responda com um número.";
      return null;
    }
    if (!INTEIRO.test(t)) {
      erros[chave] = "Use só números, sem letras ou sinais.";
      return null;
    }
    return Number(t);
  };
  const colaboradores = inteiro("colaboradores", true);
  const visitantes_dia = inteiro("visitantes_dia", true);
  const conversoes_dia = inteiro("conversoes_dia", false);

  const lido = lerReais(um(campos.ticket));
  let ticket: number | null = null;
  if (lido === "invalido")
    erros.ticket = "Use só o valor em reais (ex.: 199,90).";
  else ticket = lido;

  let mensalidade: boolean | null = null;
  let dias_uso: number | null = null;
  if (ticket !== null) {
    mensalidade = um(campos.mensalidade) === "sim";
    if (mensalidade) {
      const d = inteiro("dias_uso", true);
      if (d !== null && (d < 1 || d > 31))
        erros.dias_uso = "Os dias por mês vão de 1 a 31.";
      else dias_uso = d;
    }
  }

  const marcadas = Array.isArray(campos.expectativas)
    ? campos.expectativas
    : campos.expectativas
      ? [campos.expectativas]
      : [];
  const expectativas = opcoes.expectativas.filter((o) => marcadas.includes(o));
  if (!expectativas.length || expectativas.length !== new Set(marcadas).size)
    erros.expectativas = "Marque pelo menos uma opção.";

  const sugestao = um(campos.sugestao).slice(0, 4000) || null;

  if (Object.keys(erros).length) return { ok: false, erros };
  return {
    ok: true,
    dados: {
      email,
      bloco,
      segmento,
      empresa_nome,
      colaboradores: colaboradores as number,
      visitantes_dia: visitantes_dia as number,
      ticket,
      mensalidade,
      dias_uso,
      conversoes_dia,
      expectativas,
      sugestao,
      ticket_ajustado: ticketAjustado(ticket, mensalidade, dias_uso),
    },
  };
}

/** Situação do link: aberto, encerrado (pela pessoa ou pela data) ou antes do início. */
export function situacaoDoLink(
  rodada: { situacao: string; inicio: string; fim: string },
  hoje: string,
): "aberta" | "encerrada" | "antes" {
  if (rodada.situacao === "encerrada" || hoje > rodada.fim) return "encerrada";
  if (hoje < rodada.inicio) return "antes";
  return "aberta";
}
