import { semComunicacao } from "@arp/shared/cameras";
import { formatarNumero } from "@arp/shared/formato";
import {
  INTEGRACOES,
  linhaDoProduto,
  type Sistema,
  separarSegredos,
} from "@arp/shared/integracoes";
import { paraBrasilia } from "@arp/shared/os/tempo";
import { env } from "@/config/env";
import { createClaudeClient } from "@/connectors/claude/client";
import {
  createCopilotoRhClient,
  ESCOPOS_NECESSARIOS,
} from "@/connectors/copiloto-rh/client";
import { createDiarioDeObrasClient } from "@/connectors/diario-de-obras/client";
import { createGrowattClient } from "@/connectors/growatt/client";
import { ConnectorError, mensagemSegura } from "@/connectors/http";
import { createSecullumClient } from "@/connectors/secullum/client";
import { createWpsClient } from "@/connectors/wps/client";
import type { Contexto } from "@/contexto";
import { banco } from "@/infra/banco";
import {
  type Credencial,
  configClaude,
  configCopiloto,
  configDiario,
  configGrowatt,
  configSecullum,
  configWps,
  IntegracaoNaoConfigurada,
} from "@/modules/sync/credenciais.service";
import { iniciarAutorizacaoRdCrm } from "./autorizacao-rd-crm";

// Teste de conexão de cada integração (só leitura; não gasta o limite do
// /Calcular do Secullum) e o que cada integração tem de próprio além do
// formulário: a autorização (OAuth) e o que fazer ao remover. As gerais
// ficam aqui; o Marketing acrescenta as dele (mkt_*) com `estenderIntegracao`.

export interface ResultadoTeste {
  ok: boolean;
  mensagem: string;
}

/** Um teste só, ou um por produto (Google e Meta: um login, vários produtos). */
export type Teste = (
  c: Credencial,
) => Promise<string | { produto: string; testar: () => Promise<string> }[]>;

/** Para onde a pessoa segue (tela da ferramenta) e o cookie que guarda o state. */
export interface Autorizacao {
  url: string;
  cookie: { nome: string; valor: string; caminho: string; segundos: number };
}

export interface ExtensaoDaIntegracao {
  testar?: Teste;
  /** "Conectar com …": recebe o id do app (o campo `autorizar.campo`). */
  autorizar?: (ctx: Contexto, clientId: string) => Promise<Autorizacao>;
  /** Antes de apagar a credencial (ex.: revogar o acesso na ferramenta). */
  aoRemover?: () => Promise<void>;
  /** Depois de salvar, ou de um teste que deu certo (ex.: reler os dados). */
  aoMudar?: () => void;
}

/** Endereço que as câmeras chamam (não muda: está configurado nelas). */
const ROTA_CAMERAS = "/api/cameras/contagem";

/**
 * Câmeras: não há API para chamar, então mostra o endereço para configurar
 * nelas e o último contato de cada uma, com "sem comunicação" depois de 3
 * heartbeats.
 */
async function situacaoDasCameras(
  c: Credencial,
  agora = new Date(),
): Promise<string> {
  const p = INTEGRACOES.cameras.parametros.parse(c.parametros);
  const intervalo = Number(p.heartbeat_min);
  const endereco = `${env.SITE_URL}${ROTA_CAMERAS}`;
  const cameras = await banco.comoServico((tx) =>
    tx
      .selectFrom("integracao.cameras")
      .select(["deviceid", "ultimo_contato"])
      .orderBy("deviceid")
      .execute(),
  );
  if (!cameras.length)
    return `Pronto para receber. Endereço nas câmeras: ${endereco} (nenhuma câmera enviou ainda)`;
  const linhas = cameras.map((k) => {
    const ultimo = new Date(k.ultimo_contato);
    const { data: dia, hora } = paraBrasilia(ultimo);
    const quando = `${dia.split("-").reverse().join("/")} ${hora}`;
    return semComunicacao(ultimo, agora, intervalo)
      ? `${k.deviceid}: sem comunicação desde ${quando}`
      : `${k.deviceid}: último contato ${quando}`;
  });
  return `Endereço nas câmeras: ${endereco} · ${formatarNumero(cameras.length)} câmeras\n${linhas.join("\n")}`;
}

const EXTENSOES: Partial<Record<Sistema, ExtensaoDaIntegracao>> = {
  secullum: {
    async testar(c) {
      const config = configSecullum(c);
      const api = createSecullumClient(config);
      const bancos = await api.listarBancos();
      const doBanco = bancos.find((b) => String(b.id) === config.bancoId);
      if (!doBanco) {
        const ids = bancos.map((b) => `${b.id} (${b.nome})`).join(", ");
        throw new Error(
          `login aceito, mas o banco ${config.bancoId} não está liberado para este usuário. Bancos disponíveis: ${ids || "nenhum"}`,
        );
      }
      const deps = await api.departamentos();
      return `Conectado ao banco “${doBanco.nome}” · ${formatarNumero(deps.length)} departamentos`;
    },
  },
  wps: {
    async testar(c) {
      // A lista de garagens responde na hora; as leituras do dia podem levar
      // minutos na WPS e prenderiam o botão.
      const config = configWps(c);
      const garagens = await createWpsClient(config).garagens();
      const g = garagens.find((x) => x.id === config.estacionamentoId);
      if (!g) {
        const ids = garagens
          .map((x) => `${x.id} (${x.descricao ?? "sem nome"})`)
          .join(", ");
        throw new Error(
          `login aceito, mas o estacionamento ${config.estacionamentoId} não está liberado para este usuário. Disponíveis: ${ids || "nenhum"}`,
        );
      }
      return `Conectado ao estacionamento ${g.id}${g.descricao ? ` (${g.descricao})` : ""}`;
    },
  },
  diario_de_obras: {
    async testar(c) {
      const e = await createDiarioDeObrasClient(configDiario(c)).empresa();
      const obras =
        e.log === undefined
          ? ""
          : ` · ${formatarNumero(e.log.totalObras)} obras`;
      return `Conectado à empresa “${e.nome}”${obras}`;
    },
  },
  rd_crm: {
    // Sem chamar a API: renovar troca o refresh token (o antigo para de
    // valer), e isso só a sincronização faz. A leitura real aparece no
    // histórico.
    async testar(c) {
      const def = INTEGRACOES.rd_crm;
      def.parametros.parse(c.parametros);
      if (!separarSegredos(def, c.segredo).refresh_token)
        throw new IntegracaoNaoConfigurada(
          "rd_crm",
          "falta clicar em Conectar com o RD Station CRM",
        );
      return "Autorizado. As oportunidades são lidas todo dia e em Sincronizar agora.";
    },
    autorizar: iniciarAutorizacaoRdCrm,
  },
  cameras: { testar: (c) => situacaoDasCameras(c) },
  sus_growatt: {
    // O token pode ser de um instalador e ver usinas de outros clientes: a
    // mensagem cita só a usina configurada e, se ela não aparecer, só
    // quantas o token vê (sem nomes).
    async testar(c) {
      const api = createGrowattClient(configGrowatt(c));
      const usina = await api.detalhes().catch(async (erro: unknown) => {
        if (!(erro instanceof ConnectorError) || erro.status !== 404)
          throw erro;
        const n = await api.quantasUsinas().catch(() => null);
        throw new Error(
          `token aceito, mas a usina ${api.usinaId} não aparece para ele${n === null ? "" : ` (ele vê ${formatarNumero(n)} usinas)`}; confira o id no portal da Growatt`,
        );
      });
      const a = await api.agora();
      const kwh = (v: number | null) => formatarNumero(v ?? 0, 1);
      return `Conectado à usina “${usina.name}” (${formatarNumero(usina.peak_power ?? 0)} kWp) · agora ${kwh(a.current_power)} kW · hoje ${kwh(a.today_energy)} kWh · total ${formatarNumero(a.total_energy ?? 0)} kWh`;
    },
  },
  claude: {
    // Só consulta o modelo (não gasta tokens).
    async testar(c) {
      const m = await createClaudeClient(configClaude(c)).verificar();
      return `Chave aceita · modelo ${m.nome} (${m.id})`;
    },
  },
  copiloto_rh: {
    async testar(c) {
      const api = createCopilotoRhClient(configCopiloto(c));
      const me = await api.me();
      const faltam = ESCOPOS_NECESSARIOS.filter((s) => !me.scopes.includes(s));
      if (faltam.length > 0)
        throw new Error(
          `login aceito, mas faltam escopos na credencial do Copiloto: ${faltam.join(", ")}`,
        );
      const ativos = await api.totalColaboradores({
        status: ["active", "on_leave"],
      });
      return `Conectado à empresa “${me.organization.name}” · ${formatarNumero(ativos)} colaboradores ativos`;
    },
  },
};

/**
 * Acrescenta o teste, a autorização e a remoção de uma integração de outro
 * módulo. Chame na carga do módulo (ex.: no index.ts do Marketing).
 */
export function estenderIntegracao(
  sistema: Sistema,
  extensao: ExtensaoDaIntegracao,
): void {
  EXTENSOES[sistema] = { ...EXTENSOES[sistema], ...extensao };
}

export const extensaoDe = (sistema: Sistema): ExtensaoDaIntegracao =>
  EXTENSOES[sistema] ?? {};

/**
 * O "message" que as APIs de marketing devolvem no erro (ex.: "API não
 * ativada", "token expirado"), sem sequências de dígitos.
 */
function daApi(erro: ConnectorError): string {
  const m = /"(?:message|error_description)"\s*:\s*"([^"]{1,200})"/.exec(
    erro.detalhe ?? "",
  );
  return m?.[1] ? ` (${m[1].replace(/\d[\d.\-/]{7,}\d/g, "…")})` : "";
}

function explicar(erro: unknown): string {
  if (erro instanceof ConnectorError) {
    // Refresh token do OAuth vencido ou revogado (Google em modo de teste:
    // 7 dias). Só autorizando de novo.
    if (/"error"\s*:\s*"invalid_grant"/.test(erro.detalhe ?? ""))
      return "o acesso expirou ou foi revogado: clique em Conectar de novo";
    // Google Ads: o nível de acesso é o do projeto do Google Cloud.
    if (/CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION/.test(erro.detalhe ?? ""))
      return "o projeto do Google Cloud ainda não tem o nível Exploração da Google Ads API";
    if (erro.status === 401 || erro.status === 403)
      return `acesso recusado (HTTP ${erro.status}): confira usuário, senha ou token${daApi(erro)}`;
    if (erro.status === 404)
      return `endereço não encontrado (HTTP 404): confira a URL e os ids${daApi(erro)}`;
    if (erro.status === undefined && /formato/.test(erro.message))
      return "a API respondeu num formato inesperado";
    const msg = daApi(erro);
    if (msg)
      return `a API recusou: ${erro.message.replace(/^\[[a-z_]+\] /, "")}${msg}`;
  }
  if (erro instanceof Error && erro.name === "ZodError")
    return "campos incompletos ou inválidos";
  return mensagemSegura(erro).replace(/^\[[a-z_]+\] /, "");
}

export async function testarConexao(
  sistema: Sistema,
  c: Credencial,
): Promise<ResultadoTeste> {
  const { testar } = extensaoDe(sistema);
  if (!testar)
    return {
      ok: false,
      mensagem: "Falhou: o teste desta integração ainda não está disponível",
    };
  let r: Awaited<ReturnType<Teste>>;
  try {
    r = await testar(c);
  } catch (erro) {
    return { ok: false, mensagem: `Falhou: ${explicar(erro)}` };
  }
  if (typeof r === "string") return { ok: true, mensagem: r };
  // Cada produto à parte: um que falha não esconde os que funcionam.
  const feitos = await Promise.allSettled(r.map((t) => t.testar()));
  const linhas = r.map((t, i) => {
    const f = feitos[i];
    return f?.status === "fulfilled"
      ? linhaDoProduto(t.produto, true, f.value)
      : linhaDoProduto(t.produto, false, explicar(f?.reason));
  });
  return {
    ok: feitos.every((f) => f.status === "fulfilled"),
    mensagem: linhas.join("\n"),
  };
}
