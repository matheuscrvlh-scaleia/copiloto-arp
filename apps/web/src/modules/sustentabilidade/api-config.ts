import {
  respostaCandidatos,
  respostaChamadosFixos,
} from "@arp/shared/sustentabilidade/contratos/chamados-fixos";
import {
  type EnvioPreparado,
  type RespostaDoEnvio,
  respostaDoEnvio,
  respostaEnvioPreparado,
  respostaImportacao,
  respostaImportacoes,
} from "@arp/shared/sustentabilidade/contratos/importacoes";
import { respostaTelaDeParametros } from "@arp/shared/sustentabilidade/contratos/parametros";
import type { Escolhas } from "@arp/shared/sustentabilidade/importacao-linhas";
import type { ChamadoFixo } from "@arp/shared/sustentabilidade/painel-parametros";
import { queryOptions } from "@tanstack/react-query";
import type { EstadoAcao } from "@/components/form-acao";
import { acaoDaApi } from "@/lib/acao";
import { api, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";
import { chavesSustentabilidade } from "./api";

// Configurações do Sustentabilidade na tela: Parâmetros, Coletores e
// Importações (/api/v1/sustentabilidade). As ações têm os nomes das Server
// Actions do sistema antigo.

export type {
  AlteracaoDeParametro,
  EquivalenciaCadastrada,
  LinhaDeSetor,
  MarcoDoPainel,
  VigenciaDoRcc,
} from "@arp/shared/sustentabilidade/contratos/parametros";

// ---------------------------------------------------------------- parâmetros

/** GET /sustentabilidade/parametros/tela?aba=&ano= */
export const consultaDaTelaDeParametros = (aba: string, ano: string) =>
  queryOptions({
    queryKey: [...chavesSustentabilidade.telaDeParametros(), aba, ano],
    queryFn: ({ signal }) =>
      api.get("/sustentabilidade/parametros/tela", {
        esquema: respostaTelaDeParametros,
        consulta: { aba, ano },
        sinal: signal,
      }),
  });

// Os parâmetros valem na hora para as telas e o Painel: invalida o módulo.
const invalida = [chavesSustentabilidade.tudo];

/** PATCH /sustentabilidade/parametros (uma aba) */
export const salvarParametros = acaoDaApi({
  metodo: "PATCH",
  caminho: "/sustentabilidade/parametros",
  invalida,
});

/** PUT /sustentabilidade/parametros/setores */
export const salvarValidadesPorSetor = acaoDaApi({
  metodo: "PUT",
  caminho: "/sustentabilidade/parametros/setores",
  invalida,
});

/** PUT /sustentabilidade/parametros/marcos */
export const salvarMarcos = acaoDaApi({
  metodo: "PUT",
  caminho: "/sustentabilidade/parametros/marcos",
  invalida,
});

/** PUT /sustentabilidade/parametros/equivalencias */
export const salvarEquivalencias = acaoDaApi({
  metodo: "PUT",
  caminho: "/sustentabilidade/parametros/equivalencias",
  invalida,
});

/** PUT /sustentabilidade/parametros/metas */
export const salvarMetas = acaoDaApi({
  metodo: "PUT",
  caminho: "/sustentabilidade/parametros/metas",
  invalida,
});

/** POST /sustentabilidade/parametros/rcc-vigencias */
export const novaVigenciaRcc = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/parametros/rcc-vigencias",
  invalida,
});

/** POST /sustentabilidade/parametros/exemplos/remover */
export const removerExemplos = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/parametros/exemplos/remover",
  corpo: () => undefined,
  invalida,
});

// ------------------------------------------------------------ chamados fixos

/** GET /sustentabilidade/chamados-fixos */
export const consultaDosChamadosFixos = queryOptions({
  queryKey: [...chavesSustentabilidade.parametros(), "chamados-fixos"],
  queryFn: ({ signal }) =>
    api.get("/sustentabilidade/chamados-fixos", {
      esquema: respostaChamadosFixos,
      sinal: signal,
    }),
  select: (r) => r.estados,
});

/** GET /sustentabilidade/chamados-fixos/:tipo/candidatos */
export const consultaDosCandidatos = (tipo: ChamadoFixo) =>
  queryOptions({
    queryKey: [
      ...chavesSustentabilidade.parametros(),
      "chamados-fixos",
      tipo,
      "candidatos",
    ],
    queryFn: ({ signal }) =>
      api.get(`/sustentabilidade/chamados-fixos/${tipo}/candidatos`, {
        esquema: respostaCandidatos,
        sinal: signal,
      }),
    select: (r) => r.candidatos,
  });

/** POST /sustentabilidade/chamados-fixos */
export const criarChamadoRecorrente = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/chamados-fixos",
  invalida,
});

// ----------------------------------------------------------------- coletores

/** POST /sustentabilidade/coletores (cria sem `id`, altera com `id`) */
export const salvarColetor = acaoDaApi({
  metodo: "POST",
  caminho: "/sustentabilidade/coletores",
  invalida,
});

/** DELETE /sustentabilidade/coletores/:id */
export const excluirColetor = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/sustentabilidade/coletores/${String(form.get("id"))}`,
  invalida,
});

// --------------------------------------------------------------- importações

/** GET /sustentabilidade/importacoes */
export const consultaDasImportacoes = queryOptions({
  queryKey: chavesSustentabilidade.importacoes(),
  queryFn: ({ signal }) =>
    api.get("/sustentabilidade/importacoes", {
      esquema: respostaImportacoes,
      sinal: signal,
    }),
});

/** GET /sustentabilidade/importacoes/:id */
export const consultaDaImportacao = (id: string) =>
  queryOptions({
    queryKey: chavesSustentabilidade.importacao(id),
    queryFn: ({ signal }) =>
      api.get(`/sustentabilidade/importacoes/${id}`, {
        esquema: respostaImportacao,
        sinal: signal,
      }),
  });

const rebuscarImportacoes = () =>
  clienteDeConsultas
    .invalidateQueries({ queryKey: chavesSustentabilidade.importacoes() })
    .catch(() => {});

/** Passo 1a. POST /sustentabilidade/importacoes/envio */
export async function prepararEnvioImportacao(entrada: {
  tipo: string;
  nome: string;
  tamanho: number;
}): Promise<EnvioPreparado> {
  try {
    return await api.post("/sustentabilidade/importacoes/envio", entrada, {
      esquema: respostaEnvioPreparado,
    });
  } catch (e) {
    return { ok: false, erro: mensagemDoErro(e) };
  }
}

/** Passo 1b. POST /sustentabilidade/importacoes */
export async function lerEnvioImportacao(entrada: {
  tipo: string;
  caminho: string;
  nome: string;
  substituir?: boolean;
}): Promise<RespostaDoEnvio> {
  try {
    const r = await api.post("/sustentabilidade/importacoes", entrada, {
      esquema: respostaDoEnvio,
    });
    if (r.ok) await rebuscarImportacoes();
    return r;
  } catch (e) {
    return { ok: false, erro: mensagemDoErro(e) };
  }
}

/** "Não substituir". POST /sustentabilidade/importacoes/envio/descartar */
export async function descartarEnvio(entrada: {
  caminho: string;
}): Promise<void> {
  await api
    .post("/sustentabilidade/importacoes/envio/descartar", entrada)
    .catch(() => {});
}

async function estado(pedido: () => Promise<unknown>): Promise<EstadoAcao> {
  try {
    const r = await pedido();
    await rebuscarImportacoes();
    const mensagem =
      typeof r === "object" && r !== null && "mensagem" in r
        ? String(r.mensagem)
        : "Salvo.";
    return { ok: mensagem };
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

/** Passo 2. PUT /sustentabilidade/importacoes/:id/escolhas */
export const salvarEscolhasImportacao = (entrada: {
  id: string;
  escolhas: Escolhas;
}) =>
  estado(() =>
    api.put(`/sustentabilidade/importacoes/${entrada.id}/escolhas`, {
      escolhas: entrada.escolhas,
    }),
  );

/** Passo 3. POST /sustentabilidade/importacoes/:id/confirmar */
export const confirmarImportacaoSu = (entrada: { id: string }) =>
  estado(async () => {
    const r = await api.post(
      `/sustentabilidade/importacoes/${entrada.id}/confirmar`,
    );
    // As linhas entraram: as telas do módulo mostram os dados novos.
    await clienteDeConsultas
      .invalidateQueries({ queryKey: chavesSustentabilidade.tudo })
      .catch(() => {});
    return r;
  });

/** Cancelar a prévia ou desfazer. POST /sustentabilidade/importacoes/:id/desfazer */
export const desfazerImportacaoSu = acaoDaApi({
  metodo: "POST",
  caminho: (form) =>
    `/sustentabilidade/importacoes/${String(form.get("id"))}/desfazer`,
  corpo: () => undefined,
  invalida,
});
