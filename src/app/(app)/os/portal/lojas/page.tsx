import { ChevronRight, Info, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BotaoLink, Situacao } from "@/components/admin/ui";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/os/exportar";
import { hrefDaPagina, Paginacao } from "@/components/os/paginacao";
import { ListaBusca } from "@/components/os/portal/lista-busca";
import { SeloExemplo } from "@/components/os/selos";
import { SemAcesso } from "@/components/protegido";
import { formatarData } from "@/lib/formato";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import { paginaDaUrl, totalDePaginas } from "@/lib/os/paginacao";
import { lerFiltroLojas, SITUACOES_LOJA } from "@/lib/os/portal-lista";
import { contexto } from "@/server/os/base";
import { type Loja, lojasDoFiltro, paginaDeLojas } from "@/server/os/lojas";

export const metadata: Metadata = { title: "Lojas · Portal e agenda" };

const CAMINHO = "/os/portal/lojas";

export default function Page({ searchParams }: PageProps<"/os/portal/lojas">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-16" />
          <CartaoCarregando altura="h-[32rem]" />
        </TelaCarregando>
      }
    >
      <Lojas searchParams={searchParams} />
    </Suspense>
  );
}

const COLUNAS_EXPORTAR: ColunaExportar[] = [
  { titulo: "LUC" },
  { titulo: "Loja" },
  { titulo: "Locatário" },
  { titulo: "Bloco" },
  { titulo: "Situação" },
  { titulo: "Início" },
  { titulo: "Fim" },
  { titulo: "Telefone" },
  { titulo: "Vaga" },
];

/** Exportar: o filtro inteiro, lido só no clique (não só a página). */
async function exportarLojas(
  busca: Record<string, string>,
): Promise<{ colunas: ColunaExportar[]; linhas: CelulaExportar[][] }> {
  "use server";
  const ctx = await contexto();
  if (!ctx.pode("os.portal") || !ctx.pode("os.exportar"))
    throw new Error("Sem permissão para exportar.");
  const { s, q } = lerFiltroLojas(busca);
  const lista = await lojasDoFiltro(s, q);
  return {
    colunas: COLUNAS_EXPORTAR,
    linhas: lista.map((l) => [
      l.luc,
      l.nome,
      l.locatario,
      l.bloco,
      l.situacao === "vigente" ? "Vigente" : "Encerrado",
      l.inicio ? formatarData(l.inicio) : null,
      l.fim ? formatarData(l.fim) : null,
      l.telefone,
      l.tem_vaga === null ? null : l.tem_vaga ? "Sim" : "Não",
    ]),
  };
}

async function Lojas({
  searchParams,
}: Pick<PageProps<"/os/portal/lojas">, "searchParams">) {
  const ctx = await contexto();
  if (!ctx.pode("os.portal")) return <SemAcesso />;
  const sp = await searchParams;
  const { s, q } = lerFiltroLojas(sp);
  const pagina = paginaDaUrl(sp.pagina);
  // Só a página mostrada vem do banco, com a busca.
  const { lojas: lista, total } = await paginaDeLojas(s, q, pagina);
  const ultima = totalDePaginas(total);
  if (pagina > ultima) redirect(hrefDaPagina(CAMINHO, sp, ultima));
  const periodo = (l: Loja) =>
    l.inicio || l.fim
      ? `${formatarData(l.inicio)} a ${l.fim ? formatarData(l.fim) : "—"}`
      : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="vidro flex gap-3 rounded-[1.5rem] px-5 py-4 text-sm text-neutral-600">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        Até a integração com o ENET, as lojas são cadastradas aqui. Quando a API
        chegar, os contratos virão do ENET e esta lista fica só para consulta.
      </p>
      {sp.salva && (
        <output className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
          Loja cadastrada.
        </output>
      )}

      <Secao
        titulo="Lojas (contratos)"
        descricao="Um contrato por linha: o histórico fica no contrato, não na LUC."
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Situação" className="flex flex-wrap gap-1">
            {Object.entries(SITUACOES_LOJA).map(([valor, rotulo]) => (
              <Link
                key={valor}
                href={hrefDaPagina(CAMINHO, { s: valor, q: q || undefined }, 1)}
                aria-current={valor === s ? "page" : undefined}
                className="rounded-full px-3 py-1.5 text-sm text-neutral-600 transition hover:bg-white/70 aria-[current=page]:bg-neutral-900 aria-[current=page]:text-white"
              >
                {rotulo}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            {ctx.pode("os.exportar") && (
              <BotaoExportar
                titulo="Lojas"
                filtros={[SITUACOES_LOJA[s], q && `Busca: ${q}`]
                  .filter(Boolean)
                  .join(" · ")}
                nomeArquivo="lojas"
                total={total}
                carregar={exportarLojas.bind(null, q ? { s, q } : { s })}
              />
            )}
            <BotaoLink href="/os/portal/lojas/nova">
              <span className="grid size-6 place-items-center rounded-full bg-white/20">
                <Plus className="size-4" aria-hidden />
              </span>
              Nova loja
            </BotaoLink>
          </div>
        </div>
        <ListaBusca
          busca={q}
          placeholder="Buscar pela LUC, loja, locatário ou bloco…"
          vazio="Nenhuma loja aqui ainda."
          paginacao={
            <Paginacao
              pagina={pagina}
              total={total}
              href={(p) => hrefDaPagina(CAMINHO, sp, p)}
            />
          }
          itens={lista.map((l) => ({
            chave: l.id,
            conteudo: (
              <Link
                href={`/os/portal/lojas/${l.id}`}
                className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-1 transition hover:bg-white/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-neutral-900/[0.06] px-1.5 py-0.5 text-xs font-medium text-neutral-600 tabular-nums">
                      {l.luc}
                    </span>
                    <span className="font-medium">{l.nome}</span>
                    {l.situacao === "vigente" ? (
                      <Situacao tipo="ok">Vigente</Situacao>
                    ) : (
                      <Situacao tipo="neutro">Encerrado</Situacao>
                    )}
                    {l.enet_id && (
                      <span className="text-xs text-neutral-500">ENET</span>
                    )}
                    {l.exemplo && <SeloExemplo />}
                  </span>
                  <span className="mt-1 block text-xs text-neutral-500">
                    {[
                      l.locatario,
                      l.bloco ? `Bloco ${l.bloco}` : null,
                      periodo(l),
                      l.telefone,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sem dados do contrato"}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-neutral-400"
                  aria-hidden
                />
              </Link>
            ),
          }))}
        />
      </Secao>
    </div>
  );
}
