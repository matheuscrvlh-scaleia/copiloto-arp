import { createHash, timingSafeEqual } from "node:crypto";
import { lerEnvioCamera } from "@arp/shared/cameras";
import { INTEGRACOES, separarSegredos } from "@arp/shared/integracoes";
import { banco } from "@/infra/banco";
import {
  credencialEmUso,
  IntegracaoNaoConfigurada,
} from "@/modules/sync/credenciais.service";
import * as repo from "./contagem.repository";

// Recebe o envio automático das câmeras (/api/cameras/contagem). Não há
// pessoa logada: quem autoriza é o usuário e a senha do cartão "Câmeras" de
// Administração › Configurações › Integrações, conferidos antes de qualquer gravação. Só
// então a service role grava em integracao.cameras e camera_contagens.

export type Recebimento =
  | "gravado"
  /** Usuário ou senha não batem (ou o cartão não existe / está desativado). */
  | "nao_autorizado"
  /** status ou data fora do formato da câmera. */
  | "formato";

export interface EnvioRecebido {
  account: string | null;
  password: string | null;
  status: string | null;
  data: string | null;
}

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
  campos: EnvioRecebido,
  agora = new Date(),
): Promise<Recebimento> {
  if (!(await autorizado(campos.account ?? "", campos.password ?? "")))
    return "nao_autorizado";

  const envio = lerEnvioCamera({ status: campos.status, data: campos.data });
  if (!envio) return "formato";

  const iso = agora.toISOString();
  await banco.comoServico(async (tx) => {
    await repo.registrarContato(tx, envio.deviceid, iso);
    if (envio.tipo === "contagem")
      await repo.gravarContagem(tx, {
        deviceid: envio.deviceid,
        inicio: envio.inicio.toISOString(),
        fim: envio.fim.toISOString(),
        entradas: envio.entradas,
        saidas: envio.saidas,
        recebido_em: iso,
      });
  });
  return "gravado";
}
