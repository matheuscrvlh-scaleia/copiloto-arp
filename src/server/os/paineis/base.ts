import "server-only";
import type {
  Bloco,
  CartaoPainel,
  ItemBloco,
} from "@/components/os/paineis/tipos";
import { formatarNumero, formatarPct } from "@/lib/formato";
import { type Meta, status } from "@/lib/indicadores";
import {
  agrupar,
  atrasadoEm,
  backlog,
  baldeDe,
  baldesDoPeriodo,
  concluidosNa,
  confirmacaoParada,
  emAbertoEm,
  janelaDoPeriodo,
  metaPara,
  naJanela,
  primeiraResposta,
  resolucao,
  separarNoPrazo,
} from "@/lib/os/indicadores";
import { STATUS, type StatusChamado } from "@/lib/os/rotulos";
import { instante } from "@/lib/os/tempo";
import { descreverPeriodo, periodoAnterior } from "@/lib/periodo";
import type { ChamadoDoPainel } from "./consultas";
import {
  type Ctx,
  colunaDeDias,
  colunaDeTempo,
  linkDaLista,
  plural,
  tempoLegivel,
} from "./contexto";

// Base de todo painel (geral ou de setor): os 4 cartões e os blocos que
// todo setor tem, no recorte do filtro (setor, categoria e pessoa).

export function textoDaMeta(m: Meta | null, unidade: "%" | "h"): string {
  if (!m) return "Sem meta: defina em Configurações › Parâmetros";
  const f = (v: number) =>
    unidade === "%" ? formatarPct(v, 0) : `${formatarNumero(v, 1)}h`;
  const sentido = unidade === "%" ? "ou mais" : "ou menos";
  return `Meta: ${f(m.meta)} ${sentido}${m.limiteAtencao !== null ? ` · atenção até ${f(m.limiteAtencao)}` : ""}`;
}

/** Abertos, atrasados, fechados e no prazo do recorte (o que a base usa). */
export function numerosDaBase(chs: ChamadoDoPainel[], ctx: Ctx) {
  const abertos = chs.filter((c) => emAbertoEm(c, ctx.momento, ctx.agora));
  const atrasados = abertos.filter((c) =>
    atrasadoEm(c, ctx.momento, ctx.agora),
  );
  const concluidos = concluidosNa(chs, ctx.janela);
  return {
    abertos,
    atrasados,
    concluidos,
    prazo: separarNoPrazo(concluidos),
    resolucao: resolucao(concluidos),
  };
}

/** Quanto tempo passou do prazo, por chamado (coluna "Atrasado há"). */
function atrasoPorChamado(chs: ChamadoDoPainel[], momento: Date) {
  return new Map(
    chs.map((c) => [
      c.id,
      Math.max(
        0,
        (momento.getTime() - instante(c.prazo as string).getTime()) / 60_000,
      ),
    ]),
  );
}

export function montarBase(ctx: Ctx): {
  cartoes: CartaoPainel[];
  blocos: Bloco[];
} {
  const { f, listas } = ctx;
  const n = numerosDaBase(ctx.base, ctx);
  const metaPct = metaPara(
    ctx.metas,
    "pct_no_prazo",
    f.setor?.id ?? null,
    f.categoria?.id ?? null,
  );
  const back = backlog(n.abertos, ctx.momento);
  const atraso = atrasoPorChamado(n.atrasados, ctx.momento);
  const tempoAtraso = colunaDeTempo("Atrasado há", atraso);
  const tempoResolucao = colunaDeTempo(
    "Tempo de resolução",
    n.resolucao.porChamado,
  );
  const comPrazo = n.prazo.noPrazo.length + n.prazo.fora.length;

  // Fechados no período anterior de mesmo tamanho (se a leitura o cobre).
  const anterior = periodoAnterior(f.periodo);
  const fechadosAntes = concluidosNa(
    ctx.base,
    janelaDoPeriodo(anterior.de, anterior.ate),
  ).length;

  const cartoes: CartaoPainel[] = [
    {
      titulo: "Em aberto",
      valor: formatarNumero(n.abertos.length),
      detalhe: `Com a equipe ${ctx.quando} · idade média ${back.mediaDias === null ? "—" : `${formatarNumero(back.mediaDias, 1)} dias`}`,
      origem: listas.lista(`Em aberto ${ctx.quando}`, n.abertos, {
        subtitulo:
          "Aberto, em andamento ou aguardando (sem os concluídos que esperam a confirmação)",
        extra: colunaDeDias("Dias em aberto", back.idades),
        link: linkDaLista(ctx),
      }),
    },
    {
      titulo: "Atrasados",
      tom: "escuro",
      valor: formatarNumero(n.atrasados.length),
      detalhe: n.abertos.length
        ? `${formatarPct((n.atrasados.length / n.abertos.length) * 100, 0)} dos em aberto · prazo vencido ${ctx.quando}`
        : `Prazo vencido ${ctx.quando}`,
      origem: listas.lista(`Atrasados ${ctx.quando}`, n.atrasados, {
        subtitulo: "Em aberto com o prazo vencido, do mais atrasado",
        extra: tempoAtraso,
        link: linkDaLista(ctx),
      }),
    },
    {
      titulo: "Fechados no período",
      valor: formatarNumero(n.concluidos.length),
      detalhe: `${f.rotulo} · tempo médio ${tempoLegivel(n.resolucao.mediaMin)}`,
      // Só compara se a leitura do painel cobre o período anterior inteiro.
      meta:
        anterior.de >= ctx.desde
          ? `${fechadosAntes} em ${descreverPeriodo(anterior)}`
          : undefined,
      origem: listas.lista(`Fechados em ${f.rotulo}`, n.concluidos, {
        subtitulo:
          "Concluídos pela equipe no período (inclui os que esperam a confirmação)",
        extra: tempoResolucao,
        link: linkDaLista(ctx, { status: "fechado" }),
      }),
    },
    {
      titulo: "Fechados no prazo",
      tom: "verde",
      valor: formatarPct(n.prazo.pct),
      status: status(n.prazo.pct, metaPct),
      direcao: "maior_melhor",
      meta: textoDaMeta(metaPct, "%"),
      detalhe: `${n.prazo.noPrazo.length} de ${comPrazo} com prazo${n.prazo.semPrazo.length ? ` · ${n.prazo.semPrazo.length} sem prazo` : ""}`,
      origem: listas.partes(
        "Fechados no prazo",
        [
          {
            titulo: "Fora do prazo",
            itens: n.prazo.fora,
            extra: tempoResolucao,
          },
          { titulo: "No prazo", itens: n.prazo.noPrazo, extra: tempoResolucao },
          {
            titulo: "Sem prazo (fora da conta)",
            itens: n.prazo.semPrazo,
            extra: tempoResolucao,
          },
        ],
        {
          subtitulo: `Concluídos em ${f.rotulo}`,
          resumo: [
            { rotulo: "No prazo", valor: formatarPct(n.prazo.pct) },
            {
              rotulo: "Meta",
              valor: metaPct ? formatarPct(metaPct.meta, 0) : "—",
            },
          ],
          fontes: [
            {
              rotulo: "Fórmula",
              valor: "concluídos até o prazo ÷ concluídos que tinham prazo",
            },
            {
              rotulo: "Aguardando",
              valor:
                "o prazo é empurrado pelo tempo em que o chamado ficou aguardando",
            },
          ],
        },
      ),
    },
  ];

  const blocos: Bloco[] = [
    blocoSemanas(ctx),
    blocoBacklog(ctx, n.abertos, back),
    blocoAtrasadosPorPessoa(ctx, n.abertos, n.atrasados, tempoAtraso),
    blocoConfirmacao(ctx),
    blocoTempoPorCategoria(ctx, n.concluidos, n.resolucao.porChamado),
    blocoPrimeiraResposta(ctx),
    ...blocosPorCategoriaEStatus(ctx),
  ];
  return { cartoes, blocos };
}

// ---------------------------------------------------------------------------

function blocoSemanas(ctx: Ctx): Bloco {
  const { f, listas } = ctx;
  const baldes = baldesDoPeriodo(f.periodo.de, f.periodo.ate);
  const porSemana = baldes[0]?.tipo !== "mes";
  const criados = ctx.base.filter((c) => naJanela(c.criado_em, ctx.janela));
  const concluidos = concluidosNa(ctx.base, ctx.janela);
  return {
    id: "abertos-e-fechados",
    titulo: `Abertos e fechados por ${porSemana ? "semana" : "mês"}`,
    descricao: `${f.rotulo} · abertos para cima, fechados (concluídos) para baixo`,
    largura: 7,
    partes: [
      {
        tipo: "espelhadas",
        rotulos: { acima: "Abertos", abaixo: "Fechados" },
        itens: baldes.map((b) => {
          const ab = criados.filter(
            (c) => baldeDe(c.criado_em, baldes) === b.chave,
          );
          const fe = concluidos.filter(
            (c) => baldeDe(c.concluido_em, baldes) === b.chave,
          );
          return {
            chave: b.chave,
            rotulo: b.rotulo,
            titulo: b.titulo,
            acima: ab.length,
            abaixo: fe.length,
            origem: listas.partes(
              `${porSemana ? "Semana de " : ""}${b.titulo}`,
              [
                { titulo: "Abertos", itens: ab },
                { titulo: "Fechados", itens: fe },
              ],
              {
                resumo: [
                  { rotulo: "Abertos", valor: String(ab.length) },
                  { rotulo: "Fechados", valor: String(fe.length) },
                ],
              },
            ),
          };
        }),
      },
    ],
    exportar: listas.partes(`Abertos e fechados em ${f.rotulo}`, [
      { titulo: "Abertos", itens: criados },
      { titulo: "Fechados", itens: concluidos },
    ]),
  };
}

function blocoBacklog(
  ctx: Ctx,
  abertos: ChamadoDoPainel[],
  back: ReturnType<typeof backlog<ChamadoDoPainel>>,
): Bloco {
  const { listas } = ctx;
  const dias = colunaDeDias("Dias em aberto", back.idades);
  const importados = abertos.filter((c) => c.origem === "importacao").length;
  const mais = back.maisAntigo;
  return {
    id: "backlog",
    titulo: "Backlog",
    descricao: `Idade dos que estão em aberto ${ctx.quando}, sem o tempo em Aguardando`,
    largura: 5,
    partes: [
      {
        tipo: "faixas",
        itens: back.faixas.map((fx) => ({
          chave: fx.chave,
          rotulo: fx.rotulo,
          valor: fx.itens.length,
          texto: String(fx.itens.length),
          titulo: `${fx.rotulo} em aberto`,
          origem: listas.lista(
            `Em aberto há ${fx.rotulo.toLowerCase()}`,
            fx.itens,
            {
              extra: dias,
            },
          ),
        })),
      },
      {
        tipo: "numeros",
        numeros: [
          {
            rotulo: "Idade somada",
            valor: `${formatarNumero(back.totalDias, 1)} d`,
            detalhe: plural(abertos.length, "chamado", "chamados"),
            origem: listas.lista("Backlog", abertos, { extra: dias }),
          },
          {
            rotulo: "Mais antigo",
            valor: mais
              ? `${formatarNumero(back.idades.get(mais.id) ?? 0, 1)} d`
              : "—",
            detalhe: mais ? `#${mais.numero} · ${mais.titulo}` : undefined,
            origem: mais
              ? listas.lista("Mais antigo em aberto", [mais], { extra: dias })
              : undefined,
          },
        ],
      },
    ],
    nota: importados
      ? `${plural(importados, "chamado veio", "chamados vieram")} do sistema anterior, que não registrava o tempo em Aguardando: a idade deles é corrida.`
      : undefined,
    exportar: listas.lista(`Em aberto ${ctx.quando}`, abertos, { extra: dias }),
  };
}

function blocoAtrasadosPorPessoa(
  ctx: Ctx,
  abertos: ChamadoDoPainel[],
  atrasados: ChamadoDoPainel[],
  tempoAtraso: ReturnType<typeof colunaDeTempo>,
): Bloco {
  const { listas } = ctx;
  const chave = (c: ChamadoDoPainel) => c.responsavel_id ?? "sem";
  const comPessoa = agrupar(abertos, chave);
  const itens: ItemBloco[] = agrupar(atrasados, chave).map((g) => {
    const nome = ctx.pessoaNome(
      g.chave === "sem" ? null : g.chave,
      "Sem responsável (fila)",
    );
    const daPessoa =
      comPessoa.find((p) => p.chave === g.chave)?.itens.length ?? 0;
    return {
      chave: g.chave,
      rotulo: nome,
      valor: g.itens.length,
      texto: String(g.itens.length),
      detalhe: `de ${daPessoa} em aberto com a pessoa`,
      origem: listas.lista(`Atrasados: ${nome}`, g.itens, {
        extra: tempoAtraso,
        link: linkDaLista(
          ctx,
          g.chave === "sem" ? {} : { responsavel: g.chave },
        ),
      }),
    };
  });
  return {
    id: "atrasados-por-pessoa",
    titulo: "Atrasados por pessoa",
    descricao: `Responsável por cada chamado atrasado ${ctx.quando}`,
    largura: 6,
    partes: [
      {
        tipo: "barras",
        itens,
        rotuloLargo: true,
        vazio: "Nenhum chamado atrasado.",
      },
    ],
    exportar: listas.lista(`Atrasados ${ctx.quando}`, atrasados, {
      extra: tempoAtraso,
    }),
  };
}

function blocoConfirmacao(ctx: Ctx): Bloco {
  const { listas } = ctx;
  const dias = ctx.parametros.confirmacao_alerta_dias;
  const parados = confirmacaoParada(ctx.base, ctx.agora, dias);
  const ha = new Map(
    parados.map((c) => [
      c.id,
      (ctx.agora.getTime() - instante(c.concluido_em as string).getTime()) /
        60_000,
    ]),
  );
  const coluna = colunaDeTempo("Concluído há", ha);
  const quem = (c: ChamadoDoPainel) =>
    c.aberto_por ??
    (c.solicitante_nome ? `portal:${c.solicitante_nome}` : "sem");
  const nome = (k: string) =>
    k === "sem"
      ? "Sem solicitante"
      : k.startsWith("portal:")
        ? `${k.slice(7)} (portal)`
        : ctx.pessoaNome(k);
  return {
    id: "aguardando-confirmacao",
    titulo: `Aguardando confirmação há mais de ${plural(dias, "dia", "dias")}`,
    descricao:
      "Agora · quem pediu e ainda não confirmou o fechamento (o prazo do aceite está em Parâmetros)",
    largura: 6,
    partes: [
      {
        tipo: "barras",
        rotuloLargo: true,
        vazio: "Ninguém segurando o fechamento.",
        itens: agrupar(parados, quem).map((g) => ({
          chave: g.chave,
          rotulo: nome(g.chave),
          valor: g.itens.length,
          texto: String(g.itens.length),
          origem: listas.lista(`Aguardando ${nome(g.chave)}`, g.itens, {
            subtitulo: `Concluídos há mais de ${plural(dias, "dia", "dias")}, esperando a confirmação`,
            extra: coluna,
          }),
        })),
      },
    ],
    exportar: listas.lista("Aguardando confirmação", parados, {
      extra: coluna,
    }),
  };
}

function blocoTempoPorCategoria(
  ctx: Ctx,
  concluidos: ChamadoDoPainel[],
  porChamado: Map<string, number>,
): Bloco {
  const { listas, f } = ctx;
  const coluna = colunaDeTempo("Tempo de resolução", porChamado);
  const grupos = agrupar(concluidos, (c) => c.categoria_id ?? "sem");
  const linhas = grupos.map((g) => {
    const cat = ctx.categorias.find((c) => c.id === g.chave) ?? null;
    const r = resolucao(g.itens);
    const meta = metaPara(
      ctx.metas,
      "tempo_medio_horas",
      cat?.setor_id ?? f.setor?.id ?? null,
      cat?.id ?? null,
    );
    const horas = r.mediaMin === null ? null : r.mediaMin / 60;
    const nome = `${f.setor || !cat ? "" : `${ctx.setorNome(cat.setor_id)} › `}${ctx.categoriaNome(cat?.id ?? null)}`;
    return {
      chave: g.chave,
      celulas: [
        { texto: nome },
        {
          texto: String(g.itens.length),
          origem: listas.lista(`Fechados: ${nome}`, g.itens, {
            extra: coluna,
            resumo: [
              { rotulo: "Tempo médio", valor: tempoLegivel(r.mediaMin) },
              {
                rotulo: "Meta",
                valor: meta ? `${formatarNumero(meta.meta, 1)}h` : "—",
              },
            ],
          }),
        },
        {
          texto: tempoLegivel(r.mediaMin),
          status: status(horas, meta),
          direcao: "menor_melhor" as const,
        },
        { texto: meta ? `até ${formatarNumero(meta.meta, 1)}h` : "Sem meta" },
      ],
    };
  });
  const importados = concluidos.filter((c) => c.origem === "importacao").length;
  return {
    id: "tempo-por-categoria",
    titulo: "Tempo médio de resolução por categoria (MTTR)",
    descricao: `Fechados em ${f.rotulo}, da abertura à conclusão, sem o tempo em Aguardando`,
    largura: 7,
    partes: [
      {
        tipo: "tabela",
        colunas: [
          { titulo: "Categoria" },
          { titulo: "Fechados", numero: true },
          { titulo: "Tempo médio", numero: true },
          { titulo: "Meta", numero: true },
        ],
        linhas,
        vazio: "Nenhum chamado fechado no período.",
      },
    ],
    nota: importados
      ? `${plural(importados, "chamado fechado veio", "chamados fechados vieram")} do sistema anterior, que não registrava o tempo em Aguardando: o tempo deles é corrido (sem desconto).`
      : undefined,
    exportar: listas.lista(`Fechados em ${f.rotulo}`, concluidos, {
      extra: coluna,
    }),
  };
}

function blocoPrimeiraResposta(ctx: Ctx): Bloco {
  const { listas, f } = ctx;
  const criados = ctx.base.filter((c) => naJanela(c.criado_em, ctx.janela));
  const horas = new Map(ctx.categorias.map((c) => [c.id, c.resposta_horas]));
  const r = primeiraResposta(criados, horas, ctx.agora);
  const coluna = colunaDeTempo("Primeira resposta", r.porChamado);
  const notas = [
    r.semDado.length
      ? `${plural(r.semDado.length, "chamado do histórico importado fica", "chamados do histórico importado ficam")} de fora: o sistema anterior não registrava a primeira resposta.`
      : "",
    r.semMeta.length
      ? `${plural(r.semMeta.length, "chamado não tem", "chamados não têm")} prazo de resposta na categoria (fora da conta).`
      : "",
  ].filter(Boolean);
  return {
    id: "primeira-resposta",
    titulo: "Primeira resposta (SLA)",
    descricao: `Abertos em ${f.rotulo}: tempo até alguém assumir, dentro das horas de resposta da categoria`,
    largura: 5,
    partes: [
      {
        tipo: "numeros",
        numeros: [
          {
            rotulo: "Respondidos no prazo",
            valor: formatarPct(r.pct),
            detalhe: `${r.cumpridos.length} de ${r.cumpridos.length + r.estourados.length} com prazo de resposta`,
            origem: listas.partes("Primeira resposta", [
              { titulo: "Estourados", itens: r.estourados, extra: coluna },
              { titulo: "No prazo", itens: r.cumpridos, extra: coluna },
            ]),
          },
          {
            rotulo: "Estourados",
            valor: String(r.estourados.length),
            alerta: r.estourados.length > 0,
            detalhe: "inclui os ainda sem resposta",
            origem: listas.lista("Primeira resposta estourada", r.estourados, {
              extra: coluna,
            }),
          },
          {
            rotulo: "Esperando resposta",
            valor: String(r.pendentes.length),
            detalhe: "ainda dentro do prazo",
            origem: listas.lista("Esperando a primeira resposta", r.pendentes),
          },
          {
            rotulo: "Tempo médio",
            valor: tempoLegivel(r.mediaMin),
            detalhe: "até a primeira resposta",
            origem: listas.lista(
              "Tempo até a primeira resposta",
              [...r.porChamado.keys()],
              { extra: coluna },
            ),
          },
        ],
      },
    ],
    nota: notas.join(" ") || undefined,
  };
}

const COR_STATUS: Record<StatusChamado, 1 | 2 | 3 | 4 | 5 | "neutro"> = {
  aberto: 1,
  em_andamento: 5,
  aguardando: 4,
  concluido: 3,
  fechado: 2,
  cancelado: "neutro",
};

function blocosPorCategoriaEStatus(ctx: Ctx): Bloco[] {
  const { listas, f } = ctx;
  const criados = ctx.base.filter((c) => naJanela(c.criado_em, ctx.janela));
  const porCategoria = agrupar(criados, (c) => c.categoria_id ?? "sem");
  const porStatus = agrupar(criados, (c) => c.status);
  const nomeCat = (id: string) => {
    const cat = ctx.categorias.find((c) => c.id === id);
    const nome = ctx.categoriaNome(cat?.id ?? null);
    return f.setor || !cat ? nome : `${ctx.setorNome(cat.setor_id)} › ${nome}`;
  };
  return [
    {
      id: "por-categoria",
      titulo: "Chamados por categoria",
      descricao: `Abertos em ${f.rotulo}`,
      largura: 7,
      partes: [
        {
          tipo: "barras",
          rotuloLargo: true,
          itens: porCategoria.map((g) => ({
            chave: g.chave,
            rotulo: nomeCat(g.chave),
            valor: g.itens.length,
            texto: String(g.itens.length),
            origem: listas.lista(nomeCat(g.chave), g.itens, {
              subtitulo: `Abertos em ${f.rotulo}`,
              link: linkDaLista(
                ctx,
                g.chave === "sem"
                  ? {}
                  : { categoria: g.chave, status: "todos" },
              ),
            }),
          })),
        },
      ],
      exportar: listas.lista(`Abertos em ${f.rotulo}`, criados),
    },
    {
      id: "por-status",
      titulo: "Chamados por status",
      descricao: `Abertos em ${f.rotulo}, pelo status de agora`,
      largura: 5,
      partes: [
        {
          tipo: "rosca",
          centro: { valor: String(criados.length), rotulo: "abertos" },
          itens: porStatus.map((g) => {
            const s = g.chave as StatusChamado;
            return {
              chave: s,
              rotulo: STATUS[s],
              valor: g.itens.length,
              texto: String(g.itens.length),
              cor: COR_STATUS[s],
              origem: listas.lista(
                `${STATUS[s]}: abertos em ${f.rotulo}`,
                g.itens,
              ),
            };
          }),
        },
      ],
    },
  ];
}
