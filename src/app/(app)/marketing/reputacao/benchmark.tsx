import { ExternalLink, Heart, MessageCircle } from "lucide-react";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { Fonte, TopoDaTela } from "@/components/dashboard/tela";
import { formatarData, formatarNumero } from "@/lib/formato";
import {
  type ContaPublica,
  type LinhaBenchmark,
  linhaBenchmark,
  linkAnunciosGoogle,
  linkAnunciosMeta,
} from "@/lib/marketing/benchmark";
import { linhaDeFiltros } from "@/lib/marketing/periodo";
import { type ContaLida, dadosBenchmark } from "@/server/marketing/benchmark";
import type { FiltrosLidos } from "@/server/marketing/filtros";

// Aba Benchmark da Reputação: a ARP lado a lado com as referências de
// Configurações › Benchmark e marca. Sem alcance das outras contas (não vem),
// sem os anúncios delas dentro do sistema (só o botão que abre a biblioteca)
// e sem análise da IA (fica nas conversas com o Copiloto).

interface Linha {
  chave: string;
  nome: string;
  cidade: string | null;
  usuario: string | null;
  site: string | null;
  arp: boolean;
  leitura: ContaLida | null;
}

const botao =
  "inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 transition hover:border-neutral-400";

export async function AbaBenchmark({ f }: { f: FiltrosLidos }) {
  const dados = await dadosBenchmark();
  if (!dados) return null;
  const { periodo, ctx } = f;

  const linhas: Linha[] = [
    {
      chave: "arp",
      nome: "Espaço ARP",
      cidade: null,
      usuario: dados.arp?.ok ? dados.arp.conta.username : null,
      site: null,
      arp: true,
      leitura: dados.arp,
    },
    ...dados.referencias.map(({ referencia: r, leitura }) => ({
      chave: r.id,
      nome: r.nome,
      cidade: r.cidade,
      usuario: r.instagram,
      site: r.site,
      arp: false,
      leitura,
    })),
  ];
  const calc = new Map<string, { conta: ContaPublica; l: LinhaBenchmark }>();
  for (const x of linhas)
    if (x.leitura?.ok)
      calc.set(x.chave, {
        conta: x.leitura.conta,
        l: linhaBenchmark(x.leitura.conta, periodo),
      });

  return (
    <>
      <BarraDeFiltros
        modulo="marketing"
        tela="reputacao_benchmark"
        periodo={periodo}
        hoje={ctx.hoje}
        lembrado={f.lembrado}
      />
      <TopoDaTela
        filtros={linhaDeFiltros([{ rotulo: "Período", valor: f.rotulo }])}
        reais={calc.size ? "Instagram (Meta)" : undefined}
        aviso={dados.aviso}
      />

      <Secao
        titulo="Benchmark"
        descricao="Seguidores e posts do período de cada conta, lado a lado com a ARP. As referências se cadastram em Configurações › Benchmark e marca."
        calculo="Seguidores: total de hoje. Posts no período: os publicados entre as datas do filtro, dos 50 mais recentes de cada conta. Interações por post: (curtidas + comentários) ÷ posts do período. Alcance das outras contas não é público e não aparece."
      >
        <TabelaLista
          semBusca
          caber
          vazio="Nenhuma referência cadastrada. Inclua em Configurações › Benchmark e marca."
          colunas={[
            { titulo: "Conta" },
            { titulo: "Seguidores", numero: true },
            { titulo: "Posts no período", numero: true },
            { titulo: "Curtidas", numero: true },
            { titulo: "Comentários", numero: true },
            { titulo: "Interações por post", numero: true },
            { titulo: "Anúncios" },
          ]}
          linhas={linhas.map((x) => {
            const c = calc.get(x.chave);
            const aviso =
              x.leitura && !x.leitura.ok
                ? x.leitura.aviso
                : !x.usuario
                  ? "Sem Instagram cadastrado"
                  : null;
            const google = linkAnunciosGoogle(x.site);
            return {
              chave: x.chave,
              busca: x.nome,
              ordem: [
                x.nome,
                c?.conta.followers_count ?? null,
                c?.l.postsNoPeriodo ?? null,
                c?.l.curtidas ?? null,
                c?.l.comentarios ?? null,
                c?.l.interacoesPorPost ?? null,
                "",
              ],
              celulas: [
                <span key="n" className="flex flex-col">
                  <span className={x.arp ? "font-semibold" : "font-medium"}>
                    {x.nome}
                    {x.cidade && (
                      <span className="ml-1.5 text-xs font-normal text-neutral-500">
                        {x.cidade}
                      </span>
                    )}
                  </span>
                  {x.usuario && (
                    <a
                      href={`https://www.instagram.com/${x.usuario}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-neutral-500 hover:underline"
                    >
                      @{x.usuario}
                    </a>
                  )}
                  {aviso && (
                    <span className="text-xs text-amber-800">{aviso}</span>
                  )}
                </span>,
                c ? formatarNumero(c.conta.followers_count) : "—",
                c
                  ? `${formatarNumero(c.l.postsNoPeriodo)}${c.l.postsNoMinimo ? "+" : ""}`
                  : "—",
                c ? formatarNumero(c.l.curtidas) : "—",
                c ? formatarNumero(c.l.comentarios) : "—",
                c?.l.interacoesPorPost != null
                  ? formatarNumero(c.l.interacoesPorPost, 1)
                  : "—",
                x.arp ? (
                  ""
                ) : (
                  <span key="a" className="flex flex-wrap gap-1.5">
                    <a
                      href={linkAnunciosMeta(x.nome)}
                      target="_blank"
                      rel="noreferrer"
                      className={botao}
                      title="Abre a Biblioteca de Anúncios da Meta em outra aba"
                    >
                      Ver anúncios Meta
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                    {google && (
                      <a
                        href={google}
                        target="_blank"
                        rel="noreferrer"
                        className={botao}
                        title="Abre a Central de Transparência de Anúncios do Google em outra aba"
                      >
                        Google
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    )}
                  </span>
                ),
              ],
            };
          })}
        />
        <Fonte>
          Instagram (business discovery da Meta), relido a cada hora. Só contas
          comerciais ou de criador entregam os números.
        </Fonte>
      </Secao>

      <Secao
        titulo="Posts com mais curtidas e comentários"
        descricao="Os 3 posts de cada conta com mais curtidas + comentários no período. Clique para abrir no Instagram."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {linhas.map((x) => {
            const c = calc.get(x.chave);
            return (
              <div
                key={x.chave}
                className="flex flex-col gap-2 rounded-2xl border border-neutral-900/10 bg-white/50 p-4"
              >
                <p className="text-sm font-semibold">{x.nome}</p>
                {!c?.l.melhores.length && (
                  <p className="text-xs text-neutral-500">
                    Sem post no período.
                  </p>
                )}
                <ol className="flex flex-col gap-2">
                  {c?.l.melhores.map((m) => (
                    <li key={m.id}>
                      <a
                        href={m.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex flex-col gap-0.5 rounded-xl px-2 py-1.5 transition hover:bg-neutral-900/[0.04]"
                      >
                        <span className="line-clamp-2 text-xs text-neutral-700">
                          {m.caption || "(sem legenda)"}
                        </span>
                        <span className="flex items-center gap-3 text-[11px] text-neutral-500">
                          <span>{formatarData(m.timestamp.slice(0, 10))}</span>
                          <span className="inline-flex items-center gap-1">
                            <Heart className="size-3" aria-hidden />
                            {formatarNumero(m.like_count)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="size-3" aria-hidden />
                            {formatarNumero(m.comments_count)}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
        <Fonte>Instagram (business discovery da Meta)</Fonte>
      </Secao>
    </>
  );
}
