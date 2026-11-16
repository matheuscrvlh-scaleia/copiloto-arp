import type { Tx } from "@/infra/banco";

// Leituras e gravações da rotina diária do Comercial (service role: rotina
// sem sessão).

export function parametros(tx: Tx) {
  return tx
    .selectFrom("comercial.parametros")
    .select(["lembrete_aniversario_dias", "kit_aviso_dias"])
    .where("id", "=", true)
    .executeTakeFirstOrThrow();
}

/** Usuários ativos com a permissão (direta ou do cargo ativo). */
export async function usuariosComPermissao(tx: Tx, p: string) {
  const r = await tx
    .selectFrom("core.usuarios as u")
    .select("u.id")
    .where("u.ativo", "=", true)
    .where((eb) =>
      eb.or([
        eb.exists(
          eb
            .selectFrom("core.usuario_permissoes as up")
            .select("up.usuario_id")
            .whereRef("up.usuario_id", "=", "u.id")
            .where("up.permissao", "=", p),
        ),
        eb.exists(
          eb
            .selectFrom("core.cargo_permissoes as cp")
            .innerJoin("core.cargos as c", "c.id", "cp.cargo_id")
            .select("cp.cargo_id")
            .whereRef("cp.cargo_id", "=", "u.cargo_id")
            .where("cp.permissao", "=", p)
            .where("c.ativo", "=", true),
        ),
      ]),
    )
    .execute();
  return r.map((x) => x.id);
}

/** Grava os avisos (a repetida, pela chave, fica de fora); devolve os novos. */
export async function avisar(
  tx: Tx,
  linhas: {
    usuario_id: string;
    tipo: string;
    titulo: string;
    texto: string;
    href: string;
    chave: string;
  }[],
): Promise<number> {
  let novos = 0;
  for (let i = 0; i < linhas.length; i += 500) {
    const r = await tx
      .insertInto("os.notificacoes")
      .values(linhas.slice(i, i + 500))
      .onConflict((oc) => oc.columns(["usuario_id", "chave"]).doNothing())
      .returning("id")
      .execute();
    novos += r.length;
  }
  return novos;
}

/** Versões atuais com validade até `ate`, dos documentos ativos. */
export function versoesVencendo(tx: Tx, ate: string) {
  return tx
    .selectFrom("comercial.kit_versoes as v")
    .innerJoin("comercial.kit_documentos as d", "d.id", "v.documento_id")
    .select(["v.id", "v.versao", "v.validade", "d.nome"])
    .where("v.atual", "=", true)
    .where("v.validade", "is not", null)
    .where("v.validade", "<=", ate)
    .where("d.ativo", "=", true)
    .execute();
}

export function tiposLuc(tx: Tx) {
  return tx
    .selectFrom("comercial.tipos_luc")
    .select(["tipo", "conta_ocupacao"])
    .execute();
}

export function gravarFotos(
  tx: Tx,
  fotos: {
    mes: string;
    lucs: number;
    lucs_locados: number;
    abl_total: number;
    abl_locada: number;
    clientes_ativos: number;
    por_bloco: string;
    por_tipo: string;
    exemplo: boolean;
  }[],
) {
  return tx
    .insertInto("comercial.ocupacao_fotos")
    .values(fotos)
    .onConflict((oc) => oc.column("mes").doNothing())
    .returning("mes")
    .execute();
}
