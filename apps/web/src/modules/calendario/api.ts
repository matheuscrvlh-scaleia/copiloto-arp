import {
  type ConsultaItens,
  opcoesPublico,
  respostaItens,
  respostaTipos,
} from "@arp/shared/calendario/contratos";
import { respostaMensagem } from "@arp/shared/contratos/auth";
import { queryOptions } from "@tanstack/react-query";
import type { Acao } from "@/components/form-acao";
import { acaoDaApi, formParaObjeto } from "@/lib/acao";
import { api } from "@/lib/api";
import { clienteDeConsultas, VALIDADE } from "@/lib/consulta";

// Chamadas do Calendário (/api/v1/calendario) e as chaves de consulta.
// Leituras: tipos e opções de público são configuração (5 min); itens são
// dado de negócio. Toda gravação invalida o que mudou.

export const chavesCalendario = {
  tudo: ["calendario"] as const,
  tipos: () => ["calendario", "tipos"] as const,
  publico: () => ["calendario", "publico"] as const,
  itens: () => ["calendario", "itens"] as const,
  itensEntre: (p: ConsultaItens) => ["calendario", "itens", p] as const,
};

/** GET /calendario/tipos */
export const consultaDosTipos = queryOptions({
  queryKey: chavesCalendario.tipos(),
  queryFn: ({ signal }) =>
    api.get("/calendario/tipos", { esquema: respostaTipos, sinal: signal }),
  select: (r) => r.tipos,
  staleTime: VALIDADE.configuracao,
});

/** GET /calendario/publico */
export const consultaDoPublico = queryOptions({
  queryKey: chavesCalendario.publico(),
  queryFn: ({ signal }) =>
    api.get("/calendario/publico", { esquema: opcoesPublico, sinal: signal }),
  staleTime: VALIDADE.configuracao,
});

/** GET /calendario/itens?de&ate */
export const consultaDosItens = (p: ConsultaItens) =>
  queryOptions({
    queryKey: chavesCalendario.itensEntre(p),
    queryFn: ({ signal }) =>
      api.get("/calendario/itens", {
        esquema: respostaItens,
        consulta: p,
        sinal: signal,
      }),
    select: (r) => r.itens,
  });

// ---------------------------------------------------------------------------
// Itens
// ---------------------------------------------------------------------------

const corpoDoItem = (form: FormData) =>
  formParaObjeto(form, { listas: ["setores", "cargos", "usuarios"] });
const doItem = (form: FormData) =>
  `/calendario/itens/${encodeURIComponent(String(form.get("id")))}`;

const criarItem = acaoDaApi({
  metodo: "POST",
  caminho: "/calendario/itens",
  corpo: corpoDoItem,
  invalida: [chavesCalendario.itens()],
});
const atualizarItem = acaoDaApi({
  metodo: "PATCH",
  caminho: doItem,
  corpo: corpoDoItem,
  invalida: [chavesCalendario.itens()],
});

/** POST /calendario/itens (novo) ou PATCH /calendario/itens/:id (com `id`). */
export const salvarItem: Acao = (anterior, form) =>
  (form.get("id") ? atualizarItem : criarItem)(anterior, form);

/** DELETE /calendario/itens/:id */
export const excluirItem = acaoDaApi({
  metodo: "DELETE",
  caminho: doItem,
  invalida: [chavesCalendario.itens()],
});

/** POST /calendario/itens/:id/concluir: marca como feito ou reabre. */
export async function concluirItem(id: string, feito: boolean) {
  const r = await api.post(
    `/calendario/itens/${encodeURIComponent(id)}/concluir`,
    { feito },
    { esquema: respostaMensagem },
  );
  await clienteDeConsultas
    .invalidateQueries({ queryKey: chavesCalendario.itens() })
    .catch(() => {});
  return r;
}

// ---------------------------------------------------------------------------
// Tipos (mudam a legenda e o que cada item permite: invalida tudo)
// ---------------------------------------------------------------------------

const doTipo = (form: FormData) =>
  `/calendario/tipos/${encodeURIComponent(String(form.get("id")))}`;

const criarTipo = acaoDaApi({
  metodo: "POST",
  caminho: "/calendario/tipos",
  invalida: [chavesCalendario.tudo],
});
const atualizarTipo = acaoDaApi({
  metodo: "PATCH",
  caminho: doTipo,
  invalida: [chavesCalendario.tudo],
});

/** POST /calendario/tipos (novo) ou PATCH /calendario/tipos/:id (com `id`). */
export const salvarTipo: Acao = (anterior, form) =>
  (form.get("id") ? atualizarTipo : criarTipo)(anterior, form);

/** DELETE /calendario/tipos/:id */
export const excluirTipo = acaoDaApi({
  metodo: "DELETE",
  caminho: doTipo,
  invalida: [chavesCalendario.tudo],
});
