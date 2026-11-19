import { respostaMensagem } from "@arp/shared/contratos/auth";
import type { ArquivoEnviado, Campo } from "@arp/shared/formularios/campos";
import {
  formulario,
  resposta,
  respostaArquivo,
  respostaCriado,
  respostaDoLink,
  respostaLista,
  respostaRespostas,
} from "@arp/shared/formularios/contratos";
import type { MotivoFechado } from "@arp/shared/formularios/formulario";
import { type QueryKey, queryOptions } from "@tanstack/react-query";
import type { Acao, EstadoAcao } from "@/components/form-acao";
import { acaoDaApi, formParaObjeto } from "@/lib/acao";
import { api, ErroDaApi, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";
import type { Navegador } from "@/lib/navegacao";

// Chamadas do módulo Formulários: /api/v1/relatorios.
// Toda gravação invalida o que mudou; as que abriam outra tela (criar,
// duplicar, excluir) navegam sem aviso de sucesso, como o redirect() de
// antes.

export const ROTA_FORMULARIOS = "/formularios";
export const rotaDoFormulario = (id: string, sub = "") =>
  `${ROTA_FORMULARIOS}/${id}${sub ? `/${sub}` : ""}`;

export const chavesRelatorios = {
  tudo: ["relatorios"] as const,
  lista: () => ["relatorios", "lista"] as const,
  formulario: (id: string) => ["relatorios", "formulario", id] as const,
  respostas: (id: string) => ["relatorios", "respostas", id] as const,
  resposta: (id: string, r: string) =>
    ["relatorios", "resposta", id, r] as const,
  link: (token: string) => ["relatorios", "link", token] as const,
};

const de = (id: string) => `/relatorios/${encodeURIComponent(id)}`;

/** GET /relatorios */
export const consultaDaLista = queryOptions({
  queryKey: chavesRelatorios.lista(),
  queryFn: ({ signal }) =>
    api.get("/relatorios", { esquema: respostaLista, sinal: signal }),
  select: (r) => r.formularios,
});

/** GET /relatorios/:id */
export const consultaDoFormulario = (id: string) =>
  queryOptions({
    queryKey: chavesRelatorios.formulario(id),
    queryFn: ({ signal }) =>
      api.get(de(id), { esquema: formulario, sinal: signal }),
  });

/** GET /relatorios/:id/respostas */
export const consultaDasRespostas = (id: string) =>
  queryOptions({
    queryKey: chavesRelatorios.respostas(id),
    queryFn: ({ signal }) =>
      api.get(`${de(id)}/respostas`, {
        esquema: respostaRespostas,
        sinal: signal,
      }),
    select: (r) => r.respostas,
  });

/** GET /relatorios/:id/respostas/:resposta */
export const consultaDaResposta = (id: string, r: string) =>
  queryOptions({
    queryKey: chavesRelatorios.resposta(id, r),
    queryFn: ({ signal }) =>
      api.get(`${de(id)}/respostas/${encodeURIComponent(r)}`, {
        esquema: resposta,
        sinal: signal,
      }),
  });

/** Link (GET) que baixa um arquivo enviado numa resposta. */
export const linkDoArquivo = (id: string, caminho: string, nome: string) =>
  `/api/v1${de(id)}/arquivo?${new URLSearchParams({ caminho, nome })}`;

// ---------------------------------------------------------------------------
// Gravações da equipe
// ---------------------------------------------------------------------------

const doFormulario = (form: FormData) => String(form.get("id") ?? "");
const doRelatorio = (form: FormData): QueryKey[] => [
  chavesRelatorios.formulario(doFormulario(form)),
  chavesRelatorios.lista(),
];

/** POST /relatorios/:id/situacao (publicar, encerrar, reabrir, rascunho) */
export const mudarSituacao = acaoDaApi({
  metodo: "POST",
  caminho: (f) => `${de(doFormulario(f))}/situacao`,
  corpo: (f) => ({ acao: f.get("acao") }),
  invalida: doRelatorio,
});

/** POST /relatorios/:id/novo-link */
export const gerarNovoLink = acaoDaApi({
  metodo: "POST",
  caminho: (f) => `${de(doFormulario(f))}/novo-link`,
  corpo: () => undefined,
  invalida: doRelatorio,
});

/** PATCH /relatorios/:id/configuracoes */
export const salvarConfiguracoes = acaoDaApi({
  metodo: "PATCH",
  caminho: (f) => `${de(doFormulario(f))}/configuracoes`,
  invalida: doRelatorio,
});

/** PATCH /relatorios/:id/aparencia */
export const salvarAparencia = acaoDaApi({
  metodo: "PATCH",
  caminho: (f) => `${de(doFormulario(f))}/aparencia`,
  corpo: (f) => ({ ...formParaObjeto(f), paginas: f.get("paginas") === "on" }),
  invalida: doRelatorio,
});

/** PATCH /relatorios/:id/conteudo: o editor (com a lista de problemas). */
export async function salvarConteudo(c: {
  id: string;
  titulo: string;
  descricao: string;
  campos: Campo[];
}): Promise<EstadoAcao & { problemas?: string[] }> {
  try {
    const { id, ...corpo } = c;
    const r = await api.patch(`${de(id)}/conteudo`, corpo, {
      esquema: respostaMensagem,
    });
    await Promise.all(
      [chavesRelatorios.formulario(id), chavesRelatorios.lista()].map(
        (queryKey) =>
          clienteDeConsultas.invalidateQueries({ queryKey }).catch(() => {}),
      ),
    );
    return { ok: r.mensagem };
  } catch (e) {
    const problemas =
      e instanceof ErroDaApi && e.campos
        ? Object.entries(e.campos)
            .filter(([campo]) => campo.startsWith("problemas."))
            .map(([, texto]) => texto)
        : [];
    return {
      erro: mensagemDoErro(e),
      ...(problemas.length ? { problemas } : {}),
    };
  }
}

/**
 * Ação que, dando certo, abre outra tela (o `redirect()` das Server
 * Actions): não mostra aviso de sucesso.
 */
function abrindo(
  navegar: Navegador,
  opcoes: Parameters<typeof acaoDaApi>[0],
  destino: (resposta: unknown, form: FormData) => string,
): Acao {
  let para: string = ROTA_FORMULARIOS;
  const acao = acaoDaApi({
    ...opcoes,
    aoGravar: (r, f) => {
      para = destino(r, f);
    },
  });
  return async (anterior, form) => {
    const r = await acao(anterior, form);
    if (r.erro) return r;
    navegar.push(para);
    return {};
  };
}

const editorDoCriado = (r: unknown) =>
  rotaDoFormulario(respostaCriado.parse(r).id, "editar");

/** POST /relatorios: rascunho de um modelo; abre o editor. */
export const criarFormulario = (navegar: Navegador) =>
  abrindo(
    navegar,
    {
      metodo: "POST",
      caminho: "/relatorios",
      corpo: (f) => ({ modelo: String(f.get("modelo") ?? "") }),
      invalida: [chavesRelatorios.lista()],
    },
    editorDoCriado,
  );

/** POST /relatorios/:id/duplicar: cópia em rascunho; abre o editor. */
export const duplicarFormulario = (navegar: Navegador) =>
  abrindo(
    navegar,
    {
      metodo: "POST",
      caminho: (f) => `${de(doFormulario(f))}/duplicar`,
      corpo: () => undefined,
      invalida: [chavesRelatorios.lista()],
    },
    editorDoCriado,
  );

/** DELETE /relatorios/:id: volta para a lista. */
export const excluirFormulario = (navegar: Navegador) =>
  abrindo(
    navegar,
    {
      metodo: "DELETE",
      caminho: (f) => de(doFormulario(f)),
      invalida: [chavesRelatorios.lista()],
    },
    () => ROTA_FORMULARIOS,
  );

/** DELETE /relatorios/:id/respostas/:resposta: volta para as respostas. */
export const excluirResposta = (navegar: Navegador) =>
  abrindo(
    navegar,
    {
      metodo: "DELETE",
      caminho: (f) =>
        `${de(String(f.get("formulario")))}/respostas/${encodeURIComponent(String(f.get("resposta")))}`,
      invalida: (f) => {
        const id = String(f.get("formulario"));
        return [
          chavesRelatorios.formulario(id),
          chavesRelatorios.respostas(id),
          chavesRelatorios.lista(),
        ];
      },
    },
    (_, f) => rotaDoFormulario(String(f.get("formulario"))),
  );

// ---------------------------------------------------------------------------
// Link público (/responder/<token>, sem login)
// ---------------------------------------------------------------------------

const doLink = (token: string) =>
  `/relatorios/publico/${encodeURIComponent(token)}`;

/** GET /relatorios/publico/:token */
export const consultaDoLink = (token: string) =>
  queryOptions({
    queryKey: chavesRelatorios.link(token),
    queryFn: ({ signal }) =>
      api.get(doLink(token), {
        esquema: respostaDoLink,
        sinal: signal,
        renovar: false,
        irParaOLogin: false,
      }),
    staleTime: 0,
  });

export interface EstadoDoEnvio {
  erro?: string;
  /** Mensagem por pergunta (id → texto). */
  erros?: Record<string, string>;
  enviado?: boolean;
  fechado?: MotivoFechado;
}

/** "Enviar" do formulário público (campos `token`, `respostas` e `site`). */
export async function responderPeloLink(
  _: EstadoDoEnvio,
  form: FormData,
): Promise<EstadoDoEnvio> {
  try {
    await api.post(
      `${doLink(String(form.get("token") ?? ""))}/respostas`,
      {
        respostas: String(form.get("respostas") ?? ""),
        site: String(form.get("site") ?? ""),
      },
      { renovar: false, irParaOLogin: false },
    );
    return { enviado: true };
  } catch (e) {
    if (!(e instanceof ErroDaApi)) return { erro: mensagemDoErro(e) };
    // Link fechado (encerrado, rascunho ou inexistente): a tela troca de vez.
    if (e.codigo === "conflito")
      return { erro: e.mensagem, fechado: "encerrado" };
    if (e.codigo === "validacao" && e.campos)
      return { erro: e.mensagem, erros: e.campos };
    return { erro: e.mensagem };
  }
}

export interface EstadoDoArquivo {
  erro?: string;
  arquivo?: ArquivoEnviado;
}

/** Sobe um arquivo de uma pergunta "Envio de arquivo" (`token`, `campo`, `arquivo`). */
export async function enviarArquivoPeloLink(
  dados: FormData,
): Promise<EstadoDoArquivo> {
  const token = String(dados.get("token") ?? "");
  const corpo = new FormData();
  corpo.set("campo", String(dados.get("campo") ?? ""));
  const arquivo = dados.get("arquivo");
  if (arquivo instanceof File) corpo.set("arquivo", arquivo);
  try {
    const r = await api.post(`${doLink(token)}/arquivos`, corpo, {
      esquema: respostaArquivo,
      renovar: false,
      irParaOLogin: false,
    });
    return { arquivo: r.arquivo };
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}
