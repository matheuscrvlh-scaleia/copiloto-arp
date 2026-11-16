import type { Detalhe, TabelaDetalhe } from "@arp/shared/detalhe";
import type { PedidoDoQuadro } from "@arp/shared/rh/contratos/comum";
import type { DetalheDoPainel } from "@arp/shared/rh/contratos/telas";
import { useCallback, useRef } from "react";
import { tabelasDoQuadro } from "./api";

type Carregar = () => Promise<TabelaDetalhe[]>;

/**
 * A função que pede a lista de pessoas de um mês do quadro, uma por pedido:
 * o modal guarda o resultado pela função, então ela não pode mudar a cada
 * desenho da tela (era a Server Action com `.bind`).
 */
export function useCargaDoQuadro(): (p: PedidoDoQuadro) => Carregar {
  const cache = useRef(new Map<string, Carregar>());
  return useCallback((p: PedidoDoQuadro) => {
    const chave = JSON.stringify([
      p.de,
      p.fim,
      p.foco,
      p.rotulo ?? null,
      p.departamento ?? null,
    ]);
    let carregar = cache.current.get(chave);
    if (!carregar) {
      carregar = () => tabelasDoQuadro(p);
      cache.current.set(chave, carregar);
    }
    return carregar;
  }, []);
}

/** Detalhe que veio pronto da API: com `carga`, as tabelas vêm ao abrir. */
export function comCarga(
  d: DetalheDoPainel,
  carga: (p: PedidoDoQuadro) => Carregar,
): Detalhe {
  const { carga: pedido, ...detalhe } = d;
  return pedido ? { ...detalhe, carregarTabelas: carga(pedido) } : detalhe;
}
