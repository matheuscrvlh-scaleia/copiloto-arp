import type { Detalhe } from "@arp/shared/detalhe";
import {
  formatarMes,
  formatarMoeda,
  formatarNumero,
  formatarPct,
  ultimasCompetencias,
} from "@arp/shared/formato";
import {
  competenciasDoPeriodo,
  type Periodo,
  paramsDoPeriodo,
} from "@arp/shared/periodo";
import { ativosEm, porSetor, somarPonto } from "@arp/shared/rh/calculos";
import type {
  ConsultaDoPeriodo,
  PedidoDoQuadro,
} from "@arp/shared/rh/contratos/comum";
import type {
  DetalheDoPainel,
  RespostaPainel,
} from "@arp/shared/rh/contratos/telas";
import { custosPor, saldosEmReais, somarCustos } from "@arp/shared/rh/custo";
import { movimentoEntre } from "@arp/shared/rh/detalhes";
import {
  type FocoQuadro,
  origemDoAbsenteismo,
  origemDoBanco,
  origemDoCustoSobreReceita,
  origemDoCustoTotal,
  origemDoQuadro,
  origemDoSetor,
} from "@arp/shared/rh/modais";
import { fimConsiderado } from "@arp/shared/rh/periodo";
import { avisoDoPonto } from "@arp/shared/rh/ponto-periodo";
import type { NumerosTurnover } from "@arp/shared/rh/turnover";
import { type Contexto, pode } from "@/contexto";
import { banco, type Tx } from "@/infra/banco";
import {
  type BancoEmReais,
  bancoHorasEmReais,
  cicloVigente,
  colaboradoresDoQuadro,
  custoAgregado,
  custosIndividuais,
  metaDe,
  pontoDoPeriodo,
  valorDaHora,
} from "./dados";
import * as repo from "./dados.repository";
import { lerFiltrosDoPeriodo } from "./filtros";
import { buscaDeTurnover } from "./turnover";

// Painel de RH (rh.painel). A conta inteira é feita aqui, como a página do
// antigo fazia no servidor: a tela recebe os números e os detalhes dos modais
// prontos, já filtrados pelas permissões de quem vê (lista de pessoas só com
// rh.jornada / rh.quadro; custo com rh.custo_pessoal; pessoas do custo e
// banco em R$ por pessoa com rh.custo_pessoal.individual).

export async function painel(
  ctx: Contexto,
  busca: ConsultaDoPeriodo,
): Promise<RespostaPainel> {
  // Lista de pessoas no modal só para quem já as vê nas telas do RH.
  const veJornada = pode(ctx, "rh.jornada");
  const veQuadro = pode(ctx, "rh.quadro");
  // Banco em R$ por pessoa revela o salário: só com o custo individual.
  const individual = pode(ctx, "rh.custo_pessoal.individual");

  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const filtros = await lerFiltrosDoPeriodo(tx, busca);
    const { periodo, anterior, mes, departamento, departamentos } = filtros;
    return {
      filtros,
      pontoP: await pontoDoPeriodo(tx, periodo.de, periodo.ate),
      pontoAntP: await pontoDoPeriodo(tx, anterior.de, anterior.ate),
      todosSemFiltro: await colaboradoresDoQuadro(tx),
      metas: await repo.metas(tx),
      custo: await custoDoPainel(
        tx,
        ctx,
        periodo,
        departamento,
        new Map(departamentos.map((d) => [d.id, d.nome])),
      ),
      hora: individual ? await valorDaHora(tx, mes) : null,
      ciclo: cicloVigente(await repo.parametrosEmpresa(tx)),
    };
  });
  const { filtros, pontoP, pontoAntP, metas, custo, hora, ciclo } = lido;
  const { periodo, anterior, rotulo, mes, departamento } = filtros;

  // Turnover: direto do Copiloto, no período e nos 12 meses até ele (fora
  // do escopo do banco: HTTP externo).
  const turnoverDoPeriodo = buscaDeTurnover(filtros.departamentos);
  const [doPeriodo, dozeMeses] = await Promise.all([
    turnoverDoPeriodo(periodo.de, periodo.ate, departamento),
    turnoverDoPeriodo(
      ultimasCompetencias(mes, 12)[0] ?? mes,
      fimConsiderado(mes),
      departamento,
    ),
  ]);

  const doDep = <T extends { departamento_id: string | null }>(ls: T[]) =>
    departamento ? ls.filter((l) => l.departamento_id === departamento) : ls;
  const todos = doDep(lido.todosSemFiltro);
  const metaAbs = metaDe(metas, "rh.absenteismo", mes);
  const metaBanco = metaDe(metas, "rh.banco_horas_positivo", mes);
  const metaCusto = metaDe(metas, "rh.custo_sobre_receita", mes);
  const metaTurnover = metaDe(metas, "rh.turnover", mes);

  const ponto = doDep(pontoP.linhas);
  const aviso = avisoDoPonto(pontoP);
  const totais = somarPonto(ponto);
  const pontoAnt = doDep(pontoAntP.linhas);
  const totaisAnt =
    pontoAnt.length && !avisoDoPonto(pontoAntP).parcial
      ? somarPonto(pontoAnt)
      : null;
  const ativos = ativosEm(todos, periodo.ate).length;
  const ativosAnt = ativosEm(todos, anterior.ate).length;
  const tv = doPeriodo.ok ? doPeriodo.dados : null;
  const semTurnover = doPeriodo.ok ? undefined : doPeriodo.motivo;
  // Sem o Copiloto, as contagens saem da lista de pessoas (o turnover não).
  const pessoas = movimentoEntre(todos, periodo.de, periodo.ate);
  const movimento = tv
    ? { admissoes: tv.admissoes, desligamentos: tv.desligamentos }
    : {
        admissoes: pessoas.admitidos.length,
        desligamentos: pessoas.desligados.length,
      };
  const doMes = new Map<string, NumerosTurnover>(
    dozeMeses.ok ? dozeMeses.dados.mensal.map((m) => [m.competencia, m]) : [],
  );
  const evolucao = ultimasCompetencias(mes, 12).map((c) => {
    const n = ativosEm(todos, fimConsiderado(c)).length;
    return {
      chave: c,
      rotulo: formatarMes(c).slice(0, 3),
      titulo: formatarMes(c),
      valor: n,
      texto: String(n),
      detalhe: "colaboradores ativos no fim do mês",
      destaque: c === mes,
    };
  });
  const setores = porSetor(ponto);
  const emReais = custo.banco;
  const bancoValor =
    emReais && departamento
      ? (emReais.porDepartamento.get(departamento) ?? null)
      : (emReais?.valor ?? null);

  // De onde vem cada número (modal ao clicar). Os links levam o período.
  const filtrosUrl = (dep = departamento) =>
    new URLSearchParams({
      ...paramsDoPeriodo(periodo),
      ...(dep ? { dep } : {}),
    }).toString();
  const linkJornada = (dep = departamento) => ({
    href: `/rh/jornada?${filtrosUrl(dep)}`,
    rotulo: "Abrir a Jornada",
  });
  const opcoesPonto = {
    mes: pontoP.efetivo?.de ?? periodo.de,
    ate: pontoP.efetivo?.ate ?? periodo.ate,
    pessoas: veJornada,
    link: veJornada ? linkJornada() : undefined,
  };
  // Com a lista de pessoas (rh.quadro), as tabelas vêm ao abrir o modal
  // (`carga`): são todos os ativos de cada um dos 12 meses.
  const quadroDe = (
    foco: FocoQuadro,
    de: string,
    ate: string,
    nome: string,
    numeros: NumerosTurnover | null = de === periodo.de && ate === periodo.ate
      ? tv
      : (doMes.get(de) ?? null),
  ): DetalheDoPainel => {
    const detalhe = origemDoQuadro(todos, de, ate, {
      foco,
      pessoas: veQuadro,
      numeros,
      semTurnover,
      rotulo: nome,
      link: veQuadro
        ? {
            href: `/rh/quadro?${filtrosUrl()}`,
            rotulo: "Abrir Quadro e turnover",
          }
        : undefined,
    });
    const carga: PedidoDoQuadro = {
      de,
      fim: ate,
      foco,
      rotulo: nome,
      ...(departamento ? { departamento } : {}),
    };
    return veQuadro ? { ...detalhe, tabelas: [], carga } : detalhe;
  };
  const quadroDoPeriodo = (foco: FocoQuadro) =>
    quadroDe(foco, periodo.de, periodo.ate, rotulo);
  const linkCusto = custo.competencia
    ? {
        // O Custo de pessoal é por competência: a da folha usada aqui.
        href: `/rh/custo-de-pessoal?${new URLSearchParams({ mes: custo.competencia.slice(0, 7), ...(departamento ? { dep: departamento } : {}) }).toString()}`,
        rotulo: "Abrir Custo de pessoal",
      }
    : undefined;
  const origemReceita = custo.podeVer
    ? origemDoCustoSobreReceita(custo.totais, custo.faturamento, {
        competencia: custo.competencia ?? mes,
        ficticia: custo.ficticia,
        meta: metaCusto ? `até ${formatarPct(metaCusto.meta)}` : undefined,
        link: linkCusto,
      })
    : null;
  const origemTotal: Detalhe | null =
    custo.totais && custo.competencia
      ? origemDoCustoTotal(custo.totais, {
          competencia: custo.competencia,
          ficticia: custo.ficticia,
          porSetor: custo.porSetor,
          pessoas: custo.pessoas,
          link: linkCusto,
        })
      : null;

  return {
    filtros,
    metas: {
      absenteismo: metaAbs,
      banco: metaBanco,
      custo: metaCusto,
      turnover: metaTurnover,
    },
    custo: {
      podeVer: custo.podeVer,
      motivo: custo.motivo,
      totais: custo.totais,
      competencia: custo.competencia,
      rotulo: custo.rotulo,
      semFaturamento: custo.semFaturamento,
      ficticia: custo.ficticia,
      serie: custo.serie,
      variacao: custo.variacao,
      sobreReceita: custo.sobreReceita,
      origemTotal,
      origemReceita,
    },
    ponto: {
      semDado: aviso.semDado,
      parcial: aviso.parcial,
      comLinhas: ponto.length > 0,
      de: opcoesPonto.mes,
      ate: opcoesPonto.ate,
      absenteismo: totais.absenteismo,
      absenteismoAnterior: totaisAnt?.absenteismo ?? null,
      banco_positivo_min: totais.banco_positivo_min,
      banco_saldo_min: totais.banco_saldo_min,
      textoBanco: textoBancoEmReais(emReais, bancoValor, custo.podeVer),
      origemAbsenteismo: origemDoAbsenteismo(ponto, {
        ...opcoesPonto,
        meta: metaAbs ? `até ${formatarPct(metaAbs.meta)}` : undefined,
      }),
      origemBanco: origemDoBanco(ponto, {
        ...opcoesPonto,
        soPositivo: true,
        ciclo,
        reais: custo.podeVer ? emReais : null,
        porPessoa: hora
          ? saldosEmReais(ponto, hora.salarioHora, hora.adicional)
          : undefined,
        meta: metaBanco ? `até ${formatarNumero(metaBanco.meta)}h` : undefined,
      }),
      setores: setores.map((s) => ({
        chave: s.departamento_id ?? "sem",
        departamento_id: s.departamento_id,
        departamento: s.departamento,
        colaboradores: s.colaboradores,
        absenteismo: s.absenteismo,
        faltas_min: s.faltas_min,
        atrasos_min: s.atrasos_min,
        origem: origemDoSetor(
          s,
          ponto.filter((l) => l.departamento_id === s.departamento_id),
          {
            ...opcoesPonto,
            link: veJornada ? linkJornada(s.departamento_id) : undefined,
          },
        ),
      })),
    },
    quadro: {
      ativos,
      ativosAnterior: ativosAnt,
      evolucao,
      detalhesEvolucao: Object.fromEntries(
        evolucao.map((e) => [
          e.chave,
          quadroDe("ativos", e.chave, fimConsiderado(e.chave), e.titulo),
        ]),
      ),
      movimento,
      turnover: tv && { turnover: tv.turnover, taxas: tv.taxas },
      semTurnover: semTurnover ?? null,
      origemAtivos: quadroDe("ativos", periodo.de, periodo.ate, rotulo),
      origemAdmissoes: quadroDoPeriodo("admissoes"),
      origemDesligamentos: quadroDoPeriodo("desligamentos"),
      origemTurnover: quadroDoPeriodo("turnover"),
    },
  };

  function textoBancoEmReais(
    b: BancoEmReais | null,
    valor: number | null,
    podeVer: boolean,
  ): string {
    if (!podeVer) return "valor em R$ só com acesso ao custo";
    if (!b?.folha) return "valor em R$ depende da folha";
    if (b.adicional === null)
      return "valor em R$: configure o banco de horas em Parâmetros";
    return `≈ ${formatarMoeda(valor ?? 0, 0)} a pagar (salário/hora de ${formatarMes(b.folha)}, +${formatarNumero(b.adicional)}%)${b.semSalario ? ` · ${b.semSalario} sem salário na folha` : ""}`;
  }
}

/**
 * Custo das folhas dos meses do período (soma), ou da última folha antes
 * dele, no recorte do filtro. Custo é mensal: período dentro de um mês usa o
 * mês inteiro.
 */
async function custoDoPainel(
  tx: Tx,
  ctx: Contexto,
  periodo: Periodo,
  departamento: string | null,
  nomes: Map<string, string>,
) {
  const podeVer = pode(ctx, "rh.custo_pessoal");
  const individual = pode(ctx, "rh.custo_pessoal.individual");
  const vazio = {
    podeVer,
    totais: null,
    competencia: null,
    rotulo: "",
    semFaturamento: [],
    ficticia: false,
    porSetor: [],
    pessoas: null,
    serie: undefined,
    variacao: undefined,
    sobreReceita: null,
    faturamento: null,
    banco: null,
  };
  if (!podeVer) return { ...vazio, motivo: "Sem acesso ao custo de pessoal." };

  const doPeriodo = competenciasDoPeriodo(periodo);
  const ultimoMes = doPeriodo.at(-1) ?? periodo.de;
  const janela = ultimasCompetencias(ultimoMes, 12 + doPeriodo.length);
  // O faturamento (lançado mês a mês) vem numa consulta só, junto com o resto.
  const todas = await custoAgregado(tx, janela[0] ?? ultimoMes, ultimoMes);
  const folhas = await repo.folhas(tx);
  const banco = await bancoHorasEmReais(tx, ultimoMes);
  const financeiros = departamento ? null : await repo.dadosFinanceiros(tx);
  const linhas = departamento
    ? todas.filter((l) => l.departamento_id === departamento)
    : todas;
  const meses = [...new Set(linhas.map((l) => l.competencia))].sort();
  // Meses do período com folha; sem nenhum, a última folha antes dele.
  const comFolha = meses.filter((c) => doPeriodo.includes(c));
  const usados = comFolha.length ? comFolha : meses.slice(-1);
  const competencia = usados.at(-1) ?? null;
  const primeiro = usados[0];
  if (!competencia || !primeiro)
    return {
      ...vazio,
      banco,
      motivo: folhas.length
        ? "Custo ainda não calculado: use Recalcular em Custo de pessoal."
        : "Depende da importação da folha.",
    };

  const doMes = (c: string) =>
    somarCustos(linhas.filter((l) => l.competencia === c));
  const totais = somarCustos(
    linhas.filter((l) => usados.includes(l.competencia)),
  );
  // Pessoas: as da última folha (somar meses contaria a mesma pessoa de novo).
  totais.colaboradores = doMes(competencia).colaboradores;
  const rotulo = comFolha.length
    ? usados.length === 1
      ? `Folha de ${formatarMes(competencia)}`
      : `Folhas de ${formatarMes(primeiro)} a ${formatarMes(competencia)} (soma)`
    : `Última folha: ${formatarMes(competencia)}`;

  // Variação: os mesmos tantos meses antes.
  const antes = meses.filter((c) => c < primeiro).slice(-usados.length);
  const totalAnt =
    antes.length === usados.length
      ? antes.reduce((s, c) => s + doMes(c).custo_total, 0)
      : null;
  const faturamentoDe = new Map(
    (financeiros ?? []).map((f) => [f.competencia, f.faturamento_bruto]),
  );
  const faturamentos = financeiros
    ? usados.map((c) => faturamentoDe.get(c) ?? null)
    : null;
  const pessoas =
    individual && usados.length === 1
      ? await custosIndividuais(tx, competencia)
      : null;
  const semFaturamento = faturamentos
    ? usados.filter((_, i) => !faturamentos[i])
    : [];
  const faturamento =
    faturamentos && semFaturamento.length === 0
      ? faturamentos.reduce<number>((s, f) => s + (f ?? 0), 0)
      : null;
  const primeiroAntes = antes[0];
  const variacao =
    totalAnt && primeiroAntes
      ? {
          texto: `${totais.custo_total >= totalAnt ? "+" : ""}${formatarNumero(((totais.custo_total - totalAnt) / totalAnt) * 100, 1)}% vs ${antes.length === 1 ? formatarMes(primeiroAntes) : `${formatarMes(primeiroAntes)} a ${formatarMes(antes.at(-1) ?? primeiroAntes)}`}`,
          sentido: "neutro" as const,
        }
      : undefined;
  return {
    podeVer,
    motivo: "",
    totais,
    competencia,
    rotulo,
    semFaturamento,
    ficticia: usados.some(
      (c) => folhas.find((f) => f.competencia === c)?.ficticia ?? false,
    ),
    porSetor: custosPor(
      linhas.filter((l) => usados.includes(l.competencia)),
      (l) => l.departamento_id,
    ).map((g) => ({
      nome: (g.chave && nomes.get(g.chave)) || "Sem departamento",
      totais: g.totais,
    })),
    pessoas:
      pessoas && departamento
        ? pessoas.filter((p) => p.departamento_id === departamento)
        : pessoas,
    faturamento,
    serie: meses.slice(-12).map((c) => {
      const t = doMes(c).custo_total;
      return {
        chave: c,
        rotulo: formatarMes(c).slice(0, 3),
        titulo: formatarMes(c),
        valor: t,
        texto: formatarMoeda(t, 0),
        destaque: usados.includes(c),
      };
    }),
    variacao,
    // Por departamento não há receita: o % é só da empresa.
    sobreReceita:
      faturamento && faturamento > 0
        ? (totais.custo_total / faturamento) * 100
        : null,
    banco,
  };
}
