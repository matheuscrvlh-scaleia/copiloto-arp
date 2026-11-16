import { type Planilha, planilha } from "@arp/shared/os/contratos/visoes";
import {
  type AmbienteDaEntrada,
  detalheDaVistoria,
  type EntradaVistoria,
  type Foto,
  paginaDaVistoria,
  respostaAmbienteIncluido,
  respostaAssinatura,
  respostaCriada,
  respostaEnvio,
  respostaFoto,
  respostaNovaVistoria,
  respostaVistorias,
} from "@arp/shared/os/contratos/vistorias";
import { rotaVistoria } from "@arp/shared/os/rotas";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { Acao, EstadoAcao } from "@/components/form-acao";
import { acaoDaApi, formParaObjeto } from "@/lib/acao";
import {
  api,
  BASE_DA_API,
  type Consulta,
  ErroDaApi,
  mensagemDoErro,
} from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";

// Chamadas das Vistorias do Tickets (prefixo /api/v1/os/vistorias) e do
// link do locatário (/api/v1/os/vistoria-publica, sem login). As gravações
// têm o nome e a assinatura das Server Actions do sistema antigo
// (`@/server/os/acoes/vistorias` e `vistoria-link`).

export const chavesVistorias = {
  tudo: ["os", "vistorias"] as const,
  lista: (busca: Consulta) => ["os", "vistorias", "lista", busca] as const,
  nova: () => ["os", "vistorias", "nova"] as const,
  vistoria: (id: string) => ["os", "vistorias", "vistoria", id] as const,
  /** Link do locatário (sem sessão: fora de "os"). */
  publica: (token: string) => ["vistoria-publica", token] as const,
};

const enc = encodeURIComponent;
const comMensagem = z.object({ mensagem: z.string() });

/** Endereço do laudo em PDF (a API confere a sessão). */
export const hrefDoLaudo = (id: string, busca = "") =>
  `${BASE_DA_API}/os/vistorias/${enc(id)}/laudo${busca}`;

/** Laudo em PDF pelo link do locatário (sem login). */
export const hrefDoLaudoPublico = (token: string) =>
  `${BASE_DA_API}/os/vistoria-publica/${enc(token)}/laudo`;

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

/** GET /api/v1/os/vistorias */
export const consultaDasVistorias = (busca: Consulta) =>
  queryOptions({
    queryKey: chavesVistorias.lista(busca),
    queryFn: ({ signal }) =>
      api.get("/os/vistorias", {
        esquema: respostaVistorias,
        consulta: busca,
        sinal: signal,
      }),
  });

/** GET /api/v1/os/vistorias/nova (as lojas para escolher o contrato). */
export const consultaDaNovaVistoria = queryOptions({
  queryKey: chavesVistorias.nova(),
  queryFn: ({ signal }) =>
    api.get("/os/vistorias/nova", {
      esquema: respostaNovaVistoria,
      sinal: signal,
    }),
});

/** GET /api/v1/os/vistorias/:id */
export const consultaDaVistoria = (id: string) =>
  queryOptions({
    queryKey: chavesVistorias.vistoria(id),
    queryFn: ({ signal }) =>
      api.get(`/os/vistorias/${enc(id)}`, {
        esquema: detalheDaVistoria,
        sinal: signal,
      }),
  });

/** GET /api/v1/os/vistoria-publica/:token (404: link inativo). */
export const consultaDaVistoriaPublica = (token: string) =>
  queryOptions({
    queryKey: chavesVistorias.publica(token),
    queryFn: ({ signal }) =>
      api
        .get(`/os/vistoria-publica/${enc(token)}`, {
          esquema: paginaDaVistoria,
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

/** Exportar: o filtro inteiro, lido só no clique. */
export function exportarVistorias(
  busca: Record<string, string>,
): Promise<Planilha> {
  return api.get("/os/vistorias/exportacao", {
    esquema: planilha,
    consulta: busca,
  });
}

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

/** Renova as telas das vistorias (o `refresh()` de antes). */
function renovar(): Promise<void> {
  return clienteDeConsultas
    .invalidateQueries({ queryKey: chavesVistorias.tudo })
    .catch(() => {});
}

/** Chama a API e traduz em `{ ok }` ou `{ erro }`, como as ações de antes. */
async function chamar<R extends { mensagem: string }>(
  pedido: () => Promise<R>,
  depois?: () => Promise<void>,
): Promise<(EstadoAcao & Omit<R, "mensagem">) | { erro: string }> {
  try {
    const { mensagem, ...resto } = await pedido();
    await depois?.();
    return { ...resto, ok: mensagem };
  } catch (erro) {
    return { erro: mensagemDoErro(erro) };
  }
}

/** POST /api/v1/os/vistorias; depois abre a vistoria criada. */
export const iniciarVistoria = (abrir: (href: string) => void): Acao =>
  acaoDaApi({
    metodo: "POST",
    caminho: "/os/vistorias",
    invalida: [chavesVistorias.tudo],
    mensagem: "",
    aoGravar: (resposta) =>
      abrir(rotaVistoria(respostaCriada.parse(resposta).id)),
  });

/** POST /api/v1/os/vistorias/:id/duplicar; abre a cópia (?duplicada=1). */
export const duplicarVistoria = (abrir: (href: string) => void): Acao =>
  acaoDaApi({
    metodo: "POST",
    caminho: (form) => `/os/vistorias/${enc(String(form.get("id")))}/duplicar`,
    corpo: () => ({}),
    invalida: [chavesVistorias.tudo],
    mensagem: "",
    aoGravar: (resposta) =>
      abrir(`${rotaVistoria(respostaCriada.parse(resposta).id)}?duplicada=1`),
  });

/** PATCH /api/v1/os/vistorias/:id */
export function salvarVistoria(
  entrada: EntradaVistoria & { id: string },
): Promise<EstadoAcao> {
  const { id, ...corpo } = entrada;
  return chamar(
    () =>
      api.patch(`/os/vistorias/${enc(id)}`, corpo, { esquema: comMensagem }),
    renovar,
  );
}

type AmbienteEnviado = {
  id: string;
  titulo: string;
  resposta: "respondido" | "nao_se_aplica" | "pendente";
  descricao: string | null;
  problema: boolean;
};

/** PATCH /api/v1/os/vistorias/:id/ambientes/:ambiente (um ambiente só). */
export function salvarAmbiente(
  entrada: AmbienteEnviado & { vistoria_id: string },
): Promise<EstadoAcao> {
  const { id, vistoria_id, ...corpo } = entrada;
  return chamar(() =>
    api.patch(`/os/vistorias/${enc(vistoria_id)}/ambientes/${enc(id)}`, corpo, {
      esquema: comMensagem,
    }),
  );
}

/** POST /api/v1/os/vistorias/:id/ambientes */
export function adicionarAmbiente(entrada: {
  vistoriaId: string;
  titulo: string;
  ordem: number;
}): Promise<EstadoAcao & { id?: string; entrada?: AmbienteDaEntrada | null }> {
  return chamar(() =>
    api.post(
      `/os/vistorias/${enc(entrada.vistoriaId)}/ambientes`,
      { titulo: entrada.titulo, ordem: entrada.ordem },
      { esquema: respostaAmbienteIncluido },
    ),
  );
}

/** DELETE /api/v1/os/vistorias/ambientes/:id */
export function removerAmbiente(entrada: { id: string }): Promise<EstadoAcao> {
  return chamar(() =>
    api.delete(`/os/vistorias/ambientes/${enc(entrada.id)}`, {
      esquema: comMensagem,
    }),
  );
}

/** PUT /api/v1/os/vistorias/:id/ambientes/ordem */
export function ordenarAmbientes(entrada: {
  vistoriaId: string;
  ids: string[];
}): Promise<EstadoAcao> {
  return chamar(() =>
    api.put(
      `/os/vistorias/${enc(entrada.vistoriaId)}/ambientes/ordem`,
      { ids: entrada.ids },
      { esquema: comMensagem },
    ),
  );
}

/**
 * POST /api/v1/os/vistorias/:id/ambientes/:ambiente/fotos (multipart). O
 * formulário traz vistoria_id, ambiente_id e o arquivo, como antes.
 */
export function enviarFoto(
  form: FormData,
): Promise<EstadoAcao & { foto?: Foto }> {
  const vistoria = String(form.get("vistoria_id"));
  const ambiente = String(form.get("ambiente_id"));
  const corpo = new FormData();
  const arquivo = form.get("arquivo");
  if (arquivo) corpo.append("arquivo", arquivo);
  return chamar(() =>
    api.post(
      `/os/vistorias/${enc(vistoria)}/ambientes/${enc(ambiente)}/fotos`,
      corpo,
      { esquema: respostaFoto },
    ),
  );
}

/** DELETE /api/v1/os/vistorias/fotos/:id */
export function removerFoto(entrada: { id: string }): Promise<EstadoAcao> {
  return chamar(() =>
    api.delete(`/os/vistorias/fotos/${enc(entrada.id)}`, {
      esquema: comMensagem,
    }),
  );
}

/** POST /api/v1/os/vistorias/:id/assinaturas/:parte (multipart, PNG). */
export function salvarAssinatura(
  form: FormData,
): Promise<EstadoAcao & { url?: string | null }> {
  const vistoria = String(form.get("vistoria_id"));
  const parte = String(form.get("parte"));
  const corpo = new FormData();
  const arquivo = form.get("arquivo");
  if (arquivo) corpo.append("arquivo", arquivo);
  return chamar(
    () =>
      api.post(
        `/os/vistorias/${enc(vistoria)}/assinaturas/${enc(parte)}`,
        corpo,
        { esquema: respostaAssinatura },
      ),
    renovar,
  );
}

/** DELETE /api/v1/os/vistorias/:id/assinaturas/:parte */
export function removerAssinatura(entrada: {
  vistoriaId: string;
  parte: "locador" | "locatario";
}): Promise<EstadoAcao> {
  return chamar(
    () =>
      api.delete(
        `/os/vistorias/${enc(entrada.vistoriaId)}/assinaturas/${entrada.parte}`,
        { esquema: comMensagem },
      ),
    renovar,
  );
}

/** POST /api/v1/os/vistorias/:id/envio (o laudo e o WhatsApp). */
export function prepararEnvio(entrada: {
  vistoriaId: string;
}): Promise<EstadoAcao & { link?: string; whatsapp?: string }> {
  return chamar(() =>
    api.post(`/os/vistorias/${enc(entrada.vistoriaId)}/envio`, undefined, {
      esquema: respostaEnvio,
    }),
  );
}

/** POST /api/v1/os/vistorias/:id/link-assinatura */
export function enviarParaAssinatura(entrada: {
  vistoriaId: string;
}): Promise<EstadoAcao & { link?: string; whatsapp?: string }> {
  return chamar(
    () =>
      api.post(
        `/os/vistorias/${enc(entrada.vistoriaId)}/link-assinatura`,
        undefined,
        { esquema: respostaEnvio },
      ),
    renovar,
  );
}

/** POST /api/v1/os/vistoria-publica/:token/assinatura (sem login). */
export async function assinarVistoriaPeloLink(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const token = String(form.get("token") ?? "");
  const corpo = new FormData();
  for (const [k, v] of Object.entries(formParaObjeto(form)))
    if (k !== "token" && !Array.isArray(v)) corpo.append(k, v);
  return chamar(
    () =>
      api.post(`/os/vistoria-publica/${enc(token)}/assinatura`, corpo, {
        esquema: comMensagem,
        irParaOLogin: false,
      }),
    () =>
      clienteDeConsultas
        .invalidateQueries({ queryKey: chavesVistorias.publica(token) })
        .catch(() => {}),
  );
}
