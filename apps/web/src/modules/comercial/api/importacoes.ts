import {
  respostaConfirmacao,
  respostaImportacoes,
  respostaPrevia,
  respostaTiposImportacao,
} from "@arp/shared/comercial/contratos/importacoes";
import type {
  AcaoConfirmacao,
  AcaoPrevia,
  TipoImportacao,
} from "@arp/shared/comercial/importacao";
import { queryOptions } from "@tanstack/react-query";
import type { Acao } from "@/components/form-acao";
import { acaoDaApi } from "@/lib/acao";
import { api, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas } from "@/lib/consulta";
import { chavesCom } from "./chaves";

// Comercial › Configurações › Importações. Antes cada tipo tinha a sua
// Server Action (acoes/censo, fichas, pesquisa, importacoes); aqui a rota é
// uma só por tipo e a API escolhe o leitor (importacoes.tipos.ts). As
// funções devolvem o EstadoPrevia / EstadoConfirmacao de antes.

const BASE = "/comercial/importacoes";

/** GET /api/v1/comercial/importacoes (tipos permitidos + histórico) */
export const consultaImportacoes = queryOptions({
  queryKey: chavesCom.importacoes,
  queryFn: ({ signal }) =>
    api.get(BASE, { esquema: respostaImportacoes, sinal: signal }),
});

/** GET /api/v1/comercial/importacoes/tipos (os que a pessoa pode importar) */
export const consultaTiposImportacao = queryOptions({
  queryKey: chavesCom.tiposImportacao(),
  queryFn: ({ signal }) =>
    api.get(`${BASE}/tipos`, {
      esquema: respostaTiposImportacao,
      sinal: signal,
    }),
});

/** Importar grava em outras telas (contatos, censo, fichas, pesquisa). */
const atualizar = () =>
  clienteDeConsultas
    .invalidateQueries({ queryKey: chavesCom.tudo })
    .catch(() => {});

/** POST /api/v1/comercial/importacoes/:tipo/previa (multipart "arquivo"). */
export const previa =
  (tipo: TipoImportacao): AcaoPrevia =>
  async (_anterior, form) => {
    try {
      const r = await api.post(`${BASE}/${tipo}/previa`, form, {
        esquema: respostaPrevia,
      });
      await clienteDeConsultas
        .invalidateQueries({ queryKey: chavesCom.importacoes })
        .catch(() => {});
      return r;
    } catch (e) {
      return { erro: mensagemDoErro(e) };
    }
  };

/** POST /api/v1/comercial/importacoes/:tipo/confirmar */
export const confirmar =
  (tipo: TipoImportacao): AcaoConfirmacao =>
  async (_anterior, form) => {
    const corpo: Record<string, string> = {};
    for (const [chave, valor] of form)
      if (typeof valor === "string") corpo[chave] = valor;
    try {
      const r = await api.post(`${BASE}/${tipo}/confirmar`, corpo, {
        esquema: respostaConfirmacao,
      });
      await atualizar();
      return {
        ok: r.mensagem,
        importacaoId: r.importacaoId,
        gravadas: r.gravadas,
      };
    } catch (e) {
      return { erro: mensagemDoErro(e) };
    }
  };

/** POST /api/v1/comercial/importacoes/:id/desfazer */
export const desfazerImportacao: Acao = acaoDaApi({
  metodo: "POST",
  caminho: (form) =>
    `${BASE}/${encodeURIComponent(String(form.get("id") ?? ""))}/desfazer`,
  corpo: () => undefined,
  invalida: [chavesCom.tudo],
});
