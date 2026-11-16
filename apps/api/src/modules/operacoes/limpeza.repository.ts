import type { Tx } from "@/infra/banco";

// Consultas do rateio da limpeza (spec 4.8) usadas pelo Painel: a lista dos
// meses com o que a conta precisa. Com a sessão (RLS: operacoes.limpeza.ver
// ou .fechar). A parte B (tela da Limpeza) completa este arquivo.

/** Meses do rateio, do mais novo ao mais antigo, com o status da importação. */
export function meses(tx: Tx) {
  return tx
    .selectFrom("operacoes.limpeza_meses as m")
    .leftJoin("operacoes.importacoes as i", "i.id", "m.importacao_id")
    .select([
      "m.referencia",
      "m.importacao_id",
      "m.valor_base",
      "m.base_composicao",
      "m.func_base",
      "m.func_area_comum",
      "m.func_rateados",
      "m.regra_bl04",
      "m.status",
      "m.incompleto",
      "m.origem",
      "m.valores_planilha",
      "m.fechado_em",
      "m.enviado_em",
      "m.exemplo",
      "i.status as importacao_status",
    ])
    .orderBy("m.referencia", "desc")
    .execute();
}

export function extras(tx: Tx) {
  return tx
    .selectFrom("operacoes.limpeza_extras")
    .select(["id", "referencia", "valor"])
    .orderBy("referencia")
    .orderBy("id")
    .execute();
}

export function minutos(tx: Tx) {
  return tx
    .selectFrom("operacoes.limpeza_minutos")
    .select(["referencia", "bloco", "limpeza", "manutencao"])
    .orderBy("referencia")
    .orderBy("bloco")
    .execute();
}

/** Itens do contrato que entram na conferência. */
export function contratoDaConferencia(tx: Tx) {
  return tx
    .selectFrom("operacoes.limpeza_contrato")
    .select(["id", "referencia", "valor", "entra_conferencia"])
    .where("entra_conferencia", "=", true)
    .orderBy("referencia")
    .orderBy("id")
    .execute();
}

/** Dias úteis e feriados (Parâmetros dos Chamados). Service role: quem chama confere. */
export async function calendarioDosChamados(tx: Tx) {
  const p = await tx
    .selectFrom("os.parametros")
    .select("dias_uteis")
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();
  const f = await tx.selectFrom("os.feriados").select("data").execute();
  return { diasUteis: p.dias_uteis, feriados: f.map((x) => x.data) };
}
