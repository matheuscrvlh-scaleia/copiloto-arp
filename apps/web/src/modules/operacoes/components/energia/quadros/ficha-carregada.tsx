import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { CartaoCarregando } from "@/components/carregando";
import { ErroDaApi } from "@/lib/api";
import {
  consultaDaFicha,
  consultaDosParametros,
} from "@/modules/operacoes/api";
import { useContextoOp } from "@/modules/operacoes/contexto";
import type { DadosDaFicha } from "@/modules/operacoes/tipos";

// A ficha da caixa lida da API (o `fichaDaCaixa` do sistema antigo, que
// voltava null quando a caixa não existia): `naoAchou` aparece no lugar da
// ficha quando a API responde 404 (ou o id não é válido).

export function FichaCarregada({
  id,
  naoAchou,
  children,
}: {
  id: string;
  naoAchou: React.ReactNode;
  children: (d: DadosDaFicha) => React.ReactNode;
}) {
  const { data: p } = useSuspenseQuery(consultaDosParametros);
  const ficha = useQuery({ ...consultaDaFicha(id), retry: false });
  const ctx = useContextoOp(ficha.dataUpdatedAt || undefined);
  if (ficha.isPending) return <CartaoCarregando altura="h-[40rem]" />;
  if (ficha.error) {
    const e = ficha.error;
    if (e instanceof ErroDaApi && (e.status === 404 || e.status === 400))
      return naoAchou;
    throw e;
  }
  return children({ ...ficha.data, ctx, parametros: p.parametros });
}
