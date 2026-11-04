import "server-only";
import { cache } from "react";
import { ConnectorError, mensagemSegura } from "@/connectors/http";
import { createGoogleClient } from "@/connectors/marketing/google";
import {
  type Descoberta,
  INTEGRACOES,
  type Opcao,
  type SistemaGoogle,
  separarSegredos,
} from "@/lib/integracoes";
import {
  type Credencial,
  credencialSalva,
  podeConfigurar,
} from "../integracoes";
import { appGoogle } from "./app-google";

// Descoberta do Google: com a conta conectada, lista o que ela acessa em cada
// produto (contas do Ads, propriedades do GA4 e do Search Console, contas do
// Perfil da Empresa; no acesso do YouTube, os canais) para a pessoa escolher
// em vez de digitar ids. Uma busca que falha não derruba as outras.

export type Descobertas = Record<string, Descoberta>;

function porque(erro: unknown): string {
  if (
    erro instanceof ConnectorError &&
    /CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION/.test(erro.detalhe ?? "")
  )
    return "o projeto do Google Cloud ainda não tem o nível Exploração da Google Ads API (em Teste, só lê contas de teste)";
  if (erro instanceof ConnectorError && erro.status === 403)
    return "a conta não tem acesso, a API não está ativada no Google Cloud ou ainda aguarda aprovação do Google";
  if (erro instanceof ConnectorError && erro.status === 429)
    return "cota do Google esgotada (no Perfil da Empresa, a cota fica em 0 até o Google aprovar o acesso)";
  return mensagemSegura(erro).replace(/^\[[a-z_]+\] /, "");
}

const formatarAds = (id: string) =>
  id.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");

export async function descobrirGoogle(
  sistema: SistemaGoogle,
  c: Credencial,
): Promise<Descobertas> {
  const def = INTEGRACOES[sistema];
  const s = separarSegredos(def, c.segredo);
  const app = await appGoogle(sistema, c);
  const api = createGoogleClient({
    sistema,
    clientId: app?.clientId ?? "",
    clientSecret: app?.clientSecret ?? "",
    refreshToken: s.refresh_token ?? "",
  });

  const buscas: Record<string, () => Promise<Opcao[]>> = {
    async customer_id() {
      return (await api.contasAds()).map((k) => ({
        valor: k.login ? `${k.id}@${k.login}` : k.id,
        rotulo: `${k.nome || "sem nome"} (${formatarAds(k.id)})${k.login ? ` · pela MCC ${formatarAds(k.login)}` : ""}`,
      }));
    },
    async property_id() {
      return (await api.propriedadesGa4()).map((g) => ({
        valor: g.id,
        rotulo: `${g.nome} · ${g.conta} (${g.id})`,
      }));
    },
    async site_url() {
      return (await api.sitesSearchConsole()).map((u) => ({
        valor: u,
        rotulo: u,
      }));
    },
    async channel_id() {
      return (await api.meusCanais()).map((k) => ({
        valor: k.id,
        rotulo: `${k.nome} (${k.id})`,
      }));
    },
    async account_id() {
      return (await api.contasPerfil()).map((a) => ({
        valor: a.id,
        rotulo: `${a.nome || "sem nome"} (${a.id})`,
      }));
    },
  };

  // Só as listas dos campos deste acesso.
  const nomes = def.campos
    .filter((k) => k.escolha && k.nome in buscas)
    .map((k) => k.nome);
  const feitas = await Promise.allSettled(nomes.map((n) => buscas[n]?.()));
  return Object.fromEntries(
    nomes.map((n, i) => {
      const f = feitas[i];
      return [
        n,
        f?.status === "fulfilled"
          ? { opcoes: f.value ?? [] }
          : { opcoes: [], erro: porque(f?.reason) },
      ];
    }),
  );
}

/**
 * Para a tela: o que a conta Google salva acessa. null sem permissão, sem
 * credencial ou antes de conectar. Nunca falha (a tela mostra sem as listas).
 */
export const descobertasDaTela = cache(
  async (sistema: SistemaGoogle): Promise<Descobertas | null> => {
    try {
      if (!(await podeConfigurar(sistema))) return null;
      const c = await credencialSalva(sistema);
      if (!c?.ativa) return null;
      const s = separarSegredos(INTEGRACOES[sistema], c.segredo);
      if (!s.refresh_token) return null;
      return await descobrirGoogle(sistema, c);
    } catch {
      return null;
    }
  },
);
