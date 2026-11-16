import type {
  AlteracaoDeParametro,
  HidrometroCadastrado,
  SalaCadastrada,
  UnidadeDeEnergia,
} from "@arp/shared/operacoes/contratos/base";
import {
  type ColunasNosGrupos,
  mudancasDosParametros,
} from "@arp/shared/operacoes/parametros";
import type { Contexto } from "@/contexto";
import { exigir } from "@/contexto";
import { banco } from "@/infra/banco";
import type { OperacoesParametros } from "@/infra/banco/tipos";
import { exigirModulo, nomesDeUsuarios, parametrosDoModulo } from "./apoio";
import * as repo from "./base.repository";

// Base de Operações: parâmetros, cadastros e as leituras extras da tela de
// Parâmetros (histórico, exemplos, unidades da Energisa).

// Toda coluna de operacoes.parametros tem lugar num grupo da tela de
// Parâmetros: coluna nova (de qualquer migration) sem campo lá quebra o
// typecheck.
type Colunas = Exclude<
  keyof OperacoesParametros,
  "id" | "atualizado_em" | "atualizado_por"
>;
export const TODAS_AS_COLUNAS: [Exclude<Colunas, ColunasNosGrupos>] extends [
  never,
]
  ? true
  : Exclude<Colunas, ColunasNosGrupos> = true;

export function parametros(ctx: Contexto) {
  return parametrosDoModulo(ctx);
}

/** Hidrômetros do cadastro, com o RLS decidindo quem vê. */
export function hidrometros(ctx: Contexto): Promise<HidrometroCadastrado[]> {
  exigirModulo(ctx);
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const lista = await repo.hidrometros(tx);
    const porNumero = new Map(
      (await repo.leiturasPorHidrometro(tx)).map((l) => [l.hidrometro, l]),
    );
    return lista.map((h) => ({
      ...h,
      ultimaLeitura: porNumero.get(h.numero)?.ultima ?? null,
      meses: porNumero.get(h.numero)?.meses ?? 0,
    }));
  });
}

export function salas(ctx: Contexto): Promise<SalaCadastrada[]> {
  exigirModulo(ctx);
  return banco.comoUsuario(ctx.usuario.id, async (tx) =>
    (await repo.salas(tx)).map((s) => ({ ...s, caixas: s.caixas ?? 0 })),
  );
}

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v))
    : null;

/**
 * Últimas alterações (quem, quando, antes e depois). O RLS de
 * core.auditoria não abre operacoes.* a quem não administra: service role
 * depois de conferir no banco a permissão que edita os parâmetros.
 */
export async function historicoDosParametros(
  ctx: Contexto,
  limite = 60,
): Promise<AlteracaoDeParametro[]> {
  await exigir(ctx, "operacoes.parametros");
  const linhas = await banco.comoServico((tx) =>
    repo.historicoDosParametros(tx, limite),
  );
  const nomes = await nomesDeUsuarios(
    ctx,
    linhas.map((l) => l.usuario_id),
    ["operacoes.parametros"],
  );
  return linhas
    .map((l) => ({
      id: l.id,
      em: l.em,
      autor: l.usuario_id
        ? (nomes.get(l.usuario_id) ?? "Usuário removido")
        : "Sistema",
      mudancas: mudancasDosParametros(objeto(l.antes), objeto(l.depois)),
    }))
    .filter((a) => a.mudancas.length > 0);
}

/** Tabelas que operacoes.remover_exemplos() limpa, com o nome na tela. */
const COM_EXEMPLO = [
  ["importacoes", "Importações"],
  ["agua_leituras", "Leituras de água"],
  ["energia_faturas", "Faturas da Energisa"],
  ["quadros", "Quadros de energia"],
  ["salas", "Salas"],
  ["limpeza_meses", "Meses do rateio da limpeza"],
  ["obras", "Obras"],
  ["orcamento_revisoes", "Revisões de orçamento"],
  ["obra_realizado", "Lançamentos de realizado"],
] as const;

/** Quantas linhas de exemplo ainda existem em cada tabela. */
export async function dadosDeExemplo(ctx: Contexto) {
  await exigir(ctx, "operacoes.parametros");
  return banco.comoServico(async (tx) => {
    const contagens: { tabela: string; nome: string; linhas: number }[] = [];
    for (const [tabela, nome] of COM_EXEMPLO)
      contagens.push({
        tabela,
        nome,
        linhas: await repo.exemplosDe(tx, tabela),
      });
    return contagens.filter((c) => c.linhas > 0);
  });
}

/**
 * Unidades consumidoras da Energisa (Parâmetros › Energia). Quem edita os
 * parâmetros também edita as unidades: service role depois de conferir.
 */
export async function unidadesDeEnergia(
  ctx: Contexto,
): Promise<UnidadeDeEnergia[]> {
  await exigir(ctx, "operacoes.parametros");
  return banco.comoServico(repo.unidadesDeEnergia);
}
