import {
  type Cargo,
  type ConsultaDoHistorico,
  respostaAutores,
  respostaCargos,
  respostaCriado,
  respostaEmpresa,
  respostaHistorico,
  respostaIntegracaoSalva,
  respostaIntegracoes,
  respostaPermissoesDePrograma,
  respostaUsuario,
  respostaUsuarios,
} from "@arp/shared/admin/contratos";
import { respostaMensagem } from "@arp/shared/contratos/auth";
import { TIPOS, type Tipo } from "@arp/shared/historico";
import {
  INTEGRACOES,
  type ModuloDeIntegracao,
  type Sistema,
} from "@arp/shared/integracoes";
import { type QueryKey, queryOptions } from "@tanstack/react-query";
import type { Acao } from "@/components/form-acao";
import { acaoDaApi, formParaObjeto } from "@/lib/acao";
import { api, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas, VALIDADE } from "@/lib/consulta";
import { CHAVE_DA_SESSAO } from "@/lib/sessao";

// Chamadas da Administração. Contrato: @arp/shared/admin/contratos.

/** Chaves de consulta do módulo: sempre começam pelo nome dele. */
export const chavesAdmin = {
  tudo: ["admin"] as const,
  usuarios: () => ["admin", "usuarios"] as const,
  usuario: (id: string) => ["admin", "usuario", id] as const,
  cargos: () => ["admin", "cargos"] as const,
  permissoesDePrograma: () => ["admin", "permissoes-de-programa"] as const,
  empresa: () => ["admin", "empresa"] as const,
  historico: (filtros: ConsultaDoHistorico) =>
    ["admin", "historico", filtros] as const,
  autores: () => ["admin", "historico-autores"] as const,
  /** Todas as telas de integrações (Administração e Marketing). */
  integracoes: () => ["admin", "integracoes"] as const,
  integracoesDe: (modulo: ModuloDeIntegracao) =>
    ["admin", "integracoes", modulo] as const,
};

// ---------------------------------------------------------------------------
// Usuários e cargos
// ---------------------------------------------------------------------------

/** GET /api/v1/admin/usuarios */
export const consultaDosUsuarios = queryOptions({
  queryKey: chavesAdmin.usuarios(),
  queryFn: ({ signal }) =>
    api.get("/admin/usuarios", { esquema: respostaUsuarios, sinal: signal }),
  select: (r) => r.usuarios,
});

/** GET /api/v1/admin/usuarios/:id (404: a tela mostra "não encontrada") */
export const consultaDoUsuario = (id: string) =>
  queryOptions({
    queryKey: chavesAdmin.usuario(id),
    queryFn: ({ signal }) =>
      api.get(`/admin/usuarios/${id}`, {
        esquema: respostaUsuario,
        sinal: signal,
      }),
    select: (r) => r.usuario,
  });

/** GET /api/v1/admin/cargos */
export const consultaDosCargos = queryOptions({
  queryKey: chavesAdmin.cargos(),
  queryFn: ({ signal }) =>
    api.get("/admin/cargos", { esquema: respostaCargos, sinal: signal }),
  select: (r) => r.cargos,
});

/** GET /api/v1/admin/permissoes-de-programa ("Programa – lançar") */
export const consultaDasPermissoesDePrograma = queryOptions({
  queryKey: chavesAdmin.permissoesDePrograma(),
  queryFn: ({ signal }) =>
    api.get("/admin/permissoes-de-programa", {
      esquema: respostaPermissoesDePrograma,
      sinal: signal,
    }),
  select: (r) => r.programas,
});

/** Só o que a escolha de cargo mostra. */
export function cargosParaEscolha(lista: Cargo[]) {
  return lista.map(({ id, nome, ativo, permissoes }) => ({
    id,
    nome,
    ativo,
    permissoes,
  }));
}

// Perfil, cargo ou permissões mudaram: as listas e a sessão de quem está
// logado (as permissões dela podem ter mudado junto).
const ACESSO = [chavesAdmin.usuarios(), chavesAdmin.cargos(), CHAVE_DA_SESSAO];
const acessoDe = (form: FormData) => [
  ...ACESSO,
  chavesAdmin.usuario(String(form.get("id"))),
];
const id = (form: FormData) => String(form.get("id"));

/** POST /api/v1/admin/usuarios; depois abre a tela da pessoa criada. */
export const criarUsuario = (aoCriar: (id: string) => void) =>
  acaoDaApi({
    metodo: "POST",
    caminho: "/admin/usuarios",
    invalida: ACESSO,
    aoGravar: (resposta) => aoCriar(respostaCriado.parse(resposta).id),
  });

/** PATCH /api/v1/admin/usuarios/:id */
export const salvarUsuario = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) => `/admin/usuarios/${id(form)}`,
  invalida: acessoDe,
});

/** PATCH /api/v1/admin/usuarios/:id/situacao (inativa ou reativa) */
export const alternarUsuario = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) => `/admin/usuarios/${id(form)}/situacao`,
  invalida: acessoDe,
});

/**
 * Depois de excluir: primeiro sai da tela do que foi excluído (ela daria
 * "não encontrada" ao buscar de novo), depois atualiza as listas.
 */
function aoExcluir(sair?: () => void) {
  return () => {
    sair?.();
    for (const queryKey of ACESSO)
      void clienteDeConsultas.invalidateQueries({ queryKey });
  };
}

/** DELETE /api/v1/admin/usuarios/:id */
export const excluirUsuario = (sair?: () => void) =>
  acaoDaApi({
    metodo: "DELETE",
    caminho: (form) => `/admin/usuarios/${id(form)}`,
    aoGravar: aoExcluir(sair),
  });

/** DELETE /api/v1/admin/usuarios/:id/permissoes */
export const removerIndividuais = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/admin/usuarios/${id(form)}/permissoes`,
  invalida: acessoDe,
});

/** POST /api/v1/admin/usuarios/:id/senha */
export const trocarSenha = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/admin/usuarios/${id(form)}/senha`,
});

/** POST /api/v1/admin/cargos; depois volta para a lista. */
export const criarCargo = (aoCriar: () => void) =>
  acaoDaApi({
    metodo: "POST",
    caminho: "/admin/cargos",
    corpo: (form) =>
      formParaObjeto(form, { listas: ["permissoes", "programas_vistas"] }),
    invalida: ACESSO,
    aoGravar: aoCriar,
  });

/** PATCH /api/v1/admin/cargos/:id */
export const salvarCargo = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) => `/admin/cargos/${id(form)}`,
  corpo: (form) =>
    formParaObjeto(form, { listas: ["permissoes", "programas_vistas"] }),
  invalida: ACESSO,
});

/** PATCH /api/v1/admin/cargos/:id/situacao */
export const alternarCargo = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) => `/admin/cargos/${id(form)}/situacao`,
  invalida: ACESSO,
});

/** DELETE /api/v1/admin/cargos/:id */
export const apagarCargo = (sair?: () => void) =>
  acaoDaApi({
    metodo: "DELETE",
    caminho: (form) => `/admin/cargos/${id(form)}`,
    aoGravar: aoExcluir(sair),
  });

// ---------------------------------------------------------------------------
// Empresa
// ---------------------------------------------------------------------------

/** GET /api/v1/admin/empresa (toda pessoa logada lê) */
export const consultaDaEmpresa = queryOptions({
  queryKey: chavesAdmin.empresa(),
  queryFn: ({ signal }) =>
    api.get("/admin/empresa", { esquema: respostaEmpresa, sinal: signal }),
  select: (r) => r.empresa,
  staleTime: VALIDADE.configuracao,
});

/** PATCH /api/v1/admin/empresa */
export const salvarEmpresa = acaoDaApi({
  metodo: "PATCH",
  caminho: "/admin/empresa",
  invalida: [chavesAdmin.empresa()],
});

// ---------------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------------

const ehTipo = (t: string): t is Tipo => t in TIPOS;

/** GET /api/v1/admin/historico */
export const consultaDoHistoricoDe = (filtros: ConsultaDoHistorico) =>
  queryOptions({
    queryKey: chavesAdmin.historico(filtros),
    queryFn: ({ signal }) =>
      api.get("/admin/historico", {
        esquema: respostaHistorico,
        consulta: filtros,
        sinal: signal,
      }),
    // O tipo vem do banco como texto: só os que a tela conhece.
    select: (r) => ({
      total: r.total,
      linhas: r.linhas.flatMap((l) =>
        ehTipo(l.tipo) ? [{ ...l, tipo: l.tipo }] : [],
      ),
    }),
  });

/** GET /api/v1/admin/historico/autores */
export const consultaDosAutores = queryOptions({
  queryKey: chavesAdmin.autores(),
  queryFn: ({ signal }) =>
    api.get("/admin/historico/autores", {
      esquema: respostaAutores,
      sinal: signal,
    }),
  select: (r) => r.autores,
  staleTime: VALIDADE.configuracao,
});

// ---------------------------------------------------------------------------
// Integrações (Administração › Integrações e Marketing › Configurações ›
// Integrações usam as mesmas chamadas)
// ---------------------------------------------------------------------------

/** GET /api/v1/admin/integracoes?modulo= */
export const consultaDasIntegracoes = (modulo: ModuloDeIntegracao) =>
  queryOptions({
    queryKey: chavesAdmin.integracoesDe(modulo),
    queryFn: ({ signal }) =>
      api.get("/admin/integracoes", {
        esquema: respostaIntegracoes,
        consulta: { modulo },
        sinal: signal,
      }),
  });

const sistema = (form: FormData) => String(form.get("sistema"));
const ehSistema = (v: string): v is Sistema => v in INTEGRACOES;
/** As telas de integrações e, nas do Marketing, as telas que leem delas. */
const mudou = (form: FormData): QueryKey[] =>
  sistema(form).startsWith("mkt_")
    ? [chavesAdmin.integracoes(), ["marketing"]]
    : [chavesAdmin.integracoes()];
const texto = (form: FormData, nome: string) => {
  const v = form.get(nome);
  return typeof v === "string" ? v : "";
};

/**
 * PUT /api/v1/admin/integracoes/:sistema. Com o botão "Conectar com …", a
 * resposta traz o endereço da autorização da ferramenta e a pessoa segue
 * para lá.
 */
export const salvarIntegracao = acaoDaApi({
  metodo: "PUT",
  caminho: (form) => `/admin/integracoes/${sistema(form)}`,
  corpo: (form) => {
    const s = sistema(form);
    const def = ehSistema(s) ? INTEGRACOES[s] : null;
    return {
      campos: Object.fromEntries(
        (def?.campos ?? []).map((c) => [c.nome, texto(form, c.nome)]),
      ),
      segredos: Object.fromEntries(
        (def?.segredos ?? []).map((sg) => [
          sg.nome,
          texto(form, `segredo.${sg.nome}`),
        ]),
      ),
      ativa: form.get("ativa") === "on",
      sem_teste: form.get("sem_teste") === "on",
      autorizar: form.get("autorizar") === "1",
    };
  },
  invalida: mudou,
  aoGravar: (resposta) => {
    const { redirecionar } = respostaIntegracaoSalva.parse(resposta);
    if (redirecionar) window.location.assign(redirecionar);
  },
});

/**
 * POST /api/v1/admin/integracoes/:sistema/teste. O resultado fica gravado no
 * cartão mesmo quando o teste falha: a tela busca de novo nos dois casos.
 */
export const testarIntegracao: Acao = async (_anterior, form) => {
  try {
    const r = await api.post(
      `/admin/integracoes/${sistema(form)}/teste`,
      undefined,
      { esquema: respostaMensagem },
    );
    return { ok: r.mensagem };
  } catch (erro) {
    return { erro: mensagemDoErro(erro) };
  } finally {
    await Promise.all(
      mudou(form).map((queryKey) =>
        clienteDeConsultas.invalidateQueries({ queryKey }).catch(() => {}),
      ),
    );
  }
};

/** DELETE /api/v1/admin/integracoes/:sistema */
export const removerIntegracao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/admin/integracoes/${sistema(form)}`,
  invalida: mudou,
});

/** POST /api/v1/admin/integracoes/:sistema/sincronizacao */
export const sincronizarAgora = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/admin/integracoes/${sistema(form)}/sincronizacao`,
  corpo: () => undefined,
  invalida: [chavesAdmin.integracoes()],
});
