import {
  type RespostaRotinas,
  respostaCategoriaExcluida,
  respostaCategoriaSalva,
  respostaCategorias,
  respostaCopia,
  respostaHistorico,
  respostaModelos,
  respostaParametros,
  respostaRotinas,
  respostaSetores,
  respostaTerceirizados,
  resumoDoCatalogo,
} from "@arp/shared/os/contratos/configuracoes";
import { queryOptions } from "@tanstack/react-query";
import type { Acao } from "@/components/form-acao";
import { acaoDaApi, formParaObjeto } from "@/lib/acao";
import { api, type Consulta, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas, VALIDADE } from "@/lib/consulta";
import { chavesOs } from "./api";

// Chamadas de Tickets › Configurações (prefixo /api/v1/os/configuracoes). As
// gravações têm o nome das Server Actions antigas (`@/server/os/acoes/
// config-*`) e invalidam todo o módulo (o catálogo e os setores também
// aparecem no apoio e no formulário de abrir chamado).

const BASE = "/os/configuracoes";
const TUDO = [chavesOs.tudo];

export const chavesConfig = {
  categorias: () => ["os", "configuracoes", "categorias"] as const,
  resumo: (setor: string) =>
    ["os", "configuracoes", "catalogo", setor] as const,
  setores: () => ["os", "configuracoes", "setores"] as const,
  terceirizados: () => ["os", "configuracoes", "terceirizados"] as const,
  modelos: () => ["os", "configuracoes", "modelos"] as const,
  parametros: () => ["os", "configuracoes", "parametros"] as const,
  historico: (busca: Consulta) =>
    ["os", "configuracoes", "historico", busca] as const,
};

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

export const consultaDasCategorias = queryOptions({
  queryKey: chavesConfig.categorias(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/categorias`, {
      esquema: respostaCategorias,
      sinal: signal,
    }),
  staleTime: VALIDADE.configuracao,
});

export const consultaDoResumo = (setor: string) =>
  queryOptions({
    queryKey: chavesConfig.resumo(setor),
    queryFn: ({ signal }) =>
      api.get(`${BASE}/catalogo/resumo`, {
        esquema: resumoDoCatalogo,
        consulta: { setor },
        sinal: signal,
      }),
  });

export const consultaDosSetores = queryOptions({
  queryKey: chavesConfig.setores(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/setores`, { esquema: respostaSetores, sinal: signal }),
  select: (r) => r.membros,
  staleTime: VALIDADE.configuracao,
});

export const consultaDosTerceirizados = queryOptions({
  queryKey: chavesConfig.terceirizados(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/terceirizados`, {
      esquema: respostaTerceirizados,
      sinal: signal,
    }),
  staleTime: VALIDADE.configuracao,
});

export const consultaDosModelos = queryOptions({
  queryKey: chavesConfig.modelos(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/modelos`, { esquema: respostaModelos, sinal: signal }),
  select: (r) => r.modelos,
  staleTime: VALIDADE.configuracao,
});

export const consultaDosParametros = queryOptions({
  queryKey: chavesConfig.parametros(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/parametros`, {
      esquema: respostaParametros,
      sinal: signal,
    }),
  staleTime: VALIDADE.configuracao,
});

export const consultaDoHistorico = (consulta: Consulta) =>
  queryOptions({
    queryKey: chavesConfig.historico(consulta),
    queryFn: ({ signal }) =>
      api.get(`${BASE}/historico`, {
        esquema: respostaHistorico,
        consulta,
        sinal: signal,
      }),
  });

// ---------------------------------------------------------------------------
// Gravações (mesmos nomes das Server Actions do sistema antigo)
// ---------------------------------------------------------------------------

const grava = (
  metodo: "POST" | "PATCH" | "PUT" | "DELETE",
  caminho: string | ((form: FormData) => string),
  corpo?: (form: FormData) => unknown,
): Acao => acaoDaApi({ metodo, caminho, corpo, invalida: TUDO });

const campo = (form: FormData, nome: string) =>
  encodeURIComponent(String(form.get(nome) ?? ""));

/** Só o que vai no corpo (o id vai no caminho). */
const semId = (form: FormData) => {
  const { id: _id, ...resto } = formParaObjeto(form);
  return resto;
};

// Catálogo

/** Salva a categoria; a nova volta ao catálogo do setor (`aoCriar`). */
export function salvarCategoria(aoCriar: (setor: string) => void): Acao {
  return acaoDaApi({
    metodo: "POST",
    caminho: `${BASE}/categorias`,
    invalida: TUDO,
    aoGravar: (resposta) => {
      const r = respostaCategoriaSalva.safeParse(resposta);
      if (r.success && r.data.criada) aoCriar(r.data.setor_id);
    },
  });
}

export const moverCategoria = grava(
  "POST",
  (f) => `${BASE}/categorias/${campo(f, "id")}/mover`,
  semId,
);
export const alternarCategoria = grava(
  "POST",
  (f) => `${BASE}/categorias/${campo(f, "id")}/ativo`,
  semId,
);

/** Cria a cópia e abre a cópia para editar. */
export function duplicarCategoria(aoCopiar: (id: string) => void): Acao {
  return acaoDaApi({
    metodo: "POST",
    caminho: (f) => `${BASE}/categorias/${campo(f, "id")}/duplicar`,
    corpo: () => ({}),
    invalida: TUDO,
    mensagem: "",
    aoGravar: (resposta) => {
      const r = respostaCopia.safeParse(resposta);
      if (r.success) aoCopiar(r.data.id);
    },
  });
}

/** Exclui e volta ao catálogo do setor. */
export function excluirCategoria(aoExcluir: (setor: string) => void): Acao {
  return acaoDaApi({
    metodo: "DELETE",
    caminho: (f) => `${BASE}/categorias/${campo(f, "id")}`,
    invalida: TUDO,
    aoGravar: (resposta) => {
      const r = respostaCategoriaExcluida.safeParse(resposta);
      if (r.success) aoExcluir(r.data.setor_id);
    },
  });
}

// Setores e pessoas

export const salvarSetor = grava("POST", `${BASE}/setores`);
export const moverSetor = grava(
  "POST",
  (f) => `${BASE}/setores/${campo(f, "id")}/mover`,
  semId,
);
export const incluirMembro = grava("POST", `${BASE}/setores/membros`);
export const marcarGestor = grava("PATCH", `${BASE}/setores/membros`);
export const removerMembro = grava(
  "DELETE",
  (f) =>
    `${BASE}/setores/${campo(f, "setor_id")}/membros/${campo(f, "usuario_id")}`,
);

// Internos e terceirizados

export const salvarEmpresa = grava("POST", `${BASE}/empresas`);
export const salvarProfissional = grava("POST", `${BASE}/profissionais`);
export const salvarContato = grava("POST", `${BASE}/contatos`);
export const removerContato = grava(
  "DELETE",
  (f) => `${BASE}/contatos/${campo(f, "id")}`,
);

// Modelos e rotinas

export const salvarModelo = grava("POST", `${BASE}/modelos`);
export const alternarModelo = grava(
  "POST",
  (f) => `${BASE}/modelos/${campo(f, "id")}/ativo`,
  semId,
);

export interface EstadoRotinas {
  resultados?: RespostaRotinas["resultados"];
  em?: string;
  erro?: string;
}

/** "Rodar rotinas agora": o resultado de cada rotina volta para a tela. */
export async function rodarRotinasAgora(
  _anterior: EstadoRotinas,
  _form: FormData,
): Promise<EstadoRotinas> {
  try {
    const r = await api.post(`${BASE}/rotinas`, undefined, {
      esquema: respostaRotinas,
    });
    // O antigo dava refresh(): as telas abertas leem de novo o que mudou.
    await clienteDeConsultas
      .invalidateQueries({ queryKey: chavesOs.tudo })
      .catch(() => {});
    return r;
  } catch (erro) {
    return { erro: mensagemDoErro(erro) };
  }
}

// Parâmetros

export const salvarCiclo = acaoDaApi({
  metodo: "PATCH",
  caminho: `${BASE}/parametros/ciclo`,
  corpo: (f) => formParaObjeto(f, { listas: ["dias_uteis"] }),
  invalida: TUDO,
});
export const salvarOperacoes = grava("PATCH", `${BASE}/parametros/operacoes`);
export const salvarAtivos = grava("PATCH", `${BASE}/parametros/ativos`);
export const salvarListasDeSaida = grava("PATCH", `${BASE}/parametros/saidas`);
export const salvarVistorias = grava("PATCH", `${BASE}/parametros/vistorias`);
export const salvarPortal = grava("PATCH", `${BASE}/parametros/portal`);
export const salvarMensagens = grava("PATCH", `${BASE}/parametros/mensagens`);
export const incluirFeriado = grava("POST", `${BASE}/feriados`);
export const removerFeriado = grava(
  "DELETE",
  (f) => `${BASE}/feriados/${campo(f, "data")}`,
);
export const salvarTecnico = grava("POST", `${BASE}/tecnicos`);
export const incluirVigencia = grava("POST", `${BASE}/tecnicos/valores`);
export const corrigirVigencia = grava("PATCH", `${BASE}/tecnicos/valores`);
export const removerVigencia = grava(
  "DELETE",
  (f) => `${BASE}/tecnicos/valores/${campo(f, "id")}`,
);
export const salvarAtivoCategoria = grava("POST", `${BASE}/ativo-categorias`);
export const removerAtivoCategoria = grava(
  "DELETE",
  (f) => `${BASE}/ativo-categorias/${campo(f, "id")}`,
);
export const salvarMeta = grava("POST", `${BASE}/metas`);
export const removerMeta = grava(
  "DELETE",
  (f) => `${BASE}/metas/${campo(f, "id")}`,
);
export const enviarPapelTimbrado = grava(
  "PUT",
  `${BASE}/papel-timbrado`,
  (f) => f,
);
export const removerPapelTimbrado = grava("DELETE", `${BASE}/papel-timbrado`);
