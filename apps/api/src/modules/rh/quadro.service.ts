import { ultimasCompetencias } from "@arp/shared/formato";
import type { ConsultaDoPeriodo } from "@arp/shared/rh/contratos/comum";
import type { RespostaQuadro } from "@arp/shared/rh/contratos/telas";
import { fimConsiderado } from "@arp/shared/rh/periodo";
import type { Contexto } from "@/contexto";
import { banco } from "@/infra/banco";
import { colaboradoresDoQuadro, metaDe } from "./dados";
import * as repo from "./dados.repository";
import { lerFiltrosDoPeriodo } from "./filtros";
import { buscaDeTurnover } from "./turnover";

// Quadro e turnover (rh.quadro): pessoas do Copiloto RH e o turnover direto
// da API dele, no período e nos 12 meses até ele. A tela monta gráficos e
// modais com as regras de @arp/shared (a lista inteira já é dela: rh.quadro
// vê todas as pessoas nos modais).

export async function quadro(
  ctx: Contexto,
  busca: ConsultaDoPeriodo,
): Promise<RespostaQuadro> {
  const { filtros, colaboradores, metas } = await banco.comoUsuario(
    ctx.usuario.id,
    async (tx) => ({
      filtros: await lerFiltrosDoPeriodo(tx, busca),
      colaboradores: await colaboradoresDoQuadro(tx),
      metas: await repo.metas(tx),
    }),
  );
  // Fora do escopo do banco: HTTP externo.
  const turnoverDoPeriodo = buscaDeTurnover(filtros.departamentos);
  const { periodo, mes, departamento } = filtros;
  const [turnover, turnover12] = await Promise.all([
    turnoverDoPeriodo(periodo.de, periodo.ate, departamento),
    turnoverDoPeriodo(
      ultimasCompetencias(mes, 12)[0] ?? mes,
      fimConsiderado(mes),
      departamento,
    ),
  ]);
  return {
    filtros,
    colaboradores,
    metaTurnover: metaDe(metas, "rh.turnover", mes),
    turnover,
    turnover12,
  };
}
