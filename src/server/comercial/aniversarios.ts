import "server-only";
import { z } from "zod";
import { MAXIMO_SOCIOS } from "@/lib/comercial/ficha";
import type { FichaComSocios } from "@/lib/comercial/relacionamento";
import { podeAgora } from "@/server/auth";
import { lerTudo } from "@/server/supabase-paginas";
import { comAdmin } from "./base";

// Aniversário de sócio pela ficha cadastral (spec 4.7), quando o ENET não
// tem a data de nascimento: fichas PJ e PF usadas em contrato. ficha_dados
// pede comercial.formulario.ver; aqui se lê pela service role só o nome e o
// nascimento de cada pessoa (nada de CPF, endereço ou documento).

const PESSOAS = Array.from({ length: MAXIMO_SOCIOS }, (_, i) => i);
// Uma coluna por pessoa (até MAXIMO_SOCIOS = 5), escrita por extenso para o
// cliente tipado do Supabase conferir a consulta.
const COLUNAS =
  "ficha_id, n0:respostas->pessoas->0->>nome, d0:respostas->pessoas->0->>nascimento, n1:respostas->pessoas->1->>nome, d1:respostas->pessoas->1->>nascimento, n2:respostas->pessoas->2->>nome, d2:respostas->pessoas->2->>nascimento, n3:respostas->pessoas->3->>nome, d3:respostas->pessoas->3->>nascimento, n4:respostas->pessoas->4->>nome, d4:respostas->pessoas->4->>nascimento";

const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullish()
  .catch(null);
const linhaDados = z.looseObject({ ficha_id: z.string() });
const pessoa = z.object({
  nome: z.string().nullish().catch(null),
  nascimento: dataIso,
});

async function lerFichas(exemplo: boolean): Promise<FichaComSocios[]> {
  const db = comAdmin();
  const fichas = await lerTudo<{
    id: string;
    nome: string | null;
    luc: string | null;
  }>(() => {
    let q = db
      .from("fichas")
      .select("id, nome, luc")
      .eq("situacao", "usada")
      .in("tipo", ["pj", "pf"]);
    if (!exemplo) q = q.eq("exemplo", false);
    return q.order("id");
  });
  if (!fichas.length) return [];
  const ids = fichas.map((f) => f.id);
  const [dados, contratos] = await Promise.all([
    lerTudo(() =>
      db
        .from("ficha_dados")
        .select(COLUNAS)
        .in("ficha_id", ids)
        .order("ficha_id"),
    ),
    lerTudo<{ id: string; ficha_id: string | null; lucs: string[] }>(() =>
      db
        .from("contratos")
        .select("id, ficha_id, lucs")
        .eq("tipo", "contrato")
        .in("ficha_id", ids)
        .order("id"),
    ),
  ]);
  const socios = new Map<string, FichaComSocios["socios"]>();
  for (const d of dados) {
    const l = linhaDados.parse(d);
    const campos: Record<string, unknown> = d;
    socios.set(
      l.ficha_id,
      PESSOAS.map((i) =>
        pessoa.parse({ nome: campos[`n${i}`], nascimento: campos[`d${i}`] }),
      )
        .filter((p) => p.nome && p.nascimento)
        .map((p) => ({
          nome: p.nome as string,
          nascimento: p.nascimento as string,
        })),
    );
  }
  const lucDoContrato = new Map(
    contratos
      .filter((c) => c.ficha_id && c.lucs[0])
      .map((c) => [c.ficha_id, c.lucs[0]]),
  );
  return fichas
    .map((f) => ({
      id: f.id,
      nome: f.nome ?? "",
      luc: lucDoContrato.get(f.id) ?? f.luc,
      socios: socios.get(f.id) ?? [],
    }))
    .filter((f) => f.socios.length);
}

/** Para a tela: confere Relacionamento no banco antes da service role. */
export async function sociosDasFichas(): Promise<FichaComSocios[]> {
  if (!(await podeAgora("comercial.relacionamento.ver"))) return [];
  return lerFichas(true);
}

/** Para a rotina (cron, sem sessão): só fichas reais, nunca as de exemplo. */
export function sociosDasFichasSemSessao(): Promise<FichaComSocios[]> {
  return lerFichas(false);
}
