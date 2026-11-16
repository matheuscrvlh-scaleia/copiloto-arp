import type { FiltroSaidas } from "@arp/shared/os/saidas";
import { type Selectable, sql } from "kysely";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import type { Tx } from "@/infra/banco";
import type { OsAtivoSaidas } from "@/infra/banco/tipos";

// Saída do ativo: leituras pela sessão (RLS de os.ativo_saidas: quem vê
// ativos ou registra saídas) e as funções do banco que registram e
// desfazem (conferem os.ativos_saida e baixam o ativo numa transação).

export type Saida = Selectable<OsAtivoSaidas>;

/** Saídas do ativo, da mais nova para a mais antiga (inclui as desfeitas). */
export function saidasDoAtivo(tx: Tx, ativoId: string): Promise<Saida[]> {
  return tx
    .selectFrom("os.ativo_saidas")
    .selectAll()
    .where("ativo_id", "=", ativoId)
    .orderBy("registrado_em", "desc")
    .execute();
}

/** Relatório de saídas por período, tipo e responsável (todas as linhas). */
export function relatorio(tx: Tx, f: FiltroSaidas) {
  let q = tx
    .selectFrom("os.ativo_saidas as s")
    .select((eb) => [
      "s.id",
      "s.data",
      "s.tipo",
      "s.quantidade",
      "s.valor",
      "s.forma_recebimento",
      "s.destinatario_nome",
      "s.responsavel_id",
      "s.nota_fiscal",
      "s.nota_fiscal_numero",
      "s.desfeita_em",
      jsonObjectFrom(
        eb
          .selectFrom("os.ativos as a")
          .select(["a.id", "a.codigo", "a.nome"])
          .whereRef("a.id", "=", "s.ativo_id"),
      ).as("ativo"),
    ]);
  if (f.de) q = q.where("s.data", ">=", f.de);
  if (f.ate) q = q.where("s.data", "<=", f.ate);
  if (f.tipo) q = q.where("s.tipo", "=", f.tipo);
  if (f.responsavel)
    q = q.where(sql<string>`s.responsavel_id::text`, "=", f.responsavel);
  if (!f.desfeitas) q = q.where("s.desfeita_em", "is", null);
  return q
    .orderBy("s.data", "desc")
    .orderBy("s.registrado_em", "desc")
    .orderBy("s.id")
    .execute();
}

/** Tipos já usados (filtro do relatório, mesmo os que saíram da lista). */
export async function tiposUsados(tx: Tx): Promise<string[]> {
  const linhas = await tx
    .selectFrom("os.ativo_saidas")
    .select("tipo")
    .distinct()
    .execute();
  return linhas.map((l) => l.tipo);
}

/** Uma saída com o ativo, para o recibo (undefined: não existe ou o RLS esconde). */
export function saidaComAtivo(tx: Tx, id: string) {
  return tx
    .selectFrom("os.ativo_saidas as s")
    .selectAll("s")
    .select((eb) =>
      jsonObjectFrom(
        eb
          .selectFrom("os.ativos as a")
          .select(["a.codigo", "a.nome", "a.bloco", "a.area", "a.ponto"])
          .whereRef("a.id", "=", "s.ativo_id"),
      ).as("ativo"),
    )
    .where("s.id", "=", id)
    .executeTakeFirst();
}

export interface CamposDaSaida {
  tipo: string;
  data: string;
  quantidade: string | null;
  valor: number | null;
  forma: string | null;
  recebido_por: string | null;
  destinatario: string | null;
  documento: string | null;
  responsavel_id: string | null;
  motivo: string | null;
  nf: boolean;
  nf_numero: string | null;
  observacoes: string | null;
  anexos: string[];
}

/** os.registrar_saida_ativo (pela sessão: a função confere a permissão). */
export async function registrarSaidaAtivo(
  tx: Tx,
  ativoId: string,
  s: CamposDaSaida,
): Promise<void> {
  await sql`select os.registrar_saida_ativo(
    p_ativo => ${ativoId}::uuid, p_tipo => ${s.tipo}, p_data => ${s.data}::date,
    p_quantidade => ${s.quantidade}, p_valor => ${s.valor}::numeric,
    p_forma => ${s.forma}, p_recebido_por => ${s.recebido_por},
    p_destinatario => ${s.destinatario}, p_documento => ${s.documento},
    p_responsavel => ${s.responsavel_id}::uuid, p_motivo => ${s.motivo},
    p_nf => ${s.nf}, p_nf_numero => ${s.nf_numero},
    p_observacoes => ${s.observacoes}, p_anexos => ${s.anexos}::text[]
  )`.execute(tx);
}

/** os.registrar_saida_sobra: cria o ativo já baixado e registra a saída. */
export async function registrarSaidaSobra(
  tx: Tx,
  sobra: {
    nome: string;
    categoria_id: string | null;
    bloco: string | null;
    area: string | null;
  },
  s: CamposDaSaida,
): Promise<string | undefined> {
  const r = await sql<{
    ativo_id: string;
  }>`select ativo_id from os.registrar_saida_sobra(
    p_nome => ${sobra.nome}, p_categoria => ${sobra.categoria_id}::uuid,
    p_bloco => ${sobra.bloco}, p_area => ${sobra.area},
    p_tipo => ${s.tipo}, p_data => ${s.data}::date,
    p_quantidade => ${s.quantidade}, p_valor => ${s.valor}::numeric,
    p_forma => ${s.forma}, p_recebido_por => ${s.recebido_por},
    p_destinatario => ${s.destinatario}, p_documento => ${s.documento},
    p_responsavel => ${s.responsavel_id}::uuid, p_motivo => ${s.motivo},
    p_nf => ${s.nf}, p_nf_numero => ${s.nf_numero},
    p_observacoes => ${s.observacoes}, p_anexos => ${s.anexos}::text[]
  )`.execute(tx);
  return r.rows[0]?.ativo_id;
}

export async function desfazerSaida(
  tx: Tx,
  id: string,
  motivo: string,
): Promise<void> {
  await sql`select os.desfazer_saida_ativo(p_saida => ${id}::uuid, p_motivo => ${motivo})`.execute(
    tx,
  );
}
