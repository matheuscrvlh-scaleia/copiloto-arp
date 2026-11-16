import { competenciaDe } from "@arp/shared/formato";
import { type Meta, metaVigente } from "@arp/shared/indicadores";
import { diaAnterior, ultimoDiaFechado } from "@arp/shared/periodo";
import type { ColaboradorQuadro, LinhaPonto } from "@arp/shared/rh/calculos";
import {
  type CustoAgregado,
  type CustoIndividual,
  type MemoriaDoCusto,
  vigenteEm,
} from "@arp/shared/rh/custo";
import {
  juntarPonto,
  linhaDosDias,
  type PontoDoPeriodo,
  planejarPonto,
  type TrechoDoPonto,
} from "@arp/shared/rh/ponto-periodo";
import { tipoDoDesligamento } from "@arp/shared/rh/turnover";
import { z } from "zod";
import type { Tx } from "@/infra/banco";
import * as repo from "./dados.repository";

// Leituras de base do RH (dados.ts, configuracao.ts e banco-horas.ts do
// antigo), sempre dentro do escopo que o service abriu: recebem a `tx` de
// quem pediu e o RLS decide o que volta. As telas e a parte B do porte
// (custo de pessoal, configurações) montam as suas respostas daqui.

const esquemaMinutos = z.record(z.string(), z.number()).catch({});
/** jsonb de minutos por coluna do Secullum (abonos, extras). */
export const minutos = (v: unknown): Record<string, number> =>
  esquemaMinutos.parse(v ?? {});

const esquemaMemoria = z.object({
  linhas: z.array(
    z.object({ rotulo: z.string(), valor: z.number(), regra: z.string() }),
  ),
  pendencias: z.array(z.string()),
});
/** Memória de cálculo gravada com o custo (jsonb). */
export const lerMemoria = (v: unknown): MemoriaDoCusto =>
  esquemaMemoria.catch({ linhas: [], pendencias: [] }).parse(v);

const esquemaPendencias = z.array(z.string()).catch([]);

export interface Departamento {
  id: string;
  nome: string;
}

/** Departamentos ativos, por nome (filtros e listas). */
export async function departamentosAtivos(tx: Tx): Promise<Departamento[]> {
  return (await repo.departamentos(tx))
    .filter((d) => d.ativo)
    .map(({ id, nome }) => ({ id, nome }));
}

/** Meta vigente do indicador na competência, no formato do semáforo. */
export function metaDe(
  metas: Awaited<ReturnType<typeof repo.metas>>,
  indicador: string,
  competencia: string,
): Meta | null {
  const m = metaVigente(metas, indicador, competencia);
  return m
    ? { meta: m.meta, limiteAtencao: m.limite_atencao, direcao: m.direcao }
    : null;
}

// ---------------------------------------------------------------------------
// Ponto
// ---------------------------------------------------------------------------

/** Ponto do mês de todos, menos quem o RH tirou do ponto. */
export async function pontoDoMes(
  tx: Tx,
  competencia: string,
): Promise<LinhaPonto[]> {
  return (await repo.pontoMensal(tx, competencia)).map((l) => ({
    colaborador_id: l.colaborador_id,
    nome: l.nome,
    matricula: l.matricula,
    departamento_id: l.departamento_id,
    departamento: l.departamento ?? "Sem departamento",
    previstas_min: l.previstas_min,
    faltas_min: l.faltas_min,
    atrasos_min: l.atrasos_min,
    faltas_dias: l.faltas_dias,
    abonos_min: minutos(l.abonos_min),
    banco_saldo_min: l.banco_saldo_min,
    banco_creditos_min: l.banco_creditos_min,
    banco_debitos_min: l.banco_debitos_min,
    extras_min: minutos(l.extras_min),
    noturnas_min: l.noturnas_min,
    dsr_debito_min: l.dsr_debito_min,
  }));
}

/**
 * Ponto de um trecho já somado por pessoa no banco. `primeiro` é o primeiro
 * dia guardado no trecho (null sem nenhum).
 */
async function diasDoTrecho(
  tx: Tx,
  de: string,
  ate: string,
): Promise<{ linhas: LinhaPonto[]; primeiro: string | null }> {
  const somados = await repo.pontoDosDias(tx, de, ate);
  return {
    linhas: somados.map((l) =>
      linhaDosDias({
        ...l,
        departamento: l.departamento ?? "Sem departamento",
        abonos_min: minutos(l.abonos_min),
        extras_min: minutos(l.extras_min),
      }),
    ),
    primeiro: somados.reduce<string | null>(
      (m, l) => (m === null || l.primeiro_dia < m ? l.primeiro_dia : m),
      null,
    ),
  };
}

/**
 * Ponto de um período: meses inteiros pelo total do mês, pedaços de mês
 * pela soma dos dias (regras em @arp/shared/rh/ponto-periodo).
 */
export async function pontoDoPeriodo(
  tx: Tx,
  de: string,
  ate: string,
): Promise<PontoDoPeriodo> {
  const plano = planejarPonto({ de, ate }, ultimoDiaFechado());
  const semDias: TrechoDoPonto[] = [];
  const pedacos: { chave: string; linhas: LinhaPonto[] }[] = [];
  for (const c of plano.meses)
    pedacos.push({ chave: c, linhas: await pontoDoMes(tx, c) });
  for (const t of plano.trechos) {
    const { linhas, primeiro } = await diasDoTrecho(tx, t.de, t.ate);
    // Dias guardados só a partir de quando o ponto do dia começou a ser
    // gravado: o que vem antes fica de fora (e a tela avisa).
    if (primeiro === null) semDias.push(t);
    else if (primeiro > t.de)
      semDias.push({ ...t, ate: diaAnterior(primeiro) });
    pedacos.push({ chave: t.de, linhas });
  }
  pedacos.sort((a, b) => a.chave.localeCompare(b.chave));
  return {
    linhas: juntarPonto(pedacos.map((p) => p.linhas)),
    efetivo: plano.efetivo,
    semDias: semDias.sort((a, b) => a.de.localeCompare(b.de)),
  };
}

// ---------------------------------------------------------------------------
// Quadro
// ---------------------------------------------------------------------------

/**
 * Quadro e turnover: todos vêm do Copiloto RH, menos os sócios. Departamento
 * e cargo seguem do ponto e da folha.
 */
export async function colaboradoresDoQuadro(
  tx: Tx,
): Promise<ColaboradorQuadro[]> {
  const todos = await repo.colaboradores(tx);
  const deFora = await repo.socios(tx);
  return todos
    .filter((c) => !deFora.has(c.id))
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      matricula: c.matricula,
      departamento_id: c.departamento_id,
      departamento: c.departamento ?? "Sem departamento",
      admissao: c.admissao,
      desligamento: c.desligamento,
      motivo_desligamento: c.motivo_desligamento_copiloto,
      decisao_desligamento: c.decisao_desligamento_copiloto,
      tipo_turnover: c.desligamento
        ? tipoDoDesligamento(
            c.decisao_desligamento_copiloto,
            c.motivo_desligamento_copiloto,
          )
        : null,
      cargo: c.cargo,
      cargo_id: c.cargo_id,
      tipo_contrato: c.tipo_contrato,
    }));
}

// ---------------------------------------------------------------------------
// Banco de horas: ciclo, valor em R$ e salário/hora
// ---------------------------------------------------------------------------

type Empresa = Awaited<ReturnType<typeof repo.parametrosEmpresa>>;

export interface CicloVigente {
  inicio: string;
  fim: string;
  adicional: number;
}

/** Ciclo dos Parâmetros vigentes no mês de hoje (ou o primeiro cadastrado). */
export function cicloVigente(
  empresa: Empresa,
  agora = new Date(),
): CicloVigente | null {
  const p = vigenteEm(empresa, competenciaDe(agora)) ?? empresa[0];
  return p
    ? {
        inicio: p.banco_horas_inicio,
        fim: p.banco_horas_fim,
        adicional: p.banco_horas_adicional_pct,
      }
    : null;
}

/**
 * Adicional do banco de horas vigente no mês (Parâmetros); sem nenhum
 * vigente, o da primeira configuração (como rh.banco_horas_em_reais).
 */
export function adicionalDoBanco(
  empresa: Empresa,
  competencia: string,
): number | null {
  const p = vigenteEm(empresa, competencia) ?? empresa[0];
  return p ? p.banco_horas_adicional_pct : null;
}

export interface BancoEmReais {
  valor: number | null;
  positivo_min: number;
  semSalario: number;
  folha: string | null;
  adicional: number | null;
  porDepartamento: Map<string | null, number | null>;
}

/** Banco de horas positivo × salário/hora × (1 + adicional), por departamento. */
export async function bancoHorasEmReais(
  tx: Tx,
  competencia: string,
): Promise<BancoEmReais | null> {
  const data = await repo.bancoHorasEmReais(tx, competencia);
  if (!data.length) return null;
  const valores = data.map((d) => d.valor);
  return {
    valor: valores.some((v) => v === null)
      ? null
      : valores.reduce<number>((s, v) => s + (v ?? 0), 0),
    positivo_min: data.reduce((s, d) => s + d.positivo_min, 0),
    semSalario: data.reduce((s, d) => s + d.sem_salario, 0),
    folha: data[0]?.folha ?? null,
    adicional: data[0]?.adicional_pct ?? null,
    porDepartamento: new Map(
      data.map((d, i) => [d.departamento_id, valores[i] ?? null]),
    ),
  };
}

/** O Map vira lista de pares na resposta. */
export const bancoParaContrato = (b: BancoEmReais | null) =>
  b && { ...b, porDepartamento: [...b.porDepartamento] };

export interface ValorDaHora {
  /** Folha de onde vem o salário/hora: a última calculada até o mês. */
  folha: string | null;
  adicional: number | null;
  salarioHora: Map<string, number | null>;
}

/**
 * Salário/hora de cada pessoa e adicional do banco, para mostrar horas em R$
 * por pessoa (o RLS exige rh.custo_pessoal.individual).
 */
export async function valorDaHora(
  tx: Tx,
  competencia: string,
): Promise<ValorDaHora> {
  const folha = await repo.ultimaCompetenciaDeCusto(tx, competencia);
  const adicional = adicionalDoBanco(
    await repo.parametrosEmpresa(tx),
    competencia,
  );
  if (!folha) return { folha, adicional, salarioHora: new Map() };
  const linhas = await repo.salariosHora(tx, folha);
  return {
    folha,
    adicional,
    salarioHora: new Map(linhas.map((c) => [c.colaborador_id, c.salario_hora])),
  };
}

export const horaParaContrato = (h: ValorDaHora | null) =>
  h && { ...h, salarioHora: [...h.salarioHora] };

// ---------------------------------------------------------------------------
// Custo de pessoal
// ---------------------------------------------------------------------------

/**
 * Sócio (pró-labore) nunca entra no custo. O cálculo já o deixa de fora, mas
 * o custo gravado antes dessa regra (ou numa folha fechada) ainda o tem: as
 * leituras filtram também.
 */
const ehProLabore = (l: { tipo_contrato: string }) =>
  l.tipo_contrato === "pro_labore";

/** Somas por competência, departamento, cargo e contrato (rh.custo_pessoal). */
export async function custoAgregado(
  tx: Tx,
  inicio: string,
  fim: string,
): Promise<CustoAgregado[]> {
  return (await repo.custoAgregado(tx, inicio, fim)).filter(
    (l) => !ehProLabore(l),
  );
}

/** Custo de cada pessoa na competência (rh.custo_pessoal.individual). */
export async function custosIndividuais(
  tx: Tx,
  competencia: string,
): Promise<CustoIndividual[]> {
  const linhas = await repo.custosDaCompetencia(tx, competencia);
  const deFora = await repo.socios(tx);
  return linhas
    .filter((c) => !ehProLabore(c) && !deFora.has(c.colaborador_id))
    .map((c) => ({
      colaborador_id: c.colaborador_id,
      nome: c.nome ?? "—",
      matricula: c.matricula ?? null,
      departamento_id: c.departamento_id,
      departamento: c.departamento ?? "Sem departamento",
      cargo: c.cargo ?? "—",
      tipo_contrato: c.tipo_contrato,
      remuneracao: c.remuneracao,
      encargos: c.encargos,
      provisoes: c.provisao_13 + c.provisao_ferias + c.multa_rescisoria,
      beneficios: c.beneficios,
      rescisao: c.rescisao,
      custo_total: c.custo_total,
      custo_hora: c.custo_hora,
      salario_hora: c.salario_hora,
      jornada_min: c.jornada_min,
      valor_informado: c.valor_informado,
      // A memória inteira vem ao abrir o modal (memoriaDoCusto).
      pendencias: esquemaPendencias.parse(c.pendencias ?? []),
    }))
    .sort((a, b) => b.custo_total - a.custo_total);
}

/** Memória de cálculo de uma pessoa num mês; null sem custo. */
export async function memoriaDoCusto(
  tx: Tx,
  competencia: string,
  colaboradorId: string,
): Promise<MemoriaDoCusto | null> {
  const l = await repo.memoriaDoCusto(tx, competencia, colaboradorId);
  return l ? lerMemoria(l.memoria) : null;
}
