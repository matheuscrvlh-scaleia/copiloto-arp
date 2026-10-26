import "server-only";
import type { Detalhe } from "@/components/modal-detalhe";
import type {
  Bloco,
  ColunaExtra,
  ItemBloco,
} from "@/components/os/paineis/tipos";
import {
  fimDoMes,
  formatarHoras,
  formatarMes,
  formatarMoeda,
  formatarNumero,
  formatarPct,
  ultimasCompetencias,
} from "@/lib/formato";
import { status } from "@/lib/indicadores";
import {
  agrupar,
  atrasadoEm,
  concluidosNa,
  emAbertoEm,
  janelaDoPeriodo,
  media,
  metaPara,
  naJanela,
  separarNoPrazo,
} from "@/lib/os/indicadores";
import {
  type CustoDoPainel,
  minutosPorChamado,
  minutosPorTecnico,
  notasDosFornecedores,
  type OSDoFornecedor,
  somarCustos,
} from "@/lib/os/indicadores-setor";
import { ROTAS_OS } from "@/lib/os/rotas";
import { EXECUCOES, STATUS, type StatusChamado } from "@/lib/os/rotulos";
import { SINAIS, sinalDoAtivo } from "@/lib/os/sinal";
import { hojeEmBrasilia, instante, somarDias } from "@/lib/os/tempo";
import { textoDaMeta } from "./base";
import {
  ativosParaSinal,
  type ChamadoDoPainel,
  chamadosPorId,
  custosDe,
  empresas,
  linksDoPeriodo,
  nomesDosAtivos,
  resumoDosAtivos,
  sessoesDe,
  tecnicos,
} from "./consultas";
import { type Ctx, colunaDeTempo, plural, tempoLegivel } from "./contexto";

// Ordens de serviço (Operações e qualquer setor com categoria de OS ou que
// registra tempo): técnicos, custos, terceirizados, preventivas, ativos e a
// nota dos fornecedores.

/** Meses da tendência de custo (só leitura: quantos meses o gráfico mostra). */
export const MESES_DE_TENDENCIA = 6;

/** Primeiro dia da janela da tendência que termina no mês da data. */
export function inicioDaTendencia(ate: string): string {
  return ultimasCompetencias(
    `${ate.slice(0, 7)}-01`,
    MESES_DE_TENDENCIA,
  )[0] as string;
}

const ehOS = (c: ChamadoDoPainel) => c.tipo === "os";

function colunaDeReais(
  titulo: string,
  ids: string[],
  valor: (id: string) => number | null,
): ColunaExtra {
  const valores: Record<string, string> = {};
  const ordem: Record<string, number> = {};
  for (const id of ids) {
    const v = valor(id);
    valores[id] = v === null ? "sem cálculo" : formatarMoeda(v);
    ordem[id] = v ?? -1;
  }
  return { titulo, numero: true, valores, ordem };
}

export async function blocosDeOS(ctx: Ctx): Promise<Bloco[]> {
  const { f } = ctx;
  const comTempo = new Set(
    ctx.categorias.filter((c) => c.registrar_tempo).map((c) => c.id),
  );
  const os = ctx.base.filter(ehOS);
  const registram = ctx.base.filter(
    (c) => ehOS(c) || (c.categoria_id !== null && comTempo.has(c.categoria_id)),
  );
  const concluidas = concluidosNa(os, ctx.janela);
  const pedeCustos = ctx.pode("os.custos");
  const doMes = ultimasCompetencias(
    `${f.periodo.ate.slice(0, 7)}-01`,
    MESES_DE_TENDENCIA,
  ).map((m) => ({
    mes: m,
    os: concluidosNa(
      os,
      janelaDoPeriodo(
        m,
        fimDoMes(m) < f.periodo.ate ? fimDoMes(m) : f.periodo.ate,
      ),
    ),
  }));
  const lendoCustos = pedeCustos
    ? custosDe([...concluidas, ...doMes.flatMap((m) => m.os)].map((c) => c.id))
    : Promise.resolve(new Map<string, CustoDoPainel>());
  // Tudo de uma vez: sessões, técnicos, custos, ativos e fornecedores.
  const [sessoes, tecs, custos, ativos, fornecedores] = await Promise.all([
    sessoesDe(registram.map((c) => c.id)),
    tecnicos(),
    lendoCustos,
    blocosDeAtivos(ctx, concluidas, pedeCustos ? lendoCustos : null),
    blocoFornecedores(ctx),
  ]);

  const blocos: Bloco[] = [
    blocoTecnicos(ctx, sessoes, tecs, concluidas),
    blocoExecucaoELocal(ctx, os),
    blocoTerceirizados(ctx, os),
    blocoPreventivas(ctx, os),
  ];
  if (pedeCustos) blocos.push(blocoCustos(ctx, concluidas, doMes, custos));
  blocos.push(...ativos);
  if (fornecedores) blocos.push(fornecedores);
  return blocos;
}

// ---------------------------------------------------------------------------

function blocoTecnicos(
  ctx: Ctx,
  sessoes: Awaited<ReturnType<typeof sessoesDe>>,
  tecs: Awaited<ReturnType<typeof tecnicos>>,
  concluidas: ChamadoDoPainel[],
): Bloco {
  const { listas, f } = ctx;
  const r = minutosPorTecnico(sessoes, tecs, f.periodo.de, f.periodo.ate);
  const porOS = minutosPorChamado(sessoes);
  const trabalhadas = concluidas.filter((c) => (porOS.get(c.id) ?? 0) > 0);
  const mediaOS = media(trabalhadas.map((c) => porOS.get(c.id) ?? 0));
  const colunaOS = colunaDeTempo("Tempo trabalhado", porOS);
  const chamadosDoPeriodo = [
    ...new Set(r.porTecnico.flatMap((t) => t.chamados)),
  ];
  const itens: ItemBloco[] = r.porTecnico.map((t) => ({
    chave: t.tecnico.id,
    rotulo: t.tecnico.nome,
    valor: t.minutos,
    texto: formatarHoras(t.minutos),
    detalhe: plural(t.chamados.length, "chamado", "chamados"),
    origem: listas.lista(`Trabalho de ${t.tecnico.nome}`, t.chamados, {
      subtitulo: `Sessões de ${f.rotulo}`,
      resumo: [
        { rotulo: "Horas", valor: formatarHoras(t.minutos) },
        { rotulo: "Chamados", valor: String(t.chamados.length) },
      ],
      extra: colunaDeTempo(
        "Minutos do técnico",
        new Map(Object.entries(t.porChamado)),
      ),
    }),
  }));
  return {
    id: "tecnicos",
    titulo: "Técnicos",
    descricao: `Horas registradas nas sessões de ${f.rotulo}, já sem o almoço`,
    largura: 7,
    partes: [
      {
        tipo: "numeros",
        numeros: [
          {
            rotulo: "Horas trabalhadas",
            valor: formatarHoras(r.minutos),
            detalhe: "relógio: cada sessão uma vez",
            origem: listas.lista(
              "Chamados com sessões no período",
              chamadosDoPeriodo,
              {
                extra: colunaOS,
              },
            ),
          },
          {
            rotulo: "Minuto-homem",
            valor: formatarNumero(r.minutoHomem),
            detalhe: `${formatarHoras(r.minutoHomem)} · minutos × técnicos`,
            origem: listas.lista(
              "Chamados com sessões no período",
              chamadosDoPeriodo,
              {
                extra: colunaOS,
              },
            ),
          },
          {
            rotulo: "Tempo médio por OS",
            valor: tempoLegivel(mediaOS),
            detalhe: `trabalhado nas ${plural(trabalhadas.length, "OS finalizada", "OS finalizadas")}`,
            origem: listas.lista(
              "OS finalizadas com tempo registrado",
              trabalhadas,
              {
                extra: colunaOS,
              },
            ),
          },
        ],
      },
      {
        tipo: "barras",
        itens,
        rotuloLargo: true,
        vazio: "Nenhuma sessão de trabalho no período.",
      },
    ],
    nota: "Técnico desligado sai do painel a partir da data do desligamento.",
    links: [
      {
        href: `${ROTAS_OS.ordens}#relatorios`,
        rotulo: "Relatórios de OS em Excel",
      },
    ],
  };
}

function blocoExecucaoELocal(ctx: Ctx, os: ChamadoDoPainel[]): Bloco {
  const { listas, f } = ctx;
  const criadas = os.filter((c) => naJanela(c.criado_em, ctx.janela));
  const local = (c: ChamadoDoPainel) =>
    c.local?.trim() || c.bloco?.trim() || "Sem local";
  const porLocal = agrupar(criadas, local);
  const top = porLocal.slice(0, 10);
  const resto = porLocal.slice(10).flatMap((g) => g.itens);
  const locais = resto.length
    ? [...top, { chave: "Outros locais", itens: resto }]
    : top;
  const porExecucao = agrupar(criadas, (c) => c.execucao ?? "sem");
  const rotuloExec = (k: string) =>
    k === "sem" ? "Não informada" : EXECUCOES[k as keyof typeof EXECUCOES];
  return {
    id: "os-execucao-local",
    titulo: "OS por execução e por local",
    descricao: `OS abertas em ${f.rotulo}`,
    largura: 5,
    partes: [
      {
        tipo: "rosca",
        centro: { valor: String(criadas.length), rotulo: "OS abertas" },
        itens: porExecucao.map((g) => ({
          chave: g.chave,
          rotulo: rotuloExec(g.chave),
          valor: g.itens.length,
          texto: String(g.itens.length),
          cor:
            g.chave === "interna"
              ? 1
              : g.chave === "terceirizada"
                ? 2
                : "neutro",
          origem: listas.lista(
            `OS ${rotuloExec(g.chave).toLowerCase()}`,
            g.itens,
          ),
        })),
      },
      {
        tipo: "barras",
        rotuloLargo: true,
        itens: locais.map((g) => ({
          chave: g.chave,
          rotulo: g.chave,
          valor: g.itens.length,
          texto: String(g.itens.length),
          origem: listas.lista(`OS em ${g.chave}`, g.itens),
        })),
      },
    ],
    exportar: listas.lista(`OS abertas em ${f.rotulo}`, criadas),
  };
}

function blocoTerceirizados(ctx: Ctx, os: ChamadoDoPainel[]): Bloco {
  const { listas } = ctx;
  const abertas = os.filter(
    (c) =>
      c.execucao === "terceirizada" && emAbertoEm(c, ctx.momento, ctx.agora),
  );
  const vencido = (c: ChamadoDoPainel) =>
    c.prazo_terceirizado !== null &&
    instante(c.prazo_terceirizado).getTime() < ctx.momento.getTime();
  const atrasadas = abertas.filter(vencido);
  const noPrazo = abertas.filter((c) => c.prazo_terceirizado && !vencido(c));
  const semPrazo = abertas.filter((c) => !c.prazo_terceirizado);
  const retorno: ColunaExtra = {
    titulo: "Retorno até",
    valores: Object.fromEntries(
      abertas.map((c) => [
        c.id,
        c.prazo_terceirizado
          ? new Intl.DateTimeFormat("pt-BR", {
              timeZone: "America/Sao_Paulo",
            }).format(instante(c.prazo_terceirizado))
          : "Sem prazo",
      ]),
    ),
  };
  return {
    id: "terceirizados",
    titulo: "OS de terceirizados",
    descricao: `Em aberto ${ctx.quando}, pelo status e pelo prazo de retorno da empresa`,
    largura: 7,
    partes: [
      {
        tipo: "numeros",
        numeros: [
          {
            rotulo: "Retorno atrasado",
            valor: String(atrasadas.length),
            alerta: atrasadas.length > 0,
            origem: listas.lista(
              "Terceirizados com retorno atrasado",
              atrasadas,
              {
                extra: retorno,
              },
            ),
          },
          {
            rotulo: "No prazo de retorno",
            valor: String(noPrazo.length),
            origem: listas.lista("Terceirizados no prazo", noPrazo, {
              extra: retorno,
            }),
          },
          {
            rotulo: "Sem prazo de retorno",
            valor: String(semPrazo.length),
            origem: listas.lista(
              "Terceirizados sem prazo de retorno",
              semPrazo,
            ),
          },
        ],
      },
      {
        tipo: "barras",
        vazio: "Nenhuma OS terceirizada em aberto.",
        itens: agrupar(abertas, (c) => c.status).map((g) => ({
          chave: g.chave,
          rotulo: STATUS[g.chave as StatusChamado],
          valor: g.itens.length,
          texto: String(g.itens.length),
          origem: listas.lista(
            `Terceirizados: ${STATUS[g.chave as StatusChamado]}`,
            g.itens,
            { extra: retorno },
          ),
        })),
      },
    ],
    exportar: listas.lista("OS terceirizadas em aberto", abertas, {
      extra: retorno,
    }),
  };
}

function blocoPreventivas(ctx: Ctx, os: ChamadoDoPainel[]): Bloco {
  const { listas, f } = ctx;
  const catPreventiva = new Set(
    ctx.categorias.filter((c) => c.preventiva).map((c) => c.id),
  );
  const preventivas = os.filter(
    (c) =>
      c.plano_id !== null ||
      (c.categoria_id !== null && catPreventiva.has(c.categoria_id)),
  );
  const feitas = concluidosNa(preventivas, ctx.janela);
  const prazo = separarNoPrazo(feitas);
  const abertas = preventivas.filter((c) =>
    emAbertoEm(c, ctx.momento, ctx.agora),
  );
  const atrasadas = abertas.filter((c) =>
    atrasadoEm(c, ctx.momento, ctx.agora),
  );
  const [primeira] = [...catPreventiva];
  const meta = metaPara(
    ctx.metas,
    "pct_no_prazo",
    f.setor?.id ?? null,
    catPreventiva.size === 1 ? (primeira ?? null) : null,
  );
  return {
    id: "preventivas",
    titulo: "Preventivas",
    descricao: `Dos planos preventivos e das categorias de preventiva · feitas em ${f.rotulo}`,
    largura: 5,
    partes: [
      {
        tipo: "numeros",
        numeros: [
          {
            rotulo: "Feitas no prazo",
            valor: formatarPct(prazo.pct),
            status: status(prazo.pct, meta),
            direcao: "maior_melhor",
            detalhe: `${prazo.noPrazo.length} de ${prazo.noPrazo.length + prazo.fora.length} · ${textoDaMeta(meta, "%")}`,
            origem: listas.partes("Preventivas feitas", [
              { titulo: "Fora do prazo", itens: prazo.fora },
              { titulo: "No prazo", itens: prazo.noPrazo },
              { titulo: "Sem prazo", itens: prazo.semPrazo },
            ]),
          },
          {
            rotulo: "Em aberto",
            valor: String(abertas.length),
            origem: listas.lista("Preventivas em aberto", abertas),
          },
          {
            rotulo: "Atrasadas",
            valor: String(atrasadas.length),
            alerta: atrasadas.length > 0,
            origem: listas.lista("Preventivas atrasadas", atrasadas),
          },
        ],
      },
    ],
  };
}

function blocoCustos(
  ctx: Ctx,
  concluidas: ChamadoDoPainel[],
  doMes: { mes: string; os: ChamadoDoPainel[] }[],
  custos: Map<string, CustoDoPainel>,
): Bloco {
  const { listas, f } = ctx;
  const ids = concluidas.map((c) => c.id);
  const soma = somarCustos(ids, custos);
  const valor =
    (campo: keyof Omit<CustoDoPainel, "chamado_id" | "completo">) =>
    (id: string) => {
      const c = custos.get(id);
      return c && c.custo_total !== null ? Number(c[campo] ?? 0) : null;
    };
  const coluna = (titulo: string, campo: Parameters<typeof valor>[0]) =>
    colunaDeReais(titulo, ids, valor(campo));
  const comRateio = concluidas.filter((c) => c.rateio);
  const semRateio = concluidas.filter((c) => !c.rateio);
  const total = coluna("Custo total", "custo_total");
  const lista = (titulo: string, campo: Parameters<typeof valor>[0]) =>
    listas.lista(titulo, concluidas, {
      subtitulo: `OS finalizadas em ${f.rotulo}`,
      extra: coluna(titulo, campo),
    });
  const avisos = [
    soma.semCalculo.length
      ? `${plural(soma.semCalculo.length, "OS ainda sem custo calculado", "OS ainda sem custo calculado")}`
      : "",
    soma.incompletas.length
      ? `${plural(soma.incompletas.length, "OS com valor faltando", "OS com valor faltando")} (valor por minuto ou material sem preço)`
      : "",
  ].filter(Boolean);
  return {
    id: "custos",
    titulo: "Custos das OS",
    descricao: `OS finalizadas em ${f.rotulo}: mão de obra pelo valor por minuto vigente em cada sessão`,
    largura: 12,
    partes: [
      {
        tipo: "numeros",
        numeros: [
          {
            rotulo: "Custo total",
            valor: formatarMoeda(soma.total),
            detalhe: plural(
              concluidas.length,
              "OS finalizada",
              "OS finalizadas",
            ),
            origem: lista("Custo total", "custo_total"),
          },
          {
            rotulo: "Mão de obra",
            valor: formatarMoeda(soma.maoDeObra),
            origem: lista("Mão de obra", "custo_mao_obra"),
          },
          {
            rotulo: "Materiais",
            valor: formatarMoeda(soma.materiais),
            origem: lista("Materiais", "custo_materiais"),
          },
          {
            rotulo: "Terceiros",
            valor: formatarMoeda(soma.terceiros),
            origem: lista("Terceiros", "valor_terceirizado"),
          },
          {
            rotulo: "Valor com rateio",
            valor: formatarMoeda(soma.rateio),
            detalhe: `${comRateio.length} com rateio · ${semRateio.length} sem`,
            origem: listas.partes(
              "Rateio",
              [
                {
                  titulo: "Com rateio",
                  itens: comRateio,
                  extra: coluna("Valor do rateio", "valor_rateio"),
                },
                { titulo: "Sem rateio", itens: semRateio, extra: total },
              ],
              { subtitulo: `OS finalizadas em ${f.rotulo}` },
            ),
          },
        ],
      },
      {
        tipo: "colunas",
        rotularTodas: true,
        itens: doMes.map(({ mes, os }) => {
          const s = somarCustos(
            os.map((c) => c.id),
            custos,
          );
          return {
            chave: mes,
            rotulo: formatarMes(mes).slice(0, 3),
            titulo: formatarMes(mes),
            valor: s.total,
            texto: formatarMoeda(s.total, 0),
            detalhe: `${plural(os.length, "OS finalizada", "OS finalizadas")}${s.semCalculo.length ? ` · ${s.semCalculo.length} sem cálculo` : ""}`,
            destaque: mes >= `${f.periodo.de.slice(0, 7)}-01`,
            origem: listas.lista(`Custo das OS de ${formatarMes(mes)}`, os, {
              extra: colunaDeReais(
                "Custo total",
                os.map((c) => c.id),
                valor("custo_total"),
              ),
            }),
          };
        }),
      },
    ],
    nota: [
      `Custo total por mês: últimos ${MESES_DE_TENDENCIA} meses até o fim do período (os meses do período em destaque).`,
      avisos.length
        ? `Atenção: ${avisos.join(" e ")} — o total está por baixo até o cálculo ser feito.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    exportar: listas.lista(`Custos das OS de ${f.rotulo}`, concluidas, {
      extra: total,
    }),
  };
}

async function blocosDeAtivos(
  ctx: Ctx,
  concluidas: ChamadoDoPainel[],
  /** Os custos ainda chegando (lidos junto); null sem os.custos. */
  lendoCustos: Promise<Map<string, CustoDoPainel>> | null,
): Promise<Bloco[]> {
  const { listas, f } = ctx;
  const veAtivos = ctx.pode("os.ativos") || ctx.pode("os.ativos_gerenciar");
  if (!lendoCustos && !veAtivos) return [];
  const doze = somarDias(hojeEmBrasilia(ctx.agora), -365);
  const [nomes, fichas, resumo, custos] = await Promise.all([
    nomesDosAtivos(),
    veAtivos ? ativosParaSinal() : Promise.resolve([]),
    veAtivos ? resumoDosAtivos(doze) : Promise.resolve([]),
    lendoCustos,
  ]);
  const nomeDo = (id: string) => {
    const ficha = fichas.find((a) => a.id === id);
    return (
      nomes.get(id) ??
      (ficha ? `${ficha.codigo} · ${ficha.nome}` : "Ativo baixado")
    );
  };
  const partes: Bloco["partes"] = [];

  if (custos) {
    const comAtivo = concluidas.filter((c) => c.ativo_id);
    const grupos = agrupar(comAtivo, (c) => c.ativo_id as string)
      .map((g) => ({
        ...g,
        custo: somarCustos(
          g.itens.map((c) => c.id),
          custos,
        ),
      }))
      .sort((a, b) => b.custo.total - a.custo.total)
      .slice(0, 10);
    partes.push({
      tipo: "barras",
      rotuloLargo: true,
      vazio: "Nenhuma OS com ativo finalizada no período.",
      itens: grupos.map((g) => ({
        chave: g.chave,
        rotulo: nomeDo(g.chave),
        valor: g.custo.total,
        texto: formatarMoeda(g.custo.total, 0),
        detalhe: `${plural(g.itens.length, "OS", "OS")}${g.custo.semCalculo.length ? ` · ${g.custo.semCalculo.length} sem cálculo` : ""}`,
        origem: listas.lista(`Custo: ${nomeDo(g.chave)}`, g.itens, {
          extra: colunaDeReais(
            "Custo total",
            g.itens.map((c) => c.id),
            (id) => {
              const c = custos.get(id);
              return c && c.custo_total !== null ? Number(c.custo_total) : null;
            },
          ),
        }),
      })),
    });
  }

  if (veAtivos) {
    const p = ctx.parametros;
    const faixas = {
      pesoAvaliar: Number(p.sinal_peso_avaliar),
      pesoTrocar: Number(p.sinal_peso_trocar),
      corretivasAvaliar: p.sinal_corretivas_avaliar,
      corretivasTrocar: p.sinal_corretivas_trocar,
      idadeAvaliarPct: Number(p.sinal_idade_avaliar_pct),
      idadeTrocarPct: Number(p.sinal_idade_trocar_pct),
    };
    const hoje = hojeEmBrasilia(ctx.agora);
    const porAtivo = new Map(resumo.map((r) => [r.ativo_id, r]));
    const trocar = fichas
      .filter((a) => !a.baixado)
      .map((a) => {
        const r = porAtivo.get(a.id);
        return {
          a,
          r,
          s: sinalDoAtivo(
            {
              custo12m: Number(r?.custo_periodo ?? 0),
              valorReposicao: a.valorReposicao,
              corretivas12m: Number(r?.corretivas_periodo ?? 0),
              compraData: a.compraData,
              vidaUtilAnos: a.vidaUtilAnos,
            },
            faixas,
            hoje,
          ),
        };
      })
      .filter((x) => x.s.sinal === "trocar");
    const detalhe: Detalhe = {
      secao: "Ativos",
      titulo: `Sinal ${SINAIS.trocar}`,
      subtitulo:
        "Pelo pior de três critérios nos últimos 12 meses: custo ÷ reposição, corretivas e idade",
      tabelas: [
        {
          colunas: [
            { titulo: "Ativo" },
            { titulo: "Custo ÷ reposição", numero: true },
            { titulo: "Corretivas (12 meses)", numero: true },
            { titulo: "Idade (% da vida útil)", numero: true },
          ],
          linhas: trocar.map(({ a, r, s }) => ({
            chave: a.id,
            celulas: [
              `${a.codigo} · ${a.nome}`,
              formatarPct(s.pesoPct),
              String(r?.corretivas_periodo ?? 0),
              formatarPct(s.idadePct, 0),
            ],
            ordem: [
              a.codigo,
              s.pesoPct,
              Number(r?.corretivas_periodo ?? 0),
              s.idadePct,
            ],
          })),
          vazio: "Nenhum ativo com sinal Trocar.",
        },
      ],
      link: { href: ROTAS_OS.ativos, rotulo: "Abrir Ativos" },
    };
    partes.push({
      tipo: "numeros",
      numeros: [
        {
          rotulo: `Ativos com sinal ${SINAIS.trocar}`,
          valor: String(trocar.length),
          alerta: trocar.length > 0,
          detalhe: "faixas em Parâmetros",
          origem: detalhe,
        },
      ],
    });
  }

  return [
    {
      id: "ativos",
      titulo: custos ? "Ativos: top 10 por custo" : "Ativos",
      descricao: custos
        ? `Custo das OS finalizadas em ${f.rotulo}, por ativo`
        : "Sinal de troca de cada ativo",
      largura: custos ? 12 : 5,
      partes,
      links: [{ href: ROTAS_OS.ativos, rotulo: "Abrir Ativos" }],
    },
  ];
}

async function blocoFornecedores(ctx: Ctx): Promise<Bloco | null> {
  const { listas, f } = ctx;
  const [links, nomes] = await Promise.all([
    linksDoPeriodo(f.periodo.de, f.periodo.ate),
    empresas(),
  ]);
  if (links.length === 0) return null;
  const conhecidos = new Map(ctx.todos.map((c) => [c.id, c]));
  const faltam = links
    .map((l) => l.chamado_id)
    .filter((id) => !conhecidos.has(id));
  for (const c of await chamadosPorId(faltam)) conhecidos.set(c.id, c);
  const doRecorte = new Set(ctx.base.map((c) => c.id));
  const doSetor = links.filter((l) => {
    const c = conhecidos.get(l.chamado_id);
    return c && (doRecorte.has(c.id) || c.setor_id === f.setor?.id);
  });
  if (doSetor.length === 0) return null;
  const os = new Map<string, OSDoFornecedor>(
    [...conhecidos.values()].map((c) => [
      c.id,
      {
        id: c.id,
        prazo_terceirizado: c.prazo_terceirizado,
        reaberto_vezes: c.reaberto_vezes,
      },
    ]),
  );
  const notas = notasDosFornecedores(doSetor, os);
  // Chamados citados que não vieram na consulta do painel entram nas linhas.
  ctx.extras.push(...faltam.flatMap((id) => conhecidos.get(id) ?? []));
  return {
    id: "fornecedores",
    titulo: "Nota dos fornecedores",
    descricao: `Links da OS enviados em ${f.rotulo}`,
    largura: 12,
    partes: [
      {
        tipo: "tabela",
        colunas: [
          { titulo: "Empresa" },
          { titulo: "OS enviadas", numero: true },
          { titulo: "Aceite", numero: true },
          { titulo: "Retorno no prazo", numero: true },
          { titulo: "Retrabalho", numero: true },
          { titulo: "Nota (0 a 10)", numero: true },
        ],
        linhas: notas.map((n) => {
          const nome = nomes.get(n.empresaId) ?? "Empresa";
          return {
            chave: n.empresaId,
            celulas: [
              { texto: nome },
              {
                texto: String(n.enviadas.length),
                origem: listas.lista(`${nome}: OS enviadas`, n.enviadas),
              },
              {
                texto: formatarPct(n.pctAceite, 0),
                origem: listas.partes(`${nome}: aceite`, [
                  { titulo: "Aceitas", ids: n.aceitas },
                  { titulo: "Recusadas", ids: n.recusadas },
                ]),
              },
              {
                texto: formatarPct(n.pctNoPrazo, 0),
                origem: listas.partes(`${nome}: retorno`, [
                  { titulo: "Fora do prazo", ids: n.foraDoPrazo },
                  { titulo: "No prazo", ids: n.noPrazo },
                ]),
              },
              {
                texto: formatarPct(n.pctRetrabalho, 0),
                origem: listas.lista(`${nome}: OS reabertas`, n.retrabalho),
              },
              {
                texto: n.nota === null ? "—" : formatarNumero(n.nota, 1),
              },
            ],
          };
        }),
      },
    ],
    nota: "Nota de 0 a 10: média do % de aceite (entre os que responderam), do % de retorno até o prazo do terceirizado e do % sem retrabalho (OS reaberta depois de concluída).",
  };
}
