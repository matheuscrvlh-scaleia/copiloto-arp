import type { Evento } from "@arp/shared/historico";
import {
  TIPOS_IMPORTACAO,
  type TipoImportacao,
  textoDaReferencia,
} from "@arp/shared/operacoes/importacoes";
import type { Permissao } from "@arp/shared/permissions";
import { sql } from "kysely";
import type { z } from "zod";
import { type Contexto, pode } from "@/contexto";
import { ErroDePermissao, ErroDeValidacao, ErroNaoEncontrado } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import { registrarDepois } from "@/infra/eventos";

// Apoio do módulo Operações (o `base.ts` e o `historico.ts` do sistema
// antigo): o acesso ao módulo, a linha de parâmetros, a permissão conferida
// no banco, o nome das pessoas e os eventos do histórico do sistema.

export const BUCKET = "operacoes" as const;

/** Mesmo acesso que o RLS exige dos parâmetros (operacoes.acessa). */
export function exigirModulo(ctx: Contexto): void {
  if (![...ctx.permissoes].some((p) => p.startsWith("operacoes.")))
    throw new ErroDePermissao("Sem acesso ao módulo Operações.");
}

/** Alguma das permissões (lidas nesta requisição). */
export function podeAlguma(ctx: Contexto, lista: Permissao[]): boolean {
  return lista.some((p) => pode(ctx, p));
}

/** Confere a permissão AGORA no banco (o `podeAgora` do sistema antigo). */
export function podeAgora(
  ctx: Contexto,
  permissao: Permissao,
): Promise<boolean> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const r = await sql<{
      pode: boolean;
    }>`select core.pode(${permissao}) as pode`.execute(tx);
    return r.rows[0]?.pode === true;
  });
}

/** operacoes.parametros (linha única). Quem chama já conferiu o acesso. */
export async function lerParametros(tx: Tx) {
  const p = await tx
    .selectFrom("operacoes.parametros")
    .selectAll()
    .where("id", "=", true)
    .executeTakeFirst();
  if (!p)
    throw new ErroNaoEncontrado("Parâmetros de Operações não encontrados.");
  return p;
}
export type LinhaDeParametros = Awaited<ReturnType<typeof lerParametros>>;

/** Parâmetros do módulo: service role depois de conferir o acesso do RLS. */
export function parametrosDoModulo(ctx: Contexto) {
  exigirModulo(ctx);
  return banco.comoServico(lerParametros);
}

/**
 * Nome de cada pessoa (quem confirmou, corrigiu, emitiu). Primeiro pela
 * sessão; os que o RLS de core.usuarios esconde vêm pela service role, só
 * para ids que a pessoa já leu pelo RLS e depois de conferir no banco uma
 * das permissões dadas.
 */
export async function nomesDeUsuarios(
  ctx: Contexto,
  ids: (string | null | undefined)[],
  podeVer: Permissao[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  const nomes = new Map<string, string>();
  if (!unicos.length) return nomes;
  const ler = (tx: Tx, lista: string[]) =>
    tx
      .selectFrom("core.usuarios")
      .select(["id", "nome"])
      .where("id", "in", lista)
      .execute();
  for (const u of await banco.comoUsuario(ctx.usuario.id, (tx) =>
    ler(tx, unicos),
  ))
    nomes.set(u.id, u.nome);
  const faltam = unicos.filter((i) => !nomes.has(i));
  if (!faltam.length) return nomes;
  let liberado = false;
  for (const p of podeVer)
    if (await podeAgora(ctx, p)) {
      liberado = true;
      break;
    }
  if (!liberado) return nomes;
  for (const u of await banco.comoServico((tx) => ler(tx, faltam)))
    nomes.set(u.id, u.nome);
  return nomes;
}

// ---------------------------------------------------------------------------
// Histórico do sistema (core.logs). Chame só depois do sucesso da ação. Nos
// detalhes, nunca nome nem documento de locatário.
// ---------------------------------------------------------------------------

type Detalhes = Record<string, JsonValue | undefined>;

export function logOperacoes(
  ctx: Contexto,
  evento: Evento,
  descricao: string,
  detalhes: Detalhes = {},
): void {
  registrarDepois({
    modulo: "operacoes",
    evento,
    descricao,
    usuarioId: ctx.usuario.id,
    detalhes,
  });
}

const VERBO = {
  confirmou: "Confirmou a importação de",
  desfez: "Desfez a importação de",
  descartou: "Descartou a prévia de",
} as const;

/**
 * Confirmar, desfazer ou descartar a prévia de uma importação. Descartar a
 * prévia usa o mesmo evento de desfazer. Ex.: "Confirmou a importação de
 * Água · set/2026 (marcada incompleta)".
 */
export function logImportacaoOp(
  ctx: Contexto,
  acao: keyof typeof VERBO,
  imp: { id: string; tipo: TipoImportacao; referencia?: string | null },
  extra?: string,
  detalhes: Detalhes = {},
): void {
  const ref = imp.referencia ? ` · ${textoDaReferencia(imp.referencia)}` : "";
  logOperacoes(
    ctx,
    acao === "confirmou"
      ? "operacoes_importacao_confirmada"
      : "operacoes_importacao_desfeita",
    `${VERBO[acao]} ${TIPOS_IMPORTACAO[imp.tipo].curto}${ref}${extra ? ` (${extra})` : ""}`,
    {
      tipo: imp.tipo,
      importacao: imp.id,
      referencia: imp.referencia ?? undefined,
      previa: acao === "descartou" || undefined,
      ...detalhes,
    },
  );
}

/**
 * Valida o formulário e, se falhar, a mensagem do primeiro campo com o
 * rótulo da tela (o `primeiroErro` do sistema antigo: "Nome: informe o nome").
 */
export function validarFormulario<T>(
  esquema: z.ZodType<T>,
  dados: unknown,
  rotulos: Record<string, string> = {},
): T {
  const r = esquema.safeParse(dados);
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const campo = String(issue?.path[0] ?? "");
  throw new ErroDeValidacao(
    `${rotulos[campo] ?? (campo || "Campo")}: ${issue?.message ?? "inválido"}`,
  );
}

/** Em lotes, para a lista do `in` não ficar enorme. */
export async function emLotes<T, R>(
  itens: T[],
  tamanho: number,
  fn: (lote: T[]) => Promise<R[]>,
): Promise<R[]> {
  const r: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho)
    r.push(...(await fn(itens.slice(i, i + tamanho))));
  return r;
}
