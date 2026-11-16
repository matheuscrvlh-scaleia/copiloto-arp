import {
  type EstadoDiario,
  type LinhaRelatorio,
  PARTES_DO_RELATORIO,
  partesDoRelatorio,
  respostaObraDoDiario,
  respostaRelatorioCompleto,
} from "@arp/shared/operacoes/contratos/diario";
import {
  lerResumo,
  type ObraDoDiario,
  type RelatorioDaLista,
} from "@arp/shared/operacoes/diario";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import { ErroDeNegocio, ErroDePermissao, ErroNaoEncontrado } from "@/erros";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import { diarioDeObras } from "../sync/credenciais.service";
import {
  cursorSchema,
  pedidoManual,
  rodandoDeVerdade,
} from "../sync/diario-de-obras.regras";
import {
  RECURSO_DIARIO,
  SISTEMA_DIARIO,
  sincronizarDiario,
} from "../sync/diario-de-obras.service";
import { SyncEmAndamento } from "../sync/execucao.service";
import { logOperacoes, podeAgora, podeAlguma } from "./apoio";
import * as repo from "./diario.repository";

// Leituras do Diário de Obra que o Painel e as telas do Diário usam. Com a
// sessão (RLS: operacoes.obras.diario).

const tarefasSchema = z
  .object({
    total: z.number(),
    naoIniciada: z.number(),
    emAndamento: z.number(),
    concluida: z.number(),
  })
  .nullable()
  .catch(null);

export function obraDaLinha(
  l: repo.LinhaDaObra,
): ObraDoDiario & { exemplo: boolean } {
  // Gravado pela sincronização depois de passar pelo schema do conector (já
  // transformado: não passa de novo pelo schema, que espera o formato cru
  // do aplicativo). Só confere que é um objeto.
  const ficha = respostaObraDoDiario.shape.obra.shape.ficha
    .catch(null)
    .parse(l.dados ?? null);
  return {
    id: l.id,
    nome: l.nome,
    statusId: l.status_id,
    grupo: l.grupo,
    responsavel: l.responsavel,
    dataInicio: l.data_inicio,
    dataFim: l.data_fim,
    prazo: {
      contratual: l.prazo_contratual,
      decorrido: l.prazo_decorrido,
      aVencer: l.prazo_a_vencer,
    },
    realizado: l.realizado === null ? null : Number(l.realizado),
    tarefas: tarefasSchema.parse(l.tarefas),
    ficha,
    exemplo: l.exemplo,
  };
}

/** Obras do aplicativo, datas dos relatórios e a última atualização. */
export function dadosDoPainel(ctx: Contexto): Promise<{
  obras: (ObraDoDiario & { exemplo: boolean })[];
  relatorios: RelatorioDaLista[];
  atualizadoEm: string | null;
}> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    obras: (await repo.obras(tx)).map(obraDaLinha),
    relatorios: (await repo.datasDosRelatorios(tx)).map((r) => ({
      id: r.id,
      obraId: r.obra_id,
      numero: r.numero,
      data: r.data,
      dataFim: r.data_fim,
      statusId: r.status_id,
    })),
    atualizadoEm: await repo.ultimaAtualizacao(tx),
  }));
}

// ---------------------------------------------------------------------------
// Telas do Diário (parte B). Os dados (cópia do aplicativo) vêm com a
// sessão, pelo RLS (operacoes.obras.diario ou operacoes.painel). O estado da
// consulta (integracao.*, só service role) é lido depois de conferir a mesma
// regra do RLS das tabelas diario_*.
// ---------------------------------------------------------------------------

function exigirDiario(ctx: Contexto): void {
  if (!podeAlguma(ctx, ["operacoes.obras.diario", "operacoes.painel"]))
    throw new ErroDePermissao("Sem acesso ao Diário de Obra.");
}

const empresaSchema = z
  .object({
    log: z.object({ ultimoRelatorio: z.string().nullish() }).nullish(),
  })
  .nullable()
  .catch(null);

/** Estado da consulta ao aplicativo (topo das telas e botão Atualizar agora). */
export async function estadoDoDiario(ctx: Contexto): Promise<EstadoDiario> {
  exigirDiario(ctx);
  const { credencial, runs, exemplo, empresa } = await banco.comoServico(
    async (tx) => ({
      credencial: await repo.credencial(tx, SISTEMA_DIARIO),
      runs: await repo.execucoes(tx, SISTEMA_DIARIO, RECURSO_DIARIO, 20),
      exemplo: await repo.temExemplo(tx),
      empresa: await repo.empresa(tx),
    }),
  );
  const boa = runs.find((r) => r.status === "sucesso");
  const terminada = runs.find((r) => r.status !== "rodando");
  const agora = new Date();
  const rodando = runs.find((r) => rodandoDeVerdade(r, agora));
  const cursor = boa ? cursorSchema.parse(boa.cursor_depois ?? {}) : null;
  return {
    configurado: credencial?.ativa === true,
    desativado: credencial?.ativa === false,
    ultima:
      boa?.finalizado_em && cursor
        ? {
            em: boa.finalizado_em,
            avisos: cursor.avisos,
            pendente: cursor.pendente,
          }
        : null,
    falha:
      terminada?.status === "erro" && terminada.finalizado_em
        ? { em: terminada.finalizado_em, erro: terminada.erro ?? "" }
        : null,
    rodando: rodando?.iniciado_em ?? null,
    exemplo,
    ultimoRelatorioNoApp:
      empresaSchema.parse(empresa)?.log?.ultimoRelatorio ?? null,
  };
}

/** Uma obra, com o cronograma. */
export async function obraDoDiario(ctx: Contexto, id: string) {
  const l = await banco.comoUsuario(ctx.usuario.id, (tx) => repo.obra(tx, id));
  if (!l) throw new ErroNaoEncontrado();
  // Gravado pela sincronização depois de passar pelo schema do conector.
  const cronograma = respostaObraDoDiario.shape.obra.shape.cronograma
    .catch(null)
    .parse(l.lista_de_tarefas ?? null);
  return { ...obraDaLinha(l), cronograma };
}

const linhaDoRelatorio = (r: repo.LinhaDoRelatorio): LinhaRelatorio => ({
  id: r.id,
  obraId: r.obra_id,
  obra: r.obra ?? "—",
  numero: r.numero,
  data: r.data,
  dataFim: r.data_fim,
  statusId: r.status_id,
  modelo: r.modelo,
  modeloId: r.modelo_id,
  autor: r.autor,
  autorCargo: r.autor_cargo,
  autorId: r.autor_id,
  app: r.app,
  criadoNoApp: r.criado_no_app,
  resumo: lerResumo(r.resumo),
  exemplo: r.exemplo,
});

/**
 * Relatórios do período (data entre de e até), com os filtros da API: obra,
 * status, modelo e autor. Mais novos primeiro.
 */
export async function relatoriosDoPeriodo(
  ctx: Contexto,
  f: {
    de: string;
    ate: string;
    obra?: string;
    status?: string;
    modelo?: string;
    autor?: string;
  },
): Promise<LinhaRelatorio[]> {
  const status = (f.status ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.relatoriosDoPeriodo(tx, { ...f, status }),
  );
  return linhas.map(linhaDoRelatorio);
}

/** Opções dos filtros de modelo e autor: as que aparecem nos relatórios guardados. */
export async function opcoesDosRelatorios(ctx: Contexto) {
  const linhas = await banco.comoUsuario(ctx.usuario.id, repo.modelosEAutores);
  const modelos = new Map<string, string>();
  const autores = new Map<string, string>();
  for (const l of linhas) {
    if (l.modelo_id && l.modelo) modelos.set(l.modelo_id, l.modelo);
    if (l.autor_id && l.autor) autores.set(l.autor_id, l.autor);
  }
  const ordenar = (m: Map<string, string>) =>
    [...m]
      .map(([valor, rotulo]) => ({ valor, rotulo }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  return { modelos: ordenar(modelos), autores: ordenar(autores) };
}

/** O relatório inteiro (Tela 4). */
export async function relatorioCompleto(ctx: Contexto, id: string) {
  const r = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.relatorio(tx, id),
  );
  if (!r) throw new ErroNaoEncontrado();
  return {
    ...linhaDoRelatorio(r),
    // Gravado pela sincronização depois de passar pelo schema do conector.
    dados: respostaRelatorioCompleto.shape.relatorio.shape.dados
      .catch(null)
      .parse(r.dados ?? null),
    detalhadoEm: r.detalhado_em,
  };
}

const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objetoOuNada = (v: unknown) =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? v : null;

/**
 * Pedaços do relatório completo de uma obra, no período (ou em todo o
 * histórico, sem período), do mais antigo ao mais novo. Só os campos
 * pedidos saem do banco.
 */
export async function partesDosRelatorios(
  ctx: Contexto,
  obraId: string,
  partes: string,
  periodo?: { de: string; ate: string },
) {
  const pedidas = partes
    .split(",")
    .filter((p): p is repo.Parte => PARTES_DO_RELATORIO.some((x) => x === p));
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.partes(tx, obraId, pedidas, periodo),
  );
  return linhas.map((l) => {
    const v: Record<string, unknown> = Object.fromEntries(Object.entries(l));
    return partesDoRelatorio.parse({
      id: l.id,
      numero: l.numero,
      data: l.data,
      ocorrencias: lista(v.ocorrencias),
      equipamentos: lista(v.equipamentos),
      material: objetoOuNada(v.material),
      galeria: lista(v.galeria),
      videos: lista(v.videos),
      anexos: lista(v.anexos),
      atividades: lista(v.atividades),
    });
  });
}

/**
 * "Atualizar agora": consulta o aplicativo Diário de Obra depois de
 * responder (pode levar minutos). Uma consulta por vez (trava da
 * sync_runs) e um intervalo mínimo desde a última, para não gastar a cota
 * de 150 consultas por minuto da empresa.
 */
export async function atualizarAgora(ctx: Contexto): Promise<string> {
  if (!(await podeAgora(ctx, "operacoes.obras.atualizar")))
    throw new ErroDePermissao("Sem permissão para atualizar o Diário de Obra.");
  try {
    await diarioDeObras();
  } catch (erro) {
    throw new ErroDeNegocio(
      erro instanceof Error
        ? `${erro.message}.`
        : "Configure o Diário de Obra em Administração › Integrações.",
    );
  }
  let ultima: Awaited<ReturnType<typeof repo.execucoes>>[number] | undefined;
  try {
    [ultima] = await banco.comoServico((tx) =>
      repo.execucoes(tx, SISTEMA_DIARIO, RECURSO_DIARIO, 1),
    );
  } catch {
    throw new ErroDeNegocio(
      "Não deu para ler a última consulta. Tente de novo.",
    );
  }
  const pedido = pedidoManual(ultima ?? null, new Date());
  if (!pedido.pode)
    throw new ErroDeNegocio(
      pedido.motivo === "andamento"
        ? "Já há uma consulta em andamento. Aguarde terminar."
        : `A última consulta terminou há pouco. Tente de novo em ${pedido.faltaMin} min.`,
    );
  if (pedido.interrompida && ultima) {
    // A consulta morreu no meio: fica registrada como erro (como executar()
    // faz) para liberar a trava da sync_runs. Só a que ainda está "rodando".
    const id = ultima.id;
    try {
      await banco.comoServico((tx) => repo.marcarInterrompida(tx, id));
    } catch {
      throw new ErroDeNegocio(
        "Não deu para liberar a consulta anterior. Tente de novo.",
      );
    }
  }

  logOperacoes(
    ctx,
    "operacoes_diario_atualizado",
    "Pediu a atualização do Diário de Obra",
    { sistema: SISTEMA_DIARIO },
  );
  void sincronizarDiario().catch((erro: unknown) => {
    // Outra consulta começou ao mesmo tempo: a trava segurou, nada a fazer.
    if (erro instanceof SyncEmAndamento) return;
    // O erro fica registrado em integracao.sync_runs (aviso no topo das telas).
    log.error({ err: erro }, "sync diário de obra (manual)");
  });
  return "Consulta ao Diário de Obra iniciada. Leva alguns minutos; recarregue a tela para ver os dados novos.";
}
