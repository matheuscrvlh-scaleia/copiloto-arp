import {
  respostaEstadoOrcamento,
  respostaListaDeObras,
} from "@arp/shared/operacoes/contratos/obras";
import type { EstadoOrcamento } from "@arp/shared/operacoes/orcamento";
import type { Acao } from "@/components/form-acao";
import { acaoDaApi } from "@/lib/acao";
import { api, mensagemDoErro } from "@/lib/api";
import { invalidar, texto } from "./acoes";
import { chavesOp } from "./api";
import { chavesObras } from "./api-obras";

// Gravações das Obras e do Diário de Obra pela API, com os nomes e a forma
// das Server Actions do sistema antigo.

const OBRAS = [chavesObras.tudo(), chavesOp.painel(), chavesOp.importacoes()];

export const salvarObra: Acao = acaoDaApi({
  metodo: "PATCH",
  caminho: (form) => `/operacoes/obras/${texto(form, "id")}`,
  invalida: OBRAS,
});

/** O lançamento vai em multipart (o anexo é opcional). */
export const salvarRealizado: Acao = acaoDaApi({
  metodo: "POST",
  caminho: "/operacoes/obras/realizado",
  corpo: (form) => form,
  invalida: OBRAS,
});

export const excluirRealizado: Acao = acaoDaApi({
  metodo: "DELETE",
  caminho: (form) => `/operacoes/obras/realizado/${texto(form, "id")}`,
  invalida: OBRAS,
});

/** Obras para o seletor da importação do orçamento. */
export async function obrasParaImportar(): Promise<
  { id: string; nome: string }[]
> {
  try {
    const r = await api.get("/operacoes/obras/para-importar", {
      esquema: respostaListaDeObras,
    });
    return r.obras;
  } catch {
    return [];
  }
}

async function estadoDoOrcamento(
  fazer: () => Promise<EstadoOrcamento>,
): Promise<EstadoOrcamento> {
  try {
    const r = await fazer();
    if (r.confirmado || r.descartado) await invalidar(OBRAS);
    return r;
  } catch (e) {
    return { erro: mensagemDoErro(e) };
  }
}

/** Passo 1: lê a planilha e devolve a escolha da obra/meses ou a prévia. */
export function lerPlanilhaOrcamento(
  _estado: EstadoOrcamento,
  form: FormData,
): Promise<EstadoOrcamento> {
  return estadoDoOrcamento(() =>
    api.post("/operacoes/obras/orcamento", form, {
      esquema: respostaEstadoOrcamento,
    }),
  );
}

export function confirmarOrcamento(
  _estado: EstadoOrcamento,
  form: FormData,
): Promise<EstadoOrcamento> {
  return estadoDoOrcamento(() =>
    api.post(
      `/operacoes/obras/orcamento/${texto(form, "importacao")}/confirmar`,
      undefined,
      { esquema: respostaEstadoOrcamento },
    ),
  );
}

export function descartarOrcamento(
  _estado: EstadoOrcamento,
  form: FormData,
): Promise<EstadoOrcamento> {
  return estadoDoOrcamento(() =>
    api.post(
      `/operacoes/obras/orcamento/${texto(form, "importacao")}/descartar`,
      undefined,
      { esquema: respostaEstadoOrcamento },
    ),
  );
}

/** "Atualizar agora" do Diário de Obra: a consulta roda depois de responder. */
export const atualizarDiarioAgora: Acao = acaoDaApi({
  metodo: "POST",
  caminho: "/operacoes/diario/atualizar",
  corpo: () => undefined,
  invalida: [chavesObras.diario()],
});
