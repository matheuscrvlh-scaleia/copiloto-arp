import "server-only";
import { mensagemSegura } from "@/connectors/http";
import { somarDias } from "@/lib/marketing/periodo";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { createAdminClient } from "@/lib/supabase/admin";
import { meta } from "../integracoes";
import { executar } from "./execucao";
import { diasDoInstagram, JANELA_META_DIAS } from "./meta-regras";

// Sincronização da Meta para as Redes (só leitura). Duas partes:
// 1. Foto de hoje dos seguidores do Instagram e da página do Facebook (a API
//    só dá o número de agora: o histórico começa no dia da ligação).
// 2. Métricas diárias do Instagram (alcance, visualizações, interações) dos
//    dias que faltam nas últimas 18 semanas, uma chamada por dia.
// Anúncios, posts e demografia são lidos ao vivo (server/marketing/meta.ts).
// Pode parar no meio (prazo da função): o que foi gravado fica e a próxima
// execução continua pelos dias que faltam.

const SISTEMA = "mkt_meta";
const RECURSO = "redes";
/** Dias lidos ao mesmo tempo. */
const PARALELO = 4;

export async function sincronizarMeta(
  opcoes: { agora?: Date; prazoMs?: number } = {},
) {
  const agora = opcoes.agora ?? new Date();
  const prazo = Date.now() + (opcoes.prazoMs ?? 240_000);
  const hoje = hojeEmBrasilia(agora);
  const admin = createAdminClient();
  const tabela = () => admin.schema("marketing").from("redes_dia");
  const m = await meta();

  return executar(admin, SISTEMA, RECURSO, async () => {
    const avisos: string[] = [];
    let fotos = 0;

    // 1. Seguidores de hoje.
    const fotoDe = async (
      rede: "instagram" | "facebook",
      ler: () => Promise<{ followers_count: number }>,
    ) => {
      try {
        const { followers_count } = await ler();
        const { error } = await tabela().upsert(
          { rede, dia: hoje, seguidores: followers_count },
          { onConflict: "rede,dia" },
        );
        if (error) throw error;
        fotos++;
      } catch (erro) {
        avisos.push(`${rede}: ${mensagemSegura(erro).slice(0, 160)}`);
      }
    };
    if (m.instagram)
      await fotoDe("instagram", () => m.api.instagram(m.instagram));
    if (m.pagina) await fotoDe("facebook", () => m.api.pagina(m.pagina));

    // 2. Métricas diárias do Instagram que faltam.
    let dias = 0;
    if (m.instagram) {
      const { data, error } = await tabela()
        .select("dia")
        .eq("rede", "instagram")
        .not("alcance", "is", null)
        .gte("dia", somarDias(hoje, -JANELA_META_DIAS));
      if (error) throw error;
      const fila = diasDoInstagram(hoje, new Set(data.map((d) => d.dia)));
      while (fila.length && Date.now() < prazo) {
        const lote = fila.splice(0, PARALELO);
        const lidos = await Promise.allSettled(
          lote.map(async (dia) => ({
            dia,
            v: await m.api.instagramDia(m.instagram, dia),
          })),
        );
        const linhas = [];
        for (const r of lidos) {
          if (r.status === "rejected") {
            avisos.push(`instagram: ${mensagemSegura(r.reason).slice(0, 160)}`);
            continue;
          }
          const { dia, v } = r.value;
          linhas.push({
            rede: "instagram",
            dia,
            alcance: v.reach,
            visualizacoes: v.views,
            contas_engajadas: v.accounts_engaged,
            interacoes: v.total_interactions,
            toques_links: v.profile_links_taps,
            atualizado_em: new Date().toISOString(),
          });
        }
        if (linhas.length) {
          const { error: e } = await tabela().upsert(linhas, {
            onConflict: "rede,dia",
          });
          if (e) throw e;
          dias += linhas.length;
        }
        // Erro de acesso repete em todo dia: para e avisa uma vez.
        if (linhas.length === 0) break;
      }
      if (fila.length)
        avisos.push(`${fila.length} dias do Instagram ficaram para a próxima`);
    }

    const resultado = { fotos, dias, avisos: avisos.slice(0, 20) };
    return {
      ...resultado,
      registros: fotos + dias,
      cursor: { executado_em: agora.toISOString(), ...resultado },
    };
  });
}
