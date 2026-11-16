import { sql } from "kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";
import type { Tx } from "@/infra/banco";
import type { Json } from "@/infra/banco/tipos";

// Fichas cadastrais (comercial.fichas, ficha_dados, ficha_documentos,
// ficha_acessos). Com a sessão, o RLS mostra a lista a quem vê fichas, gera
// link ou monta contrato; dados, documentos e acessos só com
// comercial.formulario.ver. O token nunca sai pela sessão (o banco não deixa
// ler a coluna): só pela service role, depois de conferir a permissão.

const LISTA = [
  "id",
  "tipo",
  "situacao",
  "luc",
  "nome",
  "origem",
  "gerada_em",
  "recebida_em",
  "expira_em",
  "cancelada_em",
  "iniciada_em",
  "exemplo",
  "ficha_principal_id",
] as const;

/** Fichas geradas desde `desde` (início do dia em Brasília) e do tipo. */
export function lista(tx: Tx, desde: string | null, tipo: string | null) {
  let q = tx.selectFrom("comercial.fichas").select(LISTA);
  if (desde) q = q.where("gerada_em", ">=", `${desde}T00:00:00-03:00`);
  if (tipo) q = q.where("tipo", "=", tipo);
  return q.orderBy("gerada_em", "desc").orderBy("id").execute();
}

export function ficha(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.fichas")
    .select([
      ...LISTA,
      "rd_oportunidade",
      "consentimento_em",
      "usada_em",
      "ultimo_acesso_em",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

export function fiadores(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.fichas")
    .select(["id", "nome", "situacao"])
    .where("ficha_principal_id", "=", id)
    .orderBy("gerada_em")
    .execute();
}

export function nomeDaFicha(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.fichas")
    .select(["id", "nome"])
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Só pela service role (a sessão não lê a coluna). */
export function token(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.fichas")
    .select("token")
    .where("id", "=", id)
    .executeTakeFirst();
}

export function dados(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.ficha_dados")
    .select(["documento", "respostas", "assinatura_nome"])
    .where("ficha_id", "=", id)
    .executeTakeFirst();
}

export function documentos(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.ficha_documentos")
    .select(["id", "documento", "arquivo_nome", "tamanho", "enviado_em"])
    .where("ficha_id", "=", id)
    .orderBy("enviado_em")
    .execute();
}

/** Os últimos 30 acessos. */
export function acessos(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.ficha_acessos")
    .select(["em", "acao", "usuario_id"])
    .where("ficha_id", "=", id)
    .orderBy("em", "desc")
    .limit(30)
    .execute();
}

/** Outras fichas com o mesmo CPF/CNPJ (até 10). */
export function mesmoDocumento(tx: Tx, documento: string, id: string) {
  return tx
    .selectFrom("comercial.fichas as f")
    .select(["f.id", "f.nome", "f.situacao", "f.gerada_em"])
    .where(
      "f.id",
      "in",
      tx
        .selectFrom("comercial.ficha_dados")
        .select("ficha_id")
        .where("documento", "=", documento)
        .where("ficha_id", "<>", id)
        .limit(10),
    )
    .orderBy("f.gerada_em", "desc")
    .execute();
}

export function registrarAcesso(
  tx: Tx,
  fichaId: string,
  acao: "abriu" | "pdf" | "documento",
) {
  return tx
    .insertInto("comercial.ficha_acessos")
    .values({ ficha_id: fichaId, acao })
    .execute();
}

export function caminhoDoDocumento(tx: Tx, fichaId: string, docId: string) {
  return tx
    .selectFrom("comercial.ficha_documentos")
    .select("arquivo_path")
    .where("id", "=", docId)
    .where("ficha_id", "=", fichaId)
    .executeTakeFirst();
}

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

export function incluirLink(
  tx: Tx,
  f: {
    token: string;
    luc: string | null;
    tipo: string;
    nome: string | null;
    rd_oportunidade: string | null;
    expira_em: string;
    gerada_por: string;
  },
) {
  return tx.insertInto("comercial.fichas").values(f).execute();
}

/** Link cancelado volta a valer com token novo. */
export function reabrirCancelado(
  tx: Tx,
  id: string,
  expira: string,
  token: string,
) {
  return tx
    .updateTable("comercial.fichas")
    .set({ expira_em: expira, cancelada_em: null, token })
    .where("id", "=", id)
    .where("situacao", "=", "em_preenchimento")
    .where("cancelada_em", "is not", null)
    .returning("id")
    .execute();
}

export function renovar(tx: Tx, id: string, expira: string) {
  return tx
    .updateTable("comercial.fichas")
    .set({ expira_em: expira })
    .where("id", "=", id)
    .where("situacao", "=", "em_preenchimento")
    .returning("id")
    .execute();
}

export function cancelar(tx: Tx, id: string) {
  return tx
    .updateTable("comercial.fichas")
    .set({ cancelada_em: sql<string>`now()` })
    .where("id", "=", id)
    .where("situacao", "=", "em_preenchimento")
    .where("cancelada_em", "is", null)
    .returning("id")
    .execute();
}

// ---------------------------------------------------------------------------
// Pelo link (service role, depois de conferir o token)
// ---------------------------------------------------------------------------

export function fichaPeloToken(tx: Tx, token: string) {
  return tx
    .selectFrom("comercial.fichas as f")
    .select((eb) => [
      "f.id",
      "f.token",
      "f.tipo",
      "f.luc",
      "f.nome",
      "f.situacao",
      "f.expira_em",
      "f.cancelada_em",
      "f.iniciada_em",
      "f.consentimento_em",
      "f.gerada_por",
      "f.ultimo_acesso_em",
      jsonObjectFrom(
        eb
          .selectFrom("comercial.ficha_dados as d")
          .select("d.respostas")
          .whereRef("d.ficha_id", "=", "f.id"),
      ).as("dados"),
      jsonArrayFrom(
        eb
          .selectFrom("comercial.ficha_documentos as x")
          .select(["x.id", "x.documento", "x.arquivo_nome"])
          .whereRef("x.ficha_id", "=", "f.id")
          .orderBy("x.enviado_em"),
      ).as("documentos"),
    ])
    .where("f.token", "=", token)
    .executeTakeFirst();
}

export function textosPublicos(tx: Tx) {
  return tx
    .selectFrom("comercial.parametros")
    .select(["ficha_boas_vindas", "ficha_termo_lgpd", "ficha_validade_dias"])
    .where("id", "=", true)
    .executeTakeFirstOrThrow();
}

export function listasDeDocumentos(tx: Tx, listas: string[]) {
  return tx
    .selectFrom("comercial.listas")
    .select(["lista", "valor", "ativo", "extra"])
    .where("lista", "in", listas)
    .orderBy("ordem")
    .orderBy("valor")
    .execute();
}

export function marcarUltimoAcesso(tx: Tx, id: string) {
  return tx
    .updateTable("comercial.fichas")
    .set({ ultimo_acesso_em: sql<string>`now()` })
    .where("id", "=", id)
    .execute();
}

export async function gravarPeloLink(
  tx: Tx,
  p: {
    token: string;
    tipo: string | null;
    luc: string | null;
    nome: string | null;
    documento: string | null;
    respostas: Json;
    assinatura: string | null;
    enviar: boolean;
  },
): Promise<string | null> {
  const r = await sql<{ r: string | null }>`
    select comercial.gravar_ficha_pelo_link(
      p_token => ${p.token},
      p_tipo => ${p.tipo},
      p_luc => ${p.luc},
      p_nome => ${p.nome},
      p_documento => ${p.documento},
      p_respostas => ${JSON.stringify(p.respostas)}::jsonb,
      p_assinatura => ${p.assinatura},
      p_enviar => ${p.enviar}
    ) as r
  `.execute(tx);
  return r.rows[0]?.r ?? null;
}

export function documentosDoItem(tx: Tx, fichaId: string, documento: string) {
  return tx
    .selectFrom("comercial.ficha_documentos")
    .select(["id", "arquivo_path"])
    .where("ficha_id", "=", fichaId)
    .where("documento", "=", documento)
    .execute();
}

export function incluirDocumento(
  tx: Tx,
  d: {
    ficha_id: string;
    documento: string;
    arquivo_path: string;
    arquivo_nome: string;
    tamanho: number;
    tipo_mime: string;
  },
) {
  return tx
    .insertInto("comercial.ficha_documentos")
    .values(d)
    .returning(["id", "documento", "arquivo_nome"])
    .executeTakeFirstOrThrow();
}

export function apagarDocumentos(tx: Tx, ids: string[]) {
  return tx
    .deleteFrom("comercial.ficha_documentos")
    .where("id", "in", ids)
    .execute();
}

export function marcarConsentimento(tx: Tx, id: string) {
  return tx
    .updateTable("comercial.fichas")
    .set({ consentimento_em: sql<string>`now()` })
    .where("id", "=", id)
    .where("consentimento_em", "is", null)
    .execute();
}

export function removerDocumento(tx: Tx, fichaId: string, id: string) {
  return tx
    .deleteFrom("comercial.ficha_documentos")
    .where("id", "=", id)
    .where("ficha_id", "=", fichaId)
    .returning("arquivo_path")
    .execute();
}

// ---------------------------------------------------------------------------
// Importação do Google Forms
// ---------------------------------------------------------------------------

/** Ficha atual de cada CPF/CNPJ (pelo RLS). */
export function fichasComOsDocumentos(tx: Tx, docs: string[]) {
  return tx
    .selectFrom("comercial.ficha_dados as d")
    .innerJoin("comercial.fichas as f", "f.id", "d.ficha_id")
    .select(["d.documento", "f.id", "f.nome"])
    .where("d.documento", "in", docs)
    .execute();
}

export function incluirFichasImportadas(
  tx: Tx,
  fichas: {
    id: string;
    tipo: string;
    situacao: string;
    luc: string | null;
    nome: string | null;
    origem: string;
    gerada_por: string;
    gerada_em: string;
    iniciada_em: string;
    consentimento_em: string;
    recebida_em: string;
    importacao_id: string;
  }[],
) {
  return tx.insertInto("comercial.fichas").values(fichas).execute();
}

export function incluirDadosImportados(
  tx: Tx,
  dados: {
    ficha_id: string;
    documento: string | null;
    respostas: string;
    assinatura_nome: string | null;
  }[],
) {
  return tx.insertInto("comercial.ficha_dados").values(dados).execute();
}
