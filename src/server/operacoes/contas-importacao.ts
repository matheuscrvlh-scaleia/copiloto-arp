import "server-only";
import { createHash } from "node:crypto";
import {
  mediaDaUnidade,
  type Papel,
  somarMeses,
} from "@/lib/operacoes/energisa-contas";
import {
  montarPrevia,
  type PreviaFatura,
  resumoSchema,
} from "@/lib/operacoes/energisa-previa";
import type { Json } from "@/lib/supabase/database.types";
import { lerTudo } from "@/server/supabase-paginas";
import { falhar, op, parametros } from "./base";

// Apoio às ações da importação das faturas da Energisa (acoes/contas.ts):
// remontar a prévia a partir do que ficou gravado na importação e conferir
// com o que já está no sistema (unidade cadastrada, fatura gravada, média
// dos 12 meses anteriores).

export const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export interface ImportacaoEnergisa {
  id: string;
  resumo: Json;
}

/**
 * As prévias das importações, conferidas com o banco. Importação com o
 * resumo fora do formato (não deveria acontecer) fica de fora.
 */
export async function previasDe(
  importacoes: ImportacaoEnergisa[],
): Promise<PreviaFatura[]> {
  const lidas = importacoes.flatMap((i) => {
    const r = resumoSchema.safeParse(i.resumo);
    if (!r.success) {
      console.error("resumo da importação da Energisa inválido", i.id);
      return [];
    }
    return [{ id: i.id, resumo: r.data }];
  });
  if (!lidas.length) return [];
  const banco = await op();
  const matriculas = [...new Set(lidas.map((l) => l.resumo.matricula))];
  const refs = lidas.map((l) => l.resumo.fatura.referencia).sort();
  const desde = somarMeses(refs[0] as string, -12);
  const ate = refs.at(-1) as string;
  const [unidades, gravadas, historico, p] = await Promise.all([
    banco
      .from("energia_unidades")
      .select("matricula, apelido, papel")
      .in("matricula", matriculas),
    banco
      .from("energia_faturas")
      .select("importacao_id")
      .in(
        "importacao_id",
        lidas.map((l) => l.id),
      ),
    lerTudo(() =>
      banco
        .from("energia_faturas")
        .select("id, matricula, referencia, consumo_kwh")
        .eq("vigente", true)
        .in("matricula", matriculas)
        .gte("referencia", desde)
        .lt("referencia", ate)
        .order("id"),
    ),
    parametros(),
  ]);
  falhar(unidades.error);
  falhar(gravadas.error);
  const porMatricula = new Map(
    (unidades.data ?? []).map((u) => [u.matricula, u]),
  );
  const comFatura = new Set((gravadas.data ?? []).map((g) => g.importacao_id));
  return lidas.map(({ id, resumo }) => {
    const u = porMatricula.get(resumo.matricula);
    const m = mediaDaUnidade(
      historico,
      resumo.matricula,
      resumo.fatura.referencia,
    );
    return montarPrevia(
      {
        importacaoId: id,
        arquivo: resumo.arquivo,
        fatura: resumo.fatura,
        unidade: u ? { apelido: u.apelido, papel: u.papel as Papel } : null,
        gravada: comFatura.has(id),
        media: m ? { kwh: m.media, meses: m.meses } : null,
      },
      Number(p.energia_alerta_pct),
    );
  });
}

/** As prévias de fatura da Energisa abertas pela pessoa, da mais antiga à mais nova. */
export async function minhasPrevias(usuarioId: string) {
  const { data, error } = await (await op())
    .from("importacoes")
    .select("id, resumo")
    .eq("tipo", "energisa")
    .eq("status", "previa")
    .eq("criado_por", usuarioId)
    .order("criado_em")
    .limit(100);
  falhar(error);
  return previasDe(data ?? []);
}
