import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { lerEnvioCamera } from "@/lib/cameras";
import { INTEGRACOES, separarSegredos } from "@/lib/integracoes";
import { createAdminClient } from "@/lib/supabase/admin";
import { credencialEmUso, IntegracaoNaoConfigurada } from "../integracoes";

// Recebe o envio automático das câmeras (rota /api/cameras/contagem). Não há
// pessoa logada: quem autoriza é o usuário e a senha do cartão "Câmeras" de
// Administração › Integrações, conferidos antes de qualquer gravação. Só
// então a service role grava em integracao.cameras e camera_contagens.

export type Recebimento =
  | "gravado"
  /** Usuário ou senha não batem (ou o cartão não existe / está desativado). */
  | "nao_autorizado"
  /** status ou data fora do formato da câmera. */
  | "formato";

/** Compara em tempo constante, sem vazar o tamanho. */
function igual(a: string, b: string): boolean {
  const h = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(h(a), h(b));
}

async function autorizado(account: string, password: string) {
  try {
    const c = await credencialEmUso("cameras");
    const p = INTEGRACOES.cameras.parametros.safeParse(c.parametros);
    const senha = separarSegredos(INTEGRACOES.cameras, c.segredo).segredo;
    if (!p.success || !senha) return false;
    // Os dois sempre: o tempo não diz qual errou.
    const usuarioOk = igual(account, String(p.data.usuario));
    const senhaOk = igual(password, senha);
    return usuarioOk && senhaOk;
  } catch (erro) {
    if (erro instanceof IntegracaoNaoConfigurada) return false;
    throw erro;
  }
}

export async function receberEnvioCamera(
  form: FormData,
  agora = new Date(),
): Promise<Recebimento> {
  const campo = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : null;
  };
  if (!(await autorizado(campo("account") ?? "", campo("password") ?? "")))
    return "nao_autorizado";

  const envio = lerEnvioCamera({
    status: campo("status"),
    data: campo("data"),
  });
  if (!envio) return "formato";

  const db = createAdminClient().schema("integracao");
  const contato = await db
    .from("cameras")
    .upsert(
      { deviceid: envio.deviceid, ultimo_contato: agora.toISOString() },
      { onConflict: "deviceid" },
    );
  if (contato.error) throw contato.error;

  if (envio.tipo === "contagem") {
    // Reenvio do mesmo período regrava a linha, sem somar de novo.
    const { error } = await db.from("camera_contagens").upsert(
      {
        deviceid: envio.deviceid,
        inicio: envio.inicio.toISOString(),
        fim: envio.fim.toISOString(),
        entradas: envio.entradas,
        saidas: envio.saidas,
        recebido_em: agora.toISOString(),
      },
      { onConflict: "deviceid,inicio" },
    );
    if (error) throw error;
  }
  return "gravado";
}
