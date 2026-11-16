import { createHash } from "node:crypto";
import type {
  RespostaLuc,
  RespostaOcupacao,
} from "@arp/shared/comercial/contratos/ocupacao";
import type { EnetContrato } from "@arp/shared/comercial/fontes";
import type { Contexto } from "@/contexto";
import { ErroNaoEncontrado } from "@/erros";
import { contextoCom, parametros, tiposLuc } from "./base";
import { dadosEnet } from "./fontes";

// Ocupação e estoque (spec 4.5): ENET (LUCs, contratos, clientes) e, dos
// parâmetros, os tipos de LUC que contam na ocupação, o prazo da
// transferência e os limites da curva da carteira. Os valores só saem com
// comercial.valores.ver.

/** Sem a permissão de valores, o aluguel não sai da API. */
export function semAluguel(c: EnetContrato[], comValores: boolean) {
  return comValores ? c : c.map((x) => ({ ...x, valor_aluguel: 0 }));
}

/** Chave estável do documento (junta contratos do mesmo locatário). */
const chaveDoDocumento = (doc: string) =>
  createHash("sha256").update(doc).digest("hex").slice(0, 16);

export async function dadosDaOcupacao(
  ctx: Contexto,
): Promise<RespostaOcupacao> {
  const { pode, hoje, dadosDe } = contextoCom(ctx);
  const comValores = pode("comercial.valores.ver");
  const enet = dadosEnet(hoje);
  const tipos = await tiposLuc(ctx);
  const p = await parametros(ctx);
  return {
    hoje,
    dadosDe,
    lucs: enet.lucs,
    contratos: semAluguel(enet.contratos, comValores),
    clientes: enet.clientes.map((c) => ({
      codigo: c.codigo,
      nome: "",
      cpf_cnpj: chaveDoDocumento(c.cpf_cnpj),
      tipo_pessoa: c.tipo_pessoa,
      socios: [],
      atividade: c.atividade,
    })),
    contam: tipos.filter((t) => t.conta_ocupacao).map((t) => t.tipo),
    transferenciaDias: p.transferencia_dias,
    curva: { a: p.curva_a_pct, b: p.curva_b_pct },
    exemplo: enet.exemplo,
  };
}

/** Um LUC e os contratos dele já iniciados (do mais recente ao mais antigo). */
export function dadosDoLuc(ctx: Contexto, numero: string): RespostaLuc {
  const { pode, hoje, dadosDe } = contextoCom(ctx);
  const enet = dadosEnet(hoje);
  const luc = enet.lucs.find((x) => x.numero === numero);
  if (!luc) throw new ErroNaoEncontrado("LUC não encontrado.");
  const contratos = enet.contratos
    .filter((c) => c.luc === numero && c.data_inicio <= hoje)
    .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
  return {
    hoje,
    dadosDe,
    luc,
    contratos: semAluguel(contratos, pode("comercial.valores.ver")),
    exemplo: enet.exemplo,
  };
}
