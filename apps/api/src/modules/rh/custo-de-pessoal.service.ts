import { competenciaDaUrl, formatarMes } from "@arp/shared/formato";
import type {
  ConsultaDoCusto,
  RespostaComparacao,
  RespostaCustoDePessoal,
} from "@arp/shared/rh/contratos/custo";
import { ativosPorGrupo } from "@arp/shared/rh/custo";
import { fimConsiderado } from "@arp/shared/rh/periodo";
import { type Contexto, pode } from "@/contexto";
import { ErroDeNegocio } from "@/erros";
import { banco } from "@/infra/banco";
import { registrarDepois } from "@/infra/eventos";
import { log } from "@/infra/log";
import { exigirComMensagem } from "./apoio";
import { recalcularEmAberto } from "./custo.service";
import {
  colaboradoresDoQuadro,
  custoAgregado,
  custosIndividuais,
  metaDe,
} from "./dados";
import * as repo from "./dados.repository";
import { lerFiltros } from "./filtros";

// Custo de pessoal: abas Dashboard e Comparação (page.tsx do antigo, com a
// sessão: o RLS decide) e o Recalcular (acoes/custo-de-pessoal.ts). As somas
// e os cartões a tela faz com as regras de @arp/shared/rh; aqui saem os
// dados e os ativos do Copiloto RH no fim de cada mês (sem a lista de
// pessoas).

const soma = (m: Map<string | null, number>) =>
  [...m.values()].reduce((s, n) => s + n, 0);

/** GET /rh/custo-de-pessoal (rh.custo_pessoal) */
export function dashboard(
  ctx: Contexto,
  busca: ConsultaDoCusto,
): Promise<RespostaCustoDePessoal> {
  const podeRecalcular = pode(ctx, "rh.folha") || pode(ctx, "rh.parametros");
  const podeIndividual = pode(ctx, "rh.custo_pessoal.individual");
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const folhas = await repo.folhas(tx);
    if (!folhas.length) return { vazio: true };
    const empresa = await repo.parametrosEmpresa(tx);
    const beneficios = await repo.beneficios(tx);
    const cargos = await repo.cargos(tx);
    const financeiros = await repo.dadosFinanceiros(tx);
    const quadro = await colaboradoresDoQuadro(tx);
    const metas = await repo.metas(tx);

    // Uma competência (mês/ano da folha) por vez; sem ?mes=, a mais recente.
    // As variações são contra a folha anterior.
    const meses = folhas.map((f) => f.competencia).sort();
    const desc = [...meses].reverse();
    const { mes, departamento, departamentos } = await lerFiltros(
      tx,
      busca,
      desc,
    );
    const antes = meses.filter((c) => c < mes).at(-1) ?? null;
    const linhas = await custoAgregado(tx, antes ?? mes, mes);
    const pessoas = podeIndividual ? await custosIndividuais(tx, mes) : null;

    // Custo médio = custo ÷ ativos no Copiloto RH no último dia do mês da
    // folha (sócios já ficam fora do quadro). Departamento, cargo e
    // contrato do cadastro.
    const fins = [fimConsiderado(mes)];
    const quadroDep = departamento
      ? quadro.filter((c) => c.departamento_id === departamento)
      : quadro;
    const por = (chave: (c: (typeof quadro)[number]) => string | null) => [
      ...ativosPorGrupo(quadroDep, fins, chave),
    ];
    return {
      vazio: false,
      meses: desc,
      mes,
      antes,
      departamento,
      departamentos,
      ficticia: folhas.find((f) => f.competencia === mes)?.ficticia ?? false,
      podeRecalcular,
      linhas,
      pessoas,
      ativos: {
        doFiltro: soma(ativosPorGrupo(quadroDep, fins, () => "todos")),
        antes: soma(
          ativosPorGrupo(
            quadroDep,
            antes ? [fimConsiderado(antes)] : [],
            () => "todos",
          ),
        ),
        arp: soma(ativosPorGrupo(quadro, fins, () => "todos")),
        porDepartamento: por((c) => c.departamento_id),
        porCargo: por((c) => c.cargo_id ?? null),
        porContrato: por((c) => c.tipo_contrato ?? null),
      },
      financeiros,
      metaReceita: metaDe(metas, "rh.custo_sobre_receita", mes),
      cargos,
      faltas: {
        ratFap: !empresa.length,
        beneficios: !beneficios.some((b) => b.ativo),
      },
    };
  });
}

/** GET /rh/custo-de-pessoal/comparacao (rh.custo_pessoal) */
export function comparacao(
  ctx: Contexto,
  busca: ConsultaDoCusto,
): Promise<RespostaComparacao> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const folhas = await repo.folhas(tx);
    if (folhas.length < 2) return { vazio: true };
    const quadro = await colaboradoresDoQuadro(tx);
    const meses = folhas.map((f) => f.competencia).sort();
    const desc = [...meses].reverse();
    const { mes, departamento, departamentos } = await lerFiltros(
      tx,
      busca,
      desc,
    );
    // Sem ?comparar= (ou inválido): a folha anterior à escolhida.
    const pedidoB = competenciaDaUrl(busca.comparar);
    const comparar =
      pedidoB && pedidoB !== mes && meses.includes(pedidoB)
        ? pedidoB
        : (meses.filter((c) => c < mes).at(-1) ??
          desc.find((c) => c !== mes) ??
          mes);
    const [de, ate] = mes < comparar ? [mes, comparar] : [comparar, mes];
    const linhas = await custoAgregado(tx, de, ate);
    // Custo médio como no Dashboard: ÷ ativos no Copiloto RH no fim do mês.
    const quadroDep = departamento
      ? quadro.filter((c) => c.departamento_id === departamento)
      : quadro;
    const ativos = (c: string) =>
      soma(ativosPorGrupo(quadroDep, [fimConsiderado(c)], () => "todos"));
    return {
      vazio: false,
      meses: desc,
      mes,
      comparar,
      departamento,
      departamentos,
      linhas,
      ativosMes: ativos(mes),
      ativosComparar: ativos(comparar),
    };
  });
}

/**
 * Recalcula o custo de todas as folhas em aberto (as fechadas ficam). O
 * cálculo usa a service role: a permissão é conferida agora no banco. O
 * registro no histórico sai depois da resposta.
 */
export async function recalcular(ctx: Contexto): Promise<string> {
  await exigirComMensagem(
    ctx,
    ["rh.folha", "rh.parametros"],
    "Você não tem permissão para recalcular o custo.",
  );
  let feitos: Awaited<ReturnType<typeof recalcularEmAberto>>;
  try {
    feitos = await recalcularEmAberto();
  } catch (err) {
    log.error({ err }, "recálculo do custo");
    throw new ErroDeNegocio("Não foi possível recalcular. Tente de novo.");
  }
  registrarDepois({
    modulo: "rh",
    evento: "custo_recalculado",
    descricao: feitos.length
      ? `Recalculou o custo de ${feitos.map((f) => formatarMes(f.competencia)).join(", ")}`
      : "Pediu o recálculo do custo (nenhuma folha em aberto)",
    usuarioId: ctx.usuario.id,
    detalhes: { competencias: feitos.map((f) => f.competencia) },
  });
  if (!feitos.length) return "Nenhuma folha em aberto para calcular.";
  return `Recalculado: ${feitos
    .map(
      (f) =>
        `${formatarMes(f.competencia)} (${f.pessoas} pessoas${f.comPendencia ? `, ${f.comPendencia} com pendência` : ""})`,
    )
    .join(", ")}.`;
}
