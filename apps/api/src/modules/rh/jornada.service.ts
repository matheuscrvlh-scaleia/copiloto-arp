import type { ConsultaDoPeriodo } from "@arp/shared/rh/contratos/comum";
import type { RespostaJornada } from "@arp/shared/rh/contratos/telas";
import { type Contexto, pode } from "@/contexto";
import { banco } from "@/infra/banco";
import {
  bancoHorasEmReais,
  bancoParaContrato,
  cicloVigente,
  horaParaContrato,
  metaDe,
  pontoDoPeriodo,
  valorDaHora,
} from "./dados";
import * as repo from "./dados.repository";
import { lerFiltrosDoPeriodo } from "./filtros";

// Jornada (rh.jornada): ponto do período e do anterior, meta do
// absenteísmo, banco em R$ (rh.custo_pessoal) e salário/hora de cada pessoa
// (rh.custo_pessoal.individual: revela o salário). A tela soma e desenha com
// as regras de @arp/shared (a lista por pessoa já é dela).

export function jornada(
  ctx: Contexto,
  busca: ConsultaDoPeriodo,
): Promise<RespostaJornada> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const filtros = await lerFiltrosDoPeriodo(tx, busca);
    const { periodo, anterior, mes } = filtros;
    const ponto = await pontoDoPeriodo(tx, periodo.de, periodo.ate);
    const pontoAnterior = await pontoDoPeriodo(tx, anterior.de, anterior.ate);
    const metas = await repo.metas(tx);
    const reais = pode(ctx, "rh.custo_pessoal")
      ? await bancoHorasEmReais(tx, mes)
      : null;
    const hora = pode(ctx, "rh.custo_pessoal.individual")
      ? await valorDaHora(tx, mes)
      : null;
    const ciclo = cicloVigente(await repo.parametrosEmpresa(tx));
    return {
      filtros,
      ponto,
      anterior: pontoAnterior,
      metaAbs: metaDe(metas, "rh.absenteismo", mes),
      reais: bancoParaContrato(reais),
      hora: horaParaContrato(hora),
      ciclo,
    };
  });
}
