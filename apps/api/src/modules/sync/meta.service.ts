import { somarDias } from "@arp/shared/marketing/periodo";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import { mensagemSegura } from "@/connectors/http";
import { banco } from "@/infra/banco";
import { esquecerLeituras } from "@/modules/marketing/memoria";
import { meta } from "./credenciais.service";
import { executar } from "./execucao.service";
import { diasDoInstagram, JANELA_META_DIAS } from "./meta.regras";
import * as repo from "./meta.repository";

// Sincronização da Meta para as Redes (só leitura). Duas partes:
// 1. Foto de hoje dos seguidores do Instagram e da página do Facebook (a API
//    só dá o número de agora: o histórico começa no dia da ligação).
// 2. Métricas diárias do Instagram (alcance, visualizações, interações) dos
//    dias que faltam nas últimas 18 semanas, uma chamada por dia.
// Anúncios, posts e demografia são lidos ao vivo (módulo Marketing).
// Pode parar no meio (prazo da rodada): o que foi gravado fica e a próxima
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
  const m = await meta();

  // Ao terminar, as telas releem a Meta (o revalidateTag de antes).
  return executar(SISTEMA, RECURSO, async () => {
    const avisos: string[] = [];
    let fotos = 0;

    // 1. Seguidores de hoje.
    const fotoDe = async (
      rede: "instagram" | "facebook",
      ler: () => Promise<{ followers_count: number }>,
    ) => {
      try {
        const { followers_count } = await ler();
        await banco.comoServico((tx) =>
          repo.gravarSeguidores(tx, {
            rede,
            dia: hoje,
            seguidores: followers_count,
          }),
        );
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
      const lidos = await banco.comoServico((tx) =>
        repo.diasComMetricas(tx, somarDias(hoje, -JANELA_META_DIAS)),
      );
      const fila = diasDoInstagram(hoje, new Set(lidos));
      while (fila.length && Date.now() < prazo) {
        const lote = fila.splice(0, PARALELO);
        const resultados = await Promise.allSettled(
          lote.map(async (dia) => ({
            dia,
            v: await m.api.instagramDia(m.instagram, dia),
          })),
        );
        const linhas: repo.MetricasDoDia[] = [];
        for (const r of resultados) {
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
          await banco.comoServico((tx) => repo.gravarMetricas(tx, linhas));
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
  }).finally(() => esquecerLeituras("meta"));
}
