import type { QueryKey } from "@tanstack/react-query";
import { z } from "zod";
import type { Acao, EstadoAcao } from "@/components/form-acao";
import { api, mensagemDoErro } from "./api";
import { clienteDeConsultas } from "./consulta";

// Adaptador das Server Actions do sistema antigo. Lá, um formulário chamava
// uma função do servidor `(anterior, FormData) => Promise<EstadoAcao>`; aqui
// a mesma assinatura chama a API. O <FormAcao> e quem usa `useActionState`
// continuam iguais: só troca de onde vem a `acao`.

export type ValorDoForm = FormDataEntryValue | FormDataEntryValue[];

/** Arquivo de um <input type="file"> que ficou vazio. */
const arquivoVazio = (v: FormDataEntryValue) =>
  v instanceof File && v.size === 0 && v.name === "";

/**
 * FormData → objeto. Campo que aparece mais de uma vez (caixas de seleção,
 * `<select multiple>`) vira lista; os nomes em `listas` viram lista sempre,
 * mesmo com um valor só ou nenhum. Arquivo vazio fica de fora.
 *
 * Os valores continuam texto (ou File): quem converte número, data e
 * booleano é o schema Zod do contrato, na API.
 */
export function formParaObjeto(
  form: FormData,
  opcoes: { listas?: string[] } = {},
): Record<string, ValorDoForm> {
  const objeto: Record<string, ValorDoForm> = {};
  for (const chave of new Set(form.keys())) {
    const valores = form.getAll(chave).filter((v) => !arquivoVazio(v));
    const [primeiro] = valores;
    if (valores.length > 1) objeto[chave] = valores;
    else if (primeiro !== undefined) objeto[chave] = primeiro;
  }
  for (const chave of opcoes.listas ?? []) {
    const atual = objeto[chave];
    objeto[chave] =
      atual === undefined ? [] : Array.isArray(atual) ? atual : [atual];
  }
  return objeto;
}

const comMensagem = z.object({ mensagem: z.string() });

export interface OpcoesDaAcao {
  metodo: "POST" | "PATCH" | "PUT" | "DELETE";
  /** Relativo a /api/v1. Função quando depende do formulário (ex.: o id). */
  caminho: string | ((form: FormData) => string);
  /**
   * Corpo do pedido. Padrão: `formParaObjeto(form)` como JSON. Devolva um
   * FormData para enviar multipart (arquivos) ou `undefined` para não enviar
   * corpo.
   */
  corpo?: (form: FormData) => unknown;
  /** Chaves de consulta que esta gravação muda (o `updateTag` de antes). */
  invalida?: QueryKey[] | ((form: FormData) => QueryKey[]);
  /** Aviso de sucesso. Padrão: a `mensagem` da resposta, ou "Salvo.". */
  mensagem?: string;
  /** Depois de gravar e invalidar (ex.: navegar). Recebe a resposta crua. */
  aoGravar?: (resposta: unknown, form: FormData) => void;
}

/**
 * Cria a `acao` de um <FormAcao> (ou de `useActionState`) que grava pela
 * API: converte o formulário, chama, invalida as consultas e traduz o
 * resultado em `{ ok }` ou `{ erro }`.
 *
 * ```ts
 * export const salvarSetor = acaoDaApi({
 *   metodo: "POST",
 *   caminho: "/os/setores",
 *   invalida: [chavesOs.setores()],
 * });
 * ```
 */
export function acaoDaApi(opcoes: OpcoesDaAcao): Acao {
  return async (_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> => {
    const caminho =
      typeof opcoes.caminho === "function"
        ? opcoes.caminho(form)
        : opcoes.caminho;
    try {
      const corpo =
        opcoes.metodo === "DELETE" && !opcoes.corpo
          ? undefined
          : opcoes.corpo
            ? opcoes.corpo(form)
            : formParaObjeto(form);
      const resposta = await api.pedir(opcoes.metodo, caminho, corpo);
      const chaves =
        typeof opcoes.invalida === "function"
          ? opcoes.invalida(form)
          : (opcoes.invalida ?? []);
      // Espera as telas abertas buscarem de novo: o aviso de "Salvo." sai
      // com o dado novo já na tela. Falha ao rebuscar não desfaz a gravação.
      await Promise.all(
        chaves.map((queryKey) =>
          clienteDeConsultas.invalidateQueries({ queryKey }).catch(() => {}),
        ),
      );
      opcoes.aoGravar?.(resposta, form);
      const daResposta = comMensagem.safeParse(resposta);
      return {
        ok:
          opcoes.mensagem ??
          (daResposta.success ? daResposta.data.mensagem : "Salvo."),
      };
    } catch (erro) {
      return { erro: mensagemDoErro(erro) };
    }
  };
}
