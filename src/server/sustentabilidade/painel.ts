import "server-only";
import { fimDoMesDe } from "@/lib/comercial/datas";
import { metaVigente } from "@/lib/indicadores";
import { deBrasilia } from "@/lib/os/tempo";
import { createClient } from "@/lib/supabase/server";
import {
  apurarClube,
  apurarEntrevistas,
  apurarOcupacao,
  apurarPeriodo,
  type ClubeApurado,
  type ContratoDoPainel,
  competenciaDo,
  type GeracaoDoMes,
  type IndicadorDePrograma,
  type LancamentoDoPainel,
  type NotaDoRcc,
  type PeriodoApurado,
  type VigenciaDeFator,
  type VigenciaDePreco,
} from "@/lib/sustentabilidade/painel-apuracao";
import {
  anosDoFiltro,
  CHAVES_COM_META,
  type ChaveDoIndicador,
  competenciaDoFiltro,
  type FiltrosDoPainel,
  GRUPOS_DOS_CARTOES,
  indicadorDaMeta,
} from "@/lib/sustentabilidade/painel-indicadores";
import {
  type ConsolidadoGravado,
  type EntradaDoPainel,
  type LinhaConsolidada,
  linhasDeConsolidados,
  type MetaDoPainel,
  montarPainel,
  type PainelMontado,
  totaisDoAno,
  volumeDesdeOInicio,
} from "@/lib/sustentabilidade/painel-montagem";
import type { ItemRonda } from "@/lib/sustentabilidade/rondas";
import { podeAgora } from "@/server/auth";
import {
  consumoDeAguaPorMes,
  geracaoSolarPorMes,
} from "@/server/operacoes/para-sustentabilidade";
import { lerTudo } from "@/server/supabase-paginas";
import {
  coletores,
  contextoSu,
  parametros,
  parametrosDaEntrevista,
  su,
} from "./base";

// Leitura do Painel de Sustentabilidade (spec 4.9). Tudo com a sessão (RLS:
// "painel" lê programas, RCC, clube, rondas, contratos, marcos e consolidados;
// os valores em reais pedem "Ver valores"), menos a água e a energia, que só
// existem em Operações e vêm da service role depois de conferir o acesso
// ao painel (quem não tem Operações vê esses números só aqui). Não consulta o
// Growatt. A apuração e a montagem são puras (src/lib/sustentabilidade/painel-*).

export interface DadosDoPainel {
  filtros: FiltrosDoPainel;
  /** Anos que o filtro oferece. */
  anos: number[];
  painel: PainelMontado;
  consolidados: LinhaConsolidada[];
  /** Colunas da tabela de consolidados (reais só com "Ver valores"). */
  comValores: boolean;
  /** Situação do ano do filtro: aberto, fechado ou reaberto. */
  anoDoFiltro: "aberto" | "fechado" | "reaberto";
  /** Diferenças do ano fechado (lançamento alterado depois de fechar). */
  avisoDoAno: LinhaConsolidada["aviso"];
  /** Fontes com dado de exemplo dentro do período mostrado. */
  exemplo: string[];
  /** Operações não respondeu: energia e água ficam "sem dado". */
  operacoesIndisponivel: boolean;
  /** Entrada completa (o PDF e o Excel usam os mesmos números). */
  entrada: EntradaDoPainel;
  /** Totais de hoje de cada ano com dado (o do filtro com 12 meses): o que "Fechar ano" grava. */
  aoVivo: ReadonlyMap<number, Record<string, number | null>>;
}

type Json = unknown;

const objeto = (v: Json): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

const numeros = (v: Json): Record<string, number | null> =>
  Object.fromEntries(
    Object.entries(objeto(v)).map(([k, x]) => [
      k,
      typeof x === "number" ? x : null,
    ]),
  );

const anoDe = (data: string) => Number(data.slice(0, 4));

/**
 * Data a que valem as fotos (clube, entrevistas): hoje no ano atual; em ano
 * passado, o fim do mês do filtro (ou 31/12 nos totais do ano).
 */
export function dataDeReferencia(
  ano: number,
  ateMes: number,
  hoje: string,
): string {
  return ano >= anoDe(hoje) ? hoje : fimDoMesDe(competenciaDo(ano, ateMes));
}

/** Mês de ateMes em Brasília como intervalo de instantes (início, fim exclusivo). */
function intervaloDoMes(ano: number, mes: number): [string, string] {
  const proximo = mes === 12 ? [ano + 1, 1] : [ano, mes + 1];
  return [
    deBrasilia(competenciaDo(ano, mes)).toISOString(),
    deBrasilia(
      competenciaDo(proximo[0] as number, proximo[1] as number),
    ).toISOString(),
  ];
}

export async function dadosDoPainel(
  f: FiltrosDoPainel,
): Promise<DadosDoPainel> {
  const ctx = await contextoSu();
  if (!ctx.pode("sustentabilidade.painel"))
    throw new Error("Sem acesso ao painel de Sustentabilidade.");
  // Valores em reais: conferidos agora, no banco, e o RLS confere de novo.
  const comValores = await podeAgora("sustentabilidade.valores");
  const hoje = ctx.hoje;
  const [b, params, paramsEntrevista, listaDeColetores] = await Promise.all([
    lerDoBanco(f, comValores),
    parametros(),
    parametrosDaEntrevista(),
    coletores(),
  ]);

  // Água e energia de Operações (service role, só depois de conferir o acesso).
  let operacoesIndisponivel = false;
  let agua: Awaited<ReturnType<typeof consumoDeAguaPorMes>> = [];
  let solar: Awaited<ReturnType<typeof geracaoSolarPorMes>> = [];
  if (await podeAgora("sustentabilidade.painel")) {
    const mes = String(f.ateMes).padStart(2, "0");
    const primeiro = Math.min(f.ano - 1, b.primeiroAno ?? f.ano - 1);
    try {
      [agua, solar] = await Promise.all([
        consumoDeAguaPorMes(`${f.ano - 1}-${mes}-01`, `${f.ano}-${mes}-01`),
        geracaoSolarPorMes(`${primeiro}-01-01`, `${f.ano}-12-01`),
      ]);
    } catch (erro) {
      console.error("painel: leitura de Operações", erro);
      operacoesIndisponivel = true;
    }
  }
  const geracao: GeracaoDoMes[] = solar.map((s) => ({
    mes: s.mes,
    kwh: s.kwh,
    co2_t: s.co2_t as number | null,
  }));

  const indicadores: IndicadorDePrograma[] = b.indicadores;
  const lancamentos: LancamentoDoPainel[] = b.lancamentos;
  const precos: VigenciaDePreco[] | null = comValores ? b.precos : null;
  const periodo = (ano: number, ateMes: number): PeriodoApurado =>
    apurarPeriodo({
      ano,
      ateMes,
      indicadores,
      lancamentos,
      geracao,
      notas: b.notas,
      fatores: b.fatores,
      precos,
      grupos: GRUPOS_DOS_CARTOES,
    });
  const atual = periodo(f.ano, f.ateMes);
  const anterior = periodo(f.ano - 1, f.ateMes);

  // Anos com dado no sistema (para o "desde o início" e para os consolidados).
  const anosComDado = new Set<number>([f.ano]);
  for (const l of lancamentos) anosComDado.add(anoDe(l.data));
  for (const n of b.notas) anosComDado.add(anoDe(n.competencia));
  for (const g of geracao) anosComDado.add(anoDe(g.mes));
  for (const c of b.consolidados) anosComDado.add(c.ano);
  const anosAteOFiltro = [...anosComDado].filter((a) => a <= f.ano).sort();

  const clubeEm = (data: string): ClubeApurado | null =>
    b.participantes.length
      ? apurarClube({
          participantes: b.participantes,
          termos: b.termos,
          contratos: b.contratos,
          data,
          avisoDias: params.termo_aviso_dias,
        })
      : null;

  const aoVivo = new Map<number, Record<string, number | null>>();
  const vivos = new Map<number, number | null>();
  for (const ano of anosAteOFiltro) {
    const doze = periodo(ano, 12);
    aoVivo.set(
      ano,
      totaisDoAno(doze, clubeEm(dataDeReferencia(ano, 12, hoje))),
    );
    vivos.set(ano, ano === f.ano ? atual.volume.total : doze.volume.total);
  }
  const fechados = new Map<number, number | null>(
    b.consolidados
      .filter((c) => c.situacao === "fechado")
      .map((c) => [c.ano, c.totais.volume_reciclado ?? null]),
  );
  const consolidados = linhasDeConsolidados({
    marcos: b.marcos,
    consolidados: b.consolidados,
    aoVivo,
    comValores,
  });

  const dataFoto = dataDeReferencia(f.ano, f.ateMes, hoje);
  const comp = competenciaDoFiltro(f);
  const mesAnterior = `${f.ano - 1}-${String(f.ateMes).padStart(2, "0")}-01`;
  const doMes = agua.find((a) => a.mes === comp);
  const metas: Partial<Record<ChaveDoIndicador, MetaDoPainel>> = {};
  for (const chave of CHAVES_COM_META) {
    const m = metaVigente(b.metas, indicadorDaMeta(chave), comp);
    if (m)
      metas[chave] = {
        meta: m.meta,
        limiteAtencao: m.limite_atencao,
        direcao: m.direcao,
      };
  }

  const entrada: EntradaDoPainel = {
    filtros: f,
    atual,
    anterior,
    desdeOInicio: volumeDesdeOInicio({
      ano: f.ano,
      marcos: b.marcos
        .filter((m) => m.indicador === "volume_reciclado")
        .map((m) => ({ ano: m.ano, valor: m.valor })),
      vivos,
      fechados,
    }),
    agua: {
      m3: doMes?.m3_total ?? null,
      anterior: agua.find((a) => a.mes === mesAnterior)?.m3_total ?? null,
      incompleta: doMes?.incompleta ?? false,
    },
    clube: clubeEm(dataFoto),
    entrevistas: apurarEntrevistas({
      contratos: b.contratos,
      entrevistas: b.entrevistas,
      parametros: paramsEntrevista,
      tiposLojaDispensados: params.tipos_loja_dispensados,
      dataInauguracao:
        params.data_inauguracao === "inicio" ? "inicio" : "ativacao",
      data: dataFoto,
    }),
    ocupacao: apurarOcupacao(
      b.rondas.map((r) => ({
        itens: r.itens.flatMap((i): ItemRonda[] => {
          const cor = listaDeColetores.find((c) => c.id === i.coletorId)?.cor;
          return cor === "preto" || cor === "azul"
            ? [
                {
                  coletorId: i.coletorId,
                  cor,
                  conteineres: i.conteineres,
                  ocupacaoPct: i.ocupacaoPct,
                },
              ]
            : [];
        }),
      })),
    ),
    limiteOcupacao: params.limite_ocupacao_pct,
    metas,
    comValores,
    equivalencias: b.equivalencias,
  };

  const linhaDoAno = consolidados.find((l) => l.ano === f.ano);
  const gravado = b.consolidados.find((c) => c.ano === f.ano);
  const exemplo = [
    b.exemplo.programas && "Programas",
    b.exemplo.rcc && "RCC",
    b.exemplo.rondas && "Rondas",
    b.exemplo.clube && "Clube",
    b.exemplo.contratos && "Entrevistas e contratos",
    b.exemplo.marcos && "Marco inicial",
    agua.some((a) => a.exemplo && (a.mes === comp || a.mes === mesAnterior)) &&
      "Água (Operações)",
    solar.some((s) => s.exemplo && anoDe(s.mes) >= f.ano - 1) &&
      "Energia (Operações)",
  ].filter((x): x is string => typeof x === "string");

  return {
    filtros: f,
    anos: anosDoFiltro(Math.min(b.primeiroAno ?? f.ano, f.ano), anoDe(hoje)),
    painel: montarPainel(entrada),
    consolidados,
    comValores,
    anoDoFiltro: gravado
      ? (gravado.situacao as "fechado" | "reaberto")
      : "aberto",
    avisoDoAno: linhaDoAno?.aviso ?? null,
    exemplo,
    operacoesIndisponivel,
    entrada,
    aoVivo,
  };
}

// ---------------------------------------------------------------------------
// Leituras do banco (sessão, RLS)
// ---------------------------------------------------------------------------

interface LidoDoBanco {
  indicadores: IndicadorDePrograma[];
  lancamentos: LancamentoDoPainel[];
  notas: NotaDoRcc[];
  fatores: VigenciaDeFator[];
  precos: VigenciaDePreco[];
  participantes: {
    id: string;
    clienteDoc: string;
    locatarioManual: boolean;
    saiuEm: string | null;
  }[];
  termos: { participanteId: string; assinadoEm: string; validoAte: string }[];
  contratos: ContratoDoPainel[];
  entrevistas: { contratoId: string; data: string; setor: string | null }[];
  rondas: {
    itens: { coletorId: string; conteineres: number; ocupacaoPct: number }[];
  }[];
  marcos: { indicador: string; ano: number; valor: number }[];
  consolidados: ConsolidadoGravado[];
  equivalencias: {
    nome: string;
    fator: number;
    unidade: string | null;
    confirmado: boolean;
  }[];
  metas: {
    indicador: string;
    direcao: "maior_melhor" | "menor_melhor";
    meta: number;
    limite_atencao: number | null;
    vigente_desde: string;
  }[];
  /** Primeiro ano com dado ou marco (o filtro de ano começa nele). */
  primeiroAno: number | null;
  exemplo: Record<
    "programas" | "rcc" | "rondas" | "clube" | "contratos" | "marcos",
    boolean
  >;
}

async function lerDoBanco(
  f: FiltrosDoPainel,
  comValores: boolean,
): Promise<LidoDoBanco> {
  const db = await su();
  const core = (await createClient()).schema("core");
  const [inicioDoMes, fimDoMes] = intervaloDoMes(f.ano, f.ateMes);
  const ate = `${f.ano}-12-31`;

  const [
    indicadores,
    notas,
    fatores,
    precos,
    participantes,
    termos,
    contratos,
    entrevistas,
    rondas,
    marcos,
    consolidados,
    consolidadoValores,
    equivalencias,
    metas,
  ] = await Promise.all([
    db
      .from("programa_indicadores")
      .select(
        "nome, grupo, calculo, formulario_id, campo_id, filtro, percentual_valor",
      )
      .eq("ativo", true)
      .eq("mostrar_painel", true)
      .eq("em_reais", false)
      .not("grupo", "is", null),
    lerTudo(() =>
      db
        .from("rcc_notas")
        .select("competencia, cacambas_a, cacambas_b, exemplo")
        .lte("competencia", ate)
        .order("competencia")
        .order("id"),
    ),
    db.from("rcc_fatores").select("vigente_desde, toneladas_por_cacamba"),
    comValores
      ? db.from("rcc_precos").select("vigente_desde, preco_a, preco_b")
      : Promise.resolve({ data: [], error: null }),
    lerTudo(() =>
      db
        .from("participantes")
        .select("id, cliente_doc, locatario_manual, saiu_em, exemplo")
        .order("id"),
    ),
    lerTudo(() =>
      db
        .from("termos")
        .select("participante_id, assinado_em, valido_ate")
        .order("id"),
    ),
    lerTudo(() =>
      db
        .from("contratos")
        .select(
          "id, situacao, rescisao, tipo_loja, cliente_doc, ativacao, ativacao_corrigida, inicio, dispensada_motivo, validade_meses_especifica, exemplo",
        )
        .order("id"),
    ),
    lerTudo(() => db.rpc("entrevistas_resumo").order("id")).then(
      (l) =>
        l as unknown as {
          contrato_id: string | null;
          data: string;
          setor: string | null;
        }[],
    ),
    db
      .from("rondas")
      .select("exemplo, ronda_itens(coletor_id, conteineres, ocupacao_pct)")
      .gte("data_hora", inicioDoMes)
      .lt("data_hora", fimDoMes),
    db
      .from("marcos")
      .select("indicador, ano, valor, exemplo")
      .lte("ano", f.ano),
    db
      .from("consolidados")
      .select("ano, situacao, totais, fechado_em, reaberto_motivo"),
    comValores
      ? db.from("consolidado_valores").select("ano, totais")
      : Promise.resolve({ data: [], error: null }),
    db
      .from("equivalencias")
      .select("nome, fator, unidade, confirmado")
      .eq("confirmado", true)
      .order("nome"),
    core
      .from("metas")
      .select("indicador, direcao, meta, limite_atencao, vigente_desde")
      .like("indicador", "sustentabilidade.%"),
  ]);
  for (const r of [
    indicadores,
    fatores,
    precos,
    rondas,
    marcos,
    consolidados,
    consolidadoValores,
    equivalencias,
    metas,
  ])
    if (r.error) throw new Error(`Falha ao ler o banco: ${r.error.message}`);

  const lista = indicadores.data ?? [];
  const formularios = [...new Set(lista.map((i) => i.formulario_id))];
  const lancamentosLidos = formularios.length
    ? await lerTudo(() =>
        db
          .from("lancamentos")
          .select("formulario_id, data, valores, exemplo")
          .in("formulario_id", formularios)
          .lte("data", ate)
          .order("data")
          .order("id"),
      )
    : [];

  const valoresDoAno = new Map(
    (consolidadoValores.data ?? []).map((c) => [c.ano, numeros(c.totais)]),
  );
  const anos = [
    ...lancamentosLidos.map((l) => anoDe(l.data)),
    ...notas.map((n) => anoDe(n.competencia)),
    ...(marcos.data ?? []).map((m) => m.ano),
    ...(consolidados.data ?? []).map((c) => c.ano),
  ];
  const doPeriodoDoMes = (rondas.data ?? []) as {
    exemplo: boolean;
    ronda_itens: {
      coletor_id: string;
      conteineres: number;
      ocupacao_pct: number;
    }[];
  }[];

  return {
    indicadores: lista.map((i) => ({
      nome: i.nome,
      grupo: i.grupo,
      calculo: i.calculo as IndicadorDePrograma["calculo"],
      formularioId: i.formulario_id,
      campoId: i.campo_id,
      filtro: i.filtro,
      percentualValor: i.percentual_valor,
    })),
    lancamentos: lancamentosLidos.map((l) => ({
      formularioId: l.formulario_id,
      data: l.data,
      valores: objeto(l.valores),
    })),
    notas: notas.map((n) => ({
      competencia: n.competencia,
      cacambasA: n.cacambas_a,
      cacambasB: n.cacambas_b,
    })),
    fatores: (fatores.data ?? []).map((x) => ({
      vigenteDesde: x.vigente_desde,
      toneladasPorCacamba: x.toneladas_por_cacamba,
    })),
    precos: (precos.data ?? []).map((x) => ({
      vigenteDesde: x.vigente_desde,
      precoA: x.preco_a,
      precoB: x.preco_b,
    })),
    participantes: participantes.map((p) => ({
      id: p.id,
      clienteDoc: p.cliente_doc,
      locatarioManual: p.locatario_manual,
      saiuEm: p.saiu_em,
    })),
    termos: termos.map((t) => ({
      participanteId: t.participante_id,
      assinadoEm: t.assinado_em,
      validoAte: t.valido_ate,
    })),
    contratos: contratos.map((c) => ({
      id: c.id,
      situacao: c.situacao === "vigente" ? "vigente" : "encerrado",
      rescisao: c.rescisao,
      tipoLoja: c.tipo_loja,
      clienteDoc: c.cliente_doc,
      ativacao: c.ativacao,
      ativacaoCorrigida: c.ativacao_corrigida,
      inicio: c.inicio,
      dispensada: c.dispensada_motivo !== null,
      validadeEspecificaMeses: c.validade_meses_especifica,
    })),
    entrevistas: entrevistas.flatMap((e) =>
      e.contrato_id
        ? [{ contratoId: e.contrato_id, data: e.data, setor: e.setor }]
        : [],
    ),
    rondas: doPeriodoDoMes.map((r) => ({
      itens: r.ronda_itens.map((i) => ({
        coletorId: i.coletor_id,
        conteineres: i.conteineres,
        ocupacaoPct: i.ocupacao_pct,
      })),
    })),
    marcos: (marcos.data ?? []).map((m) => ({
      indicador: m.indicador,
      ano: m.ano,
      valor: m.valor,
    })),
    consolidados: (consolidados.data ?? []).map((c) => ({
      ano: c.ano,
      situacao: c.situacao,
      totais: numeros(c.totais),
      totaisReais: comValores ? (valoresDoAno.get(c.ano) ?? {}) : null,
      fechadoEm: c.fechado_em,
      reabertoMotivo: c.reaberto_motivo,
    })),
    equivalencias: equivalencias.data ?? [],
    metas: (metas.data ?? []).map((m) => ({
      indicador: m.indicador,
      direcao: m.direcao,
      meta: m.meta,
      limite_atencao: m.limite_atencao,
      vigente_desde: m.vigente_desde,
    })),
    primeiroAno: anos.length ? Math.min(...anos) : null,
    exemplo: {
      programas: lancamentosLidos.some((l) => l.exemplo),
      rcc: notas.some((n) => n.exemplo && anoDe(n.competencia) >= f.ano - 1),
      rondas: doPeriodoDoMes.some((r) => r.exemplo),
      clube: participantes.some((p) => p.exemplo),
      contratos: contratos.some((c) => c.exemplo),
      marcos: (marcos.data ?? []).some((m) => m.exemplo),
    },
  };
}
