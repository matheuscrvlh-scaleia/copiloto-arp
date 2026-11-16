import type {
  Aviso,
  ModuloComFiltros,
  NotificacaoDoSino,
} from "@arp/shared/contratos/casca";
import { competenciaDe, formatarMes } from "@arp/shared/formato";
import { INDICADORES_RH, metaVigente } from "@arp/shared/indicadores";
import { type Contexto, pode } from "@/contexto";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import * as repo from "./casca.repository";

// O que o menu mostra a qualquer pessoa logada: pendências (avisos), o sino
// e os filtros lembrados. Tudo lido com a sessão de quem pede (o RLS vale).

/** Telas de RH › Configurações onde cada pendência se resolve. */
const CONFIGURACOES_RH = {
  importacoes: "/rh/configuracoes/importacoes",
  cadastros: "/rh/configuracoes/cadastros",
  parametros: "/rh/configuracoes/parametros",
} as const;

/**
 * Pendências reais do sistema, só para quem pode resolvê-las. Cada consulta
 * só roda para quem tem a permissão do aviso.
 */
export async function avisosDo(ctx: Contexto): Promise<Aviso[]> {
  const veFolha = pode(ctx, "rh.folha");
  const veParametros = pode(ctx, "rh.parametros");
  if (!veFolha && !veParametros) return [];

  const hoje = new Date();
  const mesAnterior = competenciaDe(
    new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1),
  );
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    rubricas: await repo.rubricasNaoClassificadas(tx),
    temFolha: veFolha ? await repo.folhaExiste(tx, mesAnterior) : null,
    temEmpresa: veParametros ? await repo.temParametrosDaEmpresa(tx) : null,
    metas: veParametros ? await repo.metasDoRh(tx) : null,
    provisorios: veParametros ? await repo.departamentosProvisorios(tx) : null,
  }));

  const avisos: Aviso[] = [];
  if (lido.rubricas) {
    avisos.push({
      id: "rubricas",
      titulo: `${lido.rubricas} rubrica${lido.rubricas > 1 ? "s" : ""} para classificar`,
      descricao: "Vieram na folha e ainda não dizem como entram no custo.",
      href: `${CONFIGURACOES_RH.importacoes}#rubricas-novas`,
    });
  }
  if (lido.temFolha === false) {
    avisos.push({
      id: "folha",
      titulo: `Folha de ${formatarMes(mesAnterior)} não importada`,
      descricao: "Envie o Extrato Mensal da Sousa e Couto.",
      href: CONFIGURACOES_RH.importacoes,
    });
  }
  if (lido.temEmpresa === false) {
    avisos.push({
      id: "empresa",
      titulo: "RAT, FAP e banco de horas não configurados",
      descricao: "Necessários para o cálculo dos encargos.",
      href: CONFIGURACOES_RH.parametros,
    });
  }
  if (lido.metas) {
    const competencia = competenciaDe(hoje);
    const metas = lido.metas;
    const semMeta = Object.keys(INDICADORES_RH).filter(
      (i) => !metaVigente(metas, i, competencia),
    ).length;
    if (semMeta) {
      avisos.push({
        id: "metas",
        titulo: `${semMeta} indicador${semMeta > 1 ? "es" : ""} sem meta`,
        descricao:
          "Sem meta, o semáforo não mostra Ok, Atenção ou fora da meta.",
        href: `${CONFIGURACOES_RH.parametros}#metas`,
      });
    }
  }
  if (lido.provisorios) {
    avisos.push({
      id: "departamentos",
      titulo: `${lido.provisorios} departamento${lido.provisorios > 1 ? "s" : ""} para renomear`,
      descricao: "Criados pela importação da folha como “Departamento N”.",
      href: `${CONFIGURACOES_RH.cadastros}#departamentos`,
    });
  }
  return avisos;
}

// Sininho: as notificações do Tickets e os lembretes do Comercial (ambos em
// os.notificacoes).
const MODULOS_DO_SINO = ["os.", "comercial."];

/** Não lidas mais recentes de quem está logado (vazio sem Tickets nem Comercial). */
export async function minhasNotificacoes(
  ctx: Contexto,
): Promise<NotificacaoDoSino[]> {
  const temModulo = [...ctx.permissoes].some((p) =>
    MODULOS_DO_SINO.some((m) => p.startsWith(m)),
  );
  if (!temModulo) return [];
  try {
    return await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.notificacoesNaoLidas(tx, ctx.usuario.id),
    );
  } catch (err) {
    // O sino nunca derruba o menu.
    log.error({ err }, "notificações");
    return [];
  }
}

export async function marcarNotificacaoLida(
  ctx: Contexto,
  id: number,
): Promise<void> {
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.marcarLida(tx, ctx.usuario.id, id),
  );
}

export async function marcarTodasLidas(ctx: Contexto): Promise<void> {
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.marcarLida(tx, ctx.usuario.id),
  );
}

// Filtros lembrados de cada pessoa por tela (spec 4.3), em core.preferencias
// com a chave "<modulo>.filtros.<tela>" (RLS: só as da própria pessoa).
const chaveDosFiltros = (modulo: ModuloComFiltros, tela: string) =>
  `${modulo}.filtros.${tela}`;

/** A query lembrada da tela, ou null. Nunca falha a tela. */
export async function filtrosLembrados(
  ctx: Contexto,
  modulo: ModuloComFiltros,
  tela: string,
): Promise<string | null> {
  try {
    const p = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.preferencia(tx, chaveDosFiltros(modulo, tela)),
    );
    return typeof p?.valor === "string" && p.valor ? p.valor : null;
  } catch (err) {
    log.error({ err, modulo }, "preferências");
    return null;
  }
}

/** Grava os últimos filtros da pessoa na tela; vazio apaga (botão Limpar). */
export async function lembrarFiltros(
  ctx: Contexto,
  modulo: ModuloComFiltros,
  tela: string,
  query: string,
): Promise<void> {
  const chave = chaveDosFiltros(modulo, tela);
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    query
      ? repo.gravarPreferencia(tx, ctx.usuario.id, chave, query)
      : repo.apagarPreferencia(tx, ctx.usuario.id, chave),
  );
}
