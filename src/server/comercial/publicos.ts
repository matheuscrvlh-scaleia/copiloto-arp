import "server-only";
import { cacheLife } from "next/cache";
import { mensagemSegura } from "@/connectors/http";
import {
  type Acumulado,
  acumulado12Meses,
  buscarFeriados,
  type Feriado,
  type IndiceSgs,
} from "@/connectors/publicos";

// Índices e feriados nacionais para as telas (Vencimentos, Contratos,
// Eventos). Dado público, igual para todos: fica no cache do servidor. Se o
// serviço falhar, devolve null e a tela segue sem a estimativa (o erro não
// entra no cache, então a próxima visita tenta de novo).

async function acumuladoEmCache(indice: IndiceSgs): Promise<Acumulado> {
  "use cache";
  cacheLife("days");
  return acumulado12Meses(indice);
}

async function feriadosEmCache(ano: number): Promise<Feriado[]> {
  "use cache";
  cacheLife("weeks");
  return buscarFeriados(ano);
}

/** IGP-M e IPCA acumulados nos últimos 12 meses publicados (null se caiu). */
export async function indicesAcumulados(): Promise<
  Record<IndiceSgs, Acumulado | null>
> {
  const um = (i: IndiceSgs) =>
    acumuladoEmCache(i).catch((erro) => {
      console.error(`índice ${i}`, mensagemSegura(erro));
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
      [...new Set(anos)].map((a) => feriadosEmCache(a)),
    );
    return listas.flat();
  } catch (erro) {
    console.error("feriados nacionais", mensagemSegura(erro));
    return null;
  }
}
