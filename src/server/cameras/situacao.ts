import "server-only";
import { semComunicacao } from "@/lib/cameras";
import { formatarNumero } from "@/lib/formato";
import { INTEGRACOES } from "@/lib/integracoes";
import { paraBrasilia } from "@/lib/os/tempo";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Credencial } from "../integracoes";
import { origem } from "../marketing/autorizacao-rd";

// Teste do cartão "Câmeras" (quem chama já conferiu podeConfigurar): não há
// API para chamar, então mostra o endereço para configurar nas câmeras e o
// último contato de cada uma, com "sem comunicação" depois de 3 heartbeats.

export const ROTA_CAMERAS = "/api/cameras/contagem";

export async function situacaoDasCameras(
  c: Credencial,
  agora = new Date(),
): Promise<string> {
  const p = INTEGRACOES.cameras.parametros.parse(c.parametros);
  const intervalo = Number(p.heartbeat_min);
  const endereco = `${await origem()}${ROTA_CAMERAS}`;
  const { data, error } = await createAdminClient()
    .schema("integracao")
    .from("cameras")
    .select("deviceid, ultimo_contato")
    .order("deviceid");
  if (error) throw new Error(`Falha ao ler as câmeras: ${error.message}`);
  if (!data.length)
    return `Pronto para receber. Endereço nas câmeras: ${endereco} (nenhuma câmera enviou ainda)`;
  const linhas = data.map((k) => {
    const ultimo = new Date(k.ultimo_contato);
    const { data: dia, hora } = paraBrasilia(ultimo);
    const quando = `${dia.split("-").reverse().join("/")} ${hora}`;
    return semComunicacao(ultimo, agora, intervalo)
      ? `${k.deviceid}: sem comunicação desde ${quando}`
      : `${k.deviceid}: último contato ${quando}`;
  });
  return `Endereço nas câmeras: ${endereco} · ${formatarNumero(data.length)} câmeras\n${linhas.join("\n")}`;
}
