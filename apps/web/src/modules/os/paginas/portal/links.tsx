import { formatarNumero } from "@arp/shared/formato";
import type { LinhaDoPortal } from "@arp/shared/os/contratos/portal";
import { paginaDaUrl, totalDePaginas } from "@arp/shared/os/paginacao";
import { LIMITES_PORTAL } from "@arp/shared/os/portal";
import {
  FILTROS_PORTAL,
  type FiltroPortal,
  lerFiltroPortal,
} from "@arp/shared/os/portal-lista";
import { tempoAtras } from "@arp/shared/os/texto";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Suspense, useDeferredValue } from "react";
import {
  CartaoCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/exportar";
import { SemAcesso } from "@/components/protegido";
import { tonsDaTela } from "@/components/tons";
import { Redirecionar, useBusca } from "@/lib/navegacao";
import { usePermissao } from "@/lib/sessao";
import { Situacao } from "@/modules/admin/components/ui";
import { consultaDosLinks, exportarLinks } from "@/modules/os/api-portal";
import { hrefDaPagina, Paginacao } from "@/modules/os/components/paginacao";
import { AcoesDaLoja } from "@/modules/os/components/portal/acoes-link";
import {
  Atualizado,
  CartaoFiltro,
} from "@/modules/os/components/portal/cartao-filtro";
import { ListaBusca } from "@/modules/os/components/portal/lista-busca";

const TONS = tonsDaTela("portal");

const CAMINHO = "/os/portal";

export default function Pagina() {
  const portal = usePermissao("os.portal");
  const agenda = usePermissao("os.portal_agenda");
  if (!portal) {
    if (agenda) return <Redirecionar para="/os/portal/agendas" />;
    return <SemAcesso />;
  }
  return (
    <Suspense fallback={<Esqueleto />}>
      <Links />
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

function Links() {
  const sp = useBusca();
  const podeExportar = usePermissao("os.exportar");
  const { f, q } = lerFiltroPortal(sp);
  const pagina = paginaDaUrl(sp.pagina);
  const busca: Record<string, string> = {};
  if (f) busca.f = f;
  if (q) busca.q = q;
  // Só a página mostrada vem do banco; os cartões são contagens. A lista
  // antiga fica na tela até a nova chegar.
  const chave = useDeferredValue(`${f ?? ""}|${pagina}|${q}`);
  const [filtro = "", numero = "1", ...texto] = chave.split("|");
  const { data } = useSuspenseQuery(
    consultaDosLinks({ f: filtro, q: texto.join("|"), pagina: numero }),
  );
  const { indicadores: r, linhas, total } = data;
  const agora = new Date(data.agora);
  const ultima = totalDePaginas(total);
  if (pagina > ultima)
    return <Redirecionar para={hrefDaPagina(CAMINHO, sp, ultima)} />;
  // O cartão troca o filtro e mantém a busca (volta à página 1).
  const alternar = (x: FiltroPortal) =>
    hrefDaPagina(CAMINHO, { q: q || undefined, f: f === x ? undefined : x }, 1);
  const media = (m: number | null) => (m === null ? "—" : formatarNumero(m, 1));

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
          titulo="Sem CPF ou CNPJ"
          valor={formatarNumero(r.semCnpj)}
          detalhe={
            r.semCnpj
              ? "não conseguem entrar: cadastre o CPF ou CNPJ em Lojas"
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
          detalhe={`${formatarNumero(r.avaliacoes)} avaliações nos últimos ${data.diasDaMedia} dias`}
        />
      </div>

      <Secao
        titulo={f ? `Lojas · ${FILTROS_PORTAL[f]}` : "Lojas vigentes"}
        descricao={`Um link só para todas as lojas: cada loja entra com o próprio CPF ou CNPJ e fica dentro por até ${LIMITES_PORTAL.sessaoDias} dias. Encerrar o acesso tira a loja na hora.`}
      >
        {podeExportar && (
          <div className="mb-4 flex justify-end">
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
              carregar={() => exportarLinks(busca)}
            />
          </div>
        )}
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
            <Situacao tipo="neutro">Sem CPF ou CNPJ</Situacao>
          ) : (
            l.acesso.dentro && <Situacao tipo="ok">Dentro do portal</Situacao>
          )}
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
