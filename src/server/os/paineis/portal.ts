import "server-only";
import type { Detalhe } from "@/components/modal-detalhe";
import type { Bloco } from "@/components/os/paineis/tipos";
import { formatarData, formatarNumero, formatarPct } from "@/lib/formato";
import { agrupar, media, naJanela } from "@/lib/os/indicadores";
import { ocupacaoDaAgenda } from "@/lib/os/indicadores-setor";
import { ROTAS_OS } from "@/lib/os/rotas";
import {
  STATUS_VISTORIA,
  type StatusVistoria,
  TIPOS_VISTORIA,
  type TipoVistoria,
} from "@/lib/os/rotulos";
import { instante, paraBrasilia } from "@/lib/os/tempo";
import {
  agendasDoPeriodo,
  lojas,
  type VistoriaDoPainel,
  vistoriasDoPeriodo,
} from "./consultas";
import { type Ctx, colunaDeTempo, plural, tempoLegivel } from "./contexto";

// Portal do lojista (pedidos, resposta, avaliação e agendas) e vistorias.
// Aparecem no painel geral e no do setor que atende o portal ou recebe as
// vistorias dos modelos.

const STATUS_AGENDAMENTO: Record<string, string> = {
  marcado: "Marcado",
  remarcar: "Remarcar",
  cancelado: "Cancelado",
  realizado: "Realizado",
};

export async function blocosDoPortal(ctx: Ctx): Promise<Bloco[]> {
  const { listas, f } = ctx;
  const setor = f.setor;
  const cats = setor
    ? ctx.categorias.filter((c) => c.setor_id === setor.id)
    : ctx.categorias;
  if (setor && !cats.some((c) => c.no_portal)) return [];

  const pedidos = ctx.base.filter(
    (c) => c.origem === "portal" && naJanela(c.criado_em, ctx.janela),
  );
  const avaliados = ctx.base.filter(
    (c) =>
      c.origem === "portal" &&
      c.avaliacao !== null &&
      naJanela(c.avaliado_em, ctx.janela),
  );
  const [nomesLojas, agenda] = await Promise.all([
    lojas(),
    agendasDoPeriodo(f.periodo.de, f.periodo.ate),
  ]);
  const resposta = new Map(
    pedidos
      .filter((c) => c.primeira_resposta_em)
      .map((c) => [
        c.id,
        (instante(c.primeira_resposta_em as string).getTime() -
          instante(c.criado_em).getTime()) /
          60_000,
      ]),
  );
  const mediaNota = media(avaliados.map((c) => c.avaliacao as number));
  const nota: Record<string, string> = Object.fromEntries(
    avaliados.map((c) => [c.id, `${c.avaliacao} de 5`]),
  );
  const loja = (id: string | null) =>
    id ? (nomesLojas.get(id) ?? "Loja") : "Sem loja";
  const porLoja = agrupar(pedidos, (c) => c.loja_id ?? "sem");

  // Agendas: só as que alguma categoria do recorte usa.
  const usadas = new Set(cats.map((c) => c.agenda_id).filter(Boolean));
  const agendas = agenda.agendas.filter((a) => usadas.has(a.id));
  if (agenda.agendamentos.some((a) => a.exemplo)) ctx.exemplo = true;
  const numerosAgenda = agendas.map((a) => {
    const marcados = agenda.agendamentos.filter((x) => x.agenda_id === a.id);
    const bloqueios = agenda.bloqueios.filter((b) => b.agenda_id === a.id);
    const o = ocupacaoDaAgenda(
      a,
      marcados,
      bloqueios,
      f.periodo.de,
      f.periodo.ate,
    );
    // A tabela dos ocupados tem exatamente os horários que a ocupação conta
    // (marcados e realizados); remarcar e cancelados ficam à parte.
    const conta = (m: (typeof marcados)[number]) =>
      m.status === "marcado" || m.status === "realizado";
    const tabelaDeHorarios = (titulo: string, ms: typeof marcados) => ({
      titulo,
      colunas: [
        { titulo: "Dia e hora" },
        { titulo: "Loja" },
        { titulo: "Status" },
      ],
      linhas: ms.map((m) => {
        const b = paraBrasilia(instante(m.inicio));
        return {
          chave: m.id,
          celulas: [
            `${formatarData(b.data)} ${b.hora}`,
            loja(m.loja_id),
            STATUS_AGENDAMENTO[m.status] ?? m.status,
          ],
          ordem: [m.inicio, loja(m.loja_id), m.status],
        };
      }),
      vazio: "Nenhum horário no período.",
    });
    const detalhe: Detalhe = {
      secao: "Agenda",
      titulo: `Agenda ${a.nome}`,
      subtitulo: `${f.rotulo}: ${o.ocupados} de ${o.vagas} horários ocupados`,
      resumo: [
        { rotulo: "Ocupação", valor: formatarPct(o.pct, 0) },
        { rotulo: "Dias bloqueados", valor: String(o.diasBloqueados.length) },
      ],
      tabelas: [
        tabelaDeHorarios("Horários ocupados", marcados.filter(conta)),
        tabelaDeHorarios(
          "Remarcar e cancelados",
          marcados.filter((m) => !conta(m)),
        ),
        {
          titulo: "Bloqueios",
          colunas: [{ titulo: "De" }, { titulo: "Até" }, { titulo: "Motivo" }],
          linhas: bloqueios.map((b, k) => {
            const de = paraBrasilia(instante(b.inicio));
            const ate = paraBrasilia(instante(b.fim));
            return {
              chave: `${b.inicio}-${k}`,
              celulas: [
                `${formatarData(de.data)} ${de.hora}`,
                `${formatarData(ate.data)} ${ate.hora}`,
                b.motivo,
              ],
            };
          }),
          vazio: "Nenhum bloqueio no período.",
        },
      ],
      link: { href: ROTAS_OS.portal, rotulo: "Abrir Portal e agenda" },
    };
    return {
      rotulo: `Ocupação: ${a.nome}`,
      valor: formatarPct(o.pct, 0),
      detalhe: `${o.ocupados} de ${o.vagas} horários · ${plural(o.diasBloqueados.length, "dia bloqueado", "dias bloqueados")}`,
      origem: detalhe,
    };
  });

  if (
    pedidos.length === 0 &&
    avaliados.length === 0 &&
    numerosAgenda.length === 0
  )
    return [];

  return [
    {
      id: "portal",
      titulo: "Portal do lojista",
      descricao: `Pedidos feitos pelo portal em ${f.rotulo}`,
      largura: 12,
      partes: [
        {
          tipo: "numeros",
          numeros: [
            {
              rotulo: "Pedidos",
              valor: formatarNumero(pedidos.length),
              origem: listas.lista(`Pedidos do portal em ${f.rotulo}`, pedidos),
            },
            {
              rotulo: "Primeira resposta",
              valor: tempoLegivel(media([...resposta.values()])),
              detalhe: `média de ${plural(resposta.size, "pedido respondido", "pedidos respondidos")}`,
              origem: listas.lista(
                "Tempo até a primeira resposta",
                [...resposta.keys()],
                {
                  extra: colunaDeTempo("Primeira resposta", resposta),
                },
              ),
            },
            {
              rotulo: "Avaliação média",
              valor:
                mediaNota === null
                  ? "—"
                  : `${formatarNumero(mediaNota, 1)} de 5`,
              detalhe: plural(
                avaliados.length,
                "avaliação no período",
                "avaliações no período",
              ),
              origem: listas.lista("Avaliações do portal", avaliados, {
                extra: { titulo: "Nota", numero: true, valores: nota },
              }),
            },
            ...numerosAgenda,
          ],
        },
        {
          tipo: "barras",
          rotuloLargo: true,
          vazio: "Nenhum pedido pelo portal no período.",
          itens: porLoja.slice(0, 10).map((g) => ({
            chave: g.chave,
            rotulo: loja(g.chave === "sem" ? null : g.chave),
            valor: g.itens.length,
            texto: String(g.itens.length),
            origem: listas.lista(
              `Pedidos de ${loja(g.chave === "sem" ? null : g.chave)}`,
              g.itens,
            ),
          })),
        },
        {
          tipo: "colunas",
          rotularTodas: true,
          itens: [1, 2, 3, 4, 5].map((n) => {
            const deN = avaliados.filter((c) => c.avaliacao === n);
            return {
              chave: String(n),
              rotulo: `${n} ★`,
              titulo: `Nota ${n}`,
              valor: deN.length,
              texto: String(deN.length),
              origem: listas.lista(`Avaliações com nota ${n}`, deN),
            };
          }),
        },
      ],
      nota: `Pedidos por loja: as 10 que mais pediram${porLoja.length > 10 ? ` (de ${porLoja.length})` : ""}. Pedidos por categoria estão em "Chamados por categoria". Notas de 1 a 5 dadas pelo lojista ao concluir.`,
      exportar: listas.lista(`Pedidos do portal em ${f.rotulo}`, pedidos),
      links: [{ href: ROTAS_OS.portal, rotulo: "Abrir Portal e agenda" }],
    },
  ];
}

// ---------------------------------------------------------------------------
// Vistorias
// ---------------------------------------------------------------------------

function detalheDeVistorias(titulo: string, vs: VistoriaDoPainel[]): Detalhe {
  return {
    secao: "Vistorias",
    titulo,
    tabelas: [
      {
        colunas: [
          { titulo: "Código" },
          { titulo: "Tipo" },
          { titulo: "Data" },
          { titulo: "Locatário" },
          { titulo: "Unidade" },
          { titulo: "Status" },
          { titulo: "Assinatura" },
        ],
        linhas: vs.map((v) => ({
          chave: v.id,
          celulas: [
            `${v.codigo}${v.exemplo ? " (exemplo)" : ""}`,
            TIPOS_VISTORIA[v.tipo],
            formatarData(v.data),
            v.locatario,
            v.unidade,
            v.rascunho ? "Rascunho" : STATUS_VISTORIA[v.status],
            v.assinado_em ? "Assinada" : "Falta assinar",
          ],
          ordem: [
            v.codigo,
            v.tipo,
            v.data,
            v.locatario,
            v.unidade,
            v.status,
            v.assinado_em,
          ],
        })),
        vazio: "Nenhuma vistoria.",
      },
    ],
    link: { href: ROTAS_OS.vistorias, rotulo: "Abrir Vistorias" },
  };
}

export async function blocosDeVistorias(
  ctx: Ctx,
  setoresDasVistorias: Set<string>,
): Promise<Bloco[]> {
  const { listas, f } = ctx;
  if (!ctx.pode("os.vistorias")) return [];
  if (f.setor && !setoresDasVistorias.has(f.setor.id)) return [];
  const { vistorias, ambientes } = await vistoriasDoPeriodo(
    f.periodo.de,
    f.periodo.ate,
  );
  if (vistorias.length === 0) return [];
  if (vistorias.some((v) => v.exemplo)) ctx.exemplo = true;

  const aguardando = vistorias.filter(
    (v) => v.status !== "cancelado" && !v.rascunho && !v.assinado_em,
  );
  const comProblema = new Set(ambientes.map((a) => a.id));
  const viraramOS = ctx.todos.filter(
    (c) => c.ambiente_id !== null && comProblema.has(c.ambiente_id),
  );
  const situacao = (v: VistoriaDoPainel) =>
    v.rascunho ? "rascunho" : v.status;
  const rotuloSituacao = (k: string) =>
    k === "rascunho" ? "Rascunho" : STATUS_VISTORIA[k as StatusVistoria];
  const titulosAmbientes: Detalhe = {
    secao: "Vistorias",
    titulo: "Ambientes com problema",
    tabelas: [
      {
        colunas: [
          { titulo: "Vistoria" },
          { titulo: "Ambiente" },
          { titulo: "Virou OS" },
        ],
        linhas: ambientes.map((a) => ({
          chave: a.id,
          celulas: [
            vistorias.find((v) => v.id === a.vistoria_id)?.codigo ?? "—",
            a.titulo,
            viraramOS.some((c) => c.ambiente_id === a.id) ? "Sim" : "Não",
          ],
        })),
      },
    ],
    link: { href: ROTAS_OS.vistorias, rotulo: "Abrir Vistorias" },
  };

  return [
    {
      id: "vistorias",
      titulo: "Vistorias",
      descricao: `Vistorias com data em ${f.rotulo}`,
      largura: 12,
      partes: [
        {
          tipo: "numeros",
          numeros: [
            {
              rotulo: "Vistorias",
              valor: String(vistorias.length),
              origem: detalheDeVistorias(`Vistorias de ${f.rotulo}`, vistorias),
            },
            {
              rotulo: "Aguardando assinatura",
              valor: String(aguardando.length),
              alerta: aguardando.length > 0,
              detalhe: "prontas, sem a assinatura",
              origem: detalheDeVistorias("Aguardando assinatura", aguardando),
            },
            {
              rotulo: "Ambientes com problema",
              valor: String(ambientes.length),
              origem: titulosAmbientes,
            },
            {
              rotulo: "Viraram OS",
              valor: String(viraramOS.length),
              detalhe: "chamados abertos a partir dos ambientes",
              origem: listas.lista(
                "Ambientes com problema que viraram OS",
                viraramOS,
              ),
            },
          ],
        },
        {
          tipo: "rosca",
          centro: { valor: String(vistorias.length), rotulo: "vistorias" },
          itens: agrupar(vistorias, (v) => v.tipo).map((g, k) => ({
            chave: `tipo-${g.chave}`,
            rotulo: TIPOS_VISTORIA[g.chave as TipoVistoria],
            valor: g.itens.length,
            texto: String(g.itens.length),
            cor: ((k % 5) + 1) as 1 | 2 | 3 | 4 | 5,
            origem: detalheDeVistorias(
              TIPOS_VISTORIA[g.chave as TipoVistoria],
              g.itens,
            ),
          })),
        },
        {
          tipo: "barras",
          itens: agrupar(vistorias, situacao).map((g) => ({
            chave: g.chave,
            rotulo: rotuloSituacao(g.chave),
            valor: g.itens.length,
            texto: String(g.itens.length),
            origem: detalheDeVistorias(
              `Vistorias: ${rotuloSituacao(g.chave)}`,
              g.itens,
            ),
          })),
        },
      ],
      links: [{ href: ROTAS_OS.vistorias, rotulo: "Abrir Vistorias" }],
    },
  ];
}
