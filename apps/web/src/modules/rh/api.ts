import type { TabelaDetalhe } from "@arp/shared/detalhe";
import {
  type ConsultaDoPeriodo,
  type PedidoDoQuadro,
  respostaTabelas,
} from "@arp/shared/rh/contratos/comum";
import {
  respostaFuncionarios,
  respostaPerfil,
} from "@arp/shared/rh/contratos/funcionarios";
import {
  respostaFechamento,
  respostaJornada,
  respostaPainel,
  respostaQuadro,
} from "@arp/shared/rh/contratos/telas";
import {
  respostaBeneficioCriado,
  respostaBeneficios,
} from "@arp/shared/rh/contratos/beneficios";
import { respostaCadastros } from "@arp/shared/rh/contratos/cadastros";
import {
  type ConsultaDoCusto,
  respostaComparacao,
  respostaCustoDePessoal,
} from "@arp/shared/rh/contratos/custo";
import {
  type PreviaDaFolha,
  type PreviaDoPlano,
  previaDaFolha,
  previaDoPlano,
  respostaFolhaParaEditar,
  respostaImportacoes,
} from "@arp/shared/rh/contratos/importacoes";
import {
  type ConsultaDoOrcamento,
  respostaCategorias,
  respostaOrcamento,
} from "@arp/shared/rh/contratos/orcamento";
import { respostaParametros } from "@arp/shared/rh/contratos/parametros";
import { queryOptions } from "@tanstack/react-query";
import type { Acao } from "@/components/form-acao";
import { acaoDaApi, formParaObjeto } from "@/lib/acao";
import { api, mensagemDoErro } from "@/lib/api";
import type { Busca } from "@/modules/shell/api";

// Chamadas do RH (/api/v1/rh) e as chaves de consulta. As telas mandam os
// filtros da URL como vieram: quem os lê (sem confiar) é a API.

export const chavesRh = {
  tudo: ["rh"] as const,
  painel: (f: ConsultaDoPeriodo) => ["rh", "painel", f] as const,
  quadro: (f: ConsultaDoPeriodo) => ["rh", "quadro", f] as const,
  jornada: (f: ConsultaDoPeriodo) => ["rh", "jornada", f] as const,
  funcionarios: () => ["rh", "funcionarios"] as const,
  funcionario: (id: string, f: ConsultaDoPeriodo) =>
    ["rh", "funcionarios", id, f] as const,
  fechamento: () => ["rh", "banco-de-horas"] as const,
  fechamentoDa: (f: { aba?: string; ciclo?: string }) =>
    ["rh", "banco-de-horas", f] as const,
};

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Os filtros de período da URL (?periodo, ?de, ?ate, ?mes, ?dep). */
export function filtrosDaBusca(busca: Busca): ConsultaDoPeriodo {
  const f: ConsultaDoPeriodo = {};
  for (const chave of ["periodo", "de", "ate", "mes", "dep"] as const) {
    const v = um(busca[chave]);
    if (v) f[chave] = v;
  }
  return f;
}

/** GET /rh/painel */
export const consultaDoPainel = (f: ConsultaDoPeriodo) =>
  queryOptions({
    queryKey: chavesRh.painel(f),
    queryFn: ({ signal }) =>
      api.get("/rh/painel", {
        esquema: respostaPainel,
        consulta: f,
        sinal: signal,
      }),
  });

/** GET /rh/quadro */
export const consultaDoQuadro = (f: ConsultaDoPeriodo) =>
  queryOptions({
    queryKey: chavesRh.quadro(f),
    queryFn: ({ signal }) =>
      api.get("/rh/quadro", {
        esquema: respostaQuadro,
        consulta: f,
        sinal: signal,
      }),
  });

/** GET /rh/jornada */
export const consultaDaJornada = (f: ConsultaDoPeriodo) =>
  queryOptions({
    queryKey: chavesRh.jornada(f),
    queryFn: ({ signal }) =>
      api.get("/rh/jornada", {
        esquema: respostaJornada,
        consulta: f,
        sinal: signal,
      }),
  });

/** GET /rh/funcionarios */
export const consultaDosFuncionarios = queryOptions({
  queryKey: chavesRh.funcionarios(),
  queryFn: ({ signal }) =>
    api.get("/rh/funcionarios", {
      esquema: respostaFuncionarios,
      sinal: signal,
    }),
  select: (r) => r.funcionarios,
});

/** GET /rh/funcionarios/:id */
export const consultaDoFuncionario = (id: string, f: ConsultaDoPeriodo) =>
  queryOptions({
    queryKey: chavesRh.funcionario(id, f),
    queryFn: ({ signal }) =>
      api.get(`/rh/funcionarios/${encodeURIComponent(id)}`, {
        esquema: respostaPerfil,
        consulta: f,
        sinal: signal,
      }),
  });

/** GET /rh/banco-de-horas?aba&ciclo */
export const consultaDoFechamento = (f: { aba?: string; ciclo?: string }) =>
  queryOptions({
    queryKey: chavesRh.fechamentoDa(f),
    queryFn: ({ signal }) =>
      api.get("/rh/banco-de-horas", {
        esquema: respostaFechamento,
        consulta: f,
        sinal: signal,
      }),
  });

// ---------------------------------------------------------------------------
// Tabelas dos modais pedidas ao abrir
// ---------------------------------------------------------------------------

/** GET /rh/detalhes/quadro: quem são as pessoas do mês do quadro. */
export const tabelasDoQuadro = (p: PedidoDoQuadro): Promise<TabelaDetalhe[]> =>
  api
    .get("/rh/detalhes/quadro", { esquema: respostaTabelas, consulta: p })
    .then((r) => r.tabelas);

/** GET /rh/detalhes/memoria-do-custo: cada linha da conta de uma pessoa. */
export const tabelasDaMemoriaDoCusto = (p: {
  competencia: string;
  colaboradorId: string;
}): Promise<TabelaDetalhe[]> =>
  api
    .get("/rh/detalhes/memoria-do-custo", {
      esquema: respostaTabelas,
      consulta: { competencia: p.competencia, colaborador: p.colaboradorId },
    })
    .then((r) => r.tabelas);

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

/** POST /rh/funcionarios/:id/fora-do-ponto (rh.parametros). */
export const marcarForaDoPonto = acaoDaApi({
  metodo: "POST",
  caminho: (form) =>
    `/rh/funcionarios/${encodeURIComponent(String(form.get("id")))}/fora-do-ponto`,
  corpo: (form) => ({ fora: String(form.get("fora")) }),
  // Muda a lista, o perfil e todas as telas que contam o ponto.
  invalida: [chavesRh.tudo],
});

/** POST /rh/banco-de-horas/fechar (com `refazer`, apaga a lista e refaz). */
export const fecharCiclo = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/banco-de-horas/fechar",
  invalida: [chavesRh.fechamento()],
});

/** PATCH /rh/banco-de-horas/ciclos/:id (acao_<id> e realizado_<id>). */
export const salvarFechamento = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) =>
    `/rh/banco-de-horas/ciclos/${encodeURIComponent(String(form.get("ciclo_id")))}`,
  corpo: (form) => {
    const campos: Record<string, string> = {};
    for (const [k, v] of form)
      if (k.startsWith("acao_") || k.startsWith("realizado_"))
        campos[k] = String(v);
    return campos;
  },
  invalida: [chavesRh.fechamento()],
});

/**
 * POST /rh/banco-de-horas/ciclos/:id/finalizar. O ciclo novo vai para os
 * Parâmetros: invalida o RH inteiro.
 */
export const finalizarCiclo = acaoDaApi({
  metodo: "POST",
  caminho: (form) =>
    `/rh/banco-de-horas/ciclos/${encodeURIComponent(String(form.get("ciclo_id")))}/finalizar`,
  corpo: () => ({}),
  invalida: [chavesRh.tudo],
});

// ---------------------------------------------------------------------------
// Parte B: custo de pessoal, planejamento orçamentário e configurações
// ---------------------------------------------------------------------------

export const chavesRhB = {
  custo: (f: ConsultaDoCusto) => ["rh", "custo", f] as const,
  comparacao: (f: ConsultaDoCusto) => ["rh", "custo", "comparacao", f] as const,
  orcamento: () => ["rh", "orcamento"] as const,
  orcamentoDo: (f: ConsultaDoOrcamento) => ["rh", "orcamento", f] as const,
  categorias: () => ["rh", "categorias-de-gasto"] as const,
  cadastros: () => ["rh", "cadastros"] as const,
  beneficios: () => ["rh", "beneficios"] as const,
  parametros: () => ["rh", "parametros"] as const,
  importacoes: () => ["rh", "importacoes"] as const,
  folha: (id: string) => ["rh", "folhas", id] as const,
};

const id = (form: FormData, nome: string) =>
  encodeURIComponent(String(form.get(nome)));

/** ?mes, ?dep e ?comparar da URL (a API confere cada um). */
export function consultaDoCustoDaBusca(busca: Busca): ConsultaDoCusto {
  const f: ConsultaDoCusto = {};
  for (const chave of ["mes", "dep", "comparar"] as const) {
    const v = um(busca[chave]);
    if (v) f[chave] = v;
  }
  return f;
}

/** ?ano, ?mes e ?cat da URL (a API confere cada um). */
export function consultaDoOrcamentoDaBusca(busca: Busca): ConsultaDoOrcamento {
  const f: ConsultaDoOrcamento = {};
  for (const chave of ["ano", "mes", "cat"] as const) {
    const v = um(busca[chave]);
    if (v) f[chave] = v;
  }
  return f;
}

/** GET /rh/custo-de-pessoal */
export const consultaDoCusto = (f: ConsultaDoCusto) =>
  queryOptions({
    queryKey: chavesRhB.custo(f),
    queryFn: ({ signal }) =>
      api.get("/rh/custo-de-pessoal", {
        esquema: respostaCustoDePessoal,
        consulta: f,
        sinal: signal,
      }),
  });

/** GET /rh/custo-de-pessoal/comparacao */
export const consultaDaComparacao = (f: ConsultaDoCusto) =>
  queryOptions({
    queryKey: chavesRhB.comparacao(f),
    queryFn: ({ signal }) =>
      api.get("/rh/custo-de-pessoal/comparacao", {
        esquema: respostaComparacao,
        consulta: f,
        sinal: signal,
      }),
  });

/** GET /rh/orcamento */
export const consultaDoOrcamento = (f: ConsultaDoOrcamento) =>
  queryOptions({
    queryKey: chavesRhB.orcamentoDo(f),
    queryFn: ({ signal }) =>
      api.get("/rh/orcamento", {
        esquema: respostaOrcamento,
        consulta: f,
        sinal: signal,
      }),
  });

/** GET /rh/categorias-de-gasto */
export const consultaDasCategorias = queryOptions({
  queryKey: chavesRhB.categorias(),
  queryFn: ({ signal }) =>
    api.get("/rh/categorias-de-gasto", {
      esquema: respostaCategorias,
      sinal: signal,
    }),
});

/** GET /rh/cadastros (faturamento, departamentos e rubricas) */
export const consultaDosCadastros = queryOptions({
  queryKey: chavesRhB.cadastros(),
  queryFn: ({ signal }) =>
    api.get("/rh/cadastros", { esquema: respostaCadastros, sinal: signal }),
});

/** GET /rh/beneficios */
export const consultaDosBeneficios = queryOptions({
  queryKey: chavesRhB.beneficios(),
  queryFn: ({ signal }) =>
    api.get("/rh/beneficios", { esquema: respostaBeneficios, sinal: signal }),
});

/** GET /rh/parametros */
export const consultaDosParametros = queryOptions({
  queryKey: chavesRhB.parametros(),
  queryFn: ({ signal }) =>
    api.get("/rh/parametros", { esquema: respostaParametros, sinal: signal }),
});

/** GET /rh/importacoes */
export const consultaDasImportacoes = queryOptions({
  queryKey: chavesRhB.importacoes(),
  queryFn: ({ signal }) =>
    api.get("/rh/importacoes", {
      esquema: respostaImportacoes,
      sinal: signal,
    }),
});

/** GET /rh/folhas/:id */
export const consultaDaFolha = (folha: string) =>
  queryOptions({
    queryKey: chavesRhB.folha(folha),
    queryFn: ({ signal }) =>
      api.get(`/rh/folhas/${encodeURIComponent(folha)}`, {
        esquema: respostaFolhaParaEditar,
        sinal: signal,
      }),
  });

// Gravações da parte B. O que recalcula o custo muda as telas do RH
// inteiro: invalida tudo. O resto invalida só a tela que mudou.

/** POST /rh/custo-de-pessoal/recalcular (rh.folha ou rh.parametros). */
export const recalcularCustos = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/custo-de-pessoal/recalcular",
  corpo: () => ({}),
  invalida: [chavesRh.tudo],
});

/** POST /rh/orcamento/gastos (com id, corrige). */
export const salvarGasto = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/orcamento/gastos",
  invalida: [chavesRhB.orcamento()],
});

/** DELETE /rh/orcamento/gastos/:id */
export const excluirGasto = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/rh/orcamento/gastos/${id(form, "id")}`,
  invalida: [chavesRhB.orcamento()],
});

/** POST /rh/orcamento/:ano/finalizar */
export const finalizarOrcamento = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/rh/orcamento/${id(form, "ano")}/finalizar`,
  corpo: () => ({}),
  invalida: [chavesRhB.orcamento()],
});

/** POST /rh/categorias-de-gasto (com id, renomeia). */
export const salvarCategoria = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/categorias-de-gasto",
  invalida: [chavesRhB.categorias(), chavesRhB.orcamento()],
});

/** POST /rh/categorias-de-gasto/:id/ativa */
export const trocarAtivaCategoria = acaoDaApi({
  metodo: "POST",
  caminho: (form) => `/rh/categorias-de-gasto/${id(form, "id")}/ativa`,
  corpo: (form) => ({ ativa: String(form.get("ativa")) }),
  invalida: [chavesRhB.categorias(), chavesRhB.orcamento()],
});

/** PATCH /rh/departamentos/:id */
export const salvarDepartamento = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) => `/rh/departamentos/${id(form, "id")}`,
  invalida: [chavesRh.tudo],
});

/** POST /rh/rubricas/grupo (recalcula as folhas em aberto). */
export const trocarGrupoRubrica = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/rubricas/grupo",
  invalida: [chavesRh.tudo],
});

/** POST /rh/financeiro */
export const salvarFinanceiro = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/financeiro",
  invalida: [chavesRh.tudo],
});

/** POST /rh/parametros/jornadas */
export const salvarJornada = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/parametros/jornadas",
  invalida: [chavesRh.tudo],
});

/** DELETE /rh/parametros/jornadas/:alvo */
export const removerJornada = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/rh/parametros/jornadas/${id(form, "alvo")}`,
  invalida: [chavesRh.tudo],
});

/** POST /rh/parametros/metas */
export const salvarMeta = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/parametros/metas",
  invalida: [chavesRh.tudo],
});

/** POST /rh/parametros/empresa */
export const salvarEmpresa = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/parametros/empresa",
  invalida: [chavesRh.tudo],
});

/** POST /rh/parametros/encargos */
export const salvarEncargos = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/parametros/encargos",
  invalida: [chavesRh.tudo],
});

/** POST /rh/beneficios com id: altera o benefício. */
export const salvarBeneficio = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/beneficios",
  invalida: [chavesRh.tudo],
});

/**
 * POST /rh/beneficios sem id: cria e abre a página do benefício (lá o
 * "?criado=1" avisa; sem o "Salvo." daqui, para não avisar duas vezes).
 */
export function criarBeneficio(abrir: (id: string) => void): Acao {
  const gravar = acaoDaApi({
    metodo: "POST",
    caminho: "/rh/beneficios",
    invalida: [chavesRh.tudo],
    aoGravar: (resposta) => {
      const criado = respostaBeneficioCriado.safeParse(resposta);
      if (criado.success) abrir(criado.data.id);
    },
  });
  return async (anterior, form) => {
    const r = await gravar(anterior, form);
    return r.erro ? r : {};
  };
}

/** POST /rh/beneficios/vinculos */
export const vincularBeneficio = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/beneficios/vinculos",
  invalida: [chavesRh.tudo],
});

/** PATCH /rh/beneficios/vinculos (valor manual) */
export const salvarValorManual = acaoDaApi({
  metodo: "PATCH",
  caminho: "/rh/beneficios/vinculos",
  invalida: [chavesRh.tudo],
});

/** DELETE /rh/beneficios/vinculos/:id */
export const removerVinculo = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/rh/beneficios/vinculos/${id(form, "id")}`,
  invalida: [chavesRh.tudo],
});

/** POST /rh/beneficios/contratos */
export const vincularContrato = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/beneficios/contratos",
  invalida: [chavesRh.tudo],
});

/** DELETE /rh/beneficios/contratos/:id */
export const removerVinculoContrato = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/rh/beneficios/contratos/${id(form, "id")}`,
  invalida: [chavesRh.tudo],
});

/** POST /rh/beneficios/:id/vincular-pela-folha */
export const vincularPelaFolha = acaoDaApi({
  metodo: "POST",
  caminho: (form) =>
    `/rh/beneficios/${id(form, "beneficio_id")}/vincular-pela-folha`,
  corpo: () => ({}),
  invalida: [chavesRh.tudo],
});

/** POST /rh/beneficios/valores (colaborador_id e valor repetidos) */
export const salvarValoresDoMes = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/beneficios/valores",
  corpo: (form) =>
    formParaObjeto(form, { listas: ["colaborador_id", "valor"] }),
  invalida: [chavesRh.tudo],
});

/** POST /rh/beneficios/valores/planilha (multipart) */
export const importarValoresDoMes = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/beneficios/valores/planilha",
  corpo: (form) => form,
  invalida: [chavesRh.tudo],
});

/** POST /rh/beneficios/totais */
export const salvarTotalDoMes = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/beneficios/totais",
  invalida: [chavesRh.tudo],
});

/** Volta da leitura do arquivo: a prévia para conferir, ou o erro. */
export interface EstadoLeitura<P> {
  previa?: P;
  erro?: string;
}

/** POST /rh/folhas/previa (multipart): lê o PDF e guarda, sem gravar a folha. */
export async function lerFolha(
  _anterior: EstadoLeitura<PreviaDaFolha>,
  form: FormData,
): Promise<EstadoLeitura<PreviaDaFolha>> {
  try {
    return {
      previa: await api.post("/rh/folhas/previa", form, {
        esquema: previaDaFolha,
      }),
    };
  } catch (erro) {
    return { erro: mensagemDoErro(erro) };
  }
}

/** POST /rh/planos/previa (multipart): lê a planilha da operadora. */
export async function lerTabelaPlano(
  _anterior: EstadoLeitura<PreviaDoPlano>,
  form: FormData,
): Promise<EstadoLeitura<PreviaDoPlano>> {
  try {
    return {
      previa: await api.post("/rh/planos/previa", form, {
        esquema: previaDoPlano,
      }),
    };
  } catch (erro) {
    return { erro: mensagemDoErro(erro) };
  }
}

/** POST /rh/folhas/confirmar (a prévia veio de POST /rh/folhas/previa) */
export const confirmarFolha = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/folhas/confirmar",
  invalida: [chavesRh.tudo],
});

/** DELETE /rh/folhas/:id */
export const excluirFolha = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/rh/folhas/${id(form, "folha_id")}`,
  invalida: [chavesRh.tudo],
});

/** POST /rh/rubricas/classificar (recalcula as folhas em aberto) */
export const classificarRubrica = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/rubricas/classificar",
  invalida: [chavesRh.tudo],
});

/** PATCH /rh/folhas/:id/pessoas/:colaborador */
export const salvarPessoaFolha = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) =>
    `/rh/folhas/${id(form, "folha_id")}/pessoas/${id(form, "colaborador_id")}`,
  corpo: (form) =>
    formParaObjeto(form, {
      listas: ["codigo", "natureza", "referencia", "valor"],
    }),
  invalida: [chavesRh.tudo],
});

/** POST /rh/planos/confirmar (a prévia veio de POST /rh/planos/previa) */
export const confirmarTabelaPlano = acaoDaApi({
  metodo: "POST",
  caminho: "/rh/planos/confirmar",
  invalida: [chavesRh.tudo],
});

/** PATCH /rh/planos/tabelas/:id/faixas */
export const salvarFaixasPlano = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) => `/rh/planos/tabelas/${id(form, "tabela_id")}/faixas`,
  corpo: (form) =>
    formParaObjeto(form, {
      listas: ["idade_min", "idade_max", "mensalidade"],
    }),
  invalida: [chavesRh.tudo],
});
