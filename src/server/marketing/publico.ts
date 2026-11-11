import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { z } from "zod";
import type { ContagemCamera } from "@/lib/marketing/publico";
import { createAdminClient } from "@/lib/supabase/admin";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";

// Fluxo de pessoas das câmeras (integracao.camera_contagens, que só o
// servidor lê). Confere a permissão no banco antes da service role; o
// resultado vale igual para todos e fica no cache por alguns minutos.

const PAGINA = 1000;

const linha = z.object({
  deviceid: z.string(),
  inicio: z.string(),
  entradas: z.number().int().nonnegative(),
});

export interface DadosPublico {
  contagens: ContagemCamera[];
  /** Último contato de cada câmera (heartbeat ou contagem). */
  cameras: { deviceid: string; ultimoContato: string }[];
}

async function lerCameras(desde: string): Promise<DadosPublico> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAG.marketing.cameras);
  const db = createAdminClient().schema("integracao");
  const contagens: ContagemCamera[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await db
      .from("camera_contagens")
      .select("deviceid, inicio, entradas")
      .gte("inicio", desde)
      .order("inicio")
      .order("deviceid")
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(`Falha ao ler as câmeras: ${error.message}`);
    contagens.push(...z.array(linha).parse(data ?? []));
    if ((data?.length ?? 0) < PAGINA) break;
  }
  const { data, error } = await db
    .from("cameras")
    .select("deviceid, ultimo_contato")
    .order("deviceid");
  if (error) throw new Error(`Falha ao ler as câmeras: ${error.message}`);
  return {
    contagens,
    cameras: (data ?? []).map((c) => ({
      deviceid: c.deviceid,
      ultimoContato: c.ultimo_contato,
    })),
  };
}

/**
 * Contagens desde o 1º de janeiro do ano anterior ao de `hoje` (o
 * comparativo anual usa os dois anos). null: sem a permissão.
 */
export const dadosPublico = cache(
  async (hoje: string): Promise<DadosPublico | null> => {
    if (!(await podeAgora("marketing.publico"))) return null;
    const ano = Number(hoje.slice(0, 4)) - 1;
    return lerCameras(`${ano}-01-01T03:00:00Z`);
  },
);
