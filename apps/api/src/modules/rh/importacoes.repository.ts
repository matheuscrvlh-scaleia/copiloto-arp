import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Importações do RH (folha.ts, acoes/importacoes*.ts e acoes/folha.ts do
// antigo), com a sessão: o RLS e as funções do banco conferem rh.folha,
// rh.beneficios e o custo individual. As regras (folha fechada, prévia já
// usada, rubrica cadastrada) ficam no banco.

/** Rubricas da folha (o grupo diz se é nova). */
export function rubricas(tx: Tx) {
  return tx
    .selectFrom("rh.rubricas")
    .select(["codigo", "grupo", "descricao"])
    .orderBy("codigo")
    .execute();
}

export function departamentosAtivosComCodigo(tx: Tx) {
  return tx
    .selectFrom("rh.departamentos")
    .select(["id", "nome", "codigo_folha"])
    .where("ativo", "=", true)
    .orderBy("nome")
    .execute();
}

export async function matriculas(tx: Tx): Promise<Set<number | null>> {
  const ls = await tx
    .selectFrom("rh.colaboradores")
    .select("matricula")
    .orderBy("id")
    .execute();
  return new Set(ls.map((c) => c.matricula));
}

export function folhaDaCompetencia(tx: Tx, competencia: string) {
  return tx
    .selectFrom("rh.folhas")
    .select(["id", "status"])
    .where("competencia", "=", competencia)
    .executeTakeFirst();
}

export function registrarImportacao(
  tx: Tx,
  i: {
    id: string;
    tipo: "folha" | "plano_saude";
    referencia: string;
    arquivo_nome: string;
    arquivo_path: string;
    arquivo_sha256: string;
    enviado_por: string;
    avisos: unknown;
  },
) {
  return tx
    .insertInto("core.importacoes")
    .values({ ...i, avisos: JSON.stringify(i.avisos) })
    .execute();
}

export function importacao(tx: Tx, id: string) {
  return tx
    .selectFrom("core.importacoes")
    .select(["arquivo_path", "referencia", "status"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function importarFolha(
  tx: Tx,
  p: {
    importacaoId: string;
    folha: unknown;
    departamentos: Record<string, string>;
    substituir: boolean;
  },
): Promise<Record<string, number>> {
  const r = await sql<{ r: Record<string, number> }>`
    select rh.importar_folha(
      p_importacao_id => ${p.importacaoId}::uuid,
      p_folha => ${JSON.stringify(p.folha)}::jsonb,
      p_departamentos => ${JSON.stringify(p.departamentos)}::jsonb,
      p_substituir => ${p.substituir}
    ) as r
  `.execute(tx);
  return r.rows[0]?.r ?? {};
}

export async function excluirFolha(tx: Tx, folhaId: string): Promise<string> {
  const r = await sql<{ competencia: string }>`
    select rh.excluir_folha(p_folha_id => ${folhaId}::uuid)::text as competencia
  `.execute(tx);
  return r.rows[0]?.competencia ?? "";
}

export async function classificar(
  tx: Tx,
  codigo: number,
  grupo: string,
  usuarioId: string,
): Promise<void> {
  await tx
    .updateTable("rh.rubricas")
    .set({
      grupo: sql`${grupo}::rh.grupo_rubrica`,
      classificada_por: usuarioId,
      classificada_em: sql`now()`,
    })
    .where("codigo", "=", codigo)
    .execute();
}

// ---------------------------------------------------------------------------
// Folha para conferir e corrigir (valores individuais)
// ---------------------------------------------------------------------------

export function folha(tx: Tx, id: string) {
  return tx
    .selectFrom("rh.folhas")
    .select(["id", "competencia", "status", "ficticia"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export function pessoasDaFolha(tx: Tx, folhaId: string) {
  return tx
    .selectFrom("rh.folha_colaboradores as p")
    .leftJoin("rh.colaboradores as c", "c.id", "p.colaborador_id")
    .select([
      "p.colaborador_id",
      "p.situacao",
      "p.tipo_contrato",
      "p.departamento_id",
      "p.cargo_id",
      "p.horas_mes_min",
      "p.salario",
      "p.liquido",
      "c.nome",
      "c.matricula",
    ])
    .where("p.folha_id", "=", folhaId)
    .orderBy("p.colaborador_id")
    .execute();
}

export function rubricasDaFolha(tx: Tx, folhaId: string) {
  return tx
    .selectFrom("rh.folha_rubricas")
    .select([
      "colaborador_id",
      "rubrica_codigo",
      "natureza",
      "referencia",
      "valor",
    ])
    .where("folha_id", "=", folhaId)
    .orderBy("id")
    .execute();
}

export async function competenciaDaFolha(
  tx: Tx,
  folhaId: string,
): Promise<string | null> {
  const l = await tx
    .selectFrom("rh.folhas")
    .select("competencia")
    .where("id", "=", folhaId)
    .executeTakeFirst();
  return l?.competencia ?? null;
}

export async function salvarPessoaDaFolha(
  tx: Tx,
  p: {
    folhaId: string;
    colaboradorId: string;
    pessoa: unknown;
    rubricas: unknown;
  },
): Promise<void> {
  await sql`
    select rh.salvar_pessoa_folha(
      p_folha_id => ${p.folhaId}::uuid,
      p_colaborador_id => ${p.colaboradorId}::uuid,
      p_pessoa => ${JSON.stringify(p.pessoa)}::jsonb,
      p_rubricas => ${JSON.stringify(p.rubricas)}::jsonb
    )
  `.execute(tx);
}

// ---------------------------------------------------------------------------
// Tabela do plano
// ---------------------------------------------------------------------------

export function beneficioDoPlano(tx: Tx, id: string) {
  return tx
    .selectFrom("rh.beneficios")
    .select(["id", "nome", "tipo"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function temTabela(
  tx: Tx,
  beneficioId: string,
  vigencia: string,
): Promise<boolean> {
  const l = await tx
    .selectFrom("rh.plano_tabelas")
    .select("id")
    .where("beneficio_id", "=", beneficioId)
    .where("vigente_desde", "=", vigencia)
    .executeTakeFirst();
  return !!l;
}

export async function importarTabelaDoPlano(
  tx: Tx,
  p: {
    importacaoId: string;
    beneficioId: string;
    reajuste: number | null;
    faixas: unknown;
    coparticipacao: unknown;
  },
): Promise<void> {
  await sql`
    select rh.importar_tabela_plano(
      p_importacao_id => ${p.importacaoId}::uuid,
      p_beneficio_id => ${p.beneficioId}::uuid,
      p_reajuste_pct => ${p.reajuste}::numeric,
      p_faixas => ${JSON.stringify(p.faixas)}::jsonb,
      p_coparticipacao => ${JSON.stringify(p.coparticipacao)}::jsonb
    )
  `.execute(tx);
}

export async function salvarFaixas(
  tx: Tx,
  tabelaId: string,
  faixas: unknown,
): Promise<void> {
  await sql`
    select rh.salvar_faixas_plano(
      p_tabela_id => ${tabelaId}::uuid,
      p_faixas => ${JSON.stringify(faixas)}::jsonb
    )
  `.execute(tx);
}
