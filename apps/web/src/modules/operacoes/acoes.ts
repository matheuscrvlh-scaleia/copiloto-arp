import type {
  ArquivoParaEnviar,
  EnvioPreparado,
  PedidoDePrevia,
  PreviaAgua,
  RespostaPrevia,
} from "@arp/shared/operacoes/agua-importacao";
import {
  respostaConfirmarAgua,
  respostaEnvioAgua,
  respostaPreviaAbertaAgua,
  respostaPreviaAgua,
} from "@arp/shared/operacoes/contratos/agua";
import {
  respostaLinkDeEnvio,
  respostaMensagem,
} from "@arp/shared/operacoes/contratos/base";
import {
  respostaCadastroDaUnidade,
  respostaCriado,
  respostaLerFatura,
  respostaPreviasDeFatura,
} from "@arp/shared/operacoes/contratos/energia";
import {
  type PreviaConta,
  respostaConfirmarConta,
  respostaLerConta,
  respostaPreviaAbertaConta,
} from "@arp/shared/operacoes/contratos/importacoes";
import type { PreviaFatura } from "@arp/shared/operacoes/energisa-previa";
import type { Acao, EstadoAcao } from "@/components/form-acao";
import { acaoDaApi, formParaObjeto } from "@/lib/acao";
import { api, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";
import type { Navegador } from "@/lib/navegacao";
import { chavesOp } from "./api";

export type { PreviaConta };

// Gravações de Operações (parte A) pela API, com os mesmos nomes e a mesma
// forma das Server Actions do sistema antigo: os componentes portados
// continuam chamando `acao(estado, form)` ou a função direta, e recebem
// `{ ok }` / `{ erro }` como antes. Cada uma invalida as consultas do que
// mudou (o `refresh()` de antes).

const AGUA = [chavesOp.agua(), chavesOp.painel(), chavesOp.importacoes()];
const ENERGIA = [chavesOp.energia(), chavesOp.painel()];
const CONTAS = [chavesOp.contas(), chavesOp.painel(), chavesOp.importacoes()];

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "");

async function invalidar(chaves: readonly (readonly string[])[]) {
  await Promise.all(
    chaves.map((queryKey) =>
      clienteDeConsultas.invalidateQueries({ queryKey }).catch(() => {}),
    ),
  );
}

/** Chama a API e traduz em `{ ok }` / `{ erro }` (o EstadoAcao de antes). */
async function executar(
  fazer: () => Promise<unknown>,
  invalida: readonly (readonly string[])[],
  ok?: string,
): Promise<EstadoAcao> {
  try {
    const r = await fazer();
    await invalidar(invalida);
    const m = respostaMensagem.safeParse(r);
    return { ok: ok ?? (m.success ? m.data.mensagem : "Salvo.") };
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

// ---------------------------------------------------------------------------
// Água: importação mensal
// ---------------------------------------------------------------------------

export async function prepararEnvioAgua(
  arquivos: ArquivoParaEnviar[],
): Promise<EnvioPreparado> {
  try {
    return await api.post(
      "/operacoes/agua/importacao/envio",
      { arquivos },
      { esquema: respostaEnvioAgua },
    );
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

export async function previaAgua(
  pedido: PedidoDePrevia,
): Promise<RespostaPrevia> {
  try {
    const r = await api.post("/operacoes/agua/importacao/previa", pedido, {
      esquema: respostaPreviaAgua,
    });
    if ("previa" in r) await invalidar([chavesOp.importacoes()]);
    return r;
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

export async function limparEnvioAgua(envio: string): Promise<void> {
  await api
    .delete(`/operacoes/agua/importacao/envios/${envio}`)
    .catch(() => undefined);
}

export async function previaAbertaAgua(): Promise<PreviaAgua | null> {
  try {
    const r = await api.get("/operacoes/agua/importacao/previa-aberta", {
      esquema: respostaPreviaAbertaAgua,
    });
    return r.previa;
  } catch {
    return null;
  }
}

export async function confirmarAgua(entrada: {
  id: string;
  motivo?: string;
}): Promise<{ ok: string; referencia: string } | { erro: string }> {
  try {
    const r = await api.post(
      `/operacoes/agua/importacao/${entrada.id}/confirmar`,
      { motivo: entrada.motivo },
      { esquema: respostaConfirmarAgua },
    );
    await invalidar(AGUA);
    return { ok: r.mensagem, referencia: r.referencia };
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

export function descartarAgua(id: string): Promise<EstadoAcao> {
  return executar(
    () => api.post(`/operacoes/agua/importacao/${id}/descartar`),
    [chavesOp.importacoes()],
  );
}

// ---------------------------------------------------------------------------
// Água: vínculo do hidrômetro
// ---------------------------------------------------------------------------

export const corrigirVinculo: Acao = acaoDaApi({
  metodo: "POST",
  caminho: "/operacoes/agua/vinculos",
  invalida: [chavesOp.agua()],
});

export const removerVinculo: Acao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/operacoes/agua/vinculos/${texto(form, "id")}`,
  invalida: [chavesOp.agua()],
});

// ---------------------------------------------------------------------------
// Água: conta da concessionária
// ---------------------------------------------------------------------------

export async function lerContaAgua(
  form: FormData,
): Promise<{ previa: PreviaConta } | { erro: string }> {
  try {
    const r = await api.post("/operacoes/agua/contas", form, {
      esquema: respostaLerConta,
    });
    await invalidar([chavesOp.importacoes()]);
    return r;
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

export async function previaAbertaContaAgua(): Promise<PreviaConta | null> {
  try {
    const r = await api.get("/operacoes/agua/contas/previa-aberta", {
      esquema: respostaPreviaAbertaConta,
    });
    return r.previa;
  } catch {
    return null;
  }
}

export async function confirmarContaAgua(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao & { avisos?: string[] }> {
  try {
    const r = await api.post(
      `/operacoes/agua/contas/${texto(form, "importacao")}/confirmar`,
      formParaObjeto(form),
      { esquema: respostaConfirmarConta },
    );
    await invalidar(AGUA);
    return { ok: r.mensagem, avisos: r.avisos };
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

export function descartarContaAgua(id: string): Promise<EstadoAcao> {
  return executar(
    () => api.post(`/operacoes/agua/contas/${id}/descartar`),
    [chavesOp.importacoes()],
  );
}

export const corrigirContaAgua: Acao = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) => `/operacoes/agua/contas/${texto(form, "importacao")}`,
  invalida: AGUA,
});

// ---------------------------------------------------------------------------
// Água: correções do que a importação trouxe
// ---------------------------------------------------------------------------

export const salvarLeituraAgua: Acao = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) => `/operacoes/agua/leituras/${texto(form, "id")}`,
  invalida: AGUA,
});

export const excluirLeituraAgua: Acao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/operacoes/agua/leituras/${texto(form, "id")}`,
  invalida: AGUA,
});

export const trocarFotoLeitura: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/operacoes/agua/leituras/${texto(form, "id")}/foto`,
  corpo: (form) => form,
  invalida: AGUA,
});

export const tirarFotoLeitura: Acao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/operacoes/agua/leituras/${texto(form, "id")}/foto`,
  invalida: AGUA,
});

export const fotoDoHidrometro: Acao = acaoDaApi({
  metodo: "POST",
  caminho: "/operacoes/agua/fotos",
  corpo: (form) => form,
  invalida: AGUA,
});

// ---------------------------------------------------------------------------
// Histórico de importações
// ---------------------------------------------------------------------------

export const desfazerImportacao: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/operacoes/importacoes/${texto(form, "id")}/desfazer`,
  corpo: () => undefined,
  invalida: [chavesOp.tudo],
});

// ---------------------------------------------------------------------------
// Energia: faturas da Energisa
// ---------------------------------------------------------------------------

export interface EstadoFatura {
  previa?: PreviaFatura;
  erro?: string;
  /** Prévia anterior da mesma fatura descartada para dar lugar a esta. */
  substituiu?: boolean;
}

export async function lerFatura(form: FormData): Promise<EstadoFatura> {
  try {
    const r = await api.post("/operacoes/energia/contas/importacao", form, {
      esquema: respostaLerFatura,
    });
    await invalidar([chavesOp.importacoes()]);
    return r;
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

export async function previasPendentes(): Promise<PreviaFatura[]> {
  try {
    const r = await api.get("/operacoes/energia/contas/importacao/previas", {
      esquema: respostaPreviasDeFatura,
    });
    return r.previas;
  } catch {
    return [];
  }
}

export async function cadastrarUnidade(form: FormData): Promise<EstadoFatura> {
  try {
    const r = await api.post(
      `/operacoes/energia/contas/importacao/${texto(form, "importacao_id")}/unidade`,
      { apelido: form.get("apelido"), papel: form.get("papel") },
      { esquema: respostaCadastroDaUnidade },
    );
    return r;
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

export function confirmarFatura(form: FormData): Promise<EstadoAcao> {
  return executar(
    () =>
      api.post(
        `/operacoes/energia/contas/importacao/${texto(form, "importacao_id")}/confirmar`,
        { motivo: form.get("motivo") },
      ),
    CONTAS,
  );
}

export function descartarFatura(form: FormData): Promise<EstadoAcao> {
  return executar(
    () =>
      api.post(
        `/operacoes/energia/contas/importacao/${texto(form, "importacao_id")}/descartar`,
      ),
    [chavesOp.importacoes()],
  );
}

// ---------------------------------------------------------------------------
// Energia: quadros de medidores e termo
// ---------------------------------------------------------------------------

/** Salva o quadro; criado, abre o desenho dele (o `redirect` de antes). */
export const salvarQuadro = (navegar: Navegador): Acao =>
  acaoDaApi({
    metodo: "POST",
    caminho: "/operacoes/energia/quadros",
    invalida: ENERGIA,
    aoGravar: (r) => {
      const criado = respostaCriado.safeParse(r);
      if (criado.success && criado.data.codigo)
        navegar.push(
          `/operacoes/energia?quadro=${encodeURIComponent(criado.data.codigo)}`,
        );
    },
  });

/** Salva a caixa; criada, abre a ficha dela (o `redirect` de antes). */
export const salvarCaixa = (navegar: Navegador): Acao =>
  acaoDaApi({
    metodo: "POST",
    caminho: "/operacoes/energia/caixas",
    invalida: ENERGIA,
    aoGravar: (r) => {
      const criada = respostaCriado.safeParse(r);
      if (criada.success && criada.data.id)
        navegar.push(`/operacoes/energia/caixa/${criada.data.id}`);
    },
  });

export const trocarLocatario: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) =>
    `/operacoes/energia/caixas/${texto(form, "caixa_id")}/locatario`,
  invalida: ENERGIA,
});

export const atualizarDoEnet: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) =>
    `/operacoes/energia/caixas/${texto(form, "caixa_id")}/enet`,
  corpo: () => undefined,
  invalida: ENERGIA,
});

export const liberarCaixa: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) =>
    `/operacoes/energia/caixas/${texto(form, "caixa_id")}/liberar`,
  invalida: ENERGIA,
});

export const emitirTermo: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) =>
    `/operacoes/energia/caixas/${texto(form, "caixa_id")}/termos`,
  invalida: ENERGIA,
});

export type EnvioDeFoto =
  | { ok: true; url: string; caminho: string }
  | { ok: false; erro: string };

export async function prepararFotoDoQuadro(entrada: {
  quadroId: string;
  nome: string;
  tamanho: number;
}): Promise<EnvioDeFoto> {
  try {
    const r = await api.post(
      `/operacoes/energia/quadros/${entrada.quadroId}/fotos/envio`,
      { nome: entrada.nome, tamanho: entrada.tamanho },
      { esquema: respostaLinkDeEnvio },
    );
    return { ok: true, url: r.url, caminho: r.caminho };
  } catch (e) {
    return { ok: false, erro: mensagemDoErro(e) };
  }
}

export function registrarFotoDoQuadro(entrada: {
  quadroId: string;
  caminho: string;
}): Promise<EstadoAcao> {
  return executar(
    () =>
      api.post(`/operacoes/energia/quadros/${entrada.quadroId}/fotos`, {
        caminho: entrada.caminho,
      }),
    [chavesOp.energia()],
  );
}

export const removerFotoDoQuadro: Acao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) =>
    `/operacoes/energia/quadros/${texto(form, "quadro_id")}/fotos?${new URLSearchParams({ caminho: texto(form, "caminho") }).toString()}`,
  invalida: [chavesOp.energia()],
});
