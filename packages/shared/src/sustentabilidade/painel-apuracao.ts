// Apuração do Painel de Sustentabilidade (spec 4.9): das linhas lidas do
// banco (lançamentos, notas do RCC, geração solar, clube, entrevistas,
// rondas) saem os números de um ano até um mês. Funções puras: nada de banco
// aqui, e fonte sem dado fica null (o painel escreve "sem dado em mm/aaaa").

import { competenciasEntre, fimDoMesDe } from "../comercial/datas";
import { normalizar } from "../operacoes/agua-formato";
import {
  type Calculo,
  calcularIndicador,
  type DefinicaoIndicador,
  type IndicadorDoGrupo,
  type Lancamento,
  somaPorGrupo,
  type TotalDoGrupo,
} from "./indicadores";
import {
  type CacambasDaNota,
  calcularNota,
  fatorVigente,
  type ResultadoNota,
  totaisDoPeriodo,
} from "./rcc";
import { type CorColetor, type ItemRonda, ocupacaoMedia } from "./rondas";
import {
  cobertura,
  contratoEntraNaLista,
  type ParametrosEntrevista,
  participacao,
  type SituacaoEntrevista,
  situacaoDaEntrevista,
  situacaoDoTermo,
  termoValido,
} from "./situacao";

/** "aaaa-mm-01" de cada mês de janeiro até `ateMes` (1 a 12) do ano. */
export function competenciasDoAno(ano: number, ateMes: number): string[] {
  return competenciasEntre(
    `${ano}-01-01`,
    `${ano}-${String(ateMes).padStart(2, "0")}-01`,
  );
}

/** Competência ("aaaa-mm-01") do mês `ateMes` do ano. */
export const competenciaDo = (ano: number, mes: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-01`;

/** Soma os números que existem; null se nenhum existe (nunca zero inventado). */
export function somaOuNull(
  valores: readonly (number | null | undefined)[],
): number | null {
  const reais = valores.filter((v): v is number => typeof v === "number");
  return reais.length ? reais.reduce((t, v) => t + v, 0) : null;
}

/** Um total e a série mês a mês (null: mês sem dado). */
export interface Mensal {
  total: number | null;
  porMes: (number | null)[];
}

// ---------------------------------------------------------------------------
// Programas: grupos de impacto
// ---------------------------------------------------------------------------

export interface IndicadorDePrograma {
  nome: string;
  grupo: string | null;
  calculo: Calculo;
  formularioId: string;
  campoId: string | null;
  /** `{ campo_id, valor }` como vem do banco (jsonb). */
  filtro: unknown;
  percentualValor: string | null;
}

export interface LancamentoDoPainel extends Lancamento {
  formularioId: string;
}

function filtroDoIndicador(filtro: unknown): DefinicaoIndicador["filtro"] {
  if (!filtro || typeof filtro !== "object" || Array.isArray(filtro))
    return null;
  const f = filtro as { campo_id?: unknown; valor?: unknown };
  return typeof f.campo_id === "string" && typeof f.valor === "string"
    ? { campoId: f.campo_id, valor: f.valor }
    : null;
}

export interface GrupoApurado {
  /** Calculado sobre todos os lançamentos do período (não soma meses). */
  periodo: TotalDoGrupo;
  /** Um por mês das competências. */
  porMes: TotalDoGrupo[];
}

/**
 * Totais por grupo de impacto, no período e mês a mês. Só entram os
 * indicadores com grupo; o "ano" de cada indicador é calculado sobre os
 * lançamentos do ano inteiro (produtores únicos não somam meses).
 */
export function apurarGrupos(
  indicadores: readonly IndicadorDePrograma[],
  lancamentos: readonly LancamentoDoPainel[],
  competencias: readonly string[],
): Map<string, GrupoApurado> {
  const calculados = indicadores
    .filter((i) => i.grupo?.trim())
    .map((i) => ({
      i,
      c: calcularIndicador(
        {
          campoId: i.campoId ?? "",
          calculo: i.calculo,
          filtro: filtroDoIndicador(i.filtro),
          percentualValor: i.percentualValor,
        },
        lancamentos.filter((l) => l.formularioId === i.formularioId),
        competencias,
      ),
    }));
  const doGrupo = (
    valor: (c: (typeof calculados)[number]["c"]) => number | null,
  ) =>
    somaPorGrupo(
      calculados.map(
        ({ i, c }): IndicadorDoGrupo => ({
          nome: i.nome,
          grupo: i.grupo,
          calculo: i.calculo,
          valor: valor(c),
        }),
      ),
    );
  const periodo = doGrupo((c) => c.periodo);
  const meses = competencias.map((_, k) =>
    doGrupo((c) => c.porMes[k]?.valor ?? null),
  );
  return new Map(
    periodo.map((p) => [
      p.grupo,
      {
        periodo: p,
        porMes: meses.map(
          (m) =>
            m.find((g) => g.grupo === p.grupo) ?? {
              grupo: p.grupo,
              soma: null,
              aParte: [],
            },
        ),
      },
    ]),
  );
}

/** O grupo pelo nome, sem acento nem caixa ("Volume reciclado"). */
export function grupoPorNome(
  grupos: ReadonlyMap<string, GrupoApurado>,
  nome: string,
): GrupoApurado | null {
  const alvo = normalizar(nome);
  for (const [k, g] of grupos) if (normalizar(k) === alvo) return g;
  return null;
}

/** Soma do grupo no período e por mês; sem o grupo, tudo "sem dado". */
export function mensalDoGrupo(
  grupo: GrupoApurado | null,
  meses: number,
): Mensal {
  return {
    total: grupo?.periodo.soma ?? null,
    porMes: Array.from(
      { length: meses },
      (_, k) => grupo?.porMes[k]?.soma ?? null,
    ),
  };
}

/**
 * Produtores locais: as participações (indicador somável) e os produtores
 * únicos (valores diferentes), sempre separados, nunca somados.
 */
export function produtoresDoGrupo(grupo: GrupoApurado | null): {
  participacoes: number | null;
  unicos: number | null;
} {
  if (!grupo) return { participacoes: null, unicos: null };
  const unicos = grupo.periodo.aParte.filter(
    (i) => i.calculo === "contagem_distintos",
  );
  return {
    participacoes: grupo.periodo.soma,
    unicos: somaOuNull(unicos.map((i) => i.valor)),
  };
}

// ---------------------------------------------------------------------------
// Energia e RCC
// ---------------------------------------------------------------------------

export interface GeracaoDoMes {
  /** aaaa-mm-01 */
  mes: string;
  kwh: number;
  co2_t: number | null;
}

/** Geração por mês e o CO₂ evitado (null enquanto Operações não informa). */
export function apurarEnergia(
  geracao: readonly GeracaoDoMes[],
  competencias: readonly string[],
): { energia: Mensal; co2: number | null } {
  const doMes = new Map(geracao.map((g) => [g.mes, g]));
  const meses = competencias.map((c) => doMes.get(c) ?? null);
  return {
    energia: {
      total: somaOuNull(meses.map((g) => g?.kwh ?? null)),
      porMes: meses.map((g) => g?.kwh ?? null),
    },
    co2: somaOuNull(meses.map((g) => g?.co2_t ?? null)),
  };
}

export interface NotaDoRcc extends CacambasDaNota {
  /** aaaa-mm-01 */
  competencia: string;
}

export interface VigenciaDeFator {
  vigenteDesde: string;
  toneladasPorCacamba: number;
}

export interface VigenciaDePreco {
  vigenteDesde: string;
  precoA: number;
  precoB: number;
}

export interface RccApurado {
  a: Mensal;
  b: Mensal;
  total: Mensal;
  pctReciclado: number | null;
  /** Null sem permissão de valores, sem preço vigente ou sem nota. */
  economia: number | null;
}

/**
 * RCC do período: toneladas A e B por mês, % reciclado sobre as somas e o
 * valor economizado. Cada nota usa o fator e o preço vigentes na competência
 * dela. `precos` null = quem lê não vê valores.
 */
export function apurarRcc(
  notas: readonly NotaDoRcc[],
  fatores: readonly VigenciaDeFator[],
  precos: readonly VigenciaDePreco[] | null,
  competencias: readonly string[],
): RccApurado {
  const dentro = new Set(competencias);
  const calculadas = notas
    .filter((n) => dentro.has(n.competencia))
    .flatMap((n) => {
      const fator = fatorVigente(fatores, n.competencia);
      if (!fator) return [];
      const preco = precos ? fatorVigente(precos, n.competencia) : null;
      const r: ResultadoNota = calcularNota(n, fator, preco);
      return [{ ...n, ...r }];
    });
  const porMes = (f: (n: (typeof calculadas)[number]) => number) =>
    competencias.map((c) => {
      const doMes = calculadas.filter((n) => n.competencia === c);
      return doMes.length ? doMes.reduce((t, n) => t + f(n), 0) : null;
    });
  const a = porMes((n) => n.toneladasA);
  const b = porMes((n) => n.toneladasB);
  const total = porMes((n) => n.toneladasTotal);
  if (!calculadas.length)
    return {
      a: { total: null, porMes: a },
      b: { total: null, porMes: b },
      total: { total: null, porMes: total },
      pctReciclado: null,
      economia: null,
    };
  const t = totaisDoPeriodo(calculadas);
  return {
    a: { total: t.toneladasA, porMes: a },
    b: { total: t.toneladasB, porMes: b },
    total: { total: t.toneladasTotal, porMes: total },
    pctReciclado: t.pctReciclado,
    economia: precos ? t.valorEconomizado : null,
  };
}

// ---------------------------------------------------------------------------
// Um ano até um mês (o que o painel e o consolidado usam)
// ---------------------------------------------------------------------------

export interface PeriodoApurado {
  ano: number;
  ateMes: number;
  volume: Mensal;
  pessoas: Mensal;
  oficinas: Mensal;
  produtores: { participacoes: number | null; unicos: number | null };
  energia: Mensal;
  co2: number | null;
  rcc: RccApurado;
}

export interface EntradaDoPeriodo {
  ano: number;
  ateMes: number;
  indicadores: readonly IndicadorDePrograma[];
  lancamentos: readonly LancamentoDoPainel[];
  geracao: readonly GeracaoDoMes[];
  notas: readonly NotaDoRcc[];
  fatores: readonly VigenciaDeFator[];
  precos: readonly VigenciaDePreco[] | null;
  /** Os grupos de impacto que alimentam os cartões (nomes do spec 4.9). */
  grupos: {
    volume: string;
    pessoas: string;
    oficinas: string;
    produtores: string;
  };
}

export function apurarPeriodo(e: EntradaDoPeriodo): PeriodoApurado {
  const competencias = competenciasDoAno(e.ano, e.ateMes);
  const grupos = apurarGrupos(e.indicadores, e.lancamentos, competencias);
  const doGrupo = (nome: string) => grupoPorNome(grupos, nome);
  const { energia, co2 } = apurarEnergia(e.geracao, competencias);
  return {
    ano: e.ano,
    ateMes: e.ateMes,
    volume: mensalDoGrupo(doGrupo(e.grupos.volume), e.ateMes),
    pessoas: mensalDoGrupo(doGrupo(e.grupos.pessoas), e.ateMes),
    oficinas: mensalDoGrupo(doGrupo(e.grupos.oficinas), e.ateMes),
    produtores: produtoresDoGrupo(doGrupo(e.grupos.produtores)),
    energia,
    co2,
    rcc: apurarRcc(e.notas, e.fatores, e.precos, competencias),
  };
}

// ---------------------------------------------------------------------------
// Clube
// ---------------------------------------------------------------------------

export interface ParticipanteDoPainel {
  id: string;
  clienteDoc: string;
  /** Cadastrado à mão, "não locatário". */
  locatarioManual: boolean;
  saiuEm: string | null;
}

export interface TermoDoPainel {
  participanteId: string;
  assinadoEm: string;
  validoAte: string;
}

export interface ContratoDoPainel {
  id: string;
  situacao: "vigente" | "encerrado";
  rescisao: string | null;
  tipoLoja: string | null;
  clienteDoc: string | null;
  ativacao: string | null;
  ativacaoCorrigida: string | null;
  inicio: string | null;
  dispensada: boolean;
  validadeEspecificaMeses: number | null;
}

export interface ClubeApurado {
  /** Participantes com termo válido (inclusive a vencer). */
  ativos: number;
  /** Os ativos que são locatários. */
  locatarios: number;
  /** Clientes (CPF ou CNPJ) com contrato vigente. */
  clientes: number;
  /** Locatários ativos ÷ clientes com contrato, de 0 a 100. */
  participacao: number | null;
}

/** Participantes ativos na data (termo válido e sem saída até lá). */
export function apurarClube(p: {
  participantes: readonly ParticipanteDoPainel[];
  termos: readonly TermoDoPainel[];
  contratos: readonly ContratoDoPainel[];
  data: string;
  avisoDias: number;
}): ClubeApurado {
  const ativos = p.participantes.filter((pt) => {
    const validos = p.termos
      .filter((t) => t.participanteId === pt.id && t.assinadoEm <= p.data)
      .map((t) => t.validoAte)
      .sort();
    return termoValido(
      situacaoDoTermo({
        hoje: p.data,
        validoAte: validos.at(-1) ?? null,
        saiuEm: pt.saiuEm && pt.saiuEm <= p.data ? pt.saiuEm : null,
        avisoDias: p.avisoDias,
      }),
    );
  });
  const locatarios = ativos.filter((pt) => !pt.locatarioManual).length;
  const clientes = new Set(
    p.contratos
      .filter(
        (c) =>
          c.situacao === "vigente" &&
          c.clienteDoc &&
          (!c.rescisao || c.rescisao > p.data),
      )
      .map((c) => c.clienteDoc),
  ).size;
  return {
    ativos: ativos.length,
    locatarios,
    clientes,
    participacao: participacao(locatarios, clientes),
  };
}

// ---------------------------------------------------------------------------
// Entrevistas
// ---------------------------------------------------------------------------

export interface EntrevistaDoPainel {
  contratoId: string;
  data: string;
  setor: string | null;
}

export interface EntrevistasApuradas {
  emDia: number;
  precisam: number;
  /** De 0 a 100; null sem contrato que precise. */
  pct: number | null;
  pendentes: number;
  vencidas: number;
}

/**
 * Cobertura das entrevistas na data: em dia (e a vencer) ÷ contratos que
 * precisam, com os pendentes e os vencidos. Só entram os contratos da lista
 * de entrevistas (vigentes, fora dos tipos dispensados).
 */
export function apurarEntrevistas(p: {
  contratos: readonly ContratoDoPainel[];
  entrevistas: readonly EntrevistaDoPainel[];
  parametros: ParametrosEntrevista;
  tiposLojaDispensados: readonly string[];
  /** Qual data do contrato conta como inauguração (parâmetro). */
  dataInauguracao: "ativacao" | "inicio";
  data: string;
}): EntrevistasApuradas {
  const ultima = new Map<string, EntrevistaDoPainel>();
  for (const e of p.entrevistas)
    if (e.data <= p.data) {
      const atual = ultima.get(e.contratoId);
      if (!atual || e.data > atual.data) ultima.set(e.contratoId, e);
    }
  const situacoes: SituacaoEntrevista[] = p.contratos
    .filter((c) =>
      contratoEntraNaLista(
        { situacao: c.situacao, rescisao: c.rescisao, tipoLoja: c.tipoLoja },
        { hoje: p.data, tiposLojaDispensados: p.tiposLojaDispensados },
      ),
    )
    .map((c) => {
      const e = ultima.get(c.id);
      return situacaoDaEntrevista({
        hoje: p.data,
        ativacao:
          c.ativacaoCorrigida ??
          (p.dataInauguracao === "inicio" ? c.inicio : c.ativacao),
        dispensada: c.dispensada,
        ultimaEntrevista: e ? { data: e.data, setor: e.setor } : null,
        validadeEspecificaMeses: c.validadeEspecificaMeses,
        parametros: p.parametros,
      }).situacao;
    });
  const cob = cobertura(situacoes);
  return {
    emDia: cob.emDia,
    precisam: cob.precisam,
    pct: cob.pct,
    pendentes: situacoes.filter((s) => s === "pendente").length,
    vencidas: situacoes.filter((s) => s === "vencida").length,
  };
}

// ---------------------------------------------------------------------------
// Rondas
// ---------------------------------------------------------------------------

export interface OcupacaoApurada {
  preto: number | null;
  azul: number | null;
  /** Rondas do mês. */
  rondas: number;
}

/** Média do mês por cor, ponderada pelos contêineres (coletor sem visita não conta). */
export function apurarOcupacao(
  rondas: readonly { itens: readonly ItemRonda[] }[],
): OcupacaoApurada {
  const itens = rondas.flatMap((r) => r.itens);
  const cor = (c: CorColetor) => ocupacaoMedia(itens, c);
  return { preto: cor("preto"), azul: cor("azul"), rondas: rondas.length };
}

/** Último dia (aaaa-mm-dd) do mês `mes` do ano. */
export const fimDoMesDoAno = (ano: number, mes: number) =>
  fimDoMesDe(competenciaDo(ano, mes));
