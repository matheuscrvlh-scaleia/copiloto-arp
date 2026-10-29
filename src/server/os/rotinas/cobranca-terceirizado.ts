import "server-only";
import { formatarNumeroOS } from "@/lib/os/numeros";
import { dataHoraBr } from "@/lib/os/relatorios";
import { rotaOrdem } from "@/lib/os/rotas";
import { notificar, ordem, osAdmin } from "../base";

// Prazo do terceirizado (spec 4.8): um dia antes de vencer, o responsável
// da OS recebe o aviso para cobrar; o botão "Cobrar pelo WhatsApp" fica no
// bloco da OS, com a mensagem pronta. Um aviso por OS (cobranca_avisada_em
// e a chave da notificação). Roda pela rotina /api/cron/os (service role)
// e devolve quantas OS avisou.

const ANTECEDENCIA_MS = 24 * 3_600_000;

export async function rotinaCobrancaTerceirizado(agora: Date): Promise<number> {
  const db = osAdmin();
  const { data, error } = await db
    .from("ordens")
    .select(
      "id, numero, titulo, responsavel_id, aberto_por, prazo_terceirizado",
    )
    .eq("tipo", "os")
    .eq("execucao", "terceirizada")
    .in("status", ["aberto", "em_andamento", "aguardando"])
    .is("cobranca_avisada_em", null)
    .not("prazo_terceirizado", "is", null)
    .lte(
      "prazo_terceirizado",
      new Date(agora.getTime() + ANTECEDENCIA_MS).toISOString(),
    );
  if (error) throw new Error(`Cobrança do terceirizado: ${error.message}`);

  const ids = (data ?? []).map((c) => c.id);
  if (!ids.length) return 0;
  const { data: links } = await db
    .from("terceirizado_links")
    .select("ordem_id, criado_por, terminado_em")
    .in("ordem_id", ids)
    .is("cancelado_em", null);

  let avisadas = 0;
  for (const ch of data ?? []) {
    const link = links?.find((l) => l.ordem_id === ch.id);
    // Já terminou pelo link: não há o que cobrar.
    if (link?.terminado_em) continue;
    const prazo = ch.prazo_terceirizado as string;
    const vencido = new Date(prazo).getTime() < agora.getTime();
    await notificar([ch.responsavel_id ?? link?.criado_por ?? ch.aberto_por], {
      tipo: "cobranca",
      titulo: `${formatarNumeroOS(ch.numero)} ${ch.titulo}`,
      texto: vencido
        ? `O prazo do terceirizado venceu em ${dataHoraBr(prazo)}. Cobre pelo WhatsApp na OS.`
        : `O prazo do terceirizado vence em ${dataHoraBr(prazo)}. Cobre pelo WhatsApp na OS.`,
      href: rotaOrdem(ch.id),
      alvo: ordem(ch.id),
      // Link novo (outro prazo) avisa de novo: a chave leva o prazo.
      chave: `cobranca:${ch.id}:${prazo}`,
    });
    const { error: e } = await db
      .from("ordens")
      .update({ cobranca_avisada_em: agora.toISOString() })
      .eq("id", ch.id);
    if (e) console.error("cobrança do terceirizado", ch.id, e);
    else avisadas++;
  }
  return avisadas;
}
