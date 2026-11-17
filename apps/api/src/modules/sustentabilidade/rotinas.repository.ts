import type { Tx } from "@/infra/banco";
import type { OsStatusChamado } from "@/infra/banco/tipos";

// Consultas das rotinas do módulo e dos chamados que ele abre pelo sistema
// (service role: quem chama já conferiu o acesso, ou é a rotina diária).

export const EM_ABERTO: readonly OsStatusChamado[] = [
  "aberto",
  "em_andamento",
  "aguardando",
];

export const COLUNAS_CONTRATO = [
  "id",
  "loja_id",
  "contrato",
  "cliente_nome",
  "cliente_doc",
  "lucs",
  "bloco",
  "tipo_loja",
  "ramo",
  "ativacao",
  "inicio",
  "rescisao",
  "situacao",
  "ativacao_corrigida",
  "validade_meses_especifica",
  "dispensada_motivo",
  "dispensada_em",
  "chamado_id",
  "exemplo",
] as const;

/** Categorias de primeiro nível com o nome, nos setores dados. */
export function categoriasPorNome(tx: Tx, nome: string, setores: string[]) {
  return tx
    .selectFrom("os.categorias as c")
    .innerJoin("os.setores as s", "s.id", "c.setor_id")
    .select(["c.id", "c.setor_id", "s.nome as setor"])
    .where("c.nome", "=", nome)
    .where("c.pai_id", "is", null)
    .where("s.nome", "in", setores)
    .execute();
}

/** Categoria ativa do setor pelo nome. */
export function categoriaAtivaDoSetor(tx: Tx, setorId: string, nome: string) {
  return tx
    .selectFrom("os.categorias")
    .select("id")
    .where("setor_id", "=", setorId)
    .where("nome", "=", nome)
    .where("ativo", "=", true)
    .limit(1)
    .executeTakeFirst();
}

export function setorPorNome(tx: Tx, nome: string) {
  return tx
    .selectFrom("os.setores")
    .select("id")
    .where("nome", "=", nome)
    .limit(1)
    .executeTakeFirst();
}

export async function guardarChamado(
  tx: Tx,
  contratoId: string,
  chamadoId: string | null,
): Promise<void> {
  await tx
    .updateTable("sustentabilidade.contratos")
    .set({ chamado_id: chamadoId })
    .where("id", "=", contratoId)
    .execute();
}

export async function mudarPrazo(
  tx: Tx,
  chamadoId: string,
  prazo: string | null,
): Promise<void> {
  await tx
    .updateTable("os.chamados")
    .set({ prazo })
    .where("id", "=", chamadoId)
    .where("status", "in", EM_ABERTO)
    .execute();
}

export function contratos(tx: Tx, ids?: string[]) {
  let q = tx.selectFrom("sustentabilidade.contratos").select(COLUNAS_CONTRATO);
  if (ids) q = q.where("id", "in", ids);
  return q.orderBy("id").execute();
}

/** Entrevistas salvas (o resumo, sem respostas). */
export function entrevistasSalvas(tx: Tx, contratoIds?: string[]) {
  let q = tx
    .selectFrom("sustentabilidade.entrevistas")
    .select([
      "id",
      "contrato_id",
      "data",
      "tipo",
      "setor",
      "entrevistador_id",
      "valida_ate",
      "origem",
      "formulario_versao",
      "exemplo",
    ])
    .where("situacao", "=", "salva");
  if (contratoIds) q = q.where("contrato_id", "in", contratoIds);
  return q.orderBy("id").execute();
}

/** Chamados abertos das entrevistas (origem_ref "entrevista:<contrato>"). */
export function chamadosAbertosDasEntrevistas(tx: Tx, modulo: string) {
  return tx
    .selectFrom("os.chamados")
    .select(["id", "origem_ref"])
    .where("origem_modulo", "=", modulo)
    .where("origem_ref", "like", "entrevista:%")
    .where("status", "in", EM_ABERTO)
    .orderBy("criado_em")
    .orderBy("id")
    .execute();
}

// ---------------------------------------------------------------- clube

export function termoAvisoDias(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.parametros")
    .select("termo_aviso_dias")
    .where("id", "=", true)
    .executeTakeFirstOrThrow();
}

/** Termos ainda válidos em `hoje`. */
export function termosValidos(tx: Tx, hoje: string) {
  return tx
    .selectFrom("sustentabilidade.termos")
    .select(["id", "participante_id", "ano", "valido_ate", "chamado_id"])
    .where("valido_ate", ">=", hoje)
    .orderBy("id")
    .execute();
}

/** Participantes que não saíram do clube. */
export function participantesAtivos(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.participantes")
    .select(["id", "nome", "cliente_doc", "saiu_em"])
    .where("saiu_em", "is", null)
    .orderBy("id")
    .execute();
}

export async function ligarChamadoAoTermo(
  tx: Tx,
  termoId: string,
  chamadoId: string,
): Promise<void> {
  await tx
    .updateTable("sustentabilidade.termos")
    .set({ chamado_id: chamadoId })
    .where("id", "=", termoId)
    .execute();
}

// ---------------------------------------------------------------- programas

export function cobrancaDia(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.parametros")
    .select("cobranca_dia")
    .where("id", "=", true)
    .executeTakeFirstOrThrow();
}

export function programas(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.programas")
    .select(["id", "nome", "ativo", "frequencia", "inicio", "fim"])
    .execute();
}

/** Cobranças abertas (origem_ref "cobranca:<programa>:<mês>"). */
export function cobrancasAbertas(tx: Tx, modulo: string) {
  return tx
    .selectFrom("os.chamados")
    .select(["id", "origem_ref"])
    .where("origem_modulo", "=", modulo)
    .where("origem_ref", "like", "cobranca:%")
    .where("status", "in", EM_ABERTO)
    .execute();
}

export async function temLancamento(
  tx: Tx,
  programaId: string,
  de: string,
  ate: string,
): Promise<boolean> {
  const r = await tx
    .selectFrom("sustentabilidade.lancamentos")
    .select("id")
    .where("programa_id", "=", programaId)
    .where("data", ">=", de)
    .where("data", "<=", ate)
    .limit(1)
    .executeTakeFirst();
  return !!r;
}

export function programasComLancamento(
  tx: Tx,
  ids: string[],
  de: string,
  ate: string,
) {
  return tx
    .selectFrom("sustentabilidade.lancamentos")
    .select("programa_id")
    .distinct()
    .where("programa_id", "in", ids)
    .where("data", ">=", de)
    .where("data", "<=", ate)
    .execute();
}

/** Já houve chamado (aberto ou não) com a referência? */
export async function jaTemChamado(
  tx: Tx,
  modulo: string,
  ref: string,
): Promise<boolean> {
  const r = await tx
    .selectFrom("os.chamados")
    .select("id")
    .where("origem_modulo", "=", modulo)
    .where("origem_ref", "=", ref)
    .limit(1)
    .executeTakeFirst();
  return !!r;
}
