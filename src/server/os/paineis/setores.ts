import "server-only";
import type { Bloco } from "@/components/os/paineis/tipos";
import { formatarPct } from "@/lib/formato";
import { status } from "@/lib/indicadores";
import {
  agrupar,
  atrasadoEm,
  concluidosNa,
  emAbertoEm,
  media,
  metaPara,
  naJanela,
} from "@/lib/os/indicadores";
import {
  andamentoDosAvisos,
  type DestinoDoPainel,
  normalizar,
} from "@/lib/os/indicadores-setor";
import { tempoDeResolucaoMin } from "@/lib/os/prazo";
import { STATUS, type StatusChamado } from "@/lib/os/rotulos";
import { instante } from "@/lib/os/tempo";
import { numerosDaBase } from "./base";
import { type ChamadoDoPainel, destinosDe, destinosDoSetor } from "./consultas";
import { type Ctx, colunaDeTempo, plural, tempoLegivel } from "./contexto";
import { blocosDeOS } from "./operacoes";

// Indicadores próprios de cada setor (spec 4.13). Os blocos aparecem pelo
// catálogo (categoria de OS, de aviso…) ou pelo nome do setor e das
// categorias: um setor novo já tem o painel base, e um setor que não existe
// simplesmente não mostra o bloco.

const tem = (texto: string | null | undefined, trecho: string) =>
  normalizar(texto ?? "").includes(trecho);

export async function blocosDoSetor(ctx: Ctx): Promise<Bloco[]> {
  const setor = ctx.f.setor;
  if (!setor) return [];
  const nome = normalizar(setor.nome);
  const cats = ctx.categorias.filter((c) => c.setor_id === setor.id);
  // Os itens recebidos saem junto com as leituras dos blocos (OS, avisos).
  const lendo = destinosDoSetor(setor.id, ctx.f.periodo.de);

  const tarefas: Promise<Bloco[]>[] = [];
  if (cats.some((c) => c.tipo_padrao === "os" || c.registrar_tempo))
    tarefas.push(blocosDeOS(ctx));
  if (cats.some((c) => c.tipo_padrao === "aviso") || nome.includes("comercial"))
    tarefas.push(blocosDeAvisos(ctx));
  if (nome.includes("marketing"))
    tarefas.push(Promise.resolve(blocosDoMarketing(ctx)));
  if (nome.includes("sustentab"))
    tarefas.push(
      lendo.then((destinos) =>
        blocosDePendencias(ctx, destinos, {
          id: "entrevistas",
          titulo: "Entrevistas com clientes",
          trechos: ["entrevista"],
          vencendo: true,
        }),
      ),
    );
  if (nome.includes("estacionamento"))
    tarefas.push(
      lendo.then((destinos) => [
        ...blocosDePendencias(ctx, destinos, {
          id: "credenciamentos",
          titulo: "Credenciamentos",
          trechos: ["credenciamento"],
          exceto: "descredenciamento",
          tempoMedio: true,
        }),
        ...blocosDePendencias(ctx, destinos, {
          id: "descredenciamentos",
          titulo: "Descredenciamentos",
          trechos: ["descredenciamento"],
          tempoMedio: true,
        }),
      ]),
    );
  if (nome.startsWith("gest"))
    tarefas.push(Promise.resolve(blocosDaGestao(ctx)));

  const [destinos, especificos] = await Promise.all([
    lendo,
    Promise.all(tarefas),
  ]);
  const itens = blocoItensDeAvisos(ctx, destinos);
  return itens ? [...especificos.flat(), itens] : especificos.flat();
}

// ---------------------------------------------------------------------------
// Comercial: avisos de entrada e saída de cliente
// ---------------------------------------------------------------------------

async function blocosDeAvisos(ctx: Ctx): Promise<Bloco[]> {
  const { listas, f } = ctx;
  const avisos = ctx.base.filter(
    (c) => c.tipo === "aviso" && naJanela(c.criado_em, ctx.janela),
  );
  const destinos = await destinosDe(avisos.map((a) => a.id));
  const r = andamentoDosAvisos(avisos, destinos, ctx.agora);
  const nomeCat = (c: ChamadoDoPainel) =>
    normalizar(ctx.categoriaNome(c.categoria_id));
  const entradas = avisos.filter((c) => nomeCat(c).includes("entrada"));
  const saidas = avisos.filter((c) => nomeCat(c).includes("saida"));
  const tempo = colunaDeTempo("Até o último setor", r.tempoPorAviso);
  const atrasos = [...r.atrasosPorSetor].sort(
    (a, b) => b[1].length - a[1].length,
  );
  return [
    {
      id: "avisos",
      titulo: "Entradas e saídas de cliente",
      descricao: `Avisos abertos em ${f.rotulo} e o andamento de cada setor`,
      largura: 12,
      partes: [
        {
          tipo: "numeros",
          numeros: [
            {
              rotulo: "Entradas",
              valor: String(entradas.length),
              origem: listas.lista("Entradas de cliente", entradas),
            },
            {
              rotulo: "Saídas",
              valor: String(saidas.length),
              origem: listas.lista("Saídas de cliente", saidas),
            },
            {
              rotulo: "Com todos os setores concluídos",
              valor: formatarPct(r.pct, 0),
              detalhe: `${r.completos.length} de ${r.completos.length + r.pendentes.length} avisos`,
              origem: listas.partes("Avisos", [
                { titulo: "Faltam setores", ids: r.pendentes },
                { titulo: "Todos concluídos", ids: r.completos, extra: tempo },
              ]),
            },
            {
              rotulo: "Tempo até o último setor",
              valor: tempoLegivel(r.tempoAteUltimoMin),
              detalhe: "média dos avisos completos",
              origem: listas.lista("Avisos completos", r.completos, {
                extra: tempo,
              }),
            },
          ],
        },
        {
          tipo: "barras",
          rotuloLargo: true,
          vazio: "Nenhum setor atrasou um item de aviso.",
          itens: atrasos.map(([setor, ids]) => ({
            chave: setor,
            rotulo: ctx.setorNome(setor),
            valor: ids.length,
            texto: String(ids.length),
            titulo: `${ctx.setorNome(setor)} atrasou`,
            detalhe: "avisos com o item do setor fora do prazo",
            origem: listas.lista(
              `Avisos atrasados por ${ctx.setorNome(setor)}`,
              ids,
            ),
          })),
        },
      ],
      nota: "Setores que mais atrasam: avisos em que o item do setor foi concluído depois do prazo ou ainda está vencido.",
      exportar: listas.lista(`Avisos de ${f.rotulo}`, avisos),
    },
  ];
}

// ---------------------------------------------------------------------------
// Marketing
// ---------------------------------------------------------------------------

function blocosDoMarketing(ctx: Ctx): Bloco[] {
  const { listas, f } = ctx;
  const setor = f.setor;
  if (!setor) return [];
  const aberto = (c: ChamadoDoPainel) => emAbertoEm(c, ctx.momento, ctx.agora);
  const atrasado = (c: ChamadoDoPainel) =>
    atrasadoEm(c, ctx.momento, ctx.agora);

  const tarefas = ctx.base.filter((c) => c.tipo === "tarefa" && aberto(c));
  const porPessoa = agrupar(tarefas, (c) => c.responsavel_id ?? "sem");

  const membros = new Set(
    [...ctx.setoresDasPessoas]
      .filter(([, s]) => s.includes(setor.id))
      .map(([u]) => u),
  );
  const pedidos = ctx.todos.filter(
    (c) =>
      c.aberto_por !== null &&
      membros.has(c.aberto_por) &&
      c.setor_id !== setor.id &&
      aberto(c),
  );
  const ronda = ctx.todos.filter(
    (c) =>
      c.etiquetas.some((e) => tem(e, "ronda de ambiencia")) &&
      (aberto(c) || naJanela(c.criado_em, ctx.janela)),
  );
  const veTudo = ctx.pode("os.todos_setores") || ctx.pode("os.painel_geral");

  return [
    {
      id: "tarefas-por-pessoa",
      titulo: "Tarefas por pessoa",
      descricao: `Tarefas em aberto ${ctx.quando}, com as atrasadas de cada um`,
      largura: 6,
      partes: [
        {
          tipo: "barras",
          rotuloLargo: true,
          vazio: "Nenhuma tarefa em aberto.",
          itens: porPessoa.map((g) => {
            const nome = ctx.pessoaNome(
              g.chave === "sem" ? null : g.chave,
              "Sem responsável",
            );
            const atrasadas = g.itens.filter(atrasado);
            return {
              chave: g.chave,
              rotulo: nome,
              valor: g.itens.length,
              texto: String(g.itens.length),
              detalhe: `${plural(atrasadas.length, "atrasada", "atrasadas")}`,
              origem: listas.partes(`Tarefas de ${nome}`, [
                { titulo: "Atrasadas", itens: atrasadas },
                {
                  titulo: "No prazo ou sem prazo",
                  itens: g.itens.filter((c) => !atrasado(c)),
                },
              ]),
            };
          }),
        },
      ],
      exportar: listas.lista("Tarefas em aberto", tarefas),
    },
    {
      id: "pedidos-a-outros-setores",
      titulo: "Pedidos do setor a outros setores",
      descricao: `Abertos por quem é de ${setor.nome} e ainda em aberto ${ctx.quando}`,
      largura: 6,
      partes: [
        {
          tipo: "barras",
          rotuloLargo: true,
          vazio: "Nenhum pedido aguardando outro setor.",
          itens: agrupar(pedidos, (c) => c.setor_id).map((g) => ({
            chave: g.chave,
            rotulo: ctx.setorNome(g.chave),
            valor: g.itens.length,
            texto: String(g.itens.length),
            detalhe: `${g.itens.filter(atrasado).length} atrasados`,
            origem: listas.lista(
              `Pedidos a ${ctx.setorNome(g.chave)}`,
              g.itens,
            ),
          })),
        },
      ],
      nota: veTudo
        ? undefined
        : "Só os pedidos que você vê (os seus e aqueles em que você está envolvido).",
      exportar: listas.lista("Pedidos a outros setores", pedidos),
    },
    {
      id: "ronda-de-ambiencia",
      titulo: "Ronda de ambiência",
      descricao: `Sinalizações com a etiqueta "Ronda de ambiência" abertas em ${f.rotulo} ou ainda em aberto, pelo status`,
      largura: 12,
      partes: [
        {
          tipo: "barras",
          vazio: "Nenhuma sinalização da ronda.",
          itens: agrupar(ronda, (c) => c.status).map((g) => ({
            chave: g.chave,
            rotulo: STATUS[g.chave as StatusChamado],
            valor: g.itens.length,
            texto: String(g.itens.length),
            origem: listas.lista(
              `Ronda de ambiência: ${STATUS[g.chave as StatusChamado]}`,
              g.itens,
            ),
          })),
        },
      ],
      exportar: listas.lista("Ronda de ambiência", ronda),
    },
  ];
}

// ---------------------------------------------------------------------------
// Pendências por categoria e itens de aviso (Sustentabilidade, Estacionamento)
// ---------------------------------------------------------------------------

/** Janela de "vencendo" das entrevistas a refazer (pedido da especificação). */
const DIAS_VENCENDO = 30;

function blocosDePendencias(
  ctx: Ctx,
  destinos: DestinoDoPainel[],
  o: {
    id: string;
    titulo: string;
    trechos: string[];
    exceto?: string;
    vencendo?: boolean;
    tempoMedio?: boolean;
  },
): Bloco[] {
  const { listas, f } = ctx;
  const casa = (texto: string | null | undefined) =>
    o.trechos.some((t) => tem(texto, t)) && !(o.exceto && tem(texto, o.exceto));
  const cats = new Set(
    ctx.categorias
      .filter((c) => c.setor_id === f.setor?.id && casa(c.nome))
      .map((c) => c.id),
  );
  const chs = ctx.base.filter(
    (c) => c.categoria_id !== null && cats.has(c.categoria_id),
  );
  const linhas = destinos.filter((d) => casa(d.titulo));
  if (cats.size === 0 && linhas.length === 0) return [];

  const pendentes = [
    ...chs
      .filter((c) => emAbertoEm(c, ctx.momento, ctx.agora))
      .map((c) => c.id),
    ...linhas.filter((d) => d.status !== "concluido").map((d) => d.chamado_id),
  ];
  const feitosCh = concluidosNa(chs, ctx.janela);
  const feitasLinhas = linhas.filter(
    (d) => d.status === "concluido" && naJanela(d.concluido_em, ctx.janela),
  );
  const feitos = [
    ...feitosCh.map((c) => c.id),
    ...feitasLinhas.map((d) => d.chamado_id),
  ];

  const tempos = new Map<string, number>();
  for (const c of feitosCh) {
    const t = tempoDeResolucaoMin(c);
    if (t !== null) tempos.set(c.id, t);
  }
  for (const d of feitasLinhas)
    tempos.set(
      d.chamado_id,
      (instante(d.concluido_em as string).getTime() -
        instante(d.criado_em).getTime()) /
        60_000,
    );

  const limite = ctx.momento.getTime() + DIAS_VENCENDO * 86_400_000;
  const vence = (prazo: string | null) =>
    prazo !== null &&
    instante(prazo).getTime() >= ctx.momento.getTime() &&
    instante(prazo).getTime() <= limite;
  const vencendo = [
    ...chs
      .filter((c) => emAbertoEm(c, ctx.momento, ctx.agora) && vence(c.prazo))
      .map((c) => c.id),
    ...linhas
      .filter((d) => d.status !== "concluido" && vence(d.prazo))
      .map((d) => d.chamado_id),
  ];

  const numeros: Extract<
    Bloco["partes"][number],
    { tipo: "numeros" }
  >["numeros"] = [
    {
      rotulo: "Pendentes",
      valor: String(new Set(pendentes).size),
      detalhe: ctx.quando,
      origem: listas.lista(`${o.titulo} pendentes`, pendentes),
    },
    {
      rotulo: "Feitos no período",
      valor: String(new Set(feitos).size),
      detalhe: f.rotulo,
      origem: listas.lista(`${o.titulo} feitos em ${f.rotulo}`, feitos, {
        extra: colunaDeTempo("Tempo até concluir", tempos),
      }),
    },
  ];
  if (o.vencendo)
    numeros.push({
      rotulo: `Vencendo em ${DIAS_VENCENDO} dias`,
      valor: String(new Set(vencendo).size),
      detalhe: "para fazer ou refazer",
      origem: listas.lista(
        `${o.titulo} vencendo em ${DIAS_VENCENDO} dias`,
        vencendo,
      ),
    });
  if (o.tempoMedio)
    numeros.push({
      rotulo: "Tempo médio até concluir",
      valor: tempoLegivel(media([...tempos.values()])),
      detalhe: "dos feitos no período",
      origem: listas.lista(`${o.titulo}: tempo até concluir`, feitos, {
        extra: colunaDeTempo("Tempo até concluir", tempos),
      }),
    });

  return [
    {
      id: o.id,
      titulo: o.titulo,
      descricao:
        "Chamados da categoria e itens dos avisos de entrada e saída de cliente",
      largura: 6,
      partes: [{ tipo: "numeros", numeros }],
      exportar: listas.lista(`${o.titulo} pendentes`, pendentes),
    },
  ];
}

/** Itens de avisos de outros setores que este setor recebeu. */
function blocoItensDeAvisos(
  ctx: Ctx,
  destinos: DestinoDoPainel[],
): Bloco | null {
  const { listas, f } = ctx;
  const doSetor = new Map(ctx.todos.map((c) => [c.id, c.setor_id]));
  const linhas = destinos.filter(
    (d) => doSetor.get(d.chamado_id) !== f.setor?.id,
  );
  if (linhas.length === 0) return null;
  const pendentes = linhas.filter((d) => d.status !== "concluido");
  const atrasados = pendentes.filter(
    (d) =>
      d.prazo !== null && instante(d.prazo).getTime() < ctx.momento.getTime(),
  );
  const feitos = linhas.filter(
    (d) => d.status === "concluido" && naJanela(d.concluido_em, ctx.janela),
  );
  const ids = (ds: DestinoDoPainel[]) => ds.map((d) => d.chamado_id);
  return {
    id: "itens-de-avisos",
    titulo: "Itens de avisos para o setor",
    descricao:
      "Avisos de outros setores (entrada e saída de cliente e outros) com um item para este setor",
    largura: 6,
    partes: [
      {
        tipo: "numeros",
        numeros: [
          {
            rotulo: "Pendentes",
            valor: String(new Set(ids(pendentes)).size),
            origem: listas.lista("Avisos com item pendente", ids(pendentes)),
          },
          {
            rotulo: "Atrasados",
            valor: String(new Set(ids(atrasados)).size),
            alerta: atrasados.length > 0,
            origem: listas.lista("Avisos com item atrasado", ids(atrasados)),
          },
          {
            rotulo: "Concluídos no período",
            valor: String(new Set(ids(feitos)).size),
            origem: listas.lista(
              `Itens concluídos em ${f.rotulo}`,
              ids(feitos),
            ),
          },
        ],
      },
    ],
    exportar: listas.lista("Avisos com item pendente", ids(pendentes)),
  };
}

// ---------------------------------------------------------------------------
// Gestão
// ---------------------------------------------------------------------------

function blocosDaGestao(ctx: Ctx): Bloco[] {
  const { listas, f } = ctx;
  const cats = new Set(
    ctx.categorias.filter((c) => tem(c.nome, "protocolo")).map((c) => c.id),
  );
  const protocolos = ctx.todos.filter(
    (c) =>
      c.categoria_id !== null &&
      cats.has(c.categoria_id) &&
      (emAbertoEm(c, ctx.momento, ctx.agora) ||
        naJanela(c.criado_em, ctx.janela)),
  );
  const metaGeral = metaPara(ctx.metas, "pct_no_prazo", null);
  const porSetor = ctx.setores.flatMap((s) => {
    const n = numerosDaBase(
      ctx.todos.filter((c) => c.setor_id === s.id),
      ctx,
    );
    if (n.prazo.pct === null) return [];
    const meta = metaPara(ctx.metas, "pct_no_prazo", s.id);
    return [{ s, n, meta }];
  });
  const veTudo = ctx.pode("os.todos_setores") || ctx.pode("os.painel_geral");
  const blocos: Bloco[] = [];
  if (cats.size)
    blocos.push({
      id: "protocolos",
      titulo: "Protocolos entre setores",
      descricao: `Abertos em ${f.rotulo} ou ainda em aberto, pelo status`,
      largura: 6,
      partes: [
        {
          tipo: "barras",
          vazio: "Nenhum protocolo no período.",
          itens: agrupar(protocolos, (c) => c.status).map((g) => ({
            chave: g.chave,
            rotulo: STATUS[g.chave as StatusChamado],
            valor: g.itens.length,
            texto: String(g.itens.length),
            origem: listas.lista(
              `Protocolos: ${STATUS[g.chave as StatusChamado]}`,
              g.itens,
            ),
          })),
        },
      ],
      exportar: listas.lista("Protocolos", protocolos),
    });
  blocos.push({
    id: "no-prazo-por-setor",
    titulo: "% no prazo por setor",
    descricao: `Fechados em ${f.rotulo} até o prazo, cada setor contra a própria meta`,
    largura: 6,
    partes: [
      {
        tipo: "barras",
        rotuloLargo: true,
        meta: metaGeral
          ? {
              valor: metaGeral.meta,
              texto: `Meta geral: ${formatarPct(metaGeral.meta, 0)}`,
            }
          : undefined,
        itens: porSetor.map(({ s, n, meta }) => ({
          chave: s.id,
          rotulo: s.nome,
          valor: n.prazo.pct ?? 0,
          texto: formatarPct(n.prazo.pct, 0),
          detalhe: `${n.prazo.noPrazo.length} de ${n.prazo.noPrazo.length + n.prazo.fora.length} · ${statusTexto(status(n.prazo.pct, meta))}`,
          origem: listas.partes(`${s.nome}: fechados no prazo`, [
            { titulo: "Fora do prazo", itens: n.prazo.fora },
            { titulo: "No prazo", itens: n.prazo.noPrazo },
          ]),
        })),
      },
    ],
    nota: veTudo ? undefined : "Só os chamados que você vê de cada setor.",
  });
  return blocos;
}

function statusTexto(s: ReturnType<typeof status>): string {
  return {
    ok: "na meta",
    atencao: "atenção",
    fora: "abaixo da meta",
    sem_meta: "sem meta",
    sem_dado: "sem dados",
  }[s];
}
