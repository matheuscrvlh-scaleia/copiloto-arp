import { respostaMensagem } from "@arp/shared/contratos/auth";
import {
  respostaAplicar,
  respostaConcluir,
  respostaControle,
  respostaEntrevistaSalva,
  respostaFicha,
  respostaRascunho,
  respostaRespostas,
} from "@arp/shared/sustentabilidade/contratos/entrevistas";
import { queryOptions } from "@tanstack/react-query";
import type { EstadoAcao } from "@/components/form-acao";
import { acaoDaApi } from "@/lib/acao";
import { api, ErroDaApi, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";

// Entrevistas de resíduos na tela (spec 4.4): controle, ficha, aplicar e
// respostas, e as gravações (as antigas actions de acoes/entrevistas.ts, com
// os mesmos nomes). Aplicar funciona sem conexão: o que não chegou ao
// servidor (status 0) sobe como exceção, e a tela guarda no aparelho.

export const chavesEntrevistas = {
  tudo: ["sustentabilidade", "entrevistas"] as const,
  controle: () => ["sustentabilidade", "entrevistas", "controle"] as const,
  ficha: (id: string) =>
    ["sustentabilidade", "entrevistas", "ficha", id] as const,
  salva: (id: string) =>
    ["sustentabilidade", "entrevistas", "salva", id] as const,
  aplicar: (id: string) =>
    ["sustentabilidade", "entrevistas", "aplicar", id] as const,
  respostas: (de: string, ate: string) =>
    ["sustentabilidade", "entrevistas", "respostas", de, ate] as const,
};

/** Entrevista muda o Clube (interesse, situação) e os chamados. */
const invalida = [
  chavesEntrevistas.tudo,
  ["sustentabilidade", "clube"],
  ["os"],
] as const;

const invalidar = () =>
  Promise.all(
    invalida.map((queryKey) =>
      clienteDeConsultas.invalidateQueries({ queryKey }).catch(() => {}),
    ),
  );

/** A resposta não chegou (sem conexão): a tela trata como offline. */
const semResposta = (e: unknown) => !(e instanceof ErroDaApi) || e.status === 0;

// ---------------------------------------------------------------- leituras

/** GET /sustentabilidade/entrevistas/controle */
export const consultaDoControle = queryOptions({
  queryKey: chavesEntrevistas.controle(),
  queryFn: ({ signal }) =>
    api.get("/sustentabilidade/entrevistas/controle", {
      esquema: respostaControle,
      sinal: signal,
    }),
});

/** GET /sustentabilidade/entrevistas/contratos/:id */
export const consultaDaFicha = (id: string) =>
  queryOptions({
    queryKey: chavesEntrevistas.ficha(id),
    queryFn: ({ signal }) =>
      api.get(`/sustentabilidade/entrevistas/contratos/${id}`, {
        esquema: respostaFicha,
        sinal: signal,
      }),
    retry: false,
  });

/** GET /sustentabilidade/entrevistas/salvas/:id (as respostas, ao abrir). */
export const consultaDaEntrevistaSalva = (id: string) =>
  queryOptions({
    queryKey: chavesEntrevistas.salva(id),
    queryFn: ({ signal }) =>
      api.get(`/sustentabilidade/entrevistas/salvas/${id}`, {
        esquema: respostaEntrevistaSalva,
        sinal: signal,
      }),
  });

/** GET /sustentabilidade/entrevistas/contratos/:id/aplicar */
export const consultaDeAplicar = (id: string) =>
  queryOptions({
    queryKey: chavesEntrevistas.aplicar(id),
    queryFn: ({ signal }) =>
      api.get(`/sustentabilidade/entrevistas/contratos/${id}/aplicar`, {
        esquema: respostaAplicar,
        sinal: signal,
      }),
    retry: false,
    // A tela de aplicar guarda o rascunho no aparelho: não rebusca sozinha.
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

/** GET /sustentabilidade/entrevistas/respostas?de&ate */
export const consultaDasRespostas = (de: string, ate: string) =>
  queryOptions({
    queryKey: chavesEntrevistas.respostas(de, ate),
    queryFn: ({ signal }) =>
      api.get("/sustentabilidade/entrevistas/respostas", {
        esquema: respostaRespostas,
        consulta: { de, ate },
        sinal: signal,
      }),
  });

// ---------------------------------------------------------------- aplicar

export type ResultadoRascunho =
  | { ok: true; salva: boolean }
  | { erro: string; salva?: boolean };

/** Sobe o rascunho (idempotente pela chave). Sem conexão: lança. */
export async function salvarRascunho(entrada: {
  chave: string;
  contratoId: string;
  versao: number;
  respostas: Record<string, unknown>;
}): Promise<ResultadoRascunho> {
  try {
    const r = await api.post(
      "/sustentabilidade/entrevistas/rascunhos",
      entrada,
      {
        esquema: respostaRascunho,
      },
    );
    return { ok: true, salva: r.salva };
  } catch (e) {
    if (semResposta(e)) throw e;
    return { erro: mensagemDoErro(e) };
  }
}

/** Multipart: chave, quem, nome e a PNG (assinatura). */
export const assinarEntrevista = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/entrevistas/assinaturas",
  corpo: (form) => form,
});

export type ResultadoConclusao =
  | { ok: true; mensagem: string; aviso?: string }
  | { erro: string; erros?: Record<string, string> };

/** Salva a entrevista do rascunho. Sem conexão: lança. */
export async function concluirEntrevista(entrada: {
  chave: string;
}): Promise<ResultadoConclusao> {
  try {
    const r = await api.post(
      "/sustentabilidade/entrevistas/concluir",
      entrada,
      {
        esquema: respostaConcluir,
      },
    );
    await invalidar();
    return { ok: true, mensagem: r.mensagem, aviso: r.aviso };
  } catch (e) {
    if (semResposta(e)) throw e;
    const erro = e as ErroDaApi;
    return erro.codigo === "validacao" && erro.campos
      ? { erro: erro.mensagem, erros: erro.campos }
      : { erro: mensagemDoErro(e) };
  }
}

/** "Apresentar o clube": interesse do cliente do contrato. */
export async function registrarInteresse(entrada: {
  contratoId: string;
}): Promise<EstadoAcao> {
  try {
    const r = await api.post(
      "/sustentabilidade/entrevistas/interesse",
      entrada,
      {
        esquema: respostaMensagem,
      },
    );
    await invalidar();
    return { ok: r.mensagem };
  } catch (e) {
    if (semResposta(e)) throw e;
    return { erro: mensagemDoErro(e) };
  }
}

// ---------------------------------------------------------------- ficha

const daFicha = (caminho: string, multipart = false) =>
  acaoDaApi({
    metodo: "POST",
    caminho: `/sustentabilidade/entrevistas/${caminho}`,
    ...(multipart ? { corpo: (form: FormData) => form } : {}),
    invalida: [...invalida],
  });

export const dispensarEntrevista = daFicha("dispensar");
export const desfazerDispensa = daFicha("desfazer-dispensa");
export const corrigirAtivacao = daFicha("ativacao");
export const prazoDoContrato = daFicha("prazo");
export const transferirEntrevista = daFicha("transferir");
/** Multipart: entrevista_id e o arquivo. */
export const anexarPapel = daFicha("anexos", true);
