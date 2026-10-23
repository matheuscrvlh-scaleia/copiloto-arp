import "server-only";
import type { Bloco, CelulaTabela } from "@/components/os/paineis/tipos";
import { formatarNumero, formatarPct } from "@/lib/formato";
import { status } from "@/lib/indicadores";
import {
  matrizEntreSetores,
  metaPara,
  naJanela,
  ORIGEM_PORTAL,
  SEM_SETOR,
} from "@/lib/os/indicadores";
import { destinosDe } from "@/server/os/paineis";
import { numerosDaBase } from "./base";
import { type Ctx, colunaDeTempo, plural, tempoLegivel } from "./contexto";

// Painel geral do gestor: a mesma base, comparando os setores, e quem pede
// mais a quem.

export async function blocosDoGeral(ctx: Ctx): Promise<Bloco[]> {
  return [blocoSetores(ctx), await blocoEntreSetores(ctx)];
}

function blocoSetores(ctx: Ctx): Bloco {
  const { listas, f } = ctx;
  const linhas = ctx.setores.flatMap((s) => {
    const chs = ctx.base.filter((c) => c.setor_id === s.id);
    if (!s.ativo && chs.length === 0) return [];
    const n = numerosDaBase(chs, ctx);
    const metaPct = metaPara(ctx.metas, "pct_no_prazo", s.id);
    const metaTempo = metaPara(ctx.metas, "tempo_medio_horas", s.id);
    const tempo = colunaDeTempo("Tempo de resolução", n.resolucao.porChamado);
    const celulas: CelulaTabela[] = [
      { texto: s.nome },
      {
        texto: String(n.abertos.length),
        origem: listas.lista(`${s.nome}: em aberto ${ctx.quando}`, n.abertos),
      },
      {
        texto: String(n.atrasados.length),
        origem: listas.lista(`${s.nome}: atrasados ${ctx.quando}`, n.atrasados),
      },
      {
        texto: String(n.concluidos.length),
        origem: listas.lista(
          `${s.nome}: fechados em ${f.rotulo}`,
          n.concluidos,
          {
            extra: tempo,
          },
        ),
      },
      {
        texto: formatarPct(n.prazo.pct),
        status: status(n.prazo.pct, metaPct),
        direcao: "maior_melhor",
        origem: listas.partes(`${s.nome}: fechados no prazo`, [
          { titulo: "Fora do prazo", itens: n.prazo.fora, extra: tempo },
          { titulo: "No prazo", itens: n.prazo.noPrazo, extra: tempo },
          {
            titulo: "Sem prazo (fora da conta)",
            itens: n.prazo.semPrazo,
            extra: tempo,
          },
        ]),
      },
      {
        texto: tempoLegivel(n.resolucao.mediaMin),
        status: status(
          n.resolucao.mediaMin === null ? null : n.resolucao.mediaMin / 60,
          metaTempo,
        ),
        direcao: "menor_melhor",
        origem: listas.lista(`${s.nome}: tempo de resolução`, n.concluidos, {
          extra: tempo,
        }),
      },
    ];
    return [{ chave: s.id, celulas, atrasados: n.atrasados.length }];
  });
  const ordenadas = [...linhas].sort((a, b) => b.atrasados - a.atrasados);
  return {
    id: "setores",
    titulo: "Setores lado a lado",
    descricao: `Em aberto e atrasados ${ctx.quando}; fechados, % no prazo e tempo médio em ${f.rotulo}. Cada setor contra a própria meta.`,
    largura: 12,
    partes: [
      {
        tipo: "barras",
        rotuloLargo: true,
        vazio: "Nenhum chamado atrasado.",
        itens: ordenadas
          .filter((l) => l.atrasados > 0)
          .map((l) => ({
            chave: l.chave,
            rotulo: l.celulas[0]?.texto ?? "",
            valor: l.atrasados,
            texto: String(l.atrasados),
            titulo: `Atrasados: ${l.celulas[0]?.texto}`,
            origem: l.celulas[2]?.origem,
          })),
      },
      {
        tipo: "tabela",
        colunas: [
          { titulo: "Setor" },
          { titulo: "Em aberto", numero: true },
          { titulo: "Atrasados", numero: true },
          { titulo: "Fechados", numero: true },
          { titulo: "% no prazo", numero: true },
          { titulo: "Tempo médio", numero: true },
        ],
        linhas: ordenadas.map(({ chave, celulas }) => ({ chave, celulas })),
      },
    ],
  };
}

/** Quem pede mais a quem (setor de quem abriu → setor que recebeu). */
async function blocoEntreSetores(ctx: Ctx): Promise<Bloco> {
  const { listas, f } = ctx;
  const criados = ctx.base.filter((c) => naJanela(c.criado_em, ctx.janela));
  const avisos = criados.filter((c) => c.tipo === "aviso");
  const destinos = await destinosDe(avisos.map((a) => a.id));
  const extras = new Map<string, string[]>();
  for (const d of destinos)
    if (d.setor_id)
      extras.set(d.chamado_id, [
        ...(extras.get(d.chamado_id) ?? []),
        d.setor_id,
      ]);
  const celulas = matrizEntreSetores(criados, ctx.setoresDasPessoas, extras);

  const rotulo = (k: string) =>
    k === ORIGEM_PORTAL
      ? "Portal (lojistas)"
      : k === SEM_SETOR
        ? "Sem setor"
        : ctx.setorNome(k);
  const ordem = (k: string) =>
    k === ORIGEM_PORTAL
      ? 1000
      : k === SEM_SETOR
        ? 1001
        : ctx.setores.findIndex((s) => s.id === k);
  const chaves = (lado: "origem" | "destino") =>
    [...new Set(celulas.map((c) => c[lado]))]
      .sort((a, b) => ordem(a) - ordem(b))
      .map((k) => ({ chave: k, rotulo: rotulo(k) }));
  const unicos = [...new Set(celulas.flatMap((c) => c.itens))];
  const doPortal = celulas
    .filter((c) => c.origem === ORIGEM_PORTAL)
    .flatMap((c) => c.itens);

  return {
    id: "entre-setores",
    titulo: "Chamados entre setores",
    descricao: `Abertos em ${f.rotulo}: cada linha é quem pediu (o setor de quem abriu), cada coluna é quem recebeu. Um aviso para vários setores conta em cada um.`,
    largura: 12,
    partes: [
      {
        tipo: "numeros",
        numeros: [
          {
            rotulo: "Pedidos a outro setor",
            valor: formatarNumero(unicos.length),
            detalhe: `de ${plural(criados.length, "chamado aberto", "chamados abertos")}`,
            origem: listas.lista("Pedidos entre setores", unicos),
          },
          {
            rotulo: "Do portal",
            valor: formatarNumero(new Set(doPortal).size),
            detalhe: "pedidos dos lojistas",
            origem: listas.lista("Pedidos do portal", [...new Set(doPortal)]),
          },
        ],
      },
      {
        tipo: "matriz",
        origens: chaves("origem"),
        destinos: chaves("destino"),
        celulas: Object.fromEntries(
          celulas.map((c) => [
            `${c.origem}>${c.destino}`,
            {
              n: c.itens.length,
              origem: listas.lista(
                `${rotulo(c.origem)} → ${rotulo(c.destino)}`,
                c.itens,
                { subtitulo: `Abertos em ${f.rotulo}` },
              ),
            },
          ]),
        ),
      },
    ],
    nota: "Quem é de mais de um setor conta pelo primeiro na ordem dos setores. Pedidos dentro do próprio setor não entram.",
  };
}
