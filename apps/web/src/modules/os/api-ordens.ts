import { respostaMensagem } from "@arp/shared/os/contratos/base";
import {
  blocoDaOS,
  paginaTerceirizado,
  respostaDaOS,
  respostaOrdens,
} from "@arp/shared/os/contratos/ordens";
import { type Planilha, planilha } from "@arp/shared/os/contratos/visoes";
import type { Busca } from "@arp/shared/os/lista";
import { queryOptions } from "@tanstack/react-query";
import type { EstadoAcao } from "@/components/form-acao";
import { formParaObjeto } from "@/lib/acao";
import { api, ErroDaApi, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";
import { atualizarOs, consultaDaBusca } from "@/modules/os/api";
import type { EstadoOS } from "@/modules/os/components/ordem/tipos";

// Chamadas das Ordens de serviço (prefixo /api/v1/os/ordens) e do link do
// terceirizado (/api/v1/os/ordem-publica). As gravações têm o mesmo nome e a
// mesma assinatura das Server Actions do sistema antigo
// (`@/server/os/acoes/{ordem,ordens,ordem-arquivos,ordem-terceirizado,ordem-link}`):
// os componentes só trocaram o import. Toda gravação do bloco invalida as
// consultas do módulo (o `refresh()` de antes).

export const chavesDasOrdens = {
  lista: (busca: ReturnType<typeof consultaDaBusca>) =>
    ["os", "ordens", "lista", busca] as const,
  bloco: (id: string) => ["os", "ordens", "bloco", id] as const,
  /** Fora de "os": a tela pública não tem as consultas do módulo. */
  publica: (token: string) => ["ordem-publica", token] as const,
};

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

/** GET /api/v1/os/ordens: a tela Acompanhamento das OS (a URL da tela). */
export const consultaDasOrdens = (busca: Busca) => {
  const consulta = consultaDaBusca(busca);
  return queryOptions({
    queryKey: chavesDasOrdens.lista(consulta),
    queryFn: ({ signal }) =>
      api.get("/os/ordens", {
        esquema: respostaOrdens,
        consulta,
        sinal: signal,
      }),
  });
};

/**
 * GET /api/v1/os/ordens/:id/bloco. `null`: a pessoa não vê a OS (o bloco e o
 * cronômetro não aparecem, como antes).
 */
export const consultaDoBloco = (id: string) =>
  queryOptions({
    queryKey: chavesDasOrdens.bloco(id),
    queryFn: ({ signal }) =>
      api
        .get(`/os/ordens/${encodeURIComponent(id)}/bloco`, {
          esquema: blocoDaOS,
          sinal: signal,
        })
        .catch((erro: unknown) => {
          if (erro instanceof ErroDaApi && erro.status === 404) return null;
          throw erro;
        }),
  });

/** GET /api/v1/os/ordens/exportacao: o filtro inteiro, lido no clique. */
export function exportarOrdens(
  busca: Record<string, string>,
): Promise<Planilha> {
  return api.get("/os/ordens/exportacao", {
    esquema: planilha,
    consulta: busca,
  });
}

/**
 * GET /api/v1/os/ordem-publica/:token. `null`: link inexistente, cancelado
 * ou de OS já fechada.
 */
export const consultaDaOrdemPublica = (token: string) =>
  queryOptions({
    queryKey: chavesDasOrdens.publica(token),
    queryFn: ({ signal }) =>
      api
        .get(`/os/ordem-publica/${encodeURIComponent(token)}`, {
          esquema: paginaTerceirizado,
          sinal: signal,
          irParaOLogin: false,
        })
        .catch((erro: unknown) => {
          if (erro instanceof ErroDaApi && erro.status === 404) return null;
          throw erro;
        }),
    // O endereço das fotos vale por pouco tempo: sempre relê ao abrir.
    staleTime: 0,
  });

// ---------------------------------------------------------------------------
// Gravações do bloco da OS
// ---------------------------------------------------------------------------

type AcaoDaOS = (anterior: EstadoOS, form: FormData) => Promise<EstadoOS>;

const ordemDe = (form: FormData) =>
  `/os/ordens/${encodeURIComponent(String(form.get("ordem_id")))}`;
const itemDe = (form: FormData) => encodeURIComponent(String(form.get("id")));

/** O formulário sem o `ordem_id` (que vai no endereço). */
function campos(form: FormData, listas: string[] = []) {
  const { ordem_id: _ordem, ...resto } = formParaObjeto(form, { listas });
  return resto;
}

/** Multipart sem o `ordem_id`. */
function arquivosDe(form: FormData): FormData {
  const copia = new FormData();
  for (const [k, v] of form.entries()) if (k !== "ordem_id") copia.append(k, v);
  return copia;
}

/** Ação do bloco: grava, relê as telas do módulo e devolve o estado. */
function acaoDaOS(
  metodo: "POST" | "PATCH" | "DELETE",
  caminho: (form: FormData) => string,
  corpo: (form: FormData) => unknown = () => undefined,
): AcaoDaOS {
  return async (_anterior, form) => {
    try {
      const r = await api.pedir(metodo, caminho(form), corpo(form), {
        esquema: respostaDaOS,
      });
      await atualizarOs();
      return {
        ok: r.mensagem,
        ...(r.concluir !== undefined ? { concluir: r.concluir } : {}),
        ...(r.motivo !== undefined ? { motivo: r.motivo } : {}),
        ...(r.whatsapp !== undefined ? { whatsapp: r.whatsapp } : {}),
      };
    } catch (erro) {
      return { erro: mensagemDoErro(erro) };
    }
  };
}

/** POST /api/v1/os/ordens/:id/tempo/iniciar */
export const iniciarTempo = acaoDaOS(
  "POST",
  (f) => `${ordemDe(f)}/tempo/iniciar`,
);

/** POST /api/v1/os/ordens/:id/tempo/pausar (finalizar=1: propõe concluir) */
export const pausarTempo = acaoDaOS(
  "POST",
  (f) => `${ordemDe(f)}/tempo/pausar`,
  (f) => campos(f),
);

/** POST /api/v1/os/ordens/:id/sessoes (com `id`: corrige) */
export const salvarSessao = acaoDaOS(
  "POST",
  (f) => `${ordemDe(f)}/sessoes`,
  (f) => campos(f, ["tecnicos"]),
);

/** DELETE /api/v1/os/ordens/:id/sessoes/:item */
export const excluirSessao = acaoDaOS(
  "DELETE",
  (f) => `${ordemDe(f)}/sessoes/${itemDe(f)}`,
);

/** PATCH /api/v1/os/ordens/:id/execucao */
export const salvarExecucao = acaoDaOS(
  "PATCH",
  (f) => `${ordemDe(f)}/execucao`,
  (f) => campos(f, ["profissionais"]),
);

/** POST /api/v1/os/ordens/:id/materiais (com `id`: corrige) */
export const salvarMaterial = acaoDaOS(
  "POST",
  (f) => `${ordemDe(f)}/materiais`,
  (f) => campos(f),
);

/** DELETE /api/v1/os/ordens/:id/materiais/:item */
export const excluirMaterial = acaoDaOS(
  "DELETE",
  (f) => `${ordemDe(f)}/materiais/${itemDe(f)}`,
);

/** PATCH /api/v1/os/ordens/:id/rateio */
export const salvarRateio = acaoDaOS(
  "PATCH",
  (f) => `${ordemDe(f)}/rateio`,
  (f) => campos(f),
);

/** PATCH /api/v1/os/ordens/:id/custo-terceirizado */
export const salvarCustoTerceirizado = acaoDaOS(
  "PATCH",
  (f) => `${ordemDe(f)}/custo-terceirizado`,
  (f) => campos(f),
);

/** PATCH /api/v1/os/ordens/:id/outros-custos */
export const salvarOutrosCustos = acaoDaOS(
  "PATCH",
  (f) => `${ordemDe(f)}/outros-custos`,
  (f) => campos(f),
);

/** PATCH /api/v1/os/ordens/:id/resultado */
export const salvarResultado = acaoDaOS(
  "PATCH",
  (f) => `${ordemDe(f)}/resultado`,
  (f) => campos(f),
);

/** POST /api/v1/os/ordens/:id/concluir */
export const concluirOS = acaoDaOS("POST", (f) => `${ordemDe(f)}/concluir`);

/** POST /api/v1/os/ordens/:id/arquivos (multipart) */
export const enviarArquivos = acaoDaOS(
  "POST",
  (f) => `${ordemDe(f)}/arquivos`,
  arquivosDe,
);

/** DELETE /api/v1/os/ordens/:id/arquivos/:item */
export const removerArquivo = acaoDaOS(
  "DELETE",
  (f) => `${ordemDe(f)}/arquivos/${itemDe(f)}`,
);

/** POST /api/v1/os/ordens/:id/assinatura (multipart) */
export const assinarOS = acaoDaOS(
  "POST",
  (f) => `${ordemDe(f)}/assinatura`,
  arquivosDe,
);

/** POST /api/v1/os/ordens/:id/terceirizado/link: gera ou reenvia o link. */
export const enviarAoTerceirizado = acaoDaOS(
  "POST",
  (f) => `${ordemDe(f)}/terceirizado/link`,
  (f) => campos(f),
);

/** DELETE /api/v1/os/ordens/:id/terceirizado/link */
export const cancelarLinkTerceirizado = acaoDaOS(
  "DELETE",
  (f) => `${ordemDe(f)}/terceirizado/link`,
);

/** POST /api/v1/os/ordens/:id/terceirizado/usar */
export const usarDoTerceirizado = acaoDaOS(
  "POST",
  (f) => `${ordemDe(f)}/terceirizado/usar`,
  (f) => campos(f),
);

/** POST /api/v1/os/ordens/:id/orcamento/aprovar */
export const aprovarOrcamento = acaoDaOS(
  "POST",
  (f) => `${ordemDe(f)}/orcamento/aprovar`,
);

// ---------------------------------------------------------------------------
// Link do terceirizado (sem login; vale pelo token)
// ---------------------------------------------------------------------------

type AcaoDoLink = (anterior: EstadoAcao, form: FormData) => Promise<EstadoAcao>;

/** Ação do link: grava e relê a página (o `refresh()` de antes). */
function acaoDoLink(
  passo: string,
  corpo: (form: FormData) => unknown = () => undefined,
): AcaoDoLink {
  return async (_anterior, form) => {
    const token = String(form.get("token") ?? "");
    try {
      const r = await api.post(
        `/os/ordem-publica/${encodeURIComponent(token)}/${passo}`,
        corpo(form),
        { esquema: respostaMensagem, irParaOLogin: false },
      );
      await clienteDeConsultas
        .invalidateQueries({ queryKey: chavesDasOrdens.publica(token) })
        .catch(() => {});
      return { ok: r.mensagem };
    } catch (erro) {
      return { erro: mensagemDoErro(erro) };
    }
  };
}

/** O formulário sem o `token` (que vai no endereço). */
function semToken(form: FormData) {
  const { token: _token, ...resto } = formParaObjeto(form);
  return resto;
}

function multipartSemToken(form: FormData): FormData {
  const copia = new FormData();
  for (const [k, v] of form.entries()) if (k !== "token") copia.append(k, v);
  return copia;
}

/** POST /api/v1/os/ordem-publica/:token/aceite */
export const aceitar = acaoDoLink("aceite");
/** POST /api/v1/os/ordem-publica/:token/recusa */
export const recusar = acaoDoLink("recusa", semToken);
/** POST /api/v1/os/ordem-publica/:token/chegada */
export const cheguei = acaoDoLink("chegada", semToken);
/** POST /api/v1/os/ordem-publica/:token/termino */
export const terminei = acaoDoLink("termino", semToken);
/** POST /api/v1/os/ordem-publica/:token/relatorio */
export const salvarRelatorio = acaoDoLink("relatorio", semToken);
/** POST /api/v1/os/ordem-publica/:token/arquivos (multipart) */
export const enviarArquivosDoTerceirizado = acaoDoLink(
  "arquivos",
  multipartSemToken,
);
/** POST /api/v1/os/ordem-publica/:token/assinatura (multipart) */
export const assinarPeloLink = acaoDoLink("assinatura", multipartSemToken);
