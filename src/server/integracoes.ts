import "server-only";
import {
  createDiarioDeObrasClient,
  type DiarioDeObrasConfig,
} from "@/connectors/diario-de-obras/client";
import { ConnectorError, mensagemSegura } from "@/connectors/http";
import {
  createSecullumClient,
  type SecullumConfig,
} from "@/connectors/secullum/client";
import { createWpsClient, type WpsConfig } from "@/connectors/wps/client";
import { formatarNumero } from "@/lib/formato";
import { INTEGRACOES, type Sistema } from "@/lib/integracoes";
import { createAdminClient } from "@/lib/supabase/admin";
import { decifrar } from "./cofre";
import { env } from "./env";

// Credenciais das integrações. Valem as salvas em Administração ›
// Integrações; sem elas, as variáveis de ambiente (.env / Vercel).

export interface Credencial {
  parametros: Record<string, unknown>;
  segredo: string;
}

export class IntegracaoNaoConfigurada extends Error {
  constructor(sistema: Sistema, detalhe: string) {
    super(`${INTEGRACOES[sistema].nome}: ${detalhe}`);
    this.name = "IntegracaoNaoConfigurada";
  }
}

/** Credencial salva na tela, já decifrada; null se não houver. */
export async function credencialSalva(
  sistema: Sistema,
): Promise<(Credencial & { ativa: boolean }) | null> {
  const { data, error } = await createAdminClient()
    .schema("integracao")
    .from("credenciais")
    .select("parametros, segredo_cifrado, ativa")
    .eq("sistema", sistema)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler a credencial: ${error.message}`);
  if (!data) return null;
  return {
    parametros: (data.parametros ?? {}) as Record<string, unknown>,
    segredo: decifrar(data.segredo_cifrado, sistema),
    ativa: data.ativa,
  };
}

/** A credencial em uso: a salva (se ativa) ou a do ambiente. */
export async function credencialEmUso(sistema: Sistema): Promise<Credencial> {
  const salva = await credencialSalva(sistema);
  if (salva) {
    if (!salva.ativa)
      throw new IntegracaoNaoConfigurada(sistema, "integração desativada");
    return salva;
  }
  const doAmbiente = DO_AMBIENTE[sistema]();
  if (!doAmbiente)
    throw new IntegracaoNaoConfigurada(
      sistema,
      "cadastre o acesso em Administração › Integrações",
    );
  return doAmbiente;
}

const DO_AMBIENTE: Record<Sistema, () => Credencial | null> = {
  secullum() {
    const e = env();
    if (!e.SECULLUM_USUARIO || !e.SECULLUM_SENHA || !e.SECULLUM_BANCO_ID)
      return null;
    return {
      parametros: {
        usuario: e.SECULLUM_USUARIO,
        banco_id: e.SECULLUM_BANCO_ID,
      },
      segredo: e.SECULLUM_SENHA,
    };
  },
  wps() {
    const e = env();
    if (
      !e.WPS_BASE_URL ||
      !e.WPS_USUARIO ||
      !e.WPS_SENHA ||
      !e.WPS_ESTACIONAMENTO_ID
    )
      return null;
    return {
      parametros: {
        base_url: e.WPS_BASE_URL,
        usuario: e.WPS_USUARIO,
        estacionamento_id: e.WPS_ESTACIONAMENTO_ID,
      },
      segredo: e.WPS_SENHA,
    };
  },
  diario_de_obras: () => null,
};

/** Há credencial completa nas variáveis de ambiente? (Nunca devolve valores.) */
export function temNoAmbiente(sistema: Sistema): boolean {
  return DO_AMBIENTE[sistema]() !== null;
}

// ---------------------------------------------------------------------------
// Configuração de cada conector a partir da credencial
// ---------------------------------------------------------------------------

function configSecullum({ parametros, segredo }: Credencial): SecullumConfig {
  const p = INTEGRACOES.secullum.parametros.parse(parametros);
  return {
    usuario: String(p.usuario),
    senha: segredo,
    bancoId: String(p.banco_id),
  };
}

function configWps({ parametros, segredo }: Credencial): WpsConfig {
  const p = INTEGRACOES.wps.parametros.parse(parametros);
  return {
    baseUrl: String(p.base_url),
    usuario: String(p.usuario),
    senha: segredo,
    estacionamentoId: Number(p.estacionamento_id),
  };
}

function configDiario({ segredo }: Credencial): DiarioDeObrasConfig {
  return { token: segredo };
}

export async function secullum() {
  return createSecullumClient(
    configSecullum(await credencialEmUso("secullum")),
  );
}

export async function wps() {
  return createWpsClient(configWps(await credencialEmUso("wps")));
}

export async function diarioDeObras() {
  return createDiarioDeObrasClient(
    configDiario(await credencialEmUso("diario_de_obras")),
  );
}

// ---------------------------------------------------------------------------
// Teste de conexão (só leitura; não gasta o limite do /Calcular do Secullum)
// ---------------------------------------------------------------------------

export interface ResultadoTeste {
  ok: boolean;
  mensagem: string;
}

const TESTES: Record<Sistema, (c: Credencial) => Promise<string>> = {
  async secullum(c) {
    const config = configSecullum(c);
    const api = createSecullumClient(config);
    const bancos = await api.listarBancos();
    const banco = bancos.find((b) => String(b.id) === config.bancoId);
    if (!banco) {
      const ids = bancos.map((b) => `${b.id} (${b.nome})`).join(", ");
      throw new Error(
        `login aceito, mas o banco ${config.bancoId} não está liberado para este usuário. Bancos disponíveis: ${ids || "nenhum"}`,
      );
    }
    const deps = await api.departamentos();
    return `Conectado ao banco “${banco.nome}” · ${formatarNumero(deps.length)} departamentos`;
  },
  async wps(c) {
    const config = configWps(c);
    const r = await createWpsClient(config).entradas(new Date());
    return `Conectado ao estacionamento ${config.estacionamentoId} · ${formatarNumero(r.quantidade)} entradas hoje`;
  },
  async diario_de_obras(c) {
    const e = await createDiarioDeObrasClient(configDiario(c)).empresa();
    const obras =
      e.log === undefined ? "" : ` · ${formatarNumero(e.log.totalObras)} obras`;
    return `Conectado à empresa “${e.nome}”${obras}`;
  },
};

function explicar(erro: unknown): string {
  if (erro instanceof ConnectorError) {
    if (erro.status === 401 || erro.status === 403)
      return `acesso recusado (HTTP ${erro.status}): confira usuário, senha ou token`;
    if (erro.status === 404)
      return "endereço não encontrado (HTTP 404): confira a URL e os ids";
    if (erro.status === undefined && /formato/.test(erro.message))
      return "a API respondeu num formato inesperado";
  }
  if (erro instanceof Error && erro.name === "ZodError")
    return "campos incompletos ou inválidos";
  return mensagemSegura(erro).replace(/^\[[a-z_]+\] /, "");
}

export async function testarConexao(
  sistema: Sistema,
  c: Credencial,
): Promise<ResultadoTeste> {
  try {
    return { ok: true, mensagem: await TESTES[sistema](c) };
  } catch (erro) {
    return { ok: false, mensagem: `Falhou: ${explicar(erro)}` };
  }
}
