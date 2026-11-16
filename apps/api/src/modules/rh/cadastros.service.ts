import { competenciaDe, formatarMes } from "@arp/shared/formato";
import { INDICADORES_RH } from "@arp/shared/indicadores";
import { entradaFinanceiro } from "@arp/shared/rh/contratos/beneficios";
import {
  alvoJornada,
  entradaDepartamento,
  entradaEmpresa,
  entradaEncargos,
  entradaGrupoRubrica,
  entradaJornada,
  entradaMeta,
  type RespostaCadastros,
} from "@arp/shared/rh/contratos/cadastros";
import { GRUPOS_RUBRICA } from "@arp/shared/rh/rubricas";
import type { Contexto } from "@/contexto";
import { ErroDeNegocio } from "@/erros";
import { banco } from "@/infra/banco";
import { exigirComMensagem, validarFormulario } from "./apoio";
import * as repo from "./cadastros.repository";
import { recalcularEmAberto, tentarRecalcular } from "./custo.service";
import * as dados from "./dados.repository";

// Configurações › Cadastros (faturamento, departamentos, rubricas) e as
// gravações de › Parâmetros (acoes/cadastros.ts e acoes/parametros.ts do
// antigo). Toda gravação passa pelo RLS (rh.parametros) e cai em
// core.auditoria. Parâmetros com vigência gravam a partir do mês atual:
// meses passados continuam calculados com o valor da época. O recálculo do
// custo usa a service role: a permissão é conferida antes no banco.

const SEM_PERMISSAO_CADASTRO =
  "Você não tem permissão para alterar este cadastro.";
const SEM_PERMISSAO_PARAMETROS =
  "Você não tem permissão para alterar parâmetros.";

/** GET /rh/cadastros: faturamento do mês, departamentos e rubricas. */
export function cadastros(ctx: Contexto): Promise<RespostaCadastros> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    financeiros: await dados.dadosFinanceiros(tx),
    departamentos: await dados.departamentos(tx),
    rubricas: await dados.rubricas(tx),
  }));
}

export async function salvarDepartamento(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<void> {
  const d = validarFormulario(entradaDepartamento, campos);
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.salvarDepartamento(tx, d.id, {
      nome: d.nome,
      codigo_folha: d.codigo_folha,
    }),
  );
}

/** Troca o grupo e recalcula as folhas em aberto (fechada não muda). */
export async function trocarGrupoRubrica(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<string> {
  await exigirComMensagem(ctx, ["rh.parametros"], SEM_PERMISSAO_CADASTRO);
  const r = validarFormulario(entradaGrupoRubrica, campos, {
    codigo: "Rubrica",
    grupo: "Grupo",
  });
  const mudou = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.trocarGrupo(tx, r.codigo, r.grupo, ctx.usuario.id),
  );
  if (!mudou) throw new ErroDeNegocio("Rubrica não encontrada.");
  const calculado = await tentarRecalcular(() => recalcularEmAberto());
  const ok = `Rubrica ${r.codigo} agora em “${GRUPOS_RUBRICA[r.grupo]}”.`;
  return calculado
    ? `${ok} Folhas em aberto recalculadas.`
    : `${ok} O custo não foi recalculado: use Recalcular em Custo de pessoal.`;
}

/** Faturamento e dados financeiros do mês (manual até o ENET). */
export async function salvarFinanceiro(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<string> {
  const f = validarFormulario(entradaFinanceiro, campos, {
    competencia: "Mês",
    faturamento_bruto: "Faturamento bruto",
    custo_despesa_total: "Custo + despesa total",
    custos_operacionais_sem_pessoal: "Custos sem pessoal",
    lucro: "Lucro",
  });
  const competencia = `${f.competencia}-01`;
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.salvarFinanceiro(tx, { ...f, competencia }),
  );
  return `Dados de ${formatarMes(competencia)} salvos.`;
}

// ---------------------------------------------------------------------------
// Parâmetros
// ---------------------------------------------------------------------------

/** Jornada, RAT/FAP e encargos mudam o custo: recalcula as folhas em aberto. */
async function salvoERecalculado(): Promise<string> {
  const ok = await tentarRecalcular(() => recalcularEmAberto());
  return ok
    ? "Salvo. Custo de pessoal recalculado."
    : "Salvo, mas o custo não foi recalculado. Use Recalcular em Custo de pessoal.";
}

/** Jornada em níveis (rh.jornadas). Muda o custo por hora: recalcula. */
export async function salvarJornada(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<string> {
  await exigirComMensagem(ctx, ["rh.parametros"], SEM_PERMISSAO_PARAMETROS);
  const j = validarFormulario(entradaJornada, campos);
  const horas = j.horas ?? 0;
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.salvarJornada(
      tx,
      j.alvo,
      Math.round(horas * 60),
      competenciaDe(new Date()),
    ),
  );
  return salvoERecalculado();
}

/**
 * Tira a jornada de um nível (todas as vigências): quem ele cobria passa a
 * seguir o nível de cima. Meses fechados mantêm o custo já gravado.
 */
export async function removerJornada(
  ctx: Contexto,
  alvo: string,
): Promise<string> {
  await exigirComMensagem(ctx, ["rh.parametros"], SEM_PERMISSAO_PARAMETROS);
  const a = validarFormulario(alvoJornada, alvo);
  await banco.comoUsuario(ctx.usuario.id, (tx) => repo.removerJornada(tx, a));
  return salvoERecalculado();
}

export async function salvarMeta(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<void> {
  const m = validarFormulario(entradaMeta, campos);
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.salvarMeta(tx, {
      indicador: m.indicador,
      direcao: INDICADORES_RH[m.indicador].direcao,
      meta: m.meta ?? 0,
      limite_atencao: m.limite_atencao ?? null,
      vigente_desde: competenciaDe(new Date()),
    }),
  );
}

export async function salvarEmpresa(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<string> {
  await exigirComMensagem(ctx, ["rh.parametros"], SEM_PERMISSAO_PARAMETROS);
  const e = validarFormulario(entradaEmpresa, campos);
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.salvarEmpresa(tx, {
      vigente_desde: competenciaDe(new Date()),
      regime_tributario: e.regime_tributario || null,
      rat_pct: e.rat_pct ?? 0,
      fap: e.fap ?? 0,
      banco_horas_inicio: e.banco_horas_inicio,
      banco_horas_fim: e.banco_horas_fim,
      banco_horas_adicional_pct: e.banco_horas_adicional_pct ?? 0,
    }),
  );
  return salvoERecalculado();
}

const SEM_ENCARGOS = {
  inss_patronal_pct: 0,
  terceiros_pct: 0,
  fgts_pct: 0,
  multa_rescisoria_pct: 0,
  aplica_rat: false,
};

export async function salvarEncargos(
  ctx: Contexto,
  campos: Record<string, unknown>,
): Promise<string> {
  await exigirComMensagem(ctx, ["rh.parametros"], SEM_PERMISSAO_PARAMETROS);
  const d = validarFormulario(entradaEncargos, campos);
  const valores =
    d.tipo_contrato === "estagiario"
      ? {
          ...SEM_ENCARGOS,
          provisiona_13: false,
          provisiona_ferias: false,
          provisiona_recesso: d.provisiona_recesso,
        }
      : d.tipo_contrato === "pj"
        ? {
            ...SEM_ENCARGOS,
            provisiona_13: d.provisiona_13,
            provisiona_ferias: d.provisiona_ferias,
            provisiona_recesso: false,
          }
        : {
            inss_patronal_pct: d.inss_patronal_pct ?? 0,
            terceiros_pct: d.terceiros_pct ?? 0,
            fgts_pct: d.fgts_pct ?? 0,
            multa_rescisoria_pct: d.multa_rescisoria_pct ?? 0,
            aplica_rat: d.aplica_rat,
            provisiona_13: d.provisiona_13,
            provisiona_ferias: d.provisiona_ferias,
            provisiona_recesso: false,
          };
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.salvarEncargos(tx, {
      tipo_contrato: d.tipo_contrato,
      vigente_desde: competenciaDe(new Date()),
      ...valores,
    }),
  );
  return salvoERecalculado();
}
