import "server-only";
import {
  INTEGRACOES,
  type SistemaGoogle,
  separarSegredos,
} from "@/lib/integracoes";
import { type Credencial, credencialSalva } from "../integracoes";

// App OAuth do Google (Client ID e secret), que fica no cartão do Google. O
// YouTube usa o mesmo app com outro login, então lê o de lá. Quem chama já
// conferiu podeConfigurar (as duas seguem a mesma permissão do Marketing).

export interface AppGoogle {
  clientId: string;
  clientSecret: string;
}

/**
 * O app de cada acesso: o do Google sai de `c` (o que está sendo salvo) ou
 * do salvo; o do YouTube, sempre do Google salvo. null se faltar.
 */
export async function appGoogle(
  sistema: SistemaGoogle,
  c?: Credencial,
): Promise<AppGoogle | null> {
  const def = INTEGRACOES.mkt_google;
  const fonte =
    sistema === "mkt_google" && c ? c : await credencialSalva("mkt_google");
  if (!fonte) return null;
  const p = def.parametros.safeParse(fonte.parametros);
  const s = separarSegredos(def, fonte.segredo);
  if (!p.success || !p.data.client_id || !s.client_secret) return null;
  return { clientId: String(p.data.client_id), clientSecret: s.client_secret };
}
