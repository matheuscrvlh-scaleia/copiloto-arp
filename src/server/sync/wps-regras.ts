import { pagamentosUnicos } from "@/connectors/wps/client";
import type {
  MovimentoDoDia,
  Pagamento,
  PagamentosDoDia,
} from "@/connectors/wps/schemas";

/**
 * Dias que o cron relê: pagamento pode ser estornado ou lançado depois, então
 * a semana anterior é trocada inteira a cada execução. Hoje fica de fora
 * (ainda em andamento).
 */
export const DIAS_RELIDOS = 7;
/** Maior intervalo num reprocesso manual (3 chamadas à API por dia). */
export const LIMITE_DIAS = 93;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "2026-10-15" → 15/10/2026 no horário local (o que o conector espera). */
export function dataLocal(dia: string): Date {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(y as number, (m as number) - 1, d);
}

export function diasParaSincronizar(
  hoje: Date,
  quantos = DIAS_RELIDOS,
): string[] {
  return Array.from({ length: quantos }, (_, i) =>
    iso(
      new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate() - quantos + i,
      ),
    ),
  );
}

/** Reprocesso: ?de=2026-09-01&ate=2026-09-30 (ate opcional = de). */
export function diasDoIntervalo(de: string, ate = de): string[] {
  const formato = /^\d{4}-\d{2}-\d{2}$/;
  if (!formato.test(de) || !formato.test(ate)) {
    throw new Error("datas no formato aaaa-mm-dd");
  }
  const inicio = dataLocal(de);
  const fim = dataLocal(ate);
  if (iso(inicio) !== de || iso(fim) !== ate) throw new Error("data inválida");
  if (fim < inicio) throw new Error("'ate' antes de 'de'");
  const dias: string[] = [];
  for (
    let d = inicio;
    d <= fim;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  ) {
    dias.push(iso(d));
    if (dias.length > LIMITE_DIAS) {
      throw new Error(`no máximo ${LIMITE_DIAS} dias por vez`);
    }
  }
  return dias;
}

export interface LinhaPagamento {
  wps_codigo: number;
  pago_em: string;
  tipo_cliente: string;
  ticket: string | null;
  recibo: string;
  forma_pagamento: string;
  forma_pagamento_codigo: number;
  grupos: string[];
  valor_bruto: number;
  valor_desconto: number;
  valor_liquido: number;
  parcial: number;
  terminal: string | null;
  tarifa: string | null;
}

export interface LinhaMovimento {
  tipo_veiculo: string;
  entradas: number;
  saidas: number;
}

export interface DiaEstacionamento {
  data: string;
  pagamentos: LinhaPagamento[];
  movimento: LinhaMovimento[];
}

/** Uma linha por pagamento único, com todos os grupos em que apareceu. */
export function linhasDoDia(
  data: string,
  pagamentos: PagamentosDoDia,
  entradas: MovimentoDoDia,
  saidas: MovimentoDoDia,
): DiaEstacionamento {
  const grupos = new Map<number, string[]>();
  for (const [grupo, { detalhes }] of Object.entries(pagamentos.subdetalhes)) {
    for (const p of detalhes ?? []) {
      const lista = grupos.get(p.codigo) ?? [];
      if (!lista.includes(grupo)) lista.push(grupo);
      grupos.set(p.codigo, lista);
    }
  }

  const tipos = new Set([
    ...Object.keys(entradas.subdetalhes),
    ...Object.keys(saidas.subdetalhes),
  ]);

  return {
    data,
    pagamentos: pagamentosUnicos(pagamentos).map((p) => ({
      wps_codigo: p.codigo,
      pago_em: p.data,
      tipo_cliente: p.descricao,
      ticket: p.ticket ?? null,
      recibo: p.recibo,
      forma_pagamento: p.formaPagamento.descricao,
      forma_pagamento_codigo: p.formaPagamento.codigoMapeado,
      grupos: grupos.get(p.codigo) ?? [],
      valor_bruto: p.valorBruto,
      valor_desconto: p.desconto ?? 0,
      valor_liquido: p.valorLiquido,
      parcial: p.parcial,
      terminal: p.terminal.descricao ?? null,
      tarifa: p.tarifa ?? null,
    })),
    movimento: [...tipos].map((tipo_veiculo) => ({
      tipo_veiculo,
      entradas: entradas.subdetalhes[tipo_veiculo]?.quantidade ?? 0,
      saidas: saidas.subdetalhes[tipo_veiculo]?.quantidade ?? 0,
    })),
  };
}

/**
 * O banco aceita cada pagamento uma vez por gravação. Se a API listar o
 * mesmo código em dois dias, fica no último.
 */
export function semRepetirEntreDias(dias: DiaEstacionamento[]): {
  dias: DiaEstacionamento[];
  repetidos: number;
} {
  const ultimoDia = new Map<number, string>();
  for (const d of dias) {
    for (const p of d.pagamentos) ultimoDia.set(p.wps_codigo, d.data);
  }
  let repetidos = 0;
  return {
    dias: dias.map((d) => ({
      ...d,
      pagamentos: d.pagamentos.filter((p) => {
        const fica = ultimoDia.get(p.wps_codigo) === d.data;
        if (!fica) repetidos++;
        return fica;
      }),
    })),
    repetidos,
  };
}

/** Removido do bruto: placa de veículo e operador (LGPD). */
export function pagamentosSemPlaca(dia: PagamentosDoDia) {
  const limpa = ({ placa: _placa, operador: _operador, ...p }: Pagamento) => p;
  return {
    ...dia,
    subdetalhes: Object.fromEntries(
      Object.entries(dia.subdetalhes).map(([grupo, g]) => [
        grupo,
        { ...g, detalhes: g.detalhes?.map(limpa) },
      ]),
    ),
  };
}
