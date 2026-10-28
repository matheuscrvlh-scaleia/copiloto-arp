import { Star } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Situacao } from "@/components/admin/ui";
import {
  CartaoCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/os/exportar";
import { hrefDaPagina, Paginacao } from "@/components/os/paginacao";
import { AcoesDaLoja, CopiarLink } from "@/components/os/portal/acoes-link";
import { Atualizado, CartaoFiltro } from "@/components/os/portal/cartao-filtro";
import { ListaBusca } from "@/components/os/portal/lista-busca";
import { SeloExemplo } from "@/components/os/selos";
import { tonsDaTela } from "@/components/os/tons";
import { SemAcesso } from "@/components/protegido";
import { formatarNumero } from "@/lib/formato";
import { paginaDaUrl, totalDePaginas } from "@/lib/os/paginacao";
import { LIMITES_PORTAL } from "@/lib/os/portal";
import {
  FILTROS_PORTAL,
  type FiltroPortal,
  lerFiltroPortal,
} from "@/lib/os/portal-lista";
import { tempoAtras } from "@/lib/os/texto";
import { exportarLinks } from "@/server/os/acoes/portal";
import { contexto } from "@/server/os/base";
import {
  DIAS_DA_MEDIA,
  indicadoresDoPortal,
  type LinhaDoPortal,
  paginaDoPortal,
  urlDoPortal,
} from "@/server/os/portal";

const TONS = tonsDaTela("portal");

export const metadata: Metadata = { title: "Portal e agenda" };

const CAMINHO = "/os/portal";

export default function Page({ searchParams }: PageProps<"/os/portal">) {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Links searchParams={searchParams} />
    </Suspense>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}

async function Links({
  searchParams,
}: Pick<PageProps<"/os/portal">, "searchParams">) {
  const [ctx, sp] = await Promise.all([contexto(), searchParams]);
  if (!ctx.pode("os.portal")) {
    if (ctx.pode("os.portal_agenda")) redirect("/os/portal/agendas");
    return <SemAcesso />;
  }
  const { f, q } = lerFiltroPortal(sp);
  const pagina = paginaDaUrl(sp.pagina);
  const agora = new Date();
  // Só a página mostrada vem do banco; os cartões são contagens.
  const [r, { linhas, total }] = await Promise.all([
    indicadoresDoPortal(agora),
    paginaDoPortal(f, q, pagina, agora),
  ]);
  const ultima = totalDePaginas(total);
  if (pagina > ultima) redirect(hrefDaPagina(CAMINHO, sp, ultima));
  // O cartão troca o filtro e mantém a busca (volta à página 1).
  const alternar = (x: FiltroPortal) =>
    hrefDaPagina(CAMINHO, { q: q || undefined, f: f === x ? undefined : x }, 1);
  const url = urlDoPortal();
  const media = (m: number | null) => (m === null ? "—" : formatarNumero(m, 1));
  const busca: Record<string, string> = {};
  if (f) busca.f = f;
  if (q) busca.q = q;

  return (
    <div className="flex flex-col gap-6">
      <Atualizado agora={agora} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoFiltro
          tom={TONS[0]}
          href={alternar("entraram")}
          ativo={f === "entraram"}
          titulo="Lojas que já entraram"
          valor={formatarNumero(r.entraram)}
          detalhe={`de ${formatarNumero(r.vigentes)} lojas vigentes`}
        />
        <CartaoFiltro
          tom={TONS[1]}
          href={alternar("sem_cnpj")}
          ativo={f === "sem_cnpj"}
          titulo="Sem CNPJ"
          valor={formatarNumero(r.semCnpj)}
          detalhe={
            r.semCnpj
              ? "não conseguem entrar: cadastre o CNPJ em Lojas"
              : "todas podem entrar"
          }
        />
        <CartaoFiltro
          tom={TONS[2]}
          href={alternar("pedidos")}
          ativo={f === "pedidos"}
          titulo="Pedidos do portal no mês"
          valor={formatarNumero(r.pedidosNoMes)}
          detalhe="viraram chamados nos setores"
        />
        <CartaoFiltro
          tom={TONS[3]}
          href={alternar("avaliadas")}
          ativo={f === "avaliadas"}
          titulo="Avaliação média"
          valor={r.media === null ? "—" : `${media(r.media)} de 5`}
          detalhe={`${formatarNumero(r.avaliacoes)} avaliações nos últimos ${DIAS_DA_MEDIA} dias`}
        />
      </div>

      <Secao
        titulo={f ? `Lojas · ${FILTROS_PORTAL[f]}` : "Lojas vigentes"}
        descricao={`Um link só para todas as lojas: cada loja entra com o próprio CNPJ e fica dentro por até ${LIMITES_PORTAL.sessaoDias} dias. Encerrar o acesso tira a loja na hora.`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
          <span className="rounded-full bg-neutral-900/[0.04] px-3 py-1.5 text-xs text-neutral-700 select-all">
            {url}
          </span>
          <CopiarLink url={url} />
          {ctx.pode("os.exportar") && (
            <BotaoExportar
              titulo="Lojas no portal"
              filtros={[
                f ? FILTROS_PORTAL[f] : "Lojas vigentes",
                q && `Busca: ${q}`,
              ]
                .filter(Boolean)
                .join(" · ")}
              nomeArquivo="lojas-no-portal"
              total={total}
              carregar={exportarLinks.bind(null, busca)}
            />
          )}
        </div>
        <ListaBusca
          busca={q}
          placeholder="Buscar pela LUC, nome ou bloco…"
          vazio={
            r.vigentes
              ? "Nenhuma loja neste filtro."
              : "Nenhuma loja vigente. Cadastre as lojas na aba Lojas (contratos)."
          }
          itens={linhas.map((l) => ({
            chave: l.loja.id,
            conteudo: <LinhaDaLoja l={l} agora={agora} />,
          }))}
          paginacao={
            <Paginacao
              pagina={pagina}
              total={total}
              href={(p) => hrefDaPagina(CAMINHO, sp, p)}
            />
          }
        />
      </Secao>
    </div>
  );
}

function LinhaDaLoja({ l, agora }: { l: LinhaDoPortal; agora: Date }) {
  const detalhes = [
    l.acesso.ultimo
      ? `Último acesso ${tempoAtras(l.acesso.ultimo, agora)}`
      : "Nunca entrou",
    l.pedidosNoMes
      ? `${l.pedidosNoMes} pedido${l.pedidosNoMes === 1 ? "" : "s"} no mês`
      : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-neutral-900/[0.06] px-1.5 py-0.5 text-xs font-medium text-neutral-600 tabular-nums">
            {l.loja.luc}
          </span>
          <span className="font-medium">{l.loja.nome}</span>
          {l.loja.bloco && (
            <span className="text-xs text-neutral-500">
              Bloco {l.loja.bloco}
            </span>
          )}
          {!l.loja.cnpj ? (
            <Situacao tipo="neutro">Sem CNPJ</Situacao>
          ) : (
            l.acesso.dentro && <Situacao tipo="ok">Dentro do portal</Situacao>
          )}
          {l.loja.exemplo && <SeloExemplo />}
        </p>
        {(detalhes.length > 0 || l.media !== null) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
            {detalhes.join(" · ")}
            {l.media !== null && (
              <span className="inline-flex items-center gap-1">
                <Star
                  className="size-3 fill-[#fab219] text-[#e09a00]"
                  aria-hidden
                />
                {formatarNumero(l.media, 1)} ({l.avaliacoes})
              </span>
            )}
          </p>
        )}
      </div>
      <AcoesDaLoja
        lojaId={l.loja.id}
        loja={l.loja.nome}
        whatsapp={l.whatsapp}
        temTelefone={!!l.loja.telefone}
        dentro={l.acesso.dentro}
      />
    </div>
  );
}
