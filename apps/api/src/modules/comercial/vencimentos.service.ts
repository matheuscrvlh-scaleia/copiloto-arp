import type {
  RespostaVencimento,
  RespostaVencimentos,
} from "@arp/shared/comercial/contratos/vencimentos";
import type { Contexto } from "@/contexto";
import { ErroNaoEncontrado } from "@/erros";
import { contextoCom, parametros } from "./base";
import { dadosEnet } from "./fontes";
import { semAluguel } from "./ocupacao.service";
import { indicesAcumulados } from "./publicos";

// Vencimentos de contrato (spec 4.6): ENET (contratos, clientes, LUCs),
// faixas e dias do reajuste previsto dos parâmetros e o acumulado de 12
// meses do IGP-M e do IPCA (Banco Central; null se o serviço caiu, e a
// tela segue sem a estimativa).

/** Todos os contratos, ou só o do código (com o LUC dele). */
async function dados(
  ctx: Contexto,
  codigo: string | null,
): Promise<RespostaVencimentos> {
  const { pode, hoje, dadosDe } = contextoCom(ctx);
  const enet = dadosEnet(hoje);
  const p = await parametros(ctx);
  const indices = await indicesAcumulados();
  const contratos = codigo
    ? enet.contratos.filter((c) => c.codigo === codigo)
    : enet.contratos;
  const daqui = new Set(contratos.map((c) => c.luc));
  return {
    hoje,
    dadosDe,
    contratos: semAluguel(contratos, pode("comercial.valores.ver")),
    lucs: enet.lucs
      .filter((l) => !codigo || daqui.has(l.numero))
      .map((l) => ({ numero: l.numero, local: l.local, abl: l.abl })),
    faixas: {
      faixa1: p.vencimento_faixa1_dias,
      faixa2: p.vencimento_faixa2_dias,
    },
    diasReajuste: p.reajuste_previsto_dias,
    acumulados: {
      IGPM: indices.IGPM?.acumulado12m ?? null,
      IPCA: indices.IPCA?.acumulado12m ?? null,
    },
    ate: {
      IGPM: indices.IGPM?.ate ?? null,
      IPCA: indices.IPCA?.ate ?? null,
    },
    exemplo: enet.exemplo,
  };
}

export function dadosDosVencimentos(
  ctx: Contexto,
): Promise<RespostaVencimentos> {
  return dados(ctx, null);
}

/** Um contrato do ENET (a tela confere se está ativo) e a atividade. */
export async function dadosDoVencimento(
  ctx: Contexto,
  codigo: string,
): Promise<RespostaVencimento> {
  const d = await dados(ctx, codigo);
  const [c] = d.contratos;
  if (!c) throw new ErroNaoEncontrado("Contrato não encontrado.");
  const atividade =
    dadosEnet(d.hoje).clientes.find((x) => x.codigo === c.cliente)?.atividade ??
    "";
  return { ...d, atividade };
}
