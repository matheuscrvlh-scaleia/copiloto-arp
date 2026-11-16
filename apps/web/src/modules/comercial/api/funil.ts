import { respostaFunil } from "@arp/shared/comercial/contratos/funil";
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { chavesCom } from "./chaves";

/** GET /api/v1/comercial/funil */
export const consultaDoFunil = queryOptions({
  queryKey: chavesCom.funil(),
  queryFn: ({ signal }) =>
    api.get("/comercial/funil", { esquema: respostaFunil, sinal: signal }),
});
