import type { Detalhe, TabelaDetalhe } from "@arp/shared/detalhe";
import {
  fimDoMes,
  formatarData,
  formatarHoras,
  formatarMes,
  formatarNumero,
  formatarPct,
  formatarSaldoHoras,
  isoLocal,
  ultimasCompetencias,
} from "@arp/shared/formato";
import type {
  ConsultaDoPainel,
  PessoasDoPainel,
} from "@arp/shared/gestao/contratos";
import { status } from "@arp/shared/indicadores";
import {
  ateNoMaximo,
  descreverPeriodo,
  lerPeriodo,
  paramsDoPeriodo,
  periodoAnterior,
} from "@arp/shared/periodo";
import {
  ativosEm,
  mesesDeCasa,
  porSetor,
  somarPonto,
} from "@arp/shared/rh/calculos";
import {
  movimentoEntre,
  tabelaDeHorasPerdidas,
  tabelaDeSaidas,
  tabelaDoBanco,
  tabelaDoPonto,
  tabelaDoQuadro,
} from "@arp/shared/rh/detalhes";
import { fimConsiderado } from "@arp/shared/rh/periodo";
import { avisoDoPonto } from "@arp/shared/rh/ponto-periodo";
import { type Contexto, pode } from "@/contexto";
import { ErroDePermissao } from "@/erros";
import { banco } from "@/infra/banco";
import { avisosDo } from "@/modules/casca/casca.service";
import {
  colaboradoresDoQuadro,
  departamentosAtivos,
  metaDe,
  pontoDoPeriodo,
} from "@/modules/rh/dados";
import * as rh from "@/modules/rh/dados.repository";
import { buscaDeTurnover } from "@/modules/rh/turnover";

// Dashboard da Gestão: os números de pessoas do período (quadro do Copiloto
// e ponto do Secullum), lidos com a sessão de quem pede (o RLS vale) pelas
// mesmas leituras das telas do RH. As contas são as regras puras de
// @arp/shared; daqui sai tudo pronto para desenhar.

/**
 * Faixas de tempo de casa do gráfico (só agrupam para leitura; não são
 * regra de negócio). "ate" em meses, exclusivo.
 */
const FAIXAS_TEMPO_DE_CASA = [
  { rotulo: "< 1 ano", ate: 12 },
  { rotulo: "1–2 anos", ate: 24 },
  { rotulo: "2–5 anos", ate: 60 },
  { rotulo: "5–10 anos", ate: 120 },
  { rotulo: "10+ anos", ate: Number.POSITIVE_INFINITY },
];

const veRh = (ctx: Contexto) =>
  [...ctx.permissoes].some((p) => p.startsWith("rh."));

function variacao(
  atual: number | null,
  anterior: number | null,
): string | null {
  if (atual === null || anterior === null) return null;
  const d = atual - anterior;
  return `${d > 0 ? "+" : ""}${formatarNumero(d, 1)} p.p.`;
}

/** Pessoas no período do filtro; null para quem não tem nada do RH. */
export async function painel(
  ctx: Contexto,
  busca: ConsultaDoPainel,
): Promise<PessoasDoPainel | null> {
  if (!veRh(ctx)) return null;
  const podeFolha = pode(ctx, "rh.folha");
  // Lista de pessoas só para quem já as vê nas telas do RH.
  const veJornada = pode(ctx, "rh.jornada");
  const veQuadro = pode(ctx, "rh.quadro");

  // Data no futuro vira hoje.
  const agora = new Date();
  const periodo = ateNoMaximo(lerPeriodo(busca, agora), isoLocal(agora));
  const anterior = periodoAnterior(periodo);
  const rotulo = descreverPeriodo(periodo);
  const mes = `${periodo.ate.slice(0, 7)}-01`;
  const doze = ultimasCompetencias(mes, 12);
  const primeiroDosDoze = doze[0] ?? mes;

  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    colaboradores: await colaboradoresDoQuadro(tx),
    ultimaFolha: podeFolha ? (await rh.folhas(tx))[0] : undefined,
    pontoP: await pontoDoPeriodo(tx, periodo.de, periodo.ate),
    pontoAntP: await pontoDoPeriodo(tx, anterior.de, anterior.ate),
    metas: await rh.metas(tx),
    departamentos: await departamentosAtivos(tx),
  }));
  // Turnover: direto do Copiloto (HTTP, fora do escopo do banco), no período
  // e nos 12 meses até ele.
  const turnoverDoPeriodo = buscaDeTurnover(lido.departamentos);
  const [doPeriodo, dozeMeses, pendentes] = await Promise.all([
    turnoverDoPeriodo(periodo.de, periodo.ate),
    turnoverDoPeriodo(primeiroDosDoze, fimConsiderado(mes)),
    avisosDo(ctx),
  ]);
  const { colaboradores, pontoP, pontoAntP } = lido;
  const metaAbs = metaDe(lido.metas, "rh.absenteismo", mes);
  const metaBanco = metaDe(lido.metas, "rh.banco_horas_positivo", mes);
  const metaTurnover = metaDe(lido.metas, "rh.turnover", mes);

  const aviso = avisoDoPonto(pontoP);
  const ponto = pontoP.linhas;
  const efetivo = pontoP.efetivo ?? periodo;
  const totais = somarPonto(ponto);
  const totaisAnt =
    pontoAntP.linhas.length && !avisoDoPonto(pontoAntP).parcial
      ? somarPonto(pontoAntP.linhas)
      : null;
  const ate = periodo.ate;
  const ativosHoje = ativosEm(colaboradores, ate);
  const ativos = ativosHoje.length;
  const ativosAnt = ativosEm(colaboradores, anterior.ate).length;
  const tv = doPeriodo.ok ? doPeriodo.dados : null;
  const doHistorico = new Map(
    dozeMeses.ok ? dozeMeses.dados.mensal.map((m) => [m.competencia, m]) : [],
  );
  // Sem o Copiloto, as contagens saem da lista de pessoas (o turnover não).
  const contagem = (de: string, fim: string) => {
    const m = movimentoEntre(colaboradores, de, fim);
    return {
      admissoes: m.admitidos.length,
      desligamentos: m.desligados.length,
    };
  };
  const movimento = tv ?? contagem(periodo.de, ate);
  const qs = (dep?: string | null) =>
    new URLSearchParams({
      ...paramsDoPeriodo(periodo),
      ...(dep ? { dep } : {}),
    }).toString();
  const evolucao = doze.map((c) => {
    const n = ativosEm(colaboradores, fimConsiderado(c)).length;
    return {
      chave: c,
      rotulo: formatarMes(c).slice(0, 3),
      titulo: formatarMes(c),
      valor: n,
      texto: String(n),
      destaque: c === mes,
    };
  });
  const fluxo = doze.map((c) => {
    const m = doHistorico.get(c) ?? contagem(c, fimConsiderado(c));
    return {
      chave: c,
      rotulo: formatarMes(c).slice(0, 3),
      titulo: formatarMes(c),
      acima: m.admissoes,
      abaixo: m.desligamentos,
      destaque: c === mes,
    };
  });
  const comAdmissao = ativosHoje.flatMap((c) =>
    c.admissao === null ? [] : [{ c, meses: mesesDeCasa(c.admissao, ate) }],
  );
  const tempos = comAdmissao.map((x) => x.meses);
  const naFaixa = (k: number) => {
    const de = FAIXAS_TEMPO_DE_CASA[k - 1]?.ate ?? 0;
    const ateFaixa = FAIXAS_TEMPO_DE_CASA[k]?.ate ?? 0;
    return comAdmissao
      .filter((x) => x.meses >= de && x.meses < ateFaixa)
      .sort((a, b) => b.meses - a.meses)
      .map((x) => x.c);
  };
  const tempoDeCasa = FAIXAS_TEMPO_DE_CASA.map((f, k) => {
    const n = naFaixa(k).length;
    return {
      chave: f.rotulo,
      rotulo: f.rotulo,
      valor: n,
      texto: String(n),
      titulo: `${f.rotulo} de casa`,
      detalhe: `${n === 1 ? "pessoa" : "pessoas"}, ${formatarPct(tempos.length ? (n / tempos.length) * 100 : null)} do quadro`,
    };
  });
  const medianaCasa = [...tempos].sort((a, b) => a - b)[
    Math.floor(tempos.length / 2)
  ];
  const setores = porSetor(ponto);

  // Quem forma cada número (modal ao clicar). Ponto: só com rh.jornada;
  // cadastro e movimento: só com rh.quadro.
  const doSetor = (id: string | null) =>
    ponto.filter((l) => l.departamento_id === id);
  const linkJornada = (dep?: string | null) => `/rh/jornada?${qs(dep)}`;
  const chaveDoSetor = (id: string | null) => id ?? "sem";
  const detalhesDoMes = (c: string): Detalhe => {
    const fim = fimConsiderado(c);
    const lista = ativosEm(colaboradores, fim);
    const { admitidos, desligados } = movimentoEntre(
      colaboradores,
      c,
      fimDoMes(c),
    );
    const m = doHistorico.get(c);
    return {
      secao: "Quadro",
      titulo: `Pessoas em ${formatarMes(c)}`,
      subtitulo: `Copiloto RH em ${formatarData(fim)}`,
      resumo: [
        { rotulo: "Ativos", valor: String(lista.length) },
        {
          rotulo: "Admissões",
          valor: String(m?.admissoes ?? admitidos.length),
        },
        {
          rotulo: "Desligamentos",
          valor: String(m?.desligamentos ?? desligados.length),
        },
        { rotulo: "Turnover", valor: formatarPct(m?.turnover ?? null) },
      ],
      // As listas (todos os ativos de cada um dos 12 meses) vêm ao abrir.
      tabelas: [],
      link: {
        href: `/rh/quadro?mes=${c.slice(0, 7)}`,
        rotulo: "Abrir Quadro e turnover",
      },
    };
  };
  const detMeses = veQuadro
    ? Object.fromEntries(doze.map((c) => [c, detalhesDoMes(c)]))
    : undefined;
  const detSetores = veJornada
    ? Object.fromEntries(
        setores.map((s): [string, Detalhe] => [
          chaveDoSetor(s.departamento_id),
          {
            secao: "Pessoas por setor",
            titulo: s.departamento,
            subtitulo: `Ponto de ${formatarData(efetivo.de)} a ${formatarData(efetivo.ate)}, do maior absenteísmo para o menor`,
            resumo: [
              { rotulo: "Pessoas", valor: String(s.colaboradores) },
              { rotulo: "Absenteísmo", valor: formatarPct(s.absenteismo) },
              { rotulo: "Faltas", valor: formatarHoras(s.faltas_min) },
              { rotulo: "Atrasos", valor: formatarHoras(s.atrasos_min) },
            ],
            tabelas: [tabelaDoPonto(doSetor(s.departamento_id))],
            link: {
              href: linkJornada(s.departamento_id),
              rotulo: "Abrir a Jornada do setor",
            },
          },
        ]),
      )
    : undefined;
  const detBanco = veJornada
    ? Object.fromEntries(
        setores.map((s): [string, Detalhe] => [
          chaveDoSetor(s.departamento_id),
          {
            secao: "Banco de horas",
            titulo: s.departamento,
            subtitulo: `Saldo de cada pessoa em ${rotulo}, de quem mais deve para quem mais tem crédito`,
            resumo: [
              { rotulo: "Pessoas", valor: String(s.colaboradores) },
              {
                rotulo: "Créditos",
                valor: `${formatarSaldoHoras(s.banco_positivo_min)}`,
              },
              {
                rotulo: "Débitos",
                valor: formatarHoras(-Math.abs(s.banco_negativo_min)),
              },
              { rotulo: "Saldo", valor: formatarSaldoHoras(s.banco_saldo_min) },
            ],
            tabelas: [tabelaDoBanco(doSetor(s.departamento_id))],
            link: {
              href: linkJornada(s.departamento_id),
              rotulo: "Abrir a Jornada do setor",
            },
          },
        ]),
      )
    : undefined;
  const detTempo = veQuadro
    ? Object.fromEntries(
        FAIXAS_TEMPO_DE_CASA.map((f, k): [string, Detalhe] => [
          f.rotulo,
          {
            secao: "Tempo de casa",
            titulo: f.rotulo,
            subtitulo: `Ativos em ${formatarData(ate)}, de quem está há mais tempo`,
            tabelas: [tabelaDoQuadro(naFaixa(k), ate)],
            link: {
              href: `/rh/quadro?${qs()}`,
              rotulo: "Abrir Quadro e turnover",
            },
          },
        ]),
      )
    : undefined;
  const detHoras = veJornada
    ? Object.fromEntries(
        (["faltas", "atrasos"] as const).map((motivo): [string, Detalhe] => [
          motivo,
          {
            secao: "Horas perdidas",
            titulo: motivo === "faltas" ? "Faltas" : "Atrasos",
            subtitulo: `Quem teve ${motivo} em ${rotulo}, da maior para a menor`,
            resumo: [
              {
                rotulo: "Total",
                valor: formatarHoras(
                  motivo === "faltas" ? totais.faltas_min : totais.atrasos_min,
                ),
              },
              {
                rotulo: "Pessoas",
                valor: String(
                  ponto.filter((l) =>
                    motivo === "faltas" ? l.faltas_min > 0 : l.atrasos_min > 0,
                  ).length,
                ),
              },
            ],
            tabelas: [tabelaDeHorasPerdidas(ponto, motivo)],
            link: { href: linkJornada(), rotulo: "Abrir a Jornada" },
          },
        ]),
      )
    : undefined;
  const bancoPositivo = tabelaDoBanco(
    ponto.filter((l) => l.banco_saldo_min > 0),
  );
  const detAbsenteismo: Detalhe | undefined = veJornada
    ? {
        secao: "Absenteísmo",
        titulo: `Absenteísmo de ${rotulo}`,
        subtitulo: "Faltas e atrasos ÷ horas previstas, por pessoa",
        resumo: [
          { rotulo: "Absenteísmo", valor: formatarPct(totais.absenteismo) },
          { rotulo: "Faltas", valor: formatarHoras(totais.faltas_min) },
          { rotulo: "Atrasos", valor: formatarHoras(totais.atrasos_min) },
          { rotulo: "Pessoas", valor: String(ponto.length) },
        ],
        tabelas: [tabelaDoPonto(ponto)],
        link: { href: linkJornada(), rotulo: "Abrir a Jornada" },
      }
    : undefined;
  const detBancoPositivo: Detalhe | undefined = veJornada
    ? {
        secao: "Banco de horas",
        titulo: "Banco positivo",
        subtitulo: `Quem tem horas a folgar ou receber em ${rotulo}`,
        resumo: [
          {
            rotulo: "Total",
            valor: `${formatarSaldoHoras(totais.banco_positivo_min)}`,
          },
          { rotulo: "Pessoas", valor: String(bancoPositivo.linhas.length) },
        ],
        tabelas: [
          { ...bancoPositivo, linhas: [...bancoPositivo.linhas].reverse() },
        ],
        link: { href: linkJornada(), rotulo: "Abrir a Jornada" },
      }
    : undefined;

  return {
    aviso,
    rotulo,
    mes,
    ate,
    anteriorAte: anterior.ate,
    ativos,
    ativosAnt,
    pendencias: pendentes.length,
    totais,
    varAbs: variacao(totais.absenteismo, totaisAnt?.absenteismo ?? null),
    status: {
      absenteismo: status(totais.absenteismo, metaAbs),
      banco: status(
        ponto.length ? totais.banco_positivo_min / 60 : null,
        metaBanco,
      ),
      turnover: tv ? status(tv.turnover, metaTurnover) : null,
    },
    turnover: tv?.turnover ?? null,
    turnoverMotivo: doPeriodo.ok ? null : doPeriodo.motivo,
    movimento: {
      admissoes: movimento.admissoes,
      desligamentos: movimento.desligamentos,
    },
    evolucao,
    fluxo,
    tempoDeCasa,
    medianaCasa: medianaCasa ?? null,
    setores: setores.map((s) => ({
      ...s,
      chave: chaveDoSetor(s.departamento_id),
    })),
    ultimaFolha: lido.ultimaFolha?.competencia ?? null,
    noPonto: ponto.length,
    devemHoras: ponto.filter((l) => l.banco_saldo_min < 0).length,
    temCredito: ponto.filter((l) => l.banco_saldo_min > 0).length,
    detalhes: {
      meses: detMeses,
      setores: detSetores,
      banco: detBanco,
      tempo: detTempo,
      horas: detHoras,
      absenteismo: detAbsenteismo,
      bancoPositivo: detBancoPositivo,
    },
  };
}

// Tabelas do modal "Pessoas em <mês>", pedidas ao abrir: são a lista inteira
// de ativos de cada um dos 12 meses e iriam todas com o painel.

/** Admitidos, desligados e ativos no fim do mês (as mesmas da tela). */
export async function tabelasDoMes(
  ctx: Contexto,
  competencia: string,
): Promise<TabelaDetalhe[]> {
  // Mesma regra da tela (rh.quadro); o RLS confere a leitura de novo.
  if (!pode(ctx, "rh.quadro"))
    throw new ErroDePermissao("Você não tem acesso ao quadro.");

  const colaboradores = await banco.comoUsuario(
    ctx.usuario.id,
    colaboradoresDoQuadro,
  );
  const fim = fimConsiderado(competencia);
  const lista = ativosEm(colaboradores, fim);
  const { admitidos, desligados } = movimentoEntre(
    colaboradores,
    competencia,
    fimDoMes(competencia),
  );
  return [
    {
      ...tabelaDoQuadro(admitidos, fim, "Admitidos no mês"),
      vazio: "Nenhuma admissão no mês.",
    },
    {
      ...tabelaDeSaidas(desligados, "Desligados no mês"),
      vazio: "Nenhum desligamento no mês.",
    },
    tabelaDoQuadro(lista, fim, "Ativos no fim do mês"),
  ];
}
