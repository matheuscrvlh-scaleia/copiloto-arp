import { mensagemSegura } from "@/connectors/http";
import {
  type Acumulado,
  acumulado12Meses,
  buscarFeriados,
  type Feriado,
  type IndiceSgs,
} from "@/connectors/publicos";
import { log } from "@/infra/log";

// Índices e feriados nacionais para as telas (Vencimentos, Contratos,
// Eventos). Dado público, igual para todos: fica na memória do processo
// (índices por um dia, feriados por uma semana). Se o serviço falhar,
// devolve null e a tela segue sem a estimativa (o erro não fica guardado,
// então a próxima visita tenta de novo).

const DIA_MS = 86_400_000;

function guardado<T>(
  validadeMs: number,
  buscar: (chave: string) => Promise<T>,
): (chave: string) => Promise<T> {
  const memoria = new Map<string, { valor: T; ate: number }>();
  return async (chave) => {
    const agora = Date.now();
    const pronto = memoria.get(chave);
    if (pronto && pronto.ate > agora) return pronto.valor;
    const valor = await buscar(chave);
    memoria.set(chave, { valor, ate: agora + validadeMs });
    return valor;
  };
}

const ehIndice = (v: string): v is IndiceSgs => v === "IGPM" || v === "IPCA";

const acumuladoGuardado = guardado(DIA_MS, (indice) => {
  if (!ehIndice(indice)) throw new Error("índice desconhecido");
  return acumulado12Meses(indice);
});

const feriadosGuardados = guardado(7 * DIA_MS, (ano) =>
  buscarFeriados(Number(ano)),
);

/** IGP-M e IPCA acumulados nos últimos 12 meses publicados (null se caiu). */
export async function indicesAcumulados(): Promise<
  Record<IndiceSgs, Acumulado | null>
> {
  const um = (i: IndiceSgs) =>
    acumuladoGuardado(i).catch((erro: unknown) => {
      log.error({ erro: mensagemSegura(erro) }, `índice ${i}`);
      return null;
    });
  const [IGPM, IPCA] = await Promise.all([um("IGPM"), um("IPCA")]);
  return { IGPM, IPCA };
}

/** Feriados nacionais dos anos pedidos (null se a BrasilAPI caiu). */
export async function feriadosNacionais(
  anos: number[],
): Promise<Feriado[] | null> {
  try {
    const listas = await Promise.all(
      [...new Set(anos)].map((a) => feriadosGuardados(String(a))),
    );
    return listas.flat();
  } catch (erro) {
    log.error({ erro: mensagemSegura(erro) }, "feriados nacionais");
    return null;
  }
}
