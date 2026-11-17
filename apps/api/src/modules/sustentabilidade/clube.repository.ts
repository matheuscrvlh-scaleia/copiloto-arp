import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas do Clube SustentArp (spec 4.5). Com a `tx` do `comoUsuario`, o
// RLS decide: contato só com "Ver contato", reais só com "Ver valores" (a
// linha de valor não aparece, e o left join devolve null).

const COLUNAS_CONTRATO = [
  "id",
  "contrato",
  "cliente_doc",
  "lucs",
  "bloco",
  "tipo_loja",
  "situacao",
  "rescisao",
  "ativacao",
  "inicio",
  "ativacao_corrigida",
  "validade_meses_especifica",
  "dispensada_em",
] as const;

// ---------------------------------------------------------------- leituras

export function participantes(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.participantes")
    .select([
      "id",
      "cliente_doc",
      "nome",
      "formas",
      "saiu_em",
      "interesse",
      "exemplo",
    ])
    .orderBy("nome")
    .orderBy("id")
    .execute();
}

export function termos(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.termos")
    .select(["id", "participante_id", "ano", "assinado_em", "valido_ate"])
    .orderBy("id")
    .execute();
}

export function contratosVigentes(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select(COLUNAS_CONTRATO)
    .where("situacao", "=", "vigente")
    .orderBy("id")
    .execute();
}

export function contratosDoCliente(tx: Tx, doc: string) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select(COLUNAS_CONTRATO)
    .where("cliente_doc", "=", doc)
    .orderBy("situacao", "desc")
    .orderBy("id")
    .execute();
}

/** Contribuições com competência no ano (valor null sem "Ver valores"). */
export function contribuicoesDoAno(tx: Tx, ano: number) {
  return tx
    .selectFrom("sustentabilidade.contribuicoes as c")
    .leftJoin(
      "sustentabilidade.contribuicao_valores as v",
      "v.contribuicao_id",
      "c.id",
    )
    .select(["c.id", "c.participante_id", "v.valor"])
    .where("c.competencia", ">=", `${ano}-01-01`)
    .where("c.competencia", "<=", `${ano}-12-01`)
    .orderBy("c.id")
    .execute();
}

export function acoesDoAno(tx: Tx, ano: number) {
  return tx
    .selectFrom("sustentabilidade.acoes")
    .select(["id", "participante_id"])
    .where("data", ">=", `${ano}-01-01`)
    .where("data", "<=", `${ano}-12-31`)
    .orderBy("id")
    .execute();
}

export function valoresCombinados(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.participante_valores")
    .select(["participante_id", "valor_combinado_mes"])
    .orderBy("participante_id")
    .execute();
}

/** sustentabilidade.entrevistas_resumo() (entrevistas salvas, sem respostas). */
export async function ultimasEntrevistas(tx: Tx, doc?: string) {
  const r = await sql<{
    contrato_id: string;
    data: string;
    setor: string | null;
  }>`
    select contrato_id, data, setor
    from sustentabilidade.entrevistas_resumo()
    where ${doc === undefined ? sql`true` : sql`cliente_doc = ${doc}`}
    order by id
  `.execute(tx);
  return r.rows;
}

export function contratosParaParticipar(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select([
      "id",
      "cliente_nome",
      "cliente_doc",
      "lucs",
      "situacao",
      "rescisao",
    ])
    .where("situacao", "=", "vigente")
    .orderBy("id")
    .execute();
}

export function docsDosParticipantes(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.participantes")
    .select(["id", "cliente_doc"])
    .orderBy("id")
    .execute();
}

export function participante(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.participantes")
    .select([
      "id",
      "cliente_doc",
      "nome",
      "locatario_manual",
      "formas",
      "saiu_em",
      "saiu_motivo",
      "interesse",
      "exemplo",
      "criado_em",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

export function contato(tx: Tx, participanteId: string) {
  return tx
    .selectFrom("sustentabilidade.participante_contatos")
    .select(["email", "telefone", "contato"])
    .where("participante_id", "=", participanteId)
    .executeTakeFirst();
}

export function valorCombinado(tx: Tx, participanteId: string) {
  return tx
    .selectFrom("sustentabilidade.participante_valores")
    .select("valor_combinado_mes")
    .where("participante_id", "=", participanteId)
    .executeTakeFirst();
}

export function termosDoParticipante(tx: Tx, participanteId: string) {
  return tx
    .selectFrom("sustentabilidade.termos")
    .select(["id", "ano", "assinado_em", "valido_ate", "arquivo", "assinatura"])
    .where("participante_id", "=", participanteId)
    .orderBy("ano", "desc")
    .execute();
}

export function contribuicoesDoParticipante(tx: Tx, participanteId: string) {
  return tx
    .selectFrom("sustentabilidade.contribuicoes as c")
    .leftJoin(
      "sustentabilidade.contribuicao_valores as v",
      "v.contribuicao_id",
      "c.id",
    )
    .select([
      "c.id",
      "c.data",
      "c.forma",
      "c.competencia",
      "c.observacao",
      "v.valor",
    ])
    .where("c.participante_id", "=", participanteId)
    .orderBy("c.data", "desc")
    .orderBy("c.id")
    .execute();
}

export function acoesDoParticipante(tx: Tx, participanteId: string) {
  return tx
    .selectFrom("sustentabilidade.acoes")
    .select(["id", "data", "tipo", "observacao"])
    .where("participante_id", "=", participanteId)
    .orderBy("data", "desc")
    .orderBy("id")
    .execute();
}

export function contribuicoesDoPeriodo(
  tx: Tx,
  f: { de: string; ate: string; participanteId: string; forma: string },
) {
  let q = tx
    .selectFrom("sustentabilidade.contribuicoes as c")
    .leftJoin(
      "sustentabilidade.participantes as p",
      "p.id",
      "c.participante_id",
    )
    .leftJoin(
      "sustentabilidade.contribuicao_valores as v",
      "v.contribuicao_id",
      "c.id",
    )
    .select([
      "c.id",
      "c.participante_id",
      "c.data",
      "c.forma",
      "c.competencia",
      "c.observacao",
      "p.nome",
      "p.cliente_doc",
      "v.valor",
    ])
    .where("c.data", ">=", f.de)
    .where("c.data", "<=", f.ate);
  if (f.participanteId) q = q.where("c.participante_id", "=", f.participanteId);
  if (f.forma) q = q.where("c.forma", "=", f.forma);
  return q.orderBy("c.data", "desc").orderBy("c.id").execute();
}

export function participantesParaFiltro(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.participantes")
    .select(["id", "nome"])
    .orderBy("nome")
    .orderBy("id")
    .execute();
}

// ---------------------------------------------------------------- gravações

export function participantePorDoc(tx: Tx, doc: string) {
  return tx
    .selectFrom("sustentabilidade.participantes")
    .select("id")
    .where("cliente_doc", "=", doc)
    .executeTakeFirst();
}

export function nomeDoClienteNoContrato(tx: Tx, doc: string) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select("cliente_nome")
    .where("cliente_doc", "=", doc)
    .limit(1)
    .executeTakeFirst();
}

export async function inserirParticipante(
  tx: Tx,
  p: {
    id: string;
    cliente_doc: string;
    nome: string;
    locatario_manual: boolean;
    formas: string[];
  },
): Promise<void> {
  await tx.insertInto("sustentabilidade.participantes").values(p).execute();
}

export async function inserirContato(
  tx: Tx,
  c: {
    participante_id: string;
    email: string | null;
    telefone: string | null;
    contato: string | null;
  },
): Promise<void> {
  await tx
    .insertInto("sustentabilidade.participante_contatos")
    .values(c)
    .execute();
}

export function formasDoParticipante(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.participantes")
    .select(["formas", "locatario_manual"])
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Devolve quantas linhas mudaram (0: o RLS não deixou ou não existe). */
export async function atualizarParticipante(
  tx: Tx,
  id: string,
  valores: {
    formas?: string[];
    nome?: string;
    saiu_em?: string | null;
    saiu_motivo?: string | null;
  },
) {
  return tx
    .updateTable("sustentabilidade.participantes")
    .set(valores)
    .where("id", "=", id)
    .returning(["id", "nome"])
    .executeTakeFirst();
}

export async function removerContato(tx: Tx, participanteId: string) {
  await tx
    .deleteFrom("sustentabilidade.participante_contatos")
    .where("participante_id", "=", participanteId)
    .execute();
}

export async function gravarContato(
  tx: Tx,
  c: {
    participante_id: string;
    email: string | null;
    telefone: string | null;
    contato: string | null;
  },
) {
  await tx
    .insertInto("sustentabilidade.participante_contatos")
    .values(c)
    .onConflict((oc) =>
      oc.column("participante_id").doUpdateSet({
        email: c.email,
        telefone: c.telefone,
        contato: c.contato,
      }),
    )
    .execute();
}

export async function removerValor(tx: Tx, participanteId: string) {
  await tx
    .deleteFrom("sustentabilidade.participante_valores")
    .where("participante_id", "=", participanteId)
    .execute();
}

export async function gravarValor(
  tx: Tx,
  participanteId: string,
  valor: number,
) {
  await tx
    .insertInto("sustentabilidade.participante_valores")
    .values({ participante_id: participanteId, valor_combinado_mes: valor })
    .onConflict((oc) =>
      oc.column("participante_id").doUpdateSet({ valor_combinado_mes: valor }),
    )
    .execute();
}

/** Chamados de renovação ligados aos termos do participante (service role). */
export function chamadosDosTermos(tx: Tx, participanteId: string) {
  return tx
    .selectFrom("sustentabilidade.termos")
    .select("chamado_id")
    .where("participante_id", "=", participanteId)
    .where("chamado_id", "is not", null)
    .execute();
}

/** Termos anteriores ao novo com chamado de renovação (service role). */
export function termosComChamadoAntes(
  tx: Tx,
  participanteId: string,
  ano: number,
  validoAte: string,
) {
  return tx
    .selectFrom("sustentabilidade.termos")
    .select(["id", "ano", "valido_ate", "chamado_id"])
    .where("participante_id", "=", participanteId)
    .where("chamado_id", "is not", null)
    .where("ano", "<>", ano)
    .where("valido_ate", "<", validoAte)
    .execute();
}

export async function inserirTermo(
  tx: Tx,
  t: {
    id: string;
    participante_id: string;
    ano: number;
    assinado_em: string;
    valido_ate: string;
    arquivo: string | null;
    assinatura: string | null;
  },
) {
  await tx.insertInto("sustentabilidade.termos").values(t).execute();
}

export function participanteDoTermo(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.participantes")
    .select(["nome", "cliente_doc", "formas"])
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Dados da ARP para o termo (core.empresa, service role). */
export function empresa(tx: Tx) {
  return tx
    .selectFrom("core.empresa")
    .select(["nome", "razao_social", "cnpj", "cidade"])
    .executeTakeFirst();
}

export function removerTermo(tx: Tx, id: string) {
  return tx
    .deleteFrom("sustentabilidade.termos")
    .where("id", "=", id)
    .returning(["arquivo", "assinatura"])
    .executeTakeFirst();
}

export function arquivosDoTermo(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.termos")
    .select(["arquivo", "assinatura"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function inserirContribuicao(
  tx: Tx,
  c: {
    id: string;
    participante_id: string;
    data: string;
    forma: string;
    competencia: string;
    observacao: string | null;
  },
  valor: number,
) {
  await tx.insertInto("sustentabilidade.contribuicoes").values(c).execute();
  await tx
    .insertInto("sustentabilidade.contribuicao_valores")
    .values({ contribuicao_id: c.id, valor })
    .execute();
}

export function removerContribuicao(tx: Tx, id: string) {
  return tx
    .deleteFrom("sustentabilidade.contribuicoes")
    .where("id", "=", id)
    .returning("id")
    .executeTakeFirst();
}

export async function inserirAcao(
  tx: Tx,
  a: {
    id: string;
    participante_id: string;
    data: string;
    tipo: string;
    observacao: string | null;
  },
) {
  await tx.insertInto("sustentabilidade.acoes").values(a).execute();
}

export function removerAcao(tx: Tx, id: string) {
  return tx
    .deleteFrom("sustentabilidade.acoes")
    .where("id", "=", id)
    .returning("id")
    .executeTakeFirst();
}
