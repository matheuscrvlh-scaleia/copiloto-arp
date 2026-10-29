import { Clapperboard, Share2 } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import { MiniArea } from "@/components/dashboard/graficos/mini-area";
import { Secao } from "@/components/dashboard/tabela";
import { BarraDeFiltros } from "@/components/marketing/filtros";
import { TabelaMkt } from "@/components/marketing/tabela";
import {
  AbrirNaFerramenta,
  CartaoMkt,
  Cartoes,
  Fonte,
  TopoDaTela,
  variacaoContra,
} from "@/components/marketing/tela";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarData, formatarNumero, formatarPct } from "@/lib/formato";
import type { Rede } from "@/lib/marketing/fontes";
import { linhaDeFiltros, semanasAte } from "@/lib/marketing/periodo";
import {
  COLUNAS_EXPORTAR_REDES,
  DEMOGRAFIA,
  demografiaInstagram,
  engajamentoPorTipo,
  LISTA_REDES,
  linhasExportarRedes,
  linhasPorRede,
  type PostLinha,
  postsDoPeriodo,
  REDES,
  type RedeLinha,
  seguidoresPorSemana,
  somarRedes,
  TIPOS_POST,
  type TipoPost,
} from "@/lib/marketing/redes";
import { type Busca, lerFiltros } from "@/server/marketing/filtros";
import { dadosRedes } from "@/server/marketing/fontes";

export const metadata: Metadata = { title: "Redes sociais" };

const FONTE =
  "Instagram e Facebook (Graph API), YouTube (Data e Analytics) e TikTok (conta Business), contas da ARP";
const SEM_FACEBOOK =
  "A Meta não entrega mais esse número da página do Facebook de forma estável";

export default function Page({ searchParams }: PageProps<"/marketing/redes">) {
  return (
    <>
      <PageHeader
        title="Redes sociais"
        description="Uma linha por rede, com seguidores, alcance e interações das contas orgânicas da ARP; os posts que mais engajaram logo abaixo."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="marketing.redes">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const f = await lerFiltros("redes", await busca, "semana_passada");
  const { ctx, periodo, anterior } = f;
  const rede = f.um("rede") as Rede | "";
  const tipo = f.um("tipo") as TipoPost | "";
  const redes = rede ? [rede] : LISTA_REDES;

  const dados = await dadosRedes();
  const linhas = linhasPorRede(dados, periodo, redes);
  const t = somarRedes(linhas);
  const ta = somarRedes(linhasPorRede(dados, anterior, redes));
  const posts = postsDoPeriodo(dados, periodo, {
    redes,
    tipo: tipo || undefined,
  });
  const porTipo = engajamentoPorTipo(posts);
  const demografia = demografiaInstagram(dados);
  const comInstagram = redes.includes("instagram");
  const parcial = linhas.some((l) => l.parcial);

  const semanas = semanasAte(periodo.ate, 12);
  const historico = redes.map((r) => ({
    rede: r,
    itens: semanas.flatMap((s, k) => {
      const v = seguidoresPorSemana(dados, r, [s])[0] ?? null;
      return v === null
        ? []
        : [
            {
              chave: `${r}-${k}`,
              rotulo: s.rotulo,
              valor: v,
              texto: `${formatarNumero(v)} seguidores`,
              titulo: `Fim da semana de ${s.rotulo} a ${s.ate.slice(8, 10)}/${s.ate.slice(5, 7)}`,
            },
          ];
    }),
  }));

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Período", valor: f.rotulo },
    { rotulo: "Rede", valor: rede ? REDES[rede].rotulo : "Todas" },
    { rotulo: "Tipo de post", valor: tipo ? TIPOS_POST[tipo] : "Todos" },
  ]);
  const exportar = ctx.pode("marketing.exportar");

  return (
    <div className="flex flex-col gap-6">
      <BarraDeFiltros
        tela="redes"
        periodo={periodo}
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "rede",
            rotulo: "Rede",
            todos: "Todas as redes",
            valor: rede,
            icone: <Share2 className="size-4" />,
            opcoes: LISTA_REDES.map((r) => ({
              valor: r,
              rotulo: REDES[r].rotulo,
            })),
          },
          {
            chave: "tipo",
            rotulo: "Tipo de post",
            todos: "Todos os tipos",
            valor: tipo,
            icone: <Clapperboard className="size-4" />,
            opcoes: (Object.keys(TIPOS_POST) as TipoPost[]).map((k) => ({
              valor: k,
              rotulo: TIPOS_POST[k],
            })),
          },
        ]}
      />

      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        acoes={
          exportar ? (
            <BotaoExportar
              titulo="Redes sociais do período"
              filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
              nomeArquivo="redes-sociais-do-periodo"
              colunas={COLUNAS_EXPORTAR_REDES}
              linhas={linhasExportarRedes(linhas, t, posts)}
            />
          ) : undefined
        }
      />

      <Cartoes>
        <CartaoMkt
          titulo="Seguidores"
          valor={formatarNumero(t.seguidores)}
          variacao={variacaoContra(
            t.seguidores,
            ta.seguidores,
            f.rotuloAnterior,
          )}
          detalhe={
            rede
              ? `${REDES[rede].rotulo}, no fim do período`
              : "Soma das 4 redes, no fim do período"
          }
          fonte="Foto diária de cada rede"
        />
        <CartaoMkt
          titulo="Novos seguidores no período"
          valor={formatarNumero(t.novos)}
          variacao={variacaoContra(t.novos, ta.novos, f.rotuloAnterior)}
          detalhe={
            parcial
              ? "Alguma rede começou a contar no meio do período"
              : undefined
          }
          calculo="Seguidores no fim menos no início do período. YouTube: inscritos ganhos menos perdidos."
          fonte="Foto diária; YouTube Analytics"
        />
        <CartaoMkt
          titulo="Alcance e visualizações"
          valor={formatarNumero(t.alcanceEVisualizacoes)}
          variacao={variacaoContra(
            t.alcanceEVisualizacoes,
            ta.alcanceEVisualizacoes,
            f.rotuloAnterior,
          )}
          detalhe="Instagram pelo alcance; YouTube e TikTok pelas visualizações; Facebook sem dado"
          calculo="Instagram: reach (soma dos dias). YouTube: views. TikTok: video_views. O Facebook não entra: a Meta não entrega mais esse número da página."
          fonte="Instagram, YouTube e TikTok"
        />
        <CartaoMkt
          titulo="Interações"
          valor={formatarNumero(t.interacoes)}
          variacao={variacaoContra(
            t.interacoes,
            ta.interacoes,
            f.rotuloAnterior,
          )}
          detalhe={`Taxa de interação ${formatarPct(t.taxa)}`}
          calculo="Instagram: total_interactions. YouTube: curtidas + comentários dos vídeos publicados no período. TikTok: likes + comments + shares. Taxa: interações ÷ alcance ou visualizações."
          fonte="Instagram, YouTube e TikTok"
        />
      </Cartoes>

      <Secao titulo="Por rede" descricao={`${f.rotulo} · uma linha por rede`}>
        <TabelaMkt
          colunas={COLUNAS_REDE}
          semBusca
          linhas={linhas.map((l) => ({
            chave: l.rede,
            busca: l.rotulo,
            celulas: celulasDaRede(l),
            ordem: [
              l.rotulo,
              l.seguidores,
              l.novos,
              l.alcance,
              l.visualizacoes,
              l.interacoes,
              l.taxa,
            ],
          }))}
          rodape={[
            "Total",
            formatarNumero(t.seguidores),
            formatarNumero(t.novos),
            "",
            "",
            formatarNumero(t.interacoes),
            formatarPct(t.taxa),
          ]}
        />
        <Fonte>
          {FONTE}. Seguidores: Instagram e Facebook followers_count, YouTube
          subscriberCount, TikTok followers_count, no fim do período. Alcance do
          Instagram somado dia a dia (a mesma pessoa em dias diferentes conta de
          novo). Facebook: alcance e interações em branco, a Meta não entrega
          mais esses números da página.
          {parcial &&
            " Novos com *: o histórico começou no meio do período e conta desde a primeira foto."}
        </Fonte>
      </Secao>

      <Secao
        titulo="Posts do período"
        descricao={`${f.rotulo} · do que mais engajou para o que menos (curtidas + comentários + compartilhamentos + salvos).`}
      >
        {posts.length > 0 && (
          <ol className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {posts.slice(0, 3).map((p, i) => (
              <MelhorPost key={p.id} post={p} posicao={i + 1} />
            ))}
          </ol>
        )}
        <TabelaMkt
          colunas={COLUNAS_POST}
          ordemInicial={{ coluna: 11, desc: true }}
          placeholder="Buscar post…"
          vazio="Nenhum post nesse filtro."
          alturaMax="max-h-[36rem]"
          linhas={posts.map((p) => ({
            chave: p.id,
            busca: `${p.texto} ${REDES[p.rede].rotulo} ${TIPOS_POST[p.tipo]}`,
            celulas: celulasDoPost(p),
            ordem: [
              p.data,
              REDES[p.rede].rotulo,
              TIPOS_POST[p.tipo],
              p.texto,
              null,
              p.alcance,
              p.visualizacoes,
              p.curtidas,
              p.comentarios,
              p.compartilhamentos,
              p.salvos,
              p.interacoes,
            ],
          }))}
        />
        <Fonte>
          {FONTE}. Data: timestamp, publishedAt ou create_time. Alcance e salvos
          só no Instagram; YouTube e TikTok não entregam compartilhamentos por
          vídeo, e o TikTok não entrega comentários por vídeo nos campos usados
          (célula vazia, não zero).
        </Fonte>
      </Secao>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Secao
          titulo="Seguidores por rede"
          descricao="Últimas 12 semanas, no fim de cada semana. Cada rede na sua escala."
        >
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {historico.map((h) => {
              const primeiro = h.itens[0];
              const ultimo = h.itens.at(-1);
              const ganho =
                primeiro && ultimo ? ultimo.valor - primeiro.valor : null;
              return (
                <li key={h.rede} className="flex flex-col gap-1">
                  <p className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{REDES[h.rede].rotulo}</span>
                    <span className="tabular-nums text-neutral-600">
                      {ultimo ? formatarNumero(ultimo.valor) : "—"}
                    </span>
                  </p>
                  {h.itens.length >= 2 ? (
                    <MiniArea
                      itens={h.itens}
                      descricao={`Seguidores do ${REDES[h.rede].rotulo} por semana`}
                    />
                  ) : (
                    <p className="py-3 text-xs text-neutral-500">
                      Histórico ainda curto.
                    </p>
                  )}
                  {ganho !== null && h.itens.length >= 2 && (
                    <p className="text-xs text-neutral-500">
                      {ganho >= 0 ? "+" : ""}
                      {formatarNumero(ganho)} desde {primeiro?.rotulo}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <Fonte>
            Foto diária de cada rede. Como as APIs só dão o número de hoje, o
            histórico começa a contar no dia em que a ligação for feita (o
            sistema guarda uma foto por dia).
          </Fonte>
        </Secao>
        <Secao
          titulo="O que engaja no Instagram"
          descricao={`${f.rotulo} · interações ÷ alcance por tipo de conteúdo`}
        >
          <BarrasHorizontais
            descricao="Taxa de interação por tipo de post do Instagram"
            vazio="Nenhum post do Instagram nesse filtro."
            itens={porTipo.map((x) => ({
              chave: x.tipo,
              rotulo: TIPOS_POST[x.tipo],
              valor: x.taxa,
              texto: formatarPct(x.taxa),
              detalhe: `${x.posts} ${x.posts === 1 ? "post" : "posts"} · alcance ${formatarNumero(x.alcance)}`,
            }))}
          />
          <Fonte>
            Instagram (like_count, comments_count, shares, saved e reach de cada
            post). Só o Instagram entrega alcance por post.
          </Fonte>
        </Secao>
      </div>

      {comInstagram && (
        <Secao titulo={DEMOGRAFIA.titulo} descricao={DEMOGRAFIA.aviso}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-neutral-700">
                10 cidades com mais seguidores
              </h3>
              <BarrasHorizontais
                descricao="Seguidores do Instagram por cidade"
                vazio="Sem dados de cidade."
                itens={demografia.cidades.map((c) => ({
                  chave: c.nome,
                  rotulo: c.nome,
                  valor: c.seguidores,
                  texto: `${formatarNumero(c.seguidores)} seguidores`,
                }))}
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-neutral-700">
                Faixas de idade dos seguidores
              </h3>
              <BarrasHorizontais
                descricao="Seguidores do Instagram por faixa de idade"
                vazio="Sem dados de idade."
                itens={demografia.idades.map((c) => ({
                  chave: c.faixa,
                  rotulo: c.faixa,
                  valor: c.seguidores,
                  texto: `${formatarNumero(c.seguidores)} seguidores`,
                }))}
              />
            </div>
          </div>
          <Fonte>
            Instagram (follower_demographics, breakdown city e age). Retrato de
            hoje da base de seguidores, não do período.
          </Fonte>
        </Secao>
      )}
    </div>
  );
}

function Branco({ dica }: { dica: string }) {
  return (
    <span title={dica} className="text-neutral-300">
      —
    </span>
  );
}

function numeroOuBranco(v: number | null, dica: string): React.ReactNode {
  return v === null ? <Branco dica={dica} /> : formatarNumero(v);
}

function celulasDaRede(l: RedeLinha): React.ReactNode[] {
  const fb = l.rede === "facebook";
  const semDado = fb ? SEM_FACEBOOK : "Não se aplica a esta rede";
  return [
    <span key="r" className="whitespace-nowrap font-medium">
      <span
        className="mr-1.5 inline-block size-2 rounded-full align-middle"
        style={{ backgroundColor: `var(--serie-${REDES[l.rede].cor})` }}
        aria-hidden
      />
      {l.rotulo}
    </span>,
    numeroOuBranco(l.seguidores, "Sem foto de seguidores ainda"),
    l.novos === null ? (
      <Branco key="n" dica="Sem foto de seguidores ainda" />
    ) : (
      <span key="n" className={l.novos < 0 ? "text-red-700" : undefined}>
        {l.novos > 0 ? "+" : ""}
        {formatarNumero(l.novos)}
        {l.parcial && "*"}
      </span>
    ),
    numeroOuBranco(l.alcance, semDado),
    numeroOuBranco(l.visualizacoes, semDado),
    numeroOuBranco(l.interacoes, semDado),
    l.taxa === null ? <Branco key="t" dica={semDado} /> : formatarPct(l.taxa),
  ];
}

function celulasDoPost(p: PostLinha): React.ReactNode[] {
  const vazio = <Branco dica="Não entregue por esta rede" />;
  return [
    <span key="d" className="whitespace-nowrap tabular-nums">
      {formatarData(p.data)}
    </span>,
    REDES[p.rede].rotulo,
    TIPOS_POST[p.tipo],
    <span key="t" className="line-clamp-2">
      {p.texto}
    </span>,
    <AbrirNaFerramenta
      key="l"
      href={p.link}
      ferramenta={REDES[p.rede].ferramenta}
      compacto
    />,
    p.alcance === null ? vazio : formatarNumero(p.alcance),
    p.visualizacoes === null ? vazio : formatarNumero(p.visualizacoes),
    formatarNumero(p.curtidas),
    p.comentarios === null ? vazio : formatarNumero(p.comentarios),
    p.compartilhamentos === null ? vazio : formatarNumero(p.compartilhamentos),
    p.salvos === null ? vazio : formatarNumero(p.salvos),
    <span key="i" className="font-semibold">
      {formatarNumero(p.interacoes)}
    </span>,
  ];
}

function MelhorPost({ post, posicao }: { post: PostLinha; posicao: number }) {
  const numeros = [
    ["Interações", post.interacoes],
    [
      post.alcance !== null ? "Alcance" : "Visualizações",
      post.alcance ?? post.visualizacoes,
    ],
    ["Curtidas", post.curtidas],
  ] as const;
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-neutral-900/[0.06] bg-white/60 p-4">
      <p className="flex items-center justify-between gap-2 text-xs text-neutral-500">
        <span>
          {posicao}º · {REDES[post.rede].rotulo} · {TIPOS_POST[post.tipo]} ·{" "}
          {formatarData(post.data)}
        </span>
        <AbrirNaFerramenta
          href={post.link}
          ferramenta={REDES[post.rede].ferramenta}
          compacto
        />
      </p>
      <p className="line-clamp-2 text-sm font-medium">{post.texto}</p>
      <dl className="mt-auto grid grid-cols-3 gap-2">
        {numeros.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="text-[11px] text-neutral-500">{rotulo}</dt>
            <dd className="text-base font-semibold tabular-nums">
              {valor === null ? "—" : formatarNumero(valor)}
            </dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

const COLUNAS_REDE = [
  { titulo: "Rede" },
  { titulo: "Seguidores", numero: true },
  { titulo: "Novos no período", numero: true },
  { titulo: "Alcance", numero: true, dica: "Só o Instagram entrega alcance" },
  { titulo: "Visualizações", numero: true },
  { titulo: "Interações", numero: true },
  {
    titulo: "Taxa de interação",
    numero: true,
    dica: "Interações ÷ alcance (Instagram) ou visualizações (YouTube e TikTok)",
  },
];

const COLUNAS_POST = [
  { titulo: "Data" },
  { titulo: "Rede" },
  { titulo: "Tipo" },
  { titulo: "Post", classe: "min-w-56 max-w-72 whitespace-normal" },
  { titulo: "Link" },
  { titulo: "Alcance", numero: true, dica: "Só o Instagram" },
  { titulo: "Visualizações", numero: true },
  { titulo: "Curtidas", numero: true },
  { titulo: "Comentários", numero: true },
  { titulo: "Compartilhamentos", numero: true },
  { titulo: "Salvos", numero: true, dica: "Só o Instagram" },
  { titulo: "Interações", numero: true },
];

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-4"
        quantidade={4}
      />
      <CartaoCarregando altura="h-64" />
      <CartaoCarregando altura="h-96" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CartaoCarregando altura="h-80" />
        <CartaoCarregando altura="h-80" />
      </div>
    </TelaCarregando>
  );
}
