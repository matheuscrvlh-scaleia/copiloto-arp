import { Filter, MessageSquareWarning, Store } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { Linhas } from "@/components/dashboard/graficos/linhas";
import { MapaDeCalor } from "@/components/dashboard/graficos/mapa-calor";
import { SeloStatus } from "@/components/dashboard/indicador";
import { Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import {
  AbasDaTela,
  CartaoDaTela,
  Cartoes,
  Fonte,
  hrefCom,
  TopoDaTela,
  variacaoContra,
} from "@/components/dashboard/tela";
import {
  ComoAdicionarAArp,
  ListaDeAvaliacoes,
  SeloSituacao,
  textoDias,
} from "@/components/marketing/reputacao/avaliacoes";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  formatarData,
  formatarMes,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import { status } from "@/lib/indicadores";
import {
  dentro,
  linhaDeFiltros,
  mesesAte,
  paramsDoPeriodoMkt,
} from "@/lib/marketing/periodo";
import {
  ARP,
  type AvaliacaoLinha,
  avaliacoesDaArp,
  type LinhaLocatario,
  linhasDeAvaliacao,
  linhasDeLocatarios,
  maisCitado,
  mapaDeTemas,
  medir,
  mesAteHoje,
  mesmoTrechoDoMesAnterior,
  metaNoRitmo,
  type ParametrosReputacao,
  porMes,
  SITUACOES,
  type Situacao,
} from "@/lib/marketing/reputacao";
import {
  type Locatario,
  locatarios,
  metaMkt,
  parametros,
  temasEcodigos,
} from "@/server/marketing/base";
import {
  type Busca,
  type FiltrosLidos,
  lerFiltros,
} from "@/server/marketing/filtros";
import { dadosReputacao } from "@/server/marketing/fontes";

export const metadata: Metadata = { title: "Reputação" };

const BASE = "/marketing/reputacao";
const GOOGLE = "Google Perfil da Empresa";

export default function Page({
  searchParams,
}: PageProps<"/marketing/reputacao">) {
  return (
    <>
      <PageHeader
        title="Reputação"
        description="Avaliações no Google da ARP e dos locatários-chave, uma linha por locatário, com alerta quando uma loja começa a receber reclamações."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="marketing.reputacao">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

/** "1 e 2", "1, 2 e 3". */
function listaPt(ns: number[]): string {
  const o = [...ns].sort((a, b) => a - b).map(String);
  return o.length < 2
    ? (o[0] ?? "")
    : `${o.slice(0, -1).join(", ")} e ${o[o.length - 1]}`;
}

const nota = (v: number | null) => (v === null ? "—" : formatarNumero(v, 1));

type Fontes = Awaited<ReturnType<typeof dadosReputacao>>;

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const f = await lerFiltros("reputacao", await busca, "ultimos_30");
  const aba = f.um("aba") === "locatarios" ? "locatarios" : "arp";
  const [fontes, p, lista, { temas }] = await Promise.all([
    dadosReputacao(),
    parametros(),
    locatarios(),
    temasEcodigos(),
  ]);
  const temasAtivos = temas.filter((t) => t.ativo).map((t) => t.nome);
  const ativos = lista.filter((l) => l.ativo);
  const tema = temasAtivos.includes(f.um("tema")) ? f.um("tema") : "";
  const linhas = linhasDeLocatarios(
    fontes,
    ativos,
    p,
    temasAtivos,
    f.periodo,
    f.ctx.hoje,
    tema,
  );
  const emAlerta = linhas.filter((l) => l.situacao === "alerta").length;

  return (
    <div className="flex flex-col gap-6">
      <AbasDaTela
        rotulo="Abas da Reputação"
        ativa={aba}
        abas={[
          {
            chave: "arp",
            rotulo: "ARP",
            href: hrefCom(BASE, f.busca, { aba: null, cartao: null }),
          },
          {
            chave: "locatarios",
            rotulo: "Locatários-chave",
            href: hrefCom(BASE, f.busca, { aba: "locatarios", cartao: null }),
            aviso: emAlerta ? String(emAlerta) : undefined,
          },
        ]}
      />
      {aba === "arp" ? (
        <AbaArp
          f={f}
          fontes={fontes}
          p={p}
          temasAtivos={temasAtivos}
          tema={tema}
          ativos={ativos}
        />
      ) : (
        <AbaLocatarios
          f={f}
          fontes={fontes}
          p={p}
          temasAtivos={temasAtivos}
          tema={tema}
          ativos={ativos}
          linhas={linhas}
        />
      )}
    </div>
  );
}

interface PropsAba {
  f: FiltrosLidos;
  fontes: Fontes;
  p: ParametrosReputacao;
  temasAtivos: string[];
  tema: string;
  ativos: Locatario[];
}

const selecaoTema = (temasAtivos: string[], tema: string) => ({
  chave: "tema",
  rotulo: "Tema",
  todos: "Todos os temas",
  valor: tema,
  icone: <MessageSquareWarning className="size-4" />,
  opcoes: temasAtivos.map((t) => ({ valor: t, rotulo: t })),
});

// ---------------------------------------------------------------------------
// Aba ARP
// ---------------------------------------------------------------------------

async function AbaArp({ f, fontes, p, temasAtivos, tema, ativos }: PropsAba) {
  const { ctx, periodo } = f;
  const hoje = ctx.hoje;
  const mesAtual = `${hoje.slice(0, 7)}-01`;
  const q = f.um("q").trim().toLowerCase();
  const cartao = f.um("cartao");
  const [metaNovas, metaNota] = await Promise.all([
    metaMkt("marketing.avaliacoes_novas_arp", mesAtual),
    metaMkt("marketing.nota_media_arp", mesAtual),
  ]);
  const { local, avaliacoes } = avaliacoesDaArp(fontes, p, temasAtivos, hoje);
  const mes = medir(avaliacoes, mesAteHoje(hoje));
  const mesAnt = medir(avaliacoes, mesmoTrechoDoMesAnterior(hoje));
  const noPeriodo = medir(avaliacoes, periodo);
  const lista = avaliacoes.filter(
    (a) =>
      dentro(a.data, periodo) &&
      (!tema || a.tema === tema) &&
      (!q ||
        a.comentario.toLowerCase().includes(q) ||
        a.autor.toLowerCase().includes(q)) &&
      (cartao === "reclamacoes"
        ? a.reclamacao
        : cartao === "sem_resposta"
          ? !a.respondida
          : true),
  );

  const notaArp = local?.averageRating ?? null;
  const ritmo = metaNovas ? metaNoRitmo(metaNovas, hoje) : null;
  const stNovas = status(mes.novas, ritmo);
  const stNota = status(notaArp, metaNota);
  const estrelasRecl = listaPt(p.estrelas_reclamacao);
  const hrefCartao = (c: string) =>
    hrefCom(BASE, f.busca, {
      cartao: cartao === c ? null : c,
      periodo: "mes",
      de: null,
      ate: null,
    });

  const meses = mesesAte(hoje, 12);
  const mensal = porMes(avaliacoes, meses);
  const pontos = meses.map((m) => ({
    chave: m,
    rotulo: formatarMes(m).slice(0, 3),
    titulo: m === mesAtual ? `${formatarMes(m)} (até hoje)` : formatarMes(m),
  }));

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Período", valor: f.rotulo },
    { rotulo: "Tema", valor: tema || "Todos" },
    ...(q ? [{ rotulo: "Busca", valor: f.um("q") }] : []),
    ...(cartao
      ? [
          {
            rotulo: "Cartão",
            valor: cartao === "reclamacoes" ? "Reclamações" : "Sem resposta",
          },
        ]
      : []),
  ]);
  const filtrosExportar = linhaDeFiltros([
    { rotulo: "Período", valor: f.rotulo },
    { rotulo: "Tema", valor: tema || "Todos" },
  ]);

  return (
    <>
      <BarraDeFiltros
        modulo="marketing"
        tela="reputacao"
        periodo={periodo}
        hoje={hoje}
        lembrado={f.lembrado}
        selecoes={[selecaoTema(temasAtivos, tema)]}
        busca={{
          chave: "q",
          valor: f.um("q"),
          placeholder: "Buscar comentário ou autor…",
        }}
      />
      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        acoes={
          ctx.pode("marketing.exportar") ? (
            <BotaoExportar
              titulo="Avaliações do período"
              filtros={`${filtrosExportar} · ${ctx.dadosDe}`}
              nomeArquivo="avaliacoes-do-periodo"
              colunas={COLUNAS_AVALIACOES_EXPORTAR}
              linhas={avaliacoesExportar(
                fontes,
                ativos,
                p,
                temasAtivos,
                periodo,
                hoje,
                tema,
              )}
            />
          ) : undefined
        }
      />

      <Cartoes modulo="marketing">
        <CartaoDaTela
          titulo="Nota média"
          exemplo={
            "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
          }
          valor={nota(notaArp)}
          detalhe={
            local
              ? `${formatarNumero(local.totalReviewCount)} avaliações no Google`
              : "Perfil da ARP sem dados"
          }
          status={metaNota ? stNota : undefined}
          direcao="maior_melhor"
          meta={
            metaNota
              ? `Meta: ${nota(metaNota.meta)}`
              : "Defina a meta em Configurações"
          }
          calculo="Nota que o Google mostra no perfil (averageRating), de todas as avaliações desde sempre."
          fonte={GOOGLE}
        />
        <CartaoDaTela
          titulo="Avaliações novas no mês"
          exemplo={
            "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
          }
          valor={formatarNumero(mes.novas)}
          variacao={variacaoContra(
            mes.novas,
            mesAnt.novas,
            "mesmos dias do mês passado",
          )}
          status={ritmo ? stNovas : undefined}
          direcao="maior_melhor"
          meta={
            metaNovas && ritmo
              ? `Meta: ${formatarNumero(metaNovas.meta)} no mês · no ritmo, ${formatarNumero(Math.round(ritmo.meta))} até hoje`
              : "Defina a meta em Configurações"
          }
          calculo="Avaliações criadas do dia 1 até hoje. A situação compara com a meta proporcional aos dias que já passaram."
          fonte={GOOGLE}
        />
        <CartaoDaTela
          titulo="Reclamações no mês"
          exemplo={
            "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
          }
          valor={formatarNumero(mes.reclamacoes)}
          variacao={variacaoContra(
            mes.reclamacoes,
            mesAnt.reclamacoes,
            "mesmos dias do mês passado",
            "menor_melhor",
          )}
          detalhe={`Avaliações de ${estrelasRecl} ${p.estrelas_reclamacao.length === 1 && p.estrelas_reclamacao[0] === 1 ? "estrela" : "estrelas"} (Configurações)`}
          fonte={GOOGLE}
          href={hrefCartao("reclamacoes")}
          ativo={cartao === "reclamacoes"}
        />
        <CartaoDaTela
          titulo="Sem resposta"
          exemplo={
            "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
          }
          valor={formatarNumero(mes.semResposta)}
          detalhe={`No mês. Taxa de resposta ${formatarPct(mes.taxaResposta)}${mes.tempoMedianoResposta !== null ? ` · tempo mediano ${textoDias(mes.tempoMedianoResposta)}` : ""}`}
          calculo="Avaliações do mês sem resposta do dono (reviewReply). Responder é no Google: o link fica em cada linha."
          fonte={GOOGLE}
          href={hrefCartao("sem_resposta")}
          ativo={cartao === "sem_resposta"}
        />
      </Cartoes>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Secao
          titulo="Avaliações da ARP"
          descricao={`${f.rotulo} · a mais recente primeiro. Linha em amarelo: reclamação sem resposta.`}
        >
          <ListaDeAvaliacoes
            avaliacoes={lista}
            mapsUri={local?.mapsUri ?? null}
          />
          <Fonte>
            {GOOGLE}. Tema: classificação automática na lista de temas de
            Configurações. Tempo para responder: da avaliação até a resposta.
          </Fonte>
        </Secao>
        <div className="flex flex-col gap-4">
          <Secao
            tom="escuro"
            titulo="Metas do mês"
            descricao={formatarMes(mesAtual)}
          >
            <MetasDoMes
              linhas={[
                {
                  indicador: "Avaliações novas",
                  meta: metaNovas ? formatarNumero(metaNovas.meta) : null,
                  realizado: formatarNumero(mes.novas),
                  situacao: stNovas,
                },
                {
                  indicador: "Nota média",
                  meta: metaNota ? nota(metaNota.meta) : null,
                  realizado: nota(notaArp),
                  situacao: stNota,
                },
              ]}
            />
            <Fonte>
              Metas em Configurações. Avaliações novas: situação pelo ritmo
              (meta proporcional aos dias passados).
            </Fonte>
          </Secao>
          <Secao
            tom="verde"
            titulo="Estrelas"
            calculo="Avaliações da ARP feitas no período, contadas por número de estrelas (starRating), de 5 a 1. Fonte: Google Perfil da Empresa."
            exemplo={
              "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
            }
            descricao={`${f.rotulo}, de 5 a 1`}
          >
            <BarrasHorizontais
              descricao="Avaliações da ARP por número de estrelas"
              itens={noPeriodo.distribuicao.map((n, i) => ({
                chave: String(5 - i),
                rotulo: `${5 - i} ${i === 4 ? "estrela" : "estrelas"}`,
                valor: n,
                texto: formatarNumero(n),
                detalhe: noPeriodo.novas
                  ? formatarPct((n / noPeriodo.novas) * 100)
                  : undefined,
              }))}
            />
            <p className="mt-3 text-xs text-neutral-600">
              Taxa de resposta {formatarPct(noPeriodo.taxaResposta)}
              {noPeriodo.tempoMedianoResposta !== null &&
                ` · tempo mediano ${textoDias(noPeriodo.tempoMedianoResposta)}`}
            </p>
            <Fonte>{GOOGLE}</Fonte>
          </Secao>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Secao
          titulo="Nota média por mês"
          calculo="Média das estrelas das avaliações feitas em cada mês (createTime), últimos 12 meses. Não é a nota acumulada do perfil. Linha tracejada: meta de nota média (Configurações › Metas). Fonte: Google Perfil da Empresa."
          exemplo={
            "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
          }
          descricao="Últimos 12 meses: média das estrelas das avaliações de cada mês"
        >
          <Linhas
            pontos={pontos}
            unidade="nota"
            zero={false}
            descricao="Nota média das avaliações da ARP por mês"
            series={[
              {
                chave: "nota",
                rotulo: "Nota média",
                cor: 1,
                valores: mensal.map((m) => m.nota),
              },
            ]}
            meta={
              metaNota
                ? { valor: metaNota.meta, texto: `Meta ${nota(metaNota.meta)}` }
                : undefined
            }
          />
          <Fonte>{GOOGLE}; meta em Configurações</Fonte>
        </Secao>
        <Secao
          tom="escuro"
          titulo="Reclamações por mês"
          calculo="Avaliações da ARP em cada mês com as estrelas que contam como reclamação (Configurações › Reputação), últimos 12 meses. Fonte: Google Perfil da Empresa."
          exemplo={
            "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
          }
          descricao={`Últimos 12 meses: avaliações de ${estrelasRecl} estrelas`}
        >
          <Colunas
            descricao="Reclamações da ARP por mês"
            itens={mensal.map((m, i) => ({
              chave: m.mes,
              rotulo: pontos[i]?.rotulo ?? "",
              titulo: pontos[i]?.titulo,
              valor: m.reclamacoes,
              texto: formatarNumero(m.reclamacoes),
              detalhe: `${formatarNumero(m.avaliacoes)} avaliações no mês`,
            }))}
          />
          <Fonte>{GOOGLE}</Fonte>
        </Secao>
      </div>
    </>
  );
}

function MetasDoMes({
  linhas,
}: {
  linhas: {
    indicador: string;
    meta: string | null;
    realizado: string;
    situacao: ReturnType<typeof status>;
  }[];
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-neutral-500">
          <th className="pb-2 font-medium">Indicador</th>
          <th className="pb-2 text-right font-medium">Meta</th>
          <th className="pb-2 text-right font-medium">Realizado</th>
          <th className="pb-2 pl-3 font-medium">Situação</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.indicador} className="border-t border-neutral-900/5">
            <td className="py-2 pr-2">{l.indicador}</td>
            <td className="py-2 text-right tabular-nums">{l.meta ?? "—"}</td>
            <td className="py-2 text-right font-semibold tabular-nums">
              {l.realizado}
            </td>
            <td className="py-2 pl-3">
              <SeloStatus status={l.situacao} direcao="maior_melhor" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Aba Locatários-chave
// ---------------------------------------------------------------------------

const SITUACAO_OPCOES = (Object.keys(SITUACOES) as Situacao[]).map((s) => ({
  valor: s,
  rotulo: SITUACOES[s].rotulo,
}));

function AbaLocatarios({
  f,
  fontes,
  p,
  temasAtivos,
  tema,
  ativos,
  linhas,
}: PropsAba & { linhas: LinhaLocatario[] }) {
  const { ctx, periodo, anterior } = f;
  const hoje = ctx.hoje;
  const categoria = f.um("categoria");
  const situacao = (
    Object.hasOwn(SITUACOES, f.um("situacao")) ? f.um("situacao") : ""
  ) as Situacao | "";
  const q = f.um("q").trim().toLowerCase();
  const cartao = f.um("cartao");

  // Filtros da barra, menos a situação (os cartões contam todas).
  const passa = (l: LinhaLocatario) =>
    (!categoria || l.categoria === categoria) &&
    (!q ||
      l.nome.toLowerCase().includes(q) ||
      (l.titulo ?? "").toLowerCase().includes(q)) &&
    (!tema || l.periodo.reclamacoes > 0);
  const base = linhas.filter(passa);
  const lista = base.filter(
    (l) =>
      (!situacao || l.situacao === situacao) &&
      (cartao !== "com_reclamacao" || l.periodo.reclamacoes > 0),
  );
  const ids = new Set(base.map((l) => l.id));
  const reclAnterior = linhasDeLocatarios(
    fontes,
    ativos.filter((l) => ids.has(l.id)),
    p,
    temasAtivos,
    anterior,
    hoje,
    tema,
  ).reduce((s, l) => s + l.periodo.reclamacoes, 0);

  const comNota = base.filter((l) => l.nota !== null);
  const notaGeral = comNota.length
    ? comNota.reduce((s, l) => s + (l.nota as number), 0) / comNota.length
    : null;
  const reclamacoes = base.reduce((s, l) => s + l.periodo.reclamacoes, 0);
  const conta = (s: Situacao) => base.filter((l) => l.situacao === s).length;
  const parciais = base.filter((l) => l.parcial).length;
  const semDados = conta("sem_dados");

  // Reclamações por tema de todos os locatários juntos.
  const porTema: Record<string, number> = {};
  for (const l of base)
    for (const [t, n] of Object.entries(l.periodo.porTema))
      porTema[t] = (porTema[t] ?? 0) + n;
  const comReclamacao = base.filter((l) => l.periodo.reclamacoes > 0);
  const hrefDetalhe = (id: string, muda: Record<string, string | null> = {}) =>
    hrefCom(
      `${BASE}/${id}`,
      { ...paramsDoPeriodoMkt(periodo), ...(tema ? { tema } : {}) },
      muda,
    );

  const categorias = [...new Set(ativos.map((l) => l.categoria))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Período", valor: f.rotulo },
    { rotulo: "Categoria", valor: categoria || "Todas" },
    {
      rotulo: "Situação",
      valor: situacao ? SITUACOES[situacao].rotulo : "Todas",
    },
    {
      rotulo: "Tema",
      valor: tema ? `${tema} (só reclamações desse tema)` : "Todos",
    },
    ...(q ? [{ rotulo: "Busca", valor: f.um("q") }] : []),
    ...(cartao === "com_reclamacao"
      ? [{ rotulo: "Cartão", valor: "Com reclamação no período" }]
      : []),
  ]);
  const regra = `Alerta: ${p.reclamacoes_alerta} ou mais reclamações em ${p.janela_reputacao_dias} dias; Atenção: de ${p.reclamacoes_atencao} a ${p.reclamacoes_alerta - 1}, ou nota das novas abaixo de ${nota(p.nota_atencao)}`;
  const totalNovas = lista.reduce((s, l) => s + l.periodo.novas, 0);
  const somaNotasNovas = lista.reduce(
    (s, l) => s + (l.periodo.notaDasNovas ?? 0) * l.periodo.novas,
    0,
  );
  // Tema mais citado das linhas da lista (para o rodapé).
  const temasDaLista: Record<string, number> = {};
  for (const l of lista)
    for (const [t, n] of Object.entries(l.periodo.porTema))
      temasDaLista[t] = (temasDaLista[t] ?? 0) + n;
  const temaGeral = maisCitado(temasDaLista);

  return (
    <>
      <BarraDeFiltros
        modulo="marketing"
        tela="reputacao"
        periodo={periodo}
        hoje={hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "categoria",
            rotulo: "Categoria",
            todos: "Todas as categorias",
            valor: categoria,
            icone: <Store className="size-4" />,
            opcoes: categorias.map((c) => ({ valor: c, rotulo: c })),
          },
          {
            chave: "situacao",
            rotulo: "Situação",
            todos: "Todas as situações",
            valor: situacao,
            icone: <Filter className="size-4" />,
            opcoes: SITUACAO_OPCOES,
          },
          selecaoTema(temasAtivos, tema),
        ]}
        busca={{
          chave: "q",
          valor: f.um("q"),
          placeholder: "Buscar locatário…",
        }}
      />
      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        acoes={
          ctx.pode("marketing.exportar") ? (
            <BotaoExportar
              titulo="Reputação dos locatários"
              filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
              nomeArquivo="reputacao-dos-locatarios"
              colunas={COLUNAS_LOCATARIOS_EXPORTAR}
              linhas={locatariosExportar(lista)}
            />
          ) : undefined
        }
      />

      <Cartoes modulo="marketing">
        <CartaoDaTela
          titulo="Locatários monitorados"
          valor={formatarNumero(base.length)}
          detalhe={`${parciais} com dados parciais · ${semDados} sem dados`}
          calculo="Locatários ativos cadastrados em Configurações, nos filtros da barra."
          fonte="Configurações (locatários monitorados)"
        />
        <CartaoDaTela
          titulo="Nota média geral"
          exemplo={
            "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
          }
          valor={nota(notaGeral)}
          detalhe={`Média simples de ${comNota.length} ${comNota.length === 1 ? "locatário" : "locatários"} com nota`}
          calculo="Média das notas do Google (averageRating) dos locatários com dados; quem está sem dados fica de fora."
          fonte={GOOGLE}
        />
        <CartaoDaTela
          titulo="Reclamações no período"
          exemplo={
            "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
          }
          valor={formatarNumero(reclamacoes)}
          variacao={variacaoContra(
            reclamacoes,
            reclAnterior,
            f.rotuloAnterior,
            "menor_melhor",
          )}
          detalhe={`Avaliações de ${listaPt(p.estrelas_reclamacao)} estrelas · ${comReclamacao.length} ${comReclamacao.length === 1 ? "loja" : "lojas"}`}
          fonte={GOOGLE}
          href={hrefCom(BASE, f.busca, {
            cartao: cartao === "com_reclamacao" ? null : "com_reclamacao",
          })}
          ativo={cartao === "com_reclamacao"}
        />
        <CartaoDaTela
          titulo="Lojas em alerta"
          exemplo={
            "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
          }
          valor={formatarNumero(conta("alerta"))}
          detalhe={`${conta("atencao")} em atenção · últimos ${p.janela_reputacao_dias} dias`}
          calculo={`${regra} (Configurações).`}
          fonte={`${GOOGLE} e Configurações`}
          href={hrefCom(BASE, f.busca, {
            situacao: situacao === "alerta" ? null : "alerta",
          })}
          ativo={situacao === "alerta"}
        />
      </Cartoes>

      <Secao
        titulo="Locatários-chave"
        descricao={`${f.rotulo} · uma linha por locatário, primeiro os em alerta e depois os com mais reclamações. Clique para ver as avaliações.`}
      >
        <TabelaLista
          colunas={COLUNAS_LOCATARIOS}
          placeholder="Buscar nesta lista…"
          vazio="Nenhum locatário nesse filtro."
          linhas={lista.map((l) => ({
            chave: l.id,
            busca: `${l.nome} ${l.titulo ?? ""} ${l.categoria}`,
            href: hrefDetalhe(l.id),
            tom:
              l.situacao === "alerta"
                ? "alerta"
                : l.situacao === "atencao"
                  ? "atencao"
                  : undefined,
            celulas: celulasLocatario(l, p.nota_atencao),
            ordem: [
              l.nome,
              l.categoria,
              l.nota,
              l.total,
              l.semDados ? null : l.periodo.novas,
              l.periodo.notaDasNovas,
              l.semDados ? null : l.periodo.reclamacoes,
              l.periodo.temaMaisCitado,
              SITUACOES[l.situacao].ordem,
            ],
          }))}
          rodape={[
            "Total",
            `${lista.length} locatários`,
            "",
            formatarNumero(lista.reduce((s, l) => s + (l.total ?? 0), 0)),
            formatarNumero(totalNovas),
            totalNovas ? nota(somaNotasNovas / totalNovas) : "—",
            formatarNumero(
              lista.reduce((s, l) => s + l.periodo.reclamacoes, 0),
            ),
            temaGeral ?? "",
            "",
          ]}
        />
        <Fonte>
          {GOOGLE} e Configurações. Situação: últimos {p.janela_reputacao_dias}{" "}
          dias até hoje, qualquer que seja o período ({regra}; regra inicial, a
          confirmar). Dados parciais: o perfil não é administrado pela ARP, e o
          Google entrega só a nota, o total e até 5 avaliações, sem garantia de
          serem as mais novas. Sem dados: link inválido ou perfil sem acesso.
        </Fonte>
        <ComoAdicionarAArp />
      </Secao>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Secao
          titulo="Reclamações por tema"
          calculo="Reclamações dos locatários no período (avaliações com as estrelas de reclamação), todos juntos, por tema. O tema é a classificação automática do texto da avaliação numa lista fixa (Configurações › Reputação). Fonte: Google Perfil da Empresa."
          exemplo={
            "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
          }
          descricao={`${f.rotulo} · todos os locatários juntos`}
        >
          <BarrasHorizontais
            descricao="Reclamações dos locatários por tema"
            vazio="Nenhuma reclamação com tema no período."
            itens={temasAtivos
              .map((t) => ({
                chave: t,
                rotulo: t,
                valor: porTema[t] ?? 0,
                texto: formatarNumero(porTema[t] ?? 0),
              }))
              .filter((i) => i.valor > 0)
              .sort((a, b) => b.valor - a.valor)}
          />
          <Fonte>{GOOGLE}; temas da lista de Configurações</Fonte>
        </Secao>
        <Secao
          titulo="Locatário × tema"
          calculo="Cada célula: reclamações daquele locatário naquele tema, no período. Cor mais forte, mais reclamações. Tema pela lista de Configurações. Fonte: Google Perfil da Empresa dos locatários que deram acesso à ARP."
          exemplo={
            "avaliações do Google Perfil da Empresa, até a ferramenta ser ligada"
          }
          descricao="Reclamações no período. Clique na célula para ver as avaliações daquele tema."
        >
          {comReclamacao.length ? (
            <MapaDeCalor
              descricao="Reclamações por locatário e tema"
              rotuloValor="reclamações"
              cor={2}
              linhas={comReclamacao.map((l) => l.nome)}
              colunas={temasAtivos}
              valores={comReclamacao.map((l) =>
                temasAtivos.map((t) => l.periodo.porTema[t] || null),
              )}
              hrefs={comReclamacao.map((l) =>
                temasAtivos.map((t) =>
                  l.periodo.porTema[t]
                    ? hrefDetalhe(l.id, { tema: t, cartao: "reclamacoes" })
                    : null,
                ),
              )}
            />
          ) : (
            <p className="text-sm text-neutral-500">
              Nenhuma reclamação no período.
            </p>
          )}
          <Fonte>{GOOGLE}; temas da lista de Configurações</Fonte>
        </Secao>
      </div>
    </>
  );
}

const COLUNAS_LOCATARIOS = [
  { titulo: "Locatário", classe: "min-w-52" },
  { titulo: "Categoria" },
  { titulo: "Nota média", numero: true },
  { titulo: "Total de avaliações", numero: true },
  { titulo: "Novas no período", numero: true },
  { titulo: "Nota das novas", numero: true },
  { titulo: "Reclamações no período", numero: true },
  { titulo: "Tema mais citado", dica: "Nas reclamações do período" },
  { titulo: "Situação" },
];

function Marca({ texto, titulo }: { texto: string; titulo: string }) {
  return (
    <span
      title={titulo}
      className="ml-1.5 rounded-full bg-neutral-900/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-neutral-600"
    >
      {texto}
    </span>
  );
}

function celulasLocatario(
  l: LinhaLocatario,
  notaAtencao: number,
): React.ReactNode[] {
  const vazio = (k: string) => (
    <span key={k} className="text-neutral-300">
      —
    </span>
  );
  return [
    <span key="n" className="flex flex-col">
      <span className="font-medium">
        {l.nome}
        {l.parcial && (
          <Marca
            texto="dados parciais"
            titulo="Consulta pública: nota, total e até 5 avaliações, sem garantia de serem as mais novas"
          />
        )}
        {l.semDados && (
          <Marca
            texto="sem dados"
            titulo="Link do Google inválido ou perfil sem acesso"
          />
        )}
      </span>
      {l.titulo && l.titulo !== l.nome && (
        <span className="text-xs text-neutral-500">{l.titulo}</span>
      )}
    </span>,
    l.categoria,
    l.nota === null ? vazio("nt") : nota(l.nota),
    l.total === null ? vazio("t") : formatarNumero(l.total),
    l.semDados ? vazio("nv") : formatarNumero(l.periodo.novas),
    l.periodo.notaDasNovas === null ? (
      vazio("nn")
    ) : (
      <span
        key="nn"
        className={
          l.periodo.notaDasNovas < notaAtencao
            ? "font-semibold text-red-700"
            : ""
        }
      >
        {nota(l.periodo.notaDasNovas)}
      </span>
    ),
    l.semDados ? (
      vazio("r")
    ) : (
      <span key="r" className={l.periodo.reclamacoes ? "font-semibold" : ""}>
        {formatarNumero(l.periodo.reclamacoes)}
      </span>
    ),
    l.periodo.temaMaisCitado ?? vazio("tm"),
    <SeloSituacao key="s" situacao={l.situacao} />,
  ];
}

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

type Celula = string | number | null;
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
const ACESSO: Record<string, string> = {
  gerente: "Gerente do perfil",
  consulta_publica: "Consulta pública (dados parciais)",
  sem_acesso: "Sem acesso (sem dados)",
};

const COLUNAS_LOCATARIOS_EXPORTAR = [
  { titulo: "Locatário" },
  { titulo: "Perfil no Google" },
  { titulo: "Categoria" },
  { titulo: "Acesso" },
  { titulo: "Nota média", numero: true, formato: "0.0" },
  { titulo: "Total de avaliações", numero: true },
  { titulo: "Novas no período", numero: true },
  { titulo: "Nota das novas", numero: true, formato: "0.0" },
  { titulo: "Reclamações no período", numero: true },
  { titulo: "Tema mais citado" },
  { titulo: "Situação" },
];

function locatariosExportar(lista: LinhaLocatario[]): Celula[][] {
  const out: Celula[][] = lista.map((l) => [
    l.nome,
    l.titulo ?? "",
    l.categoria,
    ACESSO[l.acesso] ?? l.acesso,
    r1(l.nota),
    l.total,
    l.semDados ? null : l.periodo.novas,
    r1(l.periodo.notaDasNovas),
    l.semDados ? null : l.periodo.reclamacoes,
    l.periodo.temaMaisCitado ?? "",
    SITUACOES[l.situacao].rotulo,
  ]);
  out.push([
    "Total",
    `${lista.length} locatários`,
    "",
    "",
    null,
    lista.reduce((s, l) => s + (l.total ?? 0), 0),
    lista.reduce((s, l) => s + l.periodo.novas, 0),
    null,
    lista.reduce((s, l) => s + l.periodo.reclamacoes, 0),
    "",
    "",
  ]);
  return out;
}

const COLUNAS_AVALIACOES_EXPORTAR = [
  { titulo: "Local" },
  { titulo: "Data" },
  { titulo: "Estrelas", numero: true },
  { titulo: "Comentário" },
  { titulo: "Autor" },
  { titulo: "Respondida" },
  { titulo: "Tempo para responder (dias)", numero: true, formato: "0.0" },
  { titulo: "Tema" },
  { titulo: "Reclamação" },
];

/**
 * Todas as avaliações do período (e do tema), agrupadas por local: a ARP
 * primeiro, depois os locatários por nome, cada um com o seu subtotal.
 */
function avaliacoesExportar(
  fontes: Fontes,
  ativos: Locatario[],
  p: ParametrosReputacao,
  temasAtivos: string[],
  periodo: { de: string; ate: string },
  hoje: string,
  tema: string,
): Celula[][] {
  const temas = mapaDeTemas(fontes.temas, temasAtivos);
  const opcoes = { temas, estrelasReclamacao: p.estrelas_reclamacao, hoje };
  const locais = [
    { id: ARP, nome: fontes.locais.find((l) => l.id === ARP)?.title ?? "ARP" },
    ...[...ativos]
      .filter((l) => l.forma_acesso !== "sem_acesso")
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  ];
  const out: Celula[][] = [];
  for (const local of locais) {
    const ls: AvaliacaoLinha[] = linhasDeAvaliacao(
      fontes.avaliacoes.filter((a) => a.localId === local.id),
      opcoes,
    ).filter((a) => dentro(a.data, periodo) && (!tema || a.tema === tema));
    if (!ls.length) continue;
    for (const a of ls)
      out.push([
        local.nome,
        formatarData(a.data),
        a.estrelas,
        a.comentario,
        a.autor,
        a.respondida ? "Sim" : "Não",
        a.diasParaResponder,
        a.tema ?? "",
        a.reclamacao ? "Sim" : "Não",
      ]);
    const media = ls.reduce((s, a) => s + a.estrelas, 0) / ls.length;
    out.push([
      `Subtotal ${local.nome}`,
      `${ls.length} avaliações`,
      r1(media),
      "",
      "",
      `${ls.filter((a) => a.respondida).length} respondidas`,
      null,
      "",
      `${ls.filter((a) => a.reclamacao).length} reclamações`,
    ]);
  }
  return out;
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-11" />
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-4"
        quantidade={4}
      />
      <CartaoCarregando altura="h-96" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CartaoCarregando altura="h-72" />
        <CartaoCarregando altura="h-72" />
      </div>
    </TelaCarregando>
  );
}
