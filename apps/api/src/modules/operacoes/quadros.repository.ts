import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas e gravações dos quadros de medidores (spec 4.5), todas com a
// sessão (RLS de operacoes.energia.*). O histórico de ocupantes só é lido
// para quem tem operacoes.energia.historico (e o RLS também esconde). As
// funções do banco (trocar_locatario, liberar_caixa, registrar_termo)
// conferem a permissão com auth.uid().

const COLUNAS_QUADRO = [
  "id",
  "codigo",
  "nome",
  "bloco",
  "projeto",
  "subestacao",
  "roteiro_base",
  "armario",
  "disjuntor_geral",
  "espacos",
  "observacoes",
  "fotos",
  "ordem",
  "ativo",
  "exemplo",
] as const;

/** Quadros na ordem do cadastro. */
export function quadros(tx: Tx) {
  return tx
    .selectFrom("operacoes.quadros")
    .select([...COLUNAS_QUADRO])
    .orderBy("ordem")
    .orderBy("bloco")
    .orderBy("codigo")
    .execute();
}

export function quadro(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.quadros")
    .select([...COLUNAS_QUADRO])
    .where("id", "=", id)
    .executeTakeFirst();
}
export type LinhaDoQuadro = NonNullable<Awaited<ReturnType<typeof quadro>>>;

/** Contagem por quadro, feita no banco (operacoes.resumo_quadros). */
export async function resumoDosQuadros(tx: Tx): Promise<unknown> {
  const r = await sql<{
    r: unknown;
  }>`select operacoes.resumo_quadros() as r`.execute(tx);
  return r.rows[0]?.r ?? [];
}

/** Contratos vigentes do ENET (os.lojas), pela função do banco. */
export async function contratosEnet(tx: Tx): Promise<unknown> {
  const r = await sql<{
    r: unknown;
  }>`select operacoes.enet_contratos() as r`.execute(tx);
  return r.rows[0]?.r ?? [];
}

function consultaDeCaixas(tx: Tx) {
  return tx
    .selectFrom("operacoes.caixas as c")
    .leftJoin("operacoes.salas as s", "s.id", "c.sala_id")
    .select((eb) => [
      "c.id",
      "c.quadro_id",
      "c.numero",
      "c.numero_antigo",
      "c.lado",
      "c.coluna",
      "c.linha",
      "c.rota",
      "c.sala_id",
      "c.salas_texto",
      "c.pavimento",
      "c.status",
      "c.ocupante",
      "c.ocupante_documento",
      "c.ocupante_desde",
      "c.contrato",
      "c.ocupante_origem",
      "c.locatario_novo",
      "c.termo_externo",
      "c.disjuntor_amperes",
      "c.ligacao",
      "c.disjuntor_texto",
      "c.medidor_situacao",
      "c.medidor_numero",
      "c.modulo",
      "c.observacoes",
      "c.exemplo",
      "s.bloco as cadastro_bloco",
      "s.sala as cadastro_sala",
      "s.pavimento as cadastro_pavimento",
      eb
        .selectFrom("operacoes.termos as t")
        .select((e) => e.fn.countAll<number>().as("n"))
        .whereRef("t.caixa_id", "=", "c.id")
        .as("termos"),
    ]);
}
export type LinhaDaCaixa = Awaited<
  ReturnType<ReturnType<typeof consultaDeCaixas>["execute"]>
>[number];

/** Caixas de um quadro (ou de todos), na ordem do desenho. */
export function caixas(tx: Tx, quadroId: string | null) {
  let q = consultaDeCaixas(tx);
  if (quadroId) q = q.where("c.quadro_id", "=", quadroId);
  return q
    .orderBy("c.quadro_id")
    .orderBy("c.lado")
    .orderBy("c.linha")
    .orderBy("c.coluna")
    .orderBy("c.numero")
    .limit(2000)
    .execute();
}

export function caixa(tx: Tx, id: string) {
  return consultaDeCaixas(tx).where("c.id", "=", id).executeTakeFirst();
}

/** Cadastro de salas, com quantas caixas cada uma tem. */
export function salas(tx: Tx) {
  return tx
    .selectFrom("operacoes.salas as s")
    .select((eb) => [
      "s.id",
      "s.codigo",
      "s.bloco",
      "s.sala",
      "s.pavimento",
      eb
        .selectFrom("operacoes.caixas as c")
        .select((e) => e.fn.countAll<number>().as("n"))
        .whereRef("c.sala_id", "=", "s.id")
        .as("caixas"),
    ])
    .orderBy("s.bloco")
    .orderBy("s.sala")
    .orderBy("s.id")
    .limit(5000)
    .execute();
}

/** Termos da caixa, do mais novo ao mais antigo. */
export function termosDaCaixa(tx: Tx, caixaId: string) {
  return tx
    .selectFrom("operacoes.termos")
    .select([
      "id",
      "versao",
      "locatario",
      "documento",
      "bloco",
      "sala",
      "data_emissao",
      "emitido_em",
      "emitido_por",
      "docx",
    ])
    .where("caixa_id", "=", caixaId)
    .orderBy("versao", "desc")
    .execute();
}

/** Histórico de ocupantes (sigiloso): quem chama confere a permissão antes. */
export function historicoDaCaixa(tx: Tx, caixaId: string) {
  return tx
    .selectFrom("operacoes.caixa_ocupantes")
    .select(["id", "nome", "documento", "entrada", "saida", "origem"])
    .where("caixa_id", "=", caixaId)
    .orderBy(sql`saida desc nulls last`)
    .orderBy("nome")
    .execute();
}

/** Últimos termos emitidos (todas as caixas). */
export function termosRecentes(tx: Tx, limite: number) {
  return tx
    .selectFrom("operacoes.termos")
    .select([
      "id",
      "caixa_id",
      "versao",
      "locatario",
      "bloco",
      "sala",
      "data_emissao",
      "emitido_em",
      "docx",
    ])
    .orderBy("emitido_em", "desc")
    .limit(limite)
    .execute();
}

/** Termo para baixar: arquivos e campos do nome; undefined se o RLS esconde. */
export function termo(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.termos")
    .select([
      "id",
      "caixa_id",
      "versao",
      "bloco",
      "sala",
      "locatario",
      "pdf",
      "docx",
    ])
    .where("id", "=", id)
    .executeTakeFirst();
}

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

export interface DadosDoQuadro {
  nome: string;
  bloco: string;
  projeto: string | null;
  subestacao: string | null;
  roteiro_base: string | null;
  armario: string | null;
  disjuntor_geral: string | null;
  espacos: number | null;
  ordem: number;
  observacoes: string | null;
}

export function atualizarQuadro(tx: Tx, id: string, q: DadosDoQuadro) {
  return tx
    .updateTable("operacoes.quadros")
    .set(q)
    .where("id", "=", id)
    .returning("id")
    .execute();
}

export function inserirQuadro(tx: Tx, q: DadosDoQuadro & { codigo: string }) {
  return tx.insertInto("operacoes.quadros").values(q).execute();
}

export function fotosDoQuadro(tx: Tx, id: string, fotos: string[]) {
  return tx
    .updateTable("operacoes.quadros")
    .set({ fotos })
    .where("id", "=", id)
    .returning("id")
    .execute();
}

/** Número da caixa que já ocupa a posição no desenho (outra que não `id`). */
export async function caixaNaPosicao(
  tx: Tx,
  p: {
    quadro_id: string;
    lado: string;
    coluna: number;
    linha: number;
    id?: string;
  },
): Promise<string | null> {
  let q = tx
    .selectFrom("operacoes.caixas")
    .select("numero")
    .where("quadro_id", "=", p.quadro_id)
    .where("lado", "=", p.lado)
    .where("coluna", "=", p.coluna)
    .where("linha", "=", p.linha);
  if (p.id) q = q.where("id", "<>", p.id);
  const r = await q.limit(1).executeTakeFirst();
  return r?.numero ?? null;
}

export interface DadosDaCaixa {
  numero: string;
  numero_antigo: string | null;
  lado: string;
  coluna: number;
  linha: number;
  rota: string | null;
  sala_id: string | null;
  salas_texto: string | null;
  pavimento: string | null;
  status: string;
  disjuntor_amperes: number | null;
  ligacao: string | null;
  disjuntor_texto?: string | null;
  medidor_situacao: string | null;
  medidor_numero: string | null;
  modulo: string | null;
  observacoes: string | null;
  termo_externo: boolean;
}

export function atualizarCaixa(tx: Tx, id: string, c: DadosDaCaixa) {
  return tx
    .updateTable("operacoes.caixas")
    .set(c)
    .where("id", "=", id)
    .returning("id")
    .execute();
}

export function inserirCaixa(tx: Tx, c: DadosDaCaixa & { quadro_id: string }) {
  return tx
    .insertInto("operacoes.caixas")
    .values(c)
    .returning("id")
    .executeTakeFirstOrThrow();
}

export async function trocarLocatario(
  tx: Tx,
  v: {
    caixa: string;
    nome: string;
    documento: string;
    desde: string;
    contrato: string | null;
    origem: "manual" | "enet";
  },
): Promise<void> {
  await sql`select operacoes.trocar_locatario(
    p_caixa => ${v.caixa},
    p_nome => ${v.nome},
    p_documento => ${v.documento},
    p_desde => ${v.desde}::date,
    p_contrato => ${v.contrato},
    p_origem => ${v.origem}
  )`.execute(tx);
}

export async function liberarCaixa(
  tx: Tx,
  v: { caixa: string; saida: string; status: string },
): Promise<void> {
  await sql`select operacoes.liberar_caixa(
    p_caixa => ${v.caixa},
    p_saida => ${v.saida}::date,
    p_status => ${v.status}
  )`.execute(tx);
}

export async function proximaVersaoDoTermo(
  tx: Tx,
  caixa: string,
): Promise<number> {
  const r = await sql<{
    v: number;
  }>`select operacoes.proxima_versao_termo(p_caixa => ${caixa}) as v`.execute(
    tx,
  );
  return Number(r.rows[0]?.v ?? 1);
}

export interface TermoParaRegistrar {
  caixa: string;
  versao: number;
  locatario: string;
  documento: string;
  qualificacao: string;
  bloco: string;
  pavimento: string;
  sala: string;
  projeto: string;
  amperes: number | null;
  ligacao: string;
  armario: string;
  rota: string;
  observacao_tecnica: string;
  data_emissao: string;
  pdf: string;
  docx: string;
}

export async function registrarTermo(
  tx: Tx,
  t: TermoParaRegistrar,
): Promise<void> {
  await sql`select operacoes.registrar_termo(
    p_caixa => ${t.caixa},
    p_versao => ${t.versao}::int,
    p_locatario => ${t.locatario},
    p_documento => ${t.documento},
    p_qualificacao => ${t.qualificacao},
    p_bloco => ${t.bloco},
    p_pavimento => ${t.pavimento},
    p_sala => ${t.sala},
    p_projeto => ${t.projeto},
    p_amperes => ${t.amperes}::int,
    p_ligacao => ${t.ligacao},
    p_armario => ${t.armario},
    p_rota => ${t.rota},
    p_observacao_tecnica => ${t.observacao_tecnica},
    p_data_emissao => ${t.data_emissao}::date,
    p_pdf => ${t.pdf},
    p_docx => ${t.docx}
  )`.execute(tx);
}
