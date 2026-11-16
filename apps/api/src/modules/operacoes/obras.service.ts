import type {
  DadosDaObra,
  ObraLinha,
  Revisao,
} from "@arp/shared/operacoes/contratos/obras";
import { centavosDe, type ValorMes } from "@arp/shared/operacoes/obras";
import type { AvisoOrcamento } from "@arp/shared/operacoes/orcamento";
import type { Contexto } from "@/contexto";
import { linksDeLeitura } from "@/infra/arquivos";
import { banco } from "@/infra/banco";
import { BUCKET, lerParametros, nomesDeUsuarios, podeAgora } from "./apoio";
import * as repo from "./obras.repository";

// Leituras das Obras — previsto e realizado (spec 4.9). Dado de negócio:
// com a sessão (RLS de operacoes.obras.ver).
//
// Uma revisão só vale quando a importação dela foi confirmada (as linhas da
// prévia já ficam gravadas, com vigente = false). Do mesmo jeito, o
// realizado trazido por uma planilha só conta depois da confirmação.

/** Validade do link de anexo e da planilha (segundos). */
const LINK_SEGUNDOS = 3600;

/** A linha vale: sem importação (tela) ou com a importação confirmada. */
const valeImportacao = (importacaoId: string | null, status: string | null) =>
  !importacaoId || status === "confirmada";

function avisosDe(j: unknown): AvisoOrcamento[] {
  if (!Array.isArray(j)) return [];
  return j.flatMap((a: unknown) => {
    if (!a || typeof a !== "object" || Array.isArray(a)) return [];
    const o = Object.fromEntries(Object.entries(a));
    if (typeof o.mensagem !== "string") return [];
    const nivel =
      o.nivel === "erro" || o.nivel === "aviso" || o.nivel === "info"
        ? o.nivel
        : "aviso";
    return [
      {
        nivel,
        mensagem: o.mensagem,
        ...(typeof o.linha === "number" ? { linha: o.linha } : {}),
      },
    ];
  });
}

function revisaoDe(r: repo.LinhaRevisao): Revisao {
  const status = r.importacao_id ? (r.importacao_status ?? null) : null;
  return {
    id: r.id,
    codigo: r.codigo,
    data: r.data,
    titulo: r.titulo,
    total: centavosDe(Number(r.total)),
    totalArquivo:
      r.total_arquivo === null ? null : centavosDe(Number(r.total_arquivo)),
    // Vigente só com a importação confirmada (ou sem importação).
    vigente: r.vigente && (status === null || status === "confirmada"),
    exemplo: r.exemplo,
    importacaoId: r.importacao_id,
    status,
    avisos: avisosDe(r.importacao_avisos),
    importadaEm: r.importacao_confirmada_em ?? r.criado_em,
  };
}

const valorMes = (r: { mes: string; valor: number }): ValorMes => ({
  mes: r.mes,
  centavos: centavosDe(Number(r.valor)),
});

/** Todas as obras com a revisão vigente, o previsto dela e o realizado. */
export async function obrasComValores(ctx: Contexto): Promise<ObraLinha[]> {
  const { obras, revisoes, previsto, realizado } = await banco.comoUsuario(
    ctx.usuario.id,
    async (tx) => ({
      obras: await repo.obras(tx),
      revisoes: await repo.revisoesVigentes(tx),
      previsto: await repo.previstoVigente(tx),
      realizado: await repo.realizado(tx),
    }),
  );

  const vigentes = new Map<string, Revisao>();
  for (const r of revisoes) {
    const rev = revisaoDe(r);
    if (rev.vigente) vigentes.set(r.obra_id, rev);
  }
  const previstoDaRevisao = new Map<string, ValorMes[]>();
  for (const p of previsto) {
    const lista = previstoDaRevisao.get(p.revisao_id) ?? [];
    lista.push(valorMes(p));
    previstoDaRevisao.set(p.revisao_id, lista);
  }
  const realizadoDaObra = new Map<string, ValorMes[]>();
  const ultimo = new Map<string, string>();
  for (const r of realizado) {
    if (!valeImportacao(r.importacao_id, r.importacao_status)) continue;
    const lista = realizadoDaObra.get(r.obra_id) ?? [];
    lista.push(valorMes(r));
    realizadoDaObra.set(r.obra_id, lista);
    if ((ultimo.get(r.obra_id) ?? "") < r.lancado_em)
      ultimo.set(r.obra_id, r.lancado_em);
  }

  return obras.map((o) => {
    const vigente = vigentes.get(o.id) ?? null;
    return {
      id: o.id,
      nome: o.nome,
      responsavel: o.responsavel,
      ativa: o.ativa,
      exemplo: o.exemplo,
      diarioObraId: o.diario_obra_id,
      vigente,
      previsto: vigente ? (previstoDaRevisao.get(vigente.id) ?? []) : [],
      realizado: realizadoDaObra.get(o.id) ?? [],
      ultimoLancamento: ultimo.get(o.id) ?? null,
    };
  });
}

/** Obra com as revisões, as etapas de todas elas e o realizado. null: não existe ou sem acesso. */
export async function dadosDaObra(
  ctx: Contexto,
  id: string,
): Promise<DadosDaObra | null> {
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const o = await repo.obra(tx, id);
    if (!o) return null;
    return {
      o,
      revisoes: await repo.revisoesDaObra(tx, id),
      etapas: await repo.etapasDaObra(tx, id),
      realizado: await repo.realizadoDaObra(tx, id),
      p: await lerParametros(tx),
    };
  });
  if (!lido) return null;
  const { o, revisoes, etapas, realizado, p } = lido;

  const validos = realizado.filter((r) =>
    valeImportacao(r.importacao_id, r.importacao_status),
  );
  const nomes = await nomesDeUsuarios(
    ctx,
    validos.map((r) => r.lancado_por),
    ["operacoes.obras.ver"],
  );
  const links = await linksDeLeitura(
    BUCKET,
    validos.flatMap((r) => (r.anexo ? [r.anexo] : [])),
    LINK_SEGUNDOS,
  );

  return {
    obra: {
      id: o.id,
      nome: o.nome,
      responsavel: o.responsavel,
      ativa: o.ativa,
      exemplo: o.exemplo,
      diarioObraId: o.diario_obra_id,
    },
    revisoes: revisoes.map(revisaoDe),
    etapas: etapas.map((e) => ({
      revisaoId: e.revisao_id,
      ordem: e.ordem,
      nome: e.nome,
      observacao: e.observacao,
      previsto: e.previsto.map(valorMes),
    })),
    lancamentos: validos.map((r) => ({
      id: r.id,
      etapa: r.etapa,
      mes: r.mes,
      centavos: centavosDe(Number(r.valor)),
      descricao: r.descricao,
      anexo: r.anexo,
      link: r.anexo ? (links.get(r.anexo) ?? null) : null,
      origem: r.origem === "planilha" ? "planilha" : "tela",
      exemplo: r.exemplo,
      lancadoPor: r.lancado_por
        ? (nomes.get(r.lancado_por) ?? "Usuário removido")
        : r.exemplo
          ? "Exemplo"
          : "—",
      lancadoEm: r.lancado_em,
    })),
    limites: {
      desvioPontos: Number(p.obras_limite_desvio),
      orcamentoPct: Number(p.obras_limite_orcamento_pct),
    },
  };
}

/**
 * Obras do Diário de Obra para o vínculo. Quem liga é quem importa o
 * orçamento, que pode não ter a permissão do Diário: só id e nome, pela
 * service role, depois de conferir operacoes.obras.importar no banco.
 */
export async function obrasDoDiario(
  ctx: Contexto,
): Promise<{ id: string; nome: string }[]> {
  if (!(await podeAgora(ctx, "operacoes.obras.importar"))) return [];
  return banco.comoServico(repo.obrasDoDiario);
}

/**
 * Obra do orçamento ligada a uma obra do Diário de Obra, para o atalho da
 * ficha do Diário. Com a sessão (RLS de operacoes.obras.ver).
 */
export function obraLigadaAoDiario(ctx: Contexto, diarioObraId: string) {
  return banco
    .comoUsuario(ctx.usuario.id, (tx) => repo.obraLigada(tx, diarioObraId))
    .then((o) => o ?? null);
}

/** Obras para a lista do componente de importação. */
export function obrasParaImportar(ctx: Contexto) {
  return banco.comoUsuario(ctx.usuario.id, async (tx) =>
    (await repo.obras(tx)).map((o) => ({ id: o.id, nome: o.nome })),
  );
}
