import {
  respostaLuc,
  respostaOcupacao,
} from "@arp/shared/comercial/contratos/ocupacao";
import {
  respostaVencimento,
  respostaVencimentos,
} from "@arp/shared/comercial/contratos/vencimentos";
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { chavesCom } from "./chaves";

/** GET /api/v1/comercial/ocupacao */
export const consultaDaOcupacao = queryOptions({
  queryKey: chavesCom.ocupacao(),
  queryFn: ({ signal }) =>
    api.get("/comercial/ocupacao", {
      esquema: respostaOcupacao,
      sinal: signal,
    }),
});

/** GET /api/v1/comercial/ocupacao/lucs/:numero */
export const consultaDoLuc = (numero: string) =>
  queryOptions({
    queryKey: chavesCom.luc(numero),
    queryFn: ({ signal }) =>
      api.get(`/comercial/ocupacao/lucs/${encodeURIComponent(numero)}`, {
        esquema: respostaLuc,
        sinal: signal,
      }),
  });

/** GET /api/v1/comercial/vencimentos */
export const consultaDosVencimentos = queryOptions({
  queryKey: chavesCom.vencimentos(),
  queryFn: ({ signal }) =>
    api.get("/comercial/vencimentos", {
      esquema: respostaVencimentos,
      sinal: signal,
    }),
});

/** GET /api/v1/comercial/vencimentos/:contrato */
export const consultaDoVencimento = (contrato: string) =>
  queryOptions({
    queryKey: chavesCom.vencimento(contrato),
    queryFn: ({ signal }) =>
      api.get(`/comercial/vencimentos/${encodeURIComponent(contrato)}`, {
        esquema: respostaVencimento,
        sinal: signal,
      }),
  });
