import { fimDoMesDe } from "@arp/shared/comercial/datas";
import { formatarData, formatarDataHora } from "@arp/shared/formato";
import { metaVigente } from "@arp/shared/indicadores";
import { deBrasilia, hojeEmBrasilia } from "@arp/shared/os/tempo";
import type {
  ConsultaDoPainel,
  RespostaPainel,
} from "@arp/shared/sustentabilidade/contratos/painel";
import type { CamposDeFormulario } from "@arp/shared/sustentabilidade/contratos/parametros";
import { mesmoMesDoAnoAnterior } from "@arp/shared/sustentabilidade/painel";
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
  type VigenciaDeCo2,
  type VigenciaDeFator,
  type VigenciaDePreco,
} from "@arp/shared/sustentabilidade/painel-apuracao";
import {
  anosDoFiltro,
  CHAVES_COM_META,
  type ChaveDoIndicador,
  competenciaDoFiltro,
  type FiltrosDoPainel,
  GRUPOS_DOS_CARTOES,
  indicadorDaMeta,
  lerFiltrosDoPainel,
  NOMES_DOS_MESES,
  periodoEscrito,
} from "@arp/shared/sustentabilidade/painel-indicadores";
import {
  type ConsolidadoGravado,
  type EntradaDoPainel,
  type LinhaConsolidada,
  linhasDeConsolidados,
  type MetaDoPainel,
  montarPainel,
  type PainelMontado,
  separarReais,
  totaisDoAno,
  volumeDesdeOInicio,
} from "@arp/shared/sustentabilidade/painel-montagem";
import {
  esquemaDoAno,
  esquemaReabertura,
} from "@arp/shared/sustentabilidade/painel-parametros";
import type { ItemRonda } from "@arp/shared/sustentabilidade/rondas";
import { type Contexto, exigir } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao, ErroDeValidacao } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import { validarFormulario } from "@/modules/operacoes/apoio";
import {
  type AguaDoMes,
  consumoDeAguaPorMes,
  geracaoSolarPorMes,
  type SolarDoMes,
} from "@/modules/operacoes/para-sustentabilidade.service";
import {
  chamadoAbertoDaOrigem,
  concluirPeloSistema,
} from "@/modules/os/sistema.service";
import { contextoSu, logarSustentabilidade, podeAgora } from "./acesso";
import { coletores, parametros, parametrosDaEntrevista } from "./base.service";
import * as repo from "./painel.repository";
import { gerarRelatorioDoMes } from "./painel-pdf";

// Leitura do Painel de Sustentabilidade (spec 4.9). Tudo com a sessão (RLS:
// "painel" lê programas, RCC, clube, rondas, contratos, marcos e consolidados;
// os valores em reais pedem "Ver valores"), menos a água e a energia, que só
// existem em Operações e vêm da service role depois de conferir o acesso
// ao painel (quem não tem Operações vê esses números só aqui). Não consulta o
// Growatt. A apuração e a montagem são puras (@arp/shared/sustentabilidade/painel-*).

const PAINEL = "sustentabilidade.painel" as const;
const VALORES = "sustentabilidade.valores" as const;
const PARAMETROS = "sustentabilidade.parametros" as const;

export interface DadosDoPainel {
  hoje: string;
  dadosDe: string;
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
  /** Entrada completa (o PDF usa os mesmos números). */
  entrada: EntradaDoPainel;
  /** Totais de hoje de cada ano com dado (o do filtro com 12 meses): o que "Fechar ano" grava. */
  aoVivo: ReadonlyMap<number, Record<string, number | null>>;
}

const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v))
    : {};

const numeros = (v: unknown): Record<string, number | null> =>
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
  const [proximoAno, proximoMes] = mes === 12 ? [ano + 1, 1] : [ano, mes + 1];
  return [
    deBrasilia(competenciaDo(ano, mes)).toISOString(),
    deBrasilia(competenciaDo(proximoAno, proximoMes)).toISOString(),
  ];
}

const CALCULOS: readonly IndicadorDePrograma["calculo"][] = [
  "soma",
  "contagem",
  "contagem_distintos",
  "media",
  "percentual",
];
const calculoDe = (c: string): IndicadorDePrograma["calculo"] =>
  CALCULOS.find((x) => x === c) ?? "soma";

export async function dadosDoPainel(
  ctx: Contexto,
  f: FiltrosDoPainel,
): Promise<DadosDoPainel> {
  if (!ctx.permissoes.has(PAINEL))
    throw new ErroDePermissao("Sem acesso ao painel de Sustentabilidade.");
  // Valores em reais: conferidos agora, no banco, e o RLS confere de novo.
  const comValores = await podeAgora(ctx, VALORES);
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    su: await contextoSu(tx, ctx),
    b: await lerDoBanco(tx, f, comValores),
    params: await parametros(tx),
    paramsEntrevista: await parametrosDaEntrevista(tx),
    listaDeColetores: await coletores(tx),
  }));
  const { b, params, paramsEntrevista, listaDeColetores } = lido;
  const hoje = lido.su.hoje;

  // Água e energia de Operações (service role, só depois de conferir o acesso).
  let operacoesIndisponivel = false;
  let agua: AguaDoMes[] = [];
  let solar: SolarDoMes[] = [];
  if (await podeAgora(ctx, PAINEL)) {
    const mes = String(f.ateMes).padStart(2, "0");
    const primeiro = Math.min(f.ano - 1, b.primeiroAno ?? f.ano - 1);
    try {
      [agua, solar] = await banco.comoServico(async (tx) => [
        // 24 meses: o último mês com leitura (até 12 para trás) e o mesmo
        // mês do ano anterior.
        await consumoDeAguaPorMes(
          tx,
          `${f.ano - 2}-${mes}-01`,
          `${f.ano}-${mes}-01`,
        ),
        await geracaoSolarPorMes(tx, `${primeiro}-01-01`, `${f.ano}-12-01`),
      ]);
    } catch (err) {
      log.error({ err }, "painel: leitura de Operações");
      operacoesIndisponivel = true;
    }
  }
  const geracao: GeracaoDoMes[] = solar.map((s) => ({
    mes: s.mes,
    kwh: s.kwh,
  }));

  const indicadores = b.indicadores;
  const lancamentos = b.lancamentos;
  const precos: VigenciaDePreco[] | null = comValores ? b.precos : null;
  const periodo = (ano: number, ateMes: number): PeriodoApurado =>
    apurarPeriodo({
      ano,
      ateMes,
      indicadores,
      lancamentos,
      geracao,
      fatoresCo2: b.fatoresCo2,
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
  // Último mês com leitura nos 12 meses até o filtro (a fatura do mês
  // chega depois; sem isso o cartão fica vazio até a importação).
  const doMes = agua
    .filter((a) => a.mes <= comp && a.mes > mesmoMesDoAnoAnterior(comp))
    .at(-1);
  const compAgua = doMes?.mes ?? comp;
  const mesAnterior = mesmoMesDoAnoAnterior(compAgua);
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
      mes: compAgua,
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
    agua.some(
      (a) => a.exemplo && (a.mes === compAgua || a.mes === mesAnterior),
    ) && "Água (Operações)",
    solar.some((s) => s.exemplo && anoDe(s.mes) >= f.ano - 1) &&
      "Energia (Operações)",
  ].filter((x): x is string => typeof x === "string");

  return {
    hoje,
    dadosDe: lido.su.dadosDe,
    filtros: f,
    anos: anosDoFiltro(Math.min(b.primeiroAno ?? f.ano, f.ano), anoDe(hoje)),
    painel: montarPainel(entrada),
    consolidados,
    comValores,
    anoDoFiltro: !gravado
      ? "aberto"
      : gravado.situacao === "fechado"
        ? "fechado"
        : "reaberto",
    avisoDoAno: linhaDoAno?.aviso ?? null,
    exemplo,
    operacoesIndisponivel,
    entrada,
    aoVivo,
  };
}

/** GET /painel: os filtros da URL (como vieram) e o que a tela mostra. */
export async function painelDaTela(
  ctx: Contexto,
  consulta: ConsultaDoPainel,
): Promise<RespostaPainel> {
  const f = lerFiltrosDoPainel(
    {
      ano: consulta.ano ?? "",
      ate: consulta.ate ?? "",
      comparar: consulta.comparar ?? "",
    },
    hojeEmBrasilia(new Date()),
  );
  const { entrada: _, aoVivo: __, ...d } = await dadosDoPainel(ctx, f);
  return d;
}

// ---------------------------------------------------------------------------
// Leituras do banco (sessão, RLS)
// ---------------------------------------------------------------------------

interface LidoDoBanco {
  indicadores: IndicadorDePrograma[];
  lancamentos: LancamentoDoPainel[];
  notas: NotaDoRcc[];
  fatores: VigenciaDeFator[];
  fatoresCo2: VigenciaDeCo2[];
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
  tx: Tx,
  f: FiltrosDoPainel,
  comValores: boolean,
): Promise<LidoDoBanco> {
  const [inicioDoMes, fimDoMes] = intervaloDoMes(f.ano, f.ateMes);
  const ate = `${f.ano}-12-31`;

  const lista = await repo.indicadoresDoPainel(tx);
  const notas = await repo.notasDoRcc(tx, ate);
  const fatores = await repo.fatoresDoRcc(tx);
  const fatoresCo2 = await repo.fatoresDeCo2(tx);
  const precos = comValores ? await repo.precosDoRcc(tx) : [];
  const participantes = await repo.participantes(tx);
  const termos = await repo.termos(tx);
  const contratos = await repo.contratos(tx);
  const entrevistas = await repo.entrevistasResumo(tx);
  const rondas = await repo.rondasDoMes(tx, inicioDoMes, fimDoMes);
  const marcos = await repo.marcosAte(tx, f.ano);
  const consolidados = await repo.consolidados(tx);
  const consolidadoValores = comValores
    ? await repo.consolidadoValores(tx)
    : [];
  const equivalencias = await repo.equivalenciasConfirmadas(tx);
  const metas = await repo.metas(tx);
  const lancamentosLidos = await repo.lancamentos(
    tx,
    [...new Set(lista.map((i) => i.formulario_id))],
    ate,
  );

  const valoresDoAno = new Map(
    consolidadoValores.map((c) => [c.ano, numeros(c.totais)]),
  );
  const anos = [
    ...lancamentosLidos.map((l) => anoDe(l.data)),
    ...notas.map((n) => anoDe(n.competencia)),
    ...marcos.map((m) => m.ano),
    ...consolidados.map((c) => c.ano),
  ];

  return {
    indicadores: lista.map((i) => ({
      nome: i.nome,
      grupo: i.grupo,
      calculo: calculoDe(i.calculo),
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
    fatores: fatores.map((x) => ({
      vigenteDesde: x.vigente_desde,
      toneladasPorCacamba: x.toneladas_por_cacamba,
    })),
    fatoresCo2: fatoresCo2.map((x) => ({
      vigenteDesde: x.vigente_desde,
      kgPorKwh: x.kg_por_kwh,
    })),
    precos: precos.map((x) => ({
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
    rondas: rondas.map((r) => ({
      itens: r.ronda_itens.map((i) => ({
        coletorId: i.coletor_id,
        conteineres: i.conteineres,
        ocupacaoPct: i.ocupacao_pct,
      })),
    })),
    marcos: marcos.map((m) => ({
      indicador: m.indicador,
      ano: m.ano,
      valor: m.valor,
    })),
    consolidados: consolidados.map((c) => ({
      ano: c.ano,
      situacao: c.situacao,
      totais: numeros(c.totais),
      totaisReais: comValores ? (valoresDoAno.get(c.ano) ?? {}) : null,
      fechadoEm: c.fechado_em,
      reabertoMotivo: c.reaberto_motivo,
    })),
    equivalencias,
    metas,
    primeiroAno: anos.length ? Math.min(...anos) : null,
    exemplo: {
      programas: lancamentosLidos.some((l) => l.exemplo),
      rcc: notas.some((n) => n.exemplo && anoDe(n.competencia) >= f.ano - 1),
      rondas: rondas.some((r) => r.exemplo),
      clube: participantes.some((p) => p.exemplo),
      contratos: contratos.some((c) => c.exemplo),
      marcos: marcos.some((m) => m.exemplo),
    },
  };
}

// ---------------------------------------------------------------------------
// "Relatório de Sustentabilidade do mês" em PDF (spec 4.9): uma página no
// papel timbrado com o ano até aquele mês e a comparação com o ano anterior.
// Quem vê o painel gera; valores em reais só para quem tem "Ver valores" (o
// painel já monta sem eles). Ao gerar, conclui o chamado recorrente
// "Relatório de Sustentabilidade do mês": por gravar, a geração é um POST
// (com `X-ARP` e `Origin`), e não mais o GET do sistema antigo.
// ---------------------------------------------------------------------------

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export async function relatorioDoMes(
  ctx: Contexto,
  mes: string,
): Promise<Uint8Array> {
  const m = MES.exec(mes);
  if (!m) throw new ErroDeValidacao("Mês inválido. Use aaaa-mm.");
  const ano = Number(m[1]);
  const ateMes = Number(m[2]);
  const hoje = hojeEmBrasilia(new Date());
  if (mes > hoje.slice(0, 7))
    throw new ErroDeValidacao("Esse mês ainda não começou.");
  if (!(await podeAgora(ctx, PAINEL)))
    throw new ErroDePermissao(
      "Você não tem acesso ao painel de Sustentabilidade.",
    );

  const usuario = ctx.usuario;
  const filtros = { ano, ateMes, comparar: true };
  const dados = await dadosDoPainel(ctx, filtros);
  const nomeDoMes = NOMES_DOS_MESES[ateMes - 1] ?? "";
  const mesPorExtenso = `${nomeDoMes.charAt(0).toUpperCase()}${nomeDoMes.slice(1)} de ${ano}`;
  const pdf = await gerarRelatorioDoMes({
    mes: mesPorExtenso,
    periodo: periodoEscrito(filtros),
    anoAnterior: String(ano - 1),
    geradoEm: `${formatarDataHora(new Date().toISOString())}, por ${usuario.nome}`,
    cartoes: dados.painel.cartoes,
    comparacao: dados.painel.comparacao,
    graficos: dados.painel.graficos,
    equivalencias: dados.painel.equivalencias,
    exemplo: dados.exemplo,
  });

  // O chamado do relatório fecha ao gerar o do mês passado ou o do atual
  // (gerar um relatório antigo não fecha o lembrete de agora).
  const mesPassado =
    Number(hoje.slice(5, 7)) === 1
      ? `${Number(hoje.slice(0, 4)) - 1}-12`
      : `${hoje.slice(0, 4)}-${String(Number(hoje.slice(5, 7)) - 1).padStart(2, "0")}`;
  if (mes >= mesPassado) {
    try {
      // Service role: a permissão do painel foi conferida no banco acima.
      await banco.comoServico(async (tx) => {
        const aberto = await chamadoAbertoDaOrigem(
          tx,
          "sustentabilidade",
          "relatorio",
        );
        if (aberto)
          await concluirPeloSistema(tx, {
            chamadoId: aberto.id,
            texto: `Relatório de ${mesPorExtenso.toLowerCase()} gerado por ${usuario.nome} em ${formatarData(hoje)}.`,
            concluidoPor: usuario.id,
          });
      });
    } catch (err) {
      // O PDF sai de qualquer jeito; o chamado a equipe fecha à mão.
      log.error({ err }, "concluir o chamado do relatório");
    }
  }
  return pdf;
}

// ---------------------------------------------------------------------------
// Fechar e reabrir o ano no Painel (spec 4.9). O spec não diz quem fecha: aqui
// exige "Parâmetros" (a confirmar com a área), e o RLS confere de novo. Fechar
// grava os totais do ano em consolidados (e os reais em consolidado_valores,
// só com "Ver valores"); mudança de lançamento depois disso vira aviso no
// painel, sem mudar o consolidado, até alguém reabrir com motivo.
// ---------------------------------------------------------------------------

const SEM_PERMISSAO =
  "Você não tem permissão para fechar ou reabrir o ano. Peça a permissão de Parâmetros ao administrador.";

const ROTULOS = { ano: "Ano", motivo: "Motivo" };

const texto = (v: unknown) => (Array.isArray(v) ? v.at(-1) : v);

export async function fecharAno(
  ctx: Contexto,
  corpo: CamposDeFormulario,
): Promise<string> {
  const { ano } = validarFormulario(
    esquemaDoAno,
    { ano: texto(corpo.ano) },
    ROTULOS,
  );
  if (!(await podeAgora(ctx, PARAMETROS)))
    throw new ErroDePermissao(SEM_PERMISSAO);
  if (!(await podeAgora(ctx, PAINEL)))
    throw new ErroDeNegocio(
      "Para fechar o ano é preciso ver o Painel, que calcula os totais. Peça a permissão do Painel ao administrador.",
    );
  const hoje = hojeEmBrasilia(new Date());
  if (ano > Number(hoje.slice(0, 4)))
    throw new ErroDeNegocio(`${ano} ainda não começou. Não há o que fechar.`);

  const situacao = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.situacaoDoAno(tx, ano),
  );
  if (situacao === "fechado")
    throw new ErroDeNegocio(
      `${ano} já está fechado. Para mudar os totais, reabra o ano com o motivo.`,
    );

  // Os totais de hoje, do ano inteiro (12 meses), calculados como no painel.
  const dados = await dadosDoPainel(ctx, { ano, ateMes: 12, comparar: false });
  if (dados.operacoesIndisponivel)
    throw new ErroDeNegocio(
      "Não consegui ler a energia e a água de Operações agora. Tente de novo em alguns minutos: o fechamento não grava totais incompletos.",
    );
  const { semReais, reais } = separarReais(dados.aoVivo.get(ano) ?? {});

  // Totais em reais: só com "Ver valores" (o RLS também exige).
  const comValores = await podeAgora(ctx, VALORES);
  await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const gravou =
      situacao !== null
        ? await repo.fecharDeNovo(tx, ano, semReais, ctx.usuario.id)
        : await repo.fechar(tx, ano, semReais, ctx.usuario.id);
    if (!gravou) throw new ErroDePermissao(SEM_PERMISSAO);
    if (comValores) await repo.gravarTotaisEmReais(tx, ano, reais);
  });

  logarSustentabilidade(
    ctx,
    "sustentabilidade_ano_fechado",
    `Fechou o ano ${ano} no Painel de Sustentabilidade`,
    { ano },
  );
  return comValores
    ? `${ano} fechado. Os totais ficaram gravados.`
    : `${ano} fechado. Os totais em reais não foram gravados porque você não tem a permissão de ver valores.`;
}

export async function reabrirAno(
  ctx: Contexto,
  corpo: CamposDeFormulario,
): Promise<string> {
  const { ano, motivo } = validarFormulario(
    esquemaReabertura,
    { ano: texto(corpo.ano), motivo: texto(corpo.motivo) },
    ROTULOS,
  );
  await exigirParametros(ctx);
  const reabriu = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.reabrir(tx, ano, motivo, ctx.usuario.id),
  );
  if (!reabriu)
    throw new ErroDeNegocio(`${ano} não está fechado. Atualize a página.`);
  logarSustentabilidade(
    ctx,
    "sustentabilidade_ano_reaberto",
    `Reabriu o ano ${ano} no Painel de Sustentabilidade`,
    { ano, motivo },
  );
  return `${ano} reaberto. Os totais voltam a seguir os lançamentos até fechar de novo.`;
}

async function exigirParametros(ctx: Contexto): Promise<void> {
  try {
    await exigir(ctx, PARAMETROS);
  } catch (e) {
    if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
    throw e;
  }
}
