import { somarDias } from "@/lib/comercial/datas";
import {
  ativoEm,
  type EnetCliente,
  type EnetContrato,
  type EnetLuc,
  type FontesEnet,
  type StatusLuc,
} from "@/lib/comercial/fontes";

// Ocupação e estoque (spec 4.5): uma linha por LUC com o contrato ativo,
// totais em m² (LUC sem ABL conta na quantidade, não nos m²), quadros por
// bloco e por tipo e os movimentos de entrada, saída e transferência.

export interface LinhaLuc {
  numero: string;
  bloco: string;
  piso: string;
  rua: string;
  tipo: string;
  abl: number;
  areaUtil: number;
  status: StatusLuc;
  situacao: string;
  /** Do contrato ativo (null no LUC vago). */
  contrato: string | null;
  cliente: string | null;
  locatario: string | null;
  inicio: string | null;
  /** null sem a permissão de valores (o valor nem sai do servidor). */
  aluguel: number | null;
}

/** LUCs com o contrato em vigor hoje. Sem `comValores`, aluguel vai null. */
export function linhasDeLucs(
  enet: Pick<FontesEnet, "lucs" | "contratos">,
  hoje: string,
  comValores: boolean,
): LinhaLuc[] {
  const ativo = new Map<string, EnetContrato>();
  for (const c of enet.contratos) if (ativoEm(c, hoje)) ativo.set(c.luc, c);
  return enet.lucs.map((l) => {
    const c = ativo.get(l.numero) ?? null;
    return {
      numero: l.numero,
      bloco: l.local,
      piso: l.piso,
      rua: l.rua,
      tipo: l.tipo_loja,
      abl: l.abl,
      areaUtil: l.area_util,
      status: l.status,
      situacao: l.situacao,
      contrato: c?.codigo ?? null,
      cliente: c?.cliente ?? null,
      locatario: c?.locatario ?? null,
      inicio: c?.data_inicio ?? null,
      aluguel: c && comValores ? c.valor_aluguel : null,
    };
  });
}

/** Tipo de LUC no filtro: "" = os que contam na ocupação; "todos" = todos. */
export const TODOS_OS_TIPOS = "todos";

export interface FiltroLucs {
  bloco: string;
  tipo: string;
  status: "" | "locado" | "vago";
  rua: string;
}

export function filtrarLucs<T extends Pick<LinhaLuc, "bloco" | "tipo" | "rua">>(
  linhas: T[],
  f: Omit<FiltroLucs, "status">,
  contamNaOcupacao: ReadonlySet<string>,
): T[] {
  return linhas.filter(
    (l) =>
      (!f.bloco || l.bloco === f.bloco) &&
      (!f.rua || l.rua === f.rua) &&
      (f.tipo === TODOS_OS_TIPOS ||
        (f.tipo ? l.tipo === f.tipo : contamNaOcupacao.has(l.tipo))),
  );
}

export function comStatus<T extends Pick<LinhaLuc, "status">>(
  linhas: T[],
  status: FiltroLucs["status"],
): T[] {
  if (!status) return linhas;
  const quer: StatusLuc = status === "locado" ? "Locado" : "Vago";
  return linhas.filter((l) => l.status === quer);
}

export interface TotaisOcupacao {
  quantidade: number;
  locados: number;
  vagos: number;
  ablTotal: number;
  ablLocada: number;
  ablVaga: number;
  areaUtil: number;
  /** ABL locada ÷ ABL total, em %; null sem ABL. */
  pct: number | null;
  /** Soma do aluguel (null quando nenhum valor veio). */
  aluguel: number | null;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function totais(
  linhas: Pick<LinhaLuc, "status" | "abl" | "areaUtil" | "aluguel">[],
): TotaisOcupacao {
  let locados = 0;
  let ablTotal = 0;
  let ablLocada = 0;
  let areaUtil = 0;
  let aluguel: number | null = null;
  for (const l of linhas) {
    ablTotal += l.abl;
    areaUtil += l.areaUtil;
    if (l.status === "Locado") {
      locados++;
      ablLocada += l.abl;
    }
    if (l.aluguel !== null) aluguel = (aluguel ?? 0) + l.aluguel;
  }
  return {
    quantidade: linhas.length,
    locados,
    vagos: linhas.length - locados,
    ablTotal: r2(ablTotal),
    ablLocada: r2(ablLocada),
    ablVaga: r2(ablTotal - ablLocada),
    areaUtil: r2(areaUtil),
    pct: ablTotal > 0 ? (ablLocada / ablTotal) * 100 : null,
    aluguel: aluguel === null ? null : r2(aluguel),
  };
}

export interface LinhaQuadro extends TotaisOcupacao {
  chave: string;
}

/** Quadro por bloco ou por tipo, na ordem em que aparecem nos LUCs. */
export function quadroPor(
  linhas: LinhaLuc[],
  por: "bloco" | "tipo",
): LinhaQuadro[] {
  const grupos = new Map<string, LinhaLuc[]>();
  for (const l of linhas) {
    const k = l[por];
    grupos.set(k, [...(grupos.get(k) ?? []), l]);
  }
  return [...grupos].map(([chave, ls]) => ({ chave, ...totais(ls) }));
}

// ---------------------------------------------------------------------------
// Entradas, saídas e transferências (aba "Entradas e Saídas" da planilha)
// ---------------------------------------------------------------------------

export type TipoMovimento = "entrada" | "saida" | "transferencia";
export const MOVIMENTOS: Record<TipoMovimento, string> = {
  entrada: "Entrada",
  saida: "Saída",
  transferencia: "Transferência",
};

export interface Movimento {
  tipo: TipoMovimento;
  /** "aaaa-mm-dd": início (entrada, transferência) ou rescisão (saída). */
  data: string;
  luc: string;
  bloco: string;
  m2: number;
  valor: number;
  contrato: string;
  /** Transferência: o contrato rescindido do mesmo CPF ou CNPJ. */
  origem?: string;
}

/**
 * Cada contrato vira uma entrada (início) e, se rescindido, uma saída. Quando
 * o mesmo CPF ou CNPJ rescindiu um LUC e começou outro com até `dias` de
 * diferença, as duas pontas viram uma transferência só (na data do contrato
 * novo, com o m² e o valor dele): não entram em Entrada nem em Saída.
 */
export function movimentos(
  enet: { lucs: EnetLuc[]; contratos: EnetContrato[]; clientes: EnetCliente[] },
  hoje: string,
  dias: number,
): Movimento[] {
  const luc = new Map(enet.lucs.map((l) => [l.numero, l]));
  const doc = new Map(enet.clientes.map((c) => [c.codigo, c.cpf_cnpj]));
  const docDe = (c: EnetContrato) => doc.get(c.cliente) ?? c.cliente;
  const porDoc = new Map<string, EnetContrato[]>();
  for (const c of enet.contratos) {
    if (c.data_inicio > hoje) continue;
    porDoc.set(docDe(c), [...(porDoc.get(docDe(c)) ?? []), c]);
  }

  const novoDeTransf = new Map<string, string>();
  const rescindidoEmTransf = new Set<string>();
  const rescisoes = enet.contratos
    .filter((c) => c.data_rescisao && c.data_rescisao <= hoje)
    .sort((a, b) =>
      (a.data_rescisao as string).localeCompare(b.data_rescisao as string),
    );
  for (const r of rescisoes) {
    const sai = r.data_rescisao as string;
    const de = somarDias(sai, -dias);
    const ate = somarDias(sai, dias);
    const novo = (porDoc.get(docDe(r)) ?? [])
      .filter(
        (c) =>
          c.codigo !== r.codigo &&
          c.luc !== r.luc &&
          !novoDeTransf.has(c.codigo) &&
          c.data_inicio >= de &&
          c.data_inicio <= ate,
      )
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))[0];
    if (!novo) continue;
    novoDeTransf.set(novo.codigo, r.codigo);
    rescindidoEmTransf.add(r.codigo);
  }

  const base = (c: EnetContrato) => {
    const l = luc.get(c.luc);
    return {
      luc: c.luc,
      bloco: l?.local ?? "",
      m2: l?.abl ?? 0,
      valor: c.valor_aluguel,
      contrato: c.codigo,
    };
  };
  const lista: Movimento[] = [];
  for (const c of enet.contratos) {
    if (c.data_inicio <= hoje) {
      const origem = novoDeTransf.get(c.codigo);
      lista.push({
        ...base(c),
        tipo: origem ? "transferencia" : "entrada",
        data: c.data_inicio,
        ...(origem ? { origem } : {}),
      });
    }
    if (
      c.data_rescisao &&
      c.data_rescisao <= hoje &&
      !rescindidoEmTransf.has(c.codigo)
    )
      lista.push({ ...base(c), tipo: "saida", data: c.data_rescisao });
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

export type Indicador = "quantidade" | "m2" | "valor";
export const INDICADORES: Record<Indicador, string> = {
  quantidade: "Quantidade",
  m2: "m²",
  valor: "Valor",
};

const medida = (m: Movimento, i: Indicador) =>
  i === "quantidade" ? 1 : i === "m2" ? m.m2 : m.valor;

export interface ColunasMovimento {
  entrada: number;
  saida: number;
  transferencia: number;
  /** Entradas menos saídas. */
  saldo: number;
}

function somar(ms: Movimento[], i: Indicador): ColunasMovimento {
  const c = { entrada: 0, saida: 0, transferencia: 0, saldo: 0 };
  for (const m of ms) c[m.tipo] += medida(m, i);
  c.entrada = r2(c.entrada);
  c.saida = r2(c.saida);
  c.transferencia = r2(c.transferencia);
  c.saldo = r2(c.entrada - c.saida);
  return c;
}

/** Os 12 meses do ano ("aaaa-mm-01"), com as quatro colunas cada. */
export function quadroPorMes(
  ms: Movimento[],
  ano: number,
  i: Indicador,
): { mes: string; colunas: ColunasMovimento }[] {
  return Array.from({ length: 12 }, (_, k) => {
    const mes = `${ano}-${String(k + 1).padStart(2, "0")}-01`;
    return {
      mes,
      colunas: somar(
        ms.filter((m) => m.data.slice(0, 7) === mes.slice(0, 7)),
        i,
      ),
    };
  });
}

/** Por bloco, no ano, na ordem dos blocos dada. */
export function quadroMovPorBloco(
  ms: Movimento[],
  ano: number,
  i: Indicador,
  blocos: string[],
): { bloco: string; colunas: ColunasMovimento }[] {
  const doAno = ms.filter((m) => m.data.startsWith(`${ano}-`));
  return blocos.map((bloco) => ({
    bloco,
    colunas: somar(
      doAno.filter((m) => m.bloco === bloco),
      i,
    ),
  }));
}

export function totalMovimentos(
  ms: Movimento[],
  ano: number,
  i: Indicador,
): ColunasMovimento {
  return somar(
    ms.filter((m) => m.data.startsWith(`${ano}-`)),
    i,
  );
}

// ---------------------------------------------------------------------------
// Foto do fim do mês (Painel, spec 4.10)
// ---------------------------------------------------------------------------

interface Parcial {
  lucs: number;
  lucs_locados: number;
  abl_total: number;
  abl_locada: number;
}

export interface FotoOcupacao extends Parcial {
  /** "aaaa-mm-01". */
  mes: string;
  clientes_ativos: number;
  por_bloco: Record<string, Parcial>;
  por_tipo: Record<string, Parcial>;
}

/**
 * Ocupação no dia (o último do mês), pela regra da tela: só os tipos que
 * contam, status pelo contrato em vigor naquele dia (não pelo de hoje).
 */
export function fotoDaOcupacao(
  enet: Pick<FontesEnet, "lucs" | "contratos">,
  dia: string,
  contamNaOcupacao: ReadonlySet<string>,
): FotoOcupacao {
  const ativo = new Map<string, EnetContrato>();
  for (const c of enet.contratos) if (ativoEm(c, dia)) ativo.set(c.luc, c);
  const vazio = (): Parcial => ({
    lucs: 0,
    lucs_locados: 0,
    abl_total: 0,
    abl_locada: 0,
  });
  const total = vazio();
  const porBloco: Record<string, Parcial> = {};
  const porTipo: Record<string, Parcial> = {};
  const clientes = new Set<string>();
  for (const l of enet.lucs) {
    if (!contamNaOcupacao.has(l.tipo_loja)) continue;
    const c = ativo.get(l.numero);
    if (c) clientes.add(c.cliente);
    porBloco[l.local] ??= vazio();
    porTipo[l.tipo_loja] ??= vazio();
    for (const p of [
      total,
      porBloco[l.local],
      porTipo[l.tipo_loja],
    ] as Parcial[]) {
      p.lucs++;
      p.abl_total += l.abl;
      if (c) {
        p.lucs_locados++;
        p.abl_locada += l.abl;
      }
    }
  }
  const arredondar = (p: Parcial): Parcial => ({
    ...p,
    abl_total: r2(p.abl_total),
    abl_locada: r2(p.abl_locada),
  });
  const mapa = (o: Record<string, Parcial>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, arredondar(v)]));
  return {
    mes: `${dia.slice(0, 7)}-01`,
    ...arredondar(total),
    clientes_ativos: clientes.size,
    por_bloco: mapa(porBloco),
    por_tipo: mapa(porTipo),
  };
}
