import "server-only";
import { cache } from "react";
import { somarDias } from "@/lib/comercial/datas";
import { formatarData } from "@/lib/formato";
import { deBrasilia, hojeEmBrasilia } from "@/lib/os/tempo";
import {
  type ContratoDoCliente,
  contratoVigente,
  type EntrevistaDoContrato,
  entrevistaPorCliente,
  entrevistasDosContratos,
  type UltimaEntrevista,
} from "@/lib/sustentabilidade/clube-entrevista";
import type { ContribuicaoDoRelatorio } from "@/lib/sustentabilidade/clube-exportar";
import {
  anosDoClube,
  type ExtrasDoAno,
  type ParticipanteBase,
  type SituacaoClube,
  situacaoNaData,
} from "@/lib/sustentabilidade/clube-lista";
import { documentoComTipo } from "@/lib/sustentabilidade/clube-termo";
import type { SituacaoEntrevista } from "@/lib/sustentabilidade/situacao";
import type { Bucket } from "@/server/arquivos";
import { configDoSistema } from "@/server/os/automacao";
import { osAdmin } from "@/server/os/base";
import { criarChamadoSistema } from "@/server/os/criar";
import {
  chamadoAbertoDaOrigem,
  concluirPeloSistema,
} from "@/server/os/sistema";
import { lerTudo } from "@/server/supabase-paginas";
import {
  type ContextoSu,
  parametros,
  parametrosDaEntrevista,
  su,
  suAdmin,
  type Tabela,
} from "./base";

// Clube SustentArp (spec 4.5): leituras da lista, do detalhe do participante
// e dos relatórios, e a rotina diária que abre o chamado "Renovar termo do
// Clube". Tudo lido com a sessão (RLS): contato só com "Ver contato", reais só
// com "Ver valores" (o banco devolve null, e a tela trata null como "sem
// permissão", nunca como zero). Participante é por cliente (CPF/CNPJ), não
// por LUC. Contrato do ENET vem da cópia sustentabilidade.contratos.

/**
 * Onde ficam o termo anexado, o gerado e a assinatura. O armazenamento ainda
 * não tem um bucket do módulo (src/server/arquivos/caminho.ts): usa o dos
 * formulários, com o prefixo sustentabilidade/clube/. Trocar aqui se criarem
 * o bucket próprio.
 */
export const BUCKET_CLUBE: Bucket = "sustentabilidade";

export const MODULO_ORIGEM = "sustentabilidade";
export const CATEGORIA_RENOVAR_TERMO = "Renovar termo do Clube";
const SETOR = "Sustentabilidade";

/** Origem do chamado de renovação, uma por termo. */
export const origemDoTermo = (participanteId: string, ano: number) =>
  `termo:${participanteId}:${ano}`;

const COLUNAS_CONTRATO =
  "id, contrato, cliente_doc, lucs, bloco, tipo_loja, situacao, rescisao, ativacao, inicio, ativacao_corrigida, validade_meses_especifica, dispensada_em" as const;

interface LinhaContrato {
  id: string;
  contrato: string | null;
  cliente_doc: string | null;
  lucs: string[];
  bloco: string | null;
  tipo_loja: string | null;
  situacao: string;
  rescisao: string | null;
  ativacao: string | null;
  inicio: string | null;
  ativacao_corrigida: string | null;
  validade_meses_especifica: number | null;
  dispensada_em: string | null;
}

function contratoDoCliente(c: LinhaContrato): ContratoDoCliente {
  return {
    id: c.id,
    contrato: c.contrato,
    clienteDoc: c.cliente_doc || null,
    lucs: c.lucs,
    bloco: c.bloco,
    tipoLoja: c.tipo_loja,
    situacao: c.situacao === "vigente" ? "vigente" : "encerrado",
    rescisao: c.rescisao,
    ativacao: c.ativacao,
    inicio: c.inicio,
    ativacaoCorrigida: c.ativacao_corrigida,
    validadeMesesEspecifica: c.validade_meses_especifica,
    dispensada: c.dispensada_em !== null,
  };
}

/** O embed do PostgREST traz objeto, lista ou null (sem "Ver valores"). */
function valorDoEmbed(v: unknown): number | null {
  const um = Array.isArray(v) ? v[0] : v;
  const n = (um as { valor?: unknown } | null | undefined)?.valor;
  return typeof n === "number" ? n : null;
}

const ordemNumerica = (a: string, b: string) =>
  a.localeCompare(b, "pt-BR", { numeric: true });

async function configDaEntrevista(hoje: string) {
  const [p, parametrosEnt] = await Promise.all([
    parametros(),
    parametrosDaEntrevista(),
  ]);
  return {
    hoje,
    parametros: parametrosEnt,
    tiposLojaDispensados: p.tipos_loja_dispensados,
    dataInauguracao: p.data_inauguracao as "ativacao" | "inicio",
  };
}

async function ultimasEntrevistas(
  db: Awaited<ReturnType<typeof su>>,
  doc?: string,
): Promise<UltimaEntrevista[]> {
  const linhas = (await lerTudo(() => {
    const q = db.rpc("entrevistas_resumo");
    return (doc ? q.eq("cliente_doc", doc) : q).order("id");
  })) as unknown as {
    contrato_id: string;
    data: string;
    setor: string | null;
  }[];
  return linhas.map((e) => ({
    contratoId: e.contrato_id,
    data: e.data,
    setor: e.setor,
  }));
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

export interface DadosDoClube {
  /** clube_formas dos Parâmetros. */
  formas: string[];
  avisoDias: number;
  participantes: ParticipanteBase[];
  extras: Map<string, ExtrasDoAno>;
  /** Situação da entrevista por documento do cliente. */
  entrevistas: Map<string, SituacaoEntrevista | null>;
  /** Clientes PJ (14 dígitos) com contrato vigente, com os blocos. */
  clientesPj: { doc: string; blocos: string[] }[];
  /** Blocos dos contratos vigentes (opções do filtro). */
  blocos: string[];
  /** Anos com termo, do mais novo ao mais antigo (opções do filtro). */
  anos: number[];
  /** Algum participante é de exemplo (dado fictício). */
  temExemplo: boolean;
  /** Vieram da entrevista e ainda não têm termo. */
  interessados: number;
}

/**
 * Tudo que a lista do Clube precisa para o ano escolhido, em paralelo.
 * Pode ser lido por quem tem clube.ver ou clube.editar (o RLS confere).
 */
export const dadosDoClube = cache(
  async (
    ano: number,
    comValores: boolean,
    hoje: string,
  ): Promise<DadosDoClube> => {
    const db = await su();
    const [p, cfg, participantes, termos, contratos, contribuicoes, acoes] =
      await Promise.all([
        parametros(),
        configDaEntrevista(hoje),
        lerTudo(() =>
          db
            .from("participantes")
            .select(
              "id, cliente_doc, nome, formas, saiu_em, interesse, exemplo",
            )
            .order("nome")
            .order("id"),
        ),
        lerTudo(() =>
          db
            .from("termos")
            .select("id, participante_id, ano, assinado_em, valido_ate")
            .order("id"),
        ),
        lerTudo(() =>
          db
            .from("contratos")
            .select(COLUNAS_CONTRATO)
            .eq("situacao", "vigente")
            .order("id"),
        ),
        lerTudo(() =>
          db
            .from("contribuicoes")
            .select("id, participante_id, contribuicao_valores(valor)")
            .gte("competencia", `${ano}-01-01`)
            .lte("competencia", `${ano}-12-01`)
            .order("id"),
        ),
        lerTudo(() =>
          db
            .from("acoes")
            .select("id, participante_id")
            .gte("data", `${ano}-01-01`)
            .lte("data", `${ano}-12-31`)
            .order("id"),
        ),
      ]);
    const [combinados, resumo] = await Promise.all([
      comValores
        ? lerTudo(() =>
            db
              .from("participante_valores")
              .select("participante_id, valor_combinado_mes")
              .order("participante_id"),
          )
        : Promise.resolve([]),
      ultimasEntrevistas(db),
    ]);

    // Contratos vigentes por cliente: locatário, LUCs e blocos.
    const vigentes = contratos
      .filter((c) => c.cliente_doc && contratoVigente(c, hoje))
      .map(contratoDoCliente);
    const porDoc = new Map<
      string,
      { lucs: Set<string>; blocos: Set<string> }
    >();
    for (const c of vigentes) {
      const x = porDoc.get(c.clienteDoc as string) ?? {
        lucs: new Set<string>(),
        blocos: new Set<string>(),
      };
      for (const l of c.lucs) x.lucs.add(l);
      if (c.bloco) x.blocos.add(c.bloco);
      porDoc.set(c.clienteDoc as string, x);
    }

    const termosDe = new Map<string, ParticipanteBase["termos"]>();
    for (const t of termos)
      termosDe.set(t.participante_id, [
        ...(termosDe.get(t.participante_id) ?? []),
        { ano: t.ano, assinadoEm: t.assinado_em, validoAte: t.valido_ate },
      ]);

    const bases: ParticipanteBase[] = participantes.map((x) => {
      const c = porDoc.get(x.cliente_doc);
      return {
        id: x.id,
        nome: x.nome,
        doc: x.cliente_doc,
        locatario: c !== undefined,
        lucs: [...(c?.lucs ?? [])].sort(ordemNumerica),
        blocos: [...(c?.blocos ?? [])].sort(ordemNumerica),
        formas: x.formas,
        termos: termosDe.get(x.id) ?? [],
        saiuEm: x.saiu_em,
        interesse: x.interesse,
      };
    });

    const extras = new Map<string, ExtrasDoAno>();
    const extra = (id: string) => {
      let e = extras.get(id);
      if (!e) {
        e = { contribuido: 0, contribuicoes: 0, acoes: 0, combinadoMes: null };
        extras.set(id, e);
      }
      return e;
    };
    for (const c of contribuicoes) {
      const e = extra(c.participante_id);
      e.contribuicoes += 1;
      e.contribuido += comValores
        ? (valorDoEmbed(c.contribuicao_valores) ?? 0)
        : 0;
    }
    for (const a of acoes) extra(a.participante_id).acoes += 1;
    for (const v of combinados)
      extra(v.participante_id).combinadoMes = v.valor_combinado_mes;

    const clientesPj = [...porDoc]
      .filter(([doc]) => doc.length === 14)
      .map(([doc, x]) => ({ doc, blocos: [...x.blocos] }));
    const todosBlocos = new Set<string>();
    for (const x of porDoc.values())
      for (const b of x.blocos) todosBlocos.add(b);

    return {
      formas: p.clube_formas,
      avisoDias: p.termo_aviso_dias,
      participantes: bases,
      extras,
      entrevistas: entrevistaPorCliente(vigentes, resumo, cfg),
      clientesPj,
      blocos: [...todosBlocos].sort(ordemNumerica),
      anos: anosDoClube(termos, Number(hoje.slice(0, 4))).reverse(),
      temExemplo: participantes.some((x) => x.exemplo),
      interessados: bases.filter(
        (b) => b.interesse && b.termos.length === 0 && !b.saiuEm,
      ).length,
    };
  },
);

// ---------------------------------------------------------------------------
// Novo participante: clientes dos contratos
// ---------------------------------------------------------------------------

export interface ClienteParaParticipar {
  doc: string;
  nome: string;
  lucs: string[];
}

/**
 * Clientes com contrato vigente que ainda não são participantes, para
 * escolher no cadastro (busca por nome, CPF/CNPJ ou LUC).
 */
export async function clientesParaParticipar(
  hoje: string,
): Promise<ClienteParaParticipar[]> {
  const db = await su();
  const [contratos, participantes] = await Promise.all([
    lerTudo(() =>
      db
        .from("contratos")
        .select("id, cliente_nome, cliente_doc, lucs, situacao, rescisao")
        .eq("situacao", "vigente")
        .order("id"),
    ),
    lerTudo(() =>
      db.from("participantes").select("id, cliente_doc").order("id"),
    ),
  ]);
  const ja = new Set(participantes.map((p) => p.cliente_doc));
  const mapa = new Map<string, ClienteParaParticipar>();
  for (const c of contratos) {
    const doc = c.cliente_doc ?? "";
    if (
      (doc.length !== 11 && doc.length !== 14) ||
      ja.has(doc) ||
      !contratoVigente(c, hoje)
    )
      continue;
    const x = mapa.get(doc) ?? { doc, nome: c.cliente_nome, lucs: [] };
    x.lucs = [...new Set([...x.lucs, ...c.lucs])];
    mapa.set(doc, x);
  }
  return [...mapa.values()]
    .map((c) => ({ ...c, lucs: c.lucs.sort(ordemNumerica) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// ---------------------------------------------------------------------------
// Detalhe do participante
// ---------------------------------------------------------------------------

export interface DetalheDoParticipante {
  participante: Pick<
    Tabela<"participantes">,
    | "id"
    | "cliente_doc"
    | "nome"
    | "locatario_manual"
    | "formas"
    | "saiu_em"
    | "saiu_motivo"
    | "interesse"
    | "exemplo"
    | "criado_em"
  >;
  /** Null sem "Ver contato" (ou sem contato cadastrado). */
  contato: {
    email: string | null;
    telefone: string | null;
    contato: string | null;
  } | null;
  /** Null sem "Ver valores" ou sem valor combinado. */
  valorCombinadoMes: number | null;
  termos: Pick<
    Tabela<"termos">,
    "id" | "ano" | "assinado_em" | "valido_ate" | "arquivo" | "assinatura"
  >[];
  contribuicoes: {
    id: string;
    data: string;
    forma: string;
    competencia: string;
    observacao: string | null;
    /** Null sem "Ver valores". */
    valor: number | null;
  }[];
  acoes: Pick<Tabela<"acoes">, "id" | "data" | "tipo" | "observacao">[];
  situacao: SituacaoClube;
  validoAte: string | null;
  locatario: boolean;
  /** Entrevista de cada contrato do cliente (vigentes primeiro). */
  entrevistas: EntrevistaDoContrato[];
  formasDoClube: string[];
  formasDeContribuicao: string[];
  tiposDeAcao: string[];
  validadeMeses: number;
  avisoDias: number;
}

export async function detalheDoParticipante(
  id: string,
  ctx: Pick<ContextoSu, "pode" | "hoje">,
): Promise<DetalheDoParticipante | null> {
  const db = await su();
  const { data: participante, error } = await db
    .from("participantes")
    .select(
      "id, cliente_doc, nome, locatario_manual, formas, saiu_em, saiu_motivo, interesse, exemplo, criado_em",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler o participante: ${error.message}`);
  if (!participante) return null;

  const veContato = ctx.pode("sustentabilidade.contato");
  const veValores = ctx.pode("sustentabilidade.valores");
  const [
    p,
    cfg,
    contato,
    valor,
    termos,
    contribuicoes,
    acoes,
    contratos,
    resumo,
  ] = await Promise.all([
    parametros(),
    configDaEntrevista(ctx.hoje),
    veContato
      ? db
          .from("participante_contatos")
          .select("email, telefone, contato")
          .eq("participante_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    veValores
      ? db
          .from("participante_valores")
          .select("valor_combinado_mes")
          .eq("participante_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db
      .from("termos")
      .select("id, ano, assinado_em, valido_ate, arquivo, assinatura")
      .eq("participante_id", id)
      .order("ano", { ascending: false }),
    lerTudo(() =>
      db
        .from("contribuicoes")
        .select(
          "id, data, forma, competencia, observacao, contribuicao_valores(valor)",
        )
        .eq("participante_id", id)
        .order("data", { ascending: false })
        .order("id"),
    ),
    lerTudo(() =>
      db
        .from("acoes")
        .select("id, data, tipo, observacao")
        .eq("participante_id", id)
        .order("data", { ascending: false })
        .order("id"),
    ),
    db
      .from("contratos")
      .select(COLUNAS_CONTRATO)
      .eq("cliente_doc", participante.cliente_doc)
      .order("situacao", { ascending: false })
      .order("id"),
    ultimasEntrevistas(db, participante.cliente_doc),
  ]);
  for (const r of [contato, valor, termos, contratos])
    if (r.error)
      throw new Error(`Falha ao ler o participante: ${r.error.message}`);

  const termosOrdenados = termos.data ?? [];
  const situacao = situacaoNaData(
    {
      termos: termosOrdenados.map((t) => ({
        ano: t.ano,
        assinadoEm: t.assinado_em,
        validoAte: t.valido_ate,
      })),
      saiuEm: participante.saiu_em,
      interesse: participante.interesse,
    },
    ctx.hoje,
    p.termo_aviso_dias,
  );
  const doCliente = (contratos.data ?? []).map(contratoDoCliente);
  const entrevistas = entrevistasDosContratos(doCliente, resumo, cfg).sort(
    (a, b) => Number(a.foraDaLista) - Number(b.foraDaLista),
  );

  return {
    participante,
    contato: contato.data,
    valorCombinadoMes: valor.data?.valor_combinado_mes ?? null,
    termos: termosOrdenados,
    contribuicoes: contribuicoes.map((c) => ({
      id: c.id,
      data: c.data,
      forma: c.forma,
      competencia: c.competencia,
      observacao: c.observacao,
      valor: veValores ? valorDoEmbed(c.contribuicao_valores) : null,
    })),
    acoes,
    situacao: situacao.situacao,
    validoAte: situacao.validoAte,
    locatario: doCliente.some((c) => contratoVigente(c, ctx.hoje)),
    entrevistas,
    formasDoClube: p.clube_formas,
    formasDeContribuicao: p.formas_contribuicao,
    tiposDeAcao: p.tipos_acao,
    validadeMeses: p.termo_validade_meses,
    avisoDias: p.termo_aviso_dias,
  };
}

// ---------------------------------------------------------------------------
// Relatório "Contribuições do Clube"
// ---------------------------------------------------------------------------

export interface FiltroContribuicoes {
  de: string;
  ate: string;
  /** "" = todos os participantes. */
  participanteId: string;
  /** "" = todas as formas. */
  forma: string;
}

export async function contribuicoesDoClube(
  f: FiltroContribuicoes,
  comValores: boolean,
): Promise<ContribuicaoDoRelatorio[]> {
  const db = await su();
  const linhas = await lerTudo(() => {
    let q = db
      .from("contribuicoes")
      .select(
        "id, participante_id, data, forma, competencia, observacao, participantes(nome, cliente_doc), contribuicao_valores(valor)",
      )
      .gte("data", f.de)
      .lte("data", f.ate);
    if (f.participanteId) q = q.eq("participante_id", f.participanteId);
    if (f.forma) q = q.eq("forma", f.forma);
    return q.order("data", { ascending: false }).order("id");
  });
  return linhas.map((l) => {
    const dono = Array.isArray(l.participantes)
      ? l.participantes[0]
      : l.participantes;
    return {
      id: l.id,
      participanteId: l.participante_id,
      participante: dono?.nome ?? "—",
      doc: dono?.cliente_doc ?? "",
      data: l.data,
      forma: l.forma,
      competencia: l.competencia,
      valor: comValores ? valorDoEmbed(l.contribuicao_valores) : null,
      observacao: l.observacao,
    };
  });
}

/** Participantes (nome e id) para o filtro do relatório. */
export async function participantesParaFiltro(): Promise<
  { id: string; nome: string }[]
> {
  const db = await su();
  return lerTudo(() =>
    db.from("participantes").select("id, nome").order("nome").order("id"),
  );
}

// ---------------------------------------------------------------------------
// Chamado "Renovar termo do Clube"
// ---------------------------------------------------------------------------

/** Setor Sustentabilidade e a categoria "Renovar termo do Clube" (se já existir). */
async function setorECategoria(): Promise<{
  setorId: string;
  categoriaId: string | null;
} | null> {
  const db = osAdmin();
  const { data: setor, error } = await db
    .from("setores")
    .select("id")
    .eq("nome", SETOR)
    .maybeSingle();
  if (error) throw new Error(`Setor ${SETOR}: ${error.message}`);
  if (!setor) return null;
  const { data: categoria, error: e } = await db
    .from("categorias")
    .select("id")
    .eq("setor_id", setor.id)
    .eq("nome", CATEGORIA_RENOVAR_TERMO)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  if (e) throw new Error(`Categoria ${CATEGORIA_RENOVAR_TERMO}: ${e.message}`);
  return { setorId: setor.id, categoriaId: categoria?.id ?? null };
}

/**
 * Rotina diária (cron, service role): para o último termo de cada
 * participante que vence em até `termo_aviso_dias` (e ainda não venceu), abre
 * o chamado "Renovar termo do Clube" no setor Sustentabilidade, uma vez por
 * termo (origem `termo:<participante_id>:<ano>`), com o botão Executar levando
 * ao participante. O chamado só fecha pelo módulo, ao salvar o termo novo
 * (concluirRenovacoes). Quem saiu do clube e quem já renovou não recebe.
 *
 * Devolve quantos chamados criou (idempotente: rodar de novo não repete) e
 * lança erro se algo falhar, no formato de ROTINAS (rotinas.ts).
 */
export async function rotinaClube(agora: Date): Promise<number> {
  const hoje = hojeEmBrasilia(agora);
  const db = suAdmin();
  const { data: p, error } = await db
    .from("parametros")
    .select("termo_aviso_dias")
    .eq("id", true)
    .single();
  if (error) throw new Error(`Parâmetros: ${error.message}`);
  const limite = somarDias(hoje, p.termo_aviso_dias);

  const [termos, participantes] = await Promise.all([
    lerTudo(() =>
      db
        .from("termos")
        .select("id, participante_id, ano, valido_ate, chamado_id")
        .gte("valido_ate", hoje)
        .order("id"),
    ),
    lerTudo(() =>
      db
        .from("participantes")
        .select("id, nome, cliente_doc, saiu_em")
        .is("saiu_em", null)
        .order("id"),
    ),
  ]);
  const ativos = new Map(participantes.map((x) => [x.id, x]));
  // O último termo de cada participante (o que vence por último).
  const ultimo = new Map<string, (typeof termos)[number]>();
  for (const t of termos) {
    const atual = ultimo.get(t.participante_id);
    if (!atual || t.valido_ate > atual.valido_ate)
      ultimo.set(t.participante_id, t);
  }
  const aVencer = [...ultimo.values()].filter(
    (t) =>
      t.valido_ate <= limite && !t.chamado_id && ativos.has(t.participante_id),
  );
  if (!aVencer.length) return 0;

  const [destino, { cal }] = await Promise.all([
    setorECategoria(),
    configDoSistema(),
  ]);
  if (!destino)
    throw new Error(
      `O setor ${SETOR} não existe no Chamados: crie-o em Chamados › Configurações.`,
    );

  let novos = 0;
  for (const t of aVencer) {
    const dono = ativos.get(t.participante_id);
    if (!dono) continue;
    const ref = origemDoTermo(t.participante_id, t.ano);
    const aberto = await chamadoAbertoDaOrigem(MODULO_ORIGEM, ref);
    let chamadoId = aberto?.id ?? null;
    if (!aberto) {
      const criado = await criarChamadoSistema(
        {
          setorId: destino.setorId,
          categoriaId: destino.categoriaId,
          titulo: `${CATEGORIA_RENOVAR_TERMO}: ${dono.nome}`,
          descricao:
            `O termo do Clube SustentArp de ${dono.nome} (${documentoComTipo(dono.cliente_doc)}) ` +
            `vence em ${formatarData(t.valido_ate)}. Colha a nova assinatura e lance o termo no Clube; ` +
            "este chamado fecha sozinho ao salvar o termo renovado.",
          origem: "modulo",
          autorNome: "Sistema (Sustentabilidade)",
          prazo: deBrasilia(t.valido_ate, cal.expedienteFim),
          acaoUrl: `/sustentabilidade/clube/${t.participante_id}`,
          acaoRotulo: "o termo renovado",
          conclusaoExterna: true,
          origemModulo: MODULO_ORIGEM,
          origemRef: ref,
        },
        agora,
      );
      chamadoId = criado?.id ?? null;
      if (criado) novos += 1;
    }
    if (chamadoId) {
      const { error: e } = await db
        .from("termos")
        .update({ chamado_id: chamadoId })
        .eq("id", t.id);
      if (e) throw new Error(`Termo ${t.id}: ${e.message}`);
    }
  }
  return novos;
}

/**
 * Ao salvar um termo novo, conclui os chamados de renovação dos termos
 * anteriores do participante que ainda estavam abertos. Quem chama já
 * conferiu a permissão (clube.editar). Devolve quantos fechou.
 */
export async function concluirRenovacoes(p: {
  participanteId: string;
  /** Termo recém-salvo: ano e fim da validade. */
  novo: { ano: number; validoAte: string };
  concluidoPor: string;
}): Promise<number> {
  const { data, error } = await suAdmin()
    .from("termos")
    .select("id, ano, valido_ate, chamado_id")
    .eq("participante_id", p.participanteId)
    .not("chamado_id", "is", null)
    .neq("ano", p.novo.ano)
    .lt("valido_ate", p.novo.validoAte);
  if (error) throw new Error(`Termos do participante: ${error.message}`);
  let fechados = 0;
  for (const t of data ?? []) {
    if (!t.chamado_id) continue;
    const ok = await concluirPeloSistema({
      chamadoId: t.chamado_id,
      texto: `Termo de ${p.novo.ano} salvo, válido até ${formatarData(p.novo.validoAte)}.`,
      concluidoPor: p.concluidoPor,
    });
    if (ok) fechados += 1;
  }
  return fechados;
}
