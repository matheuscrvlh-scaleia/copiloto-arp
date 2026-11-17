import type { EntrevistaResumo } from "@arp/shared/sustentabilidade/entrevistas-controle";
import { sql } from "kysely";
import type { Tx } from "@/infra/banco";
import { COLUNAS_CONTRATO } from "./rotinas.repository";

// Consultas das entrevistas de resíduos (spec 4.4). Com a `tx` do
// `comoUsuario`, o RLS decide: `entrevistas` só para quem vê respostas,
// corrige ou aplicou; o resumo (sem respostas) sai de
// sustentabilidade.entrevistas_resumo().

const COLUNAS_COMPLETA = [
  "id",
  "contrato_id",
  "data",
  "tipo",
  "setor",
  "formulario_versao",
  "respostas",
  "respondente_nome",
  "entrevistador_id",
  "origem",
  "pdf",
  "exemplo",
] as const;

// ---------------------------------------------------------------- leituras

/** Entrevistas salvas sem as respostas (sustentabilidade.entrevistas_resumo). */
export async function resumo(tx: Tx): Promise<EntrevistaResumo[]> {
  const r = await sql<EntrevistaResumo>`
    select id, contrato_id, data, tipo, setor, entrevistador_id, valida_ate,
      tem_pdf, origem, formulario_versao, exemplo
    from sustentabilidade.entrevistas_resumo()
    order by id
  `.execute(tx);
  return r.rows;
}

/** Contratos que já têm entrevista salva (o resumo, só o contrato). */
export async function contratoTemEntrevista(
  tx: Tx,
  contratoId: string,
): Promise<boolean> {
  const r = await sql<{ id: string }>`
    select id from sustentabilidade.entrevistas_resumo()
    where contrato_id = ${contratoId}
    limit 1
  `.execute(tx);
  return r.rows.length > 0;
}

export function contratos(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select(COLUNAS_CONTRATO)
    .orderBy("id")
    .execute();
}

export function contrato(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select(COLUNAS_CONTRATO)
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Chamados pelos ids (service role; ids dos contratos que a pessoa vê). */
export function chamados(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("os.chamados")
    .select(["id", "numero", "tipo", "status", "responsavel_id"])
    .where("id", "in", ids)
    .execute();
}

export function contratoDaFicha(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select([
      ...COLUNAS_CONTRATO,
      "ativacao_corrigida_motivo",
      "ativacao_corrigida_em",
      "dispensada_por",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

export function completasDoContrato(tx: Tx, contratoId: string) {
  return tx
    .selectFrom("sustentabilidade.entrevistas")
    .select(["id", "pdf", "anexos", "respondente_nome"])
    .where("contrato_id", "=", contratoId)
    .where("situacao", "=", "salva")
    .execute();
}

export function transferencias(tx: Tx, contratoId: string) {
  return tx
    .selectFrom("sustentabilidade.entrevista_transferencias")
    .select([
      "entrevista_id",
      "de_contrato_id",
      "para_contrato_id",
      "motivo",
      "quem",
      "quando",
    ])
    .where((eb) =>
      eb.or([
        eb("de_contrato_id", "=", contratoId),
        eb("para_contrato_id", "=", contratoId),
      ]),
    )
    .orderBy("quando", "desc")
    .execute();
}

export function outrosDoCliente(tx: Tx, doc: string, exceto: string) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select(["id", "contrato", "lucs", "cliente_nome"])
    .where("cliente_doc", "=", doc)
    .where("id", "<>", exceto)
    .orderBy("contrato")
    .execute();
}

export function rotulosDeContratos(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select(["id", "contrato", "lucs", "cliente_nome"])
    .where("id", "in", ids)
    .execute();
}

export function questionario(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.formularios")
    .select(["id", "versao_publicada"])
    .where("tipo", "=", "questionario")
    .executeTakeFirst();
}

export function versoes(tx: Tx, formularioId: string) {
  return tx
    .selectFrom("sustentabilidade.formulario_versoes")
    .select(["versao", "definicao"])
    .where("formulario_id", "=", formularioId)
    .execute();
}

/** Uma entrevista salva com as respostas (RLS: ver respostas, corrigir ou quem aplicou). */
export function entrevistaCompleta(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.entrevistas")
    .select(COLUNAS_COMPLETA)
    .where("id", "=", id)
    .where("situacao", "=", "salva")
    .executeTakeFirst();
}

/** O rascunho mais recente da pessoa no contrato. */
export function rascunhoDoContrato(
  tx: Tx,
  contratoId: string,
  usuarioId: string,
) {
  return tx
    .selectFrom("sustentabilidade.entrevistas")
    .select([
      "rascunho_chave",
      "formulario_versao",
      "respostas",
      "atualizado_em",
      "respondente_nome",
      "assinatura_respondente",
      "assinatura_entrevistador",
    ])
    .where("contrato_id", "=", contratoId)
    .where("situacao", "=", "rascunho")
    .where("entrevistador_id", "=", usuarioId)
    .where("rascunho_chave", "is not", null)
    .orderBy("atualizado_em", "desc")
    .limit(1)
    .executeTakeFirst();
}

/** Entrevistas salvas no período, com respostas (RLS: ver respostas). */
export function salvasDoPeriodo(tx: Tx, de: string, ate: string) {
  return tx
    .selectFrom("sustentabilidade.entrevistas")
    .select(COLUNAS_COMPLETA)
    .where("situacao", "=", "salva")
    .where("data", ">=", de)
    .where("data", "<=", ate)
    .orderBy("data", "desc")
    .orderBy("id")
    .execute();
}

// ---------------------------------------------------------------- gravações

export function rascunhoPorChave(tx: Tx, chave: string) {
  return tx
    .selectFrom("sustentabilidade.entrevistas")
    .select([
      "id",
      "contrato_id",
      "data",
      "situacao",
      "formulario_versao",
      "respostas",
      "respondente_nome",
      "assinatura_respondente",
      "assinatura_entrevistador",
      "chamado_id",
      "valida_ate",
      "pdf",
    ])
    .where("rascunho_chave", "=", chave)
    .executeTakeFirst();
}

/** Respostas do rascunho (só enquanto for rascunho). */
export async function atualizarRespostas(
  tx: Tx,
  filtro: { id: string } | { chave: string },
  respostas: string,
): Promise<void> {
  let q = tx
    .updateTable("sustentabilidade.entrevistas")
    .set({ respostas })
    .where("situacao", "=", "rascunho");
  q =
    "id" in filtro
      ? q.where("id", "=", filtro.id)
      : q.where("rascunho_chave", "=", filtro.chave);
  await q.execute();
}

export function contratoParaRascunho(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select(["id", "lucs", "cliente_doc"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function inserirRascunho(
  tx: Tx,
  r: {
    contrato_id: string;
    lucs: string[];
    cliente_doc: string | null;
    data: string;
    tipo: string;
    formulario_versao: number;
    respostas: string;
    rascunho_chave: string;
    entrevistador_id: string;
  },
): Promise<void> {
  await tx
    .insertInto("sustentabilidade.entrevistas")
    .values({ ...r, situacao: "rascunho", origem: "sistema" })
    .execute();
}

/** Só um rascunho por contrato e pessoa: o de outra chave sai. */
export async function apagarOutrosRascunhos(
  tx: Tx,
  contratoId: string,
  usuarioId: string,
  chave: string,
): Promise<void> {
  await tx
    .deleteFrom("sustentabilidade.entrevistas")
    .where("contrato_id", "=", contratoId)
    .where("entrevistador_id", "=", usuarioId)
    .where("situacao", "=", "rascunho")
    .where("rascunho_chave", "<>", chave)
    .execute();
}

export async function gravarAssinatura(
  tx: Tx,
  id: string,
  valores:
    | { assinatura_respondente: string; respondente_nome: string }
    | { assinatura_entrevistador: string },
): Promise<void> {
  await tx
    .updateTable("sustentabilidade.entrevistas")
    .set(valores)
    .where("id", "=", id)
    .where("situacao", "=", "rascunho")
    .execute();
}

export function contratoParaConcluir(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select([
      "id",
      "loja_id",
      "contrato",
      "cliente_nome",
      "cliente_doc",
      "lucs",
      "situacao",
      "rescisao",
      "tipo_loja",
      "validade_meses_especifica",
      "dispensada_motivo",
      "exemplo",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Rascunho → salva. Devolve a linha se mudou (null: não era mais rascunho). */
export function salvarEntrevista(
  tx: Tx,
  id: string,
  v: {
    respostas: string;
    setor: string | null;
    tipo: string;
    valida_ate: string | null;
    pdf: string;
  },
) {
  return tx
    .updateTable("sustentabilidade.entrevistas")
    .set({ ...v, situacao: "salva" })
    .where("id", "=", id)
    .where("situacao", "=", "rascunho")
    .returning("id")
    .executeTakeFirst();
}

/** entrevistas.chamado_id (service role). */
export async function ligarChamado(
  tx: Tx,
  entrevistaId: string,
  chamadoId: string,
): Promise<void> {
  await tx
    .updateTable("sustentabilidade.entrevistas")
    .set({ chamado_id: chamadoId })
    .where("id", "=", entrevistaId)
    .execute();
}

export function clienteDoContrato(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select(["cliente_doc", "cliente_nome"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function inserirInteressado(
  tx: Tx,
  doc: string,
  nome: string,
): Promise<void> {
  await tx
    .insertInto("sustentabilidade.participantes")
    .values({ cliente_doc: doc, nome, interesse: true, formas: [] })
    .execute();
}

/** Marca o interesse de quem já está no Clube (service role). */
export async function marcarInteresse(tx: Tx, doc: string): Promise<void> {
  await tx
    .updateTable("sustentabilidade.participantes")
    .set({ interesse: true })
    .where("cliente_doc", "=", doc)
    .execute();
}

/** Colunas do módulo no contrato; devolve a linha se mudou (RLS). */
export function atualizarContrato(
  tx: Tx,
  id: string,
  v: {
    dispensada_motivo?: string | null;
    ativacao_corrigida?: string | null;
    ativacao_corrigida_motivo?: string | null;
    validade_meses_especifica?: number | null;
  },
) {
  return tx
    .updateTable("sustentabilidade.contratos")
    .set(v)
    .where("id", "=", id)
    .returning("id")
    .executeTakeFirst();
}

export function entrevistaSalva(tx: Tx, id: string) {
  return tx
    .selectFrom("sustentabilidade.entrevistas")
    .select(["id", "contrato_id", "data", "anexos"])
    .where("id", "=", id)
    .where("situacao", "=", "salva")
    .executeTakeFirst();
}

export function contratosPorIds(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("sustentabilidade.contratos")
    .select(["id", "cliente_doc", "lucs"])
    .where("id", "in", ids)
    .execute();
}

export async function moverEntrevista(
  tx: Tx,
  id: string,
  destino: { contrato_id: string; lucs: string[]; cliente_doc: string | null },
): Promise<void> {
  await tx
    .updateTable("sustentabilidade.entrevistas")
    .set(destino)
    .where("id", "=", id)
    .execute();
}

export async function inserirTransferencia(
  tx: Tx,
  t: {
    entrevista_id: string;
    de_contrato_id: string;
    para_contrato_id: string;
    motivo: string;
    quem: string;
  },
): Promise<void> {
  await tx
    .insertInto("sustentabilidade.entrevista_transferencias")
    .values(t)
    .execute();
}

export async function gravarAnexos(
  tx: Tx,
  id: string,
  anexos: string,
): Promise<void> {
  await tx
    .updateTable("sustentabilidade.entrevistas")
    .set({ anexos })
    .where("id", "=", id)
    .execute();
}
