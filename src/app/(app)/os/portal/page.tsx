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
import { FormAcao } from "@/components/form-acao";
import { BotaoExportar } from "@/components/os/exportar";
import { AcoesDoLink } from "@/components/os/portal/acoes-link";
import { Atualizado, CartaoFiltro } from "@/components/os/portal/cartao-filtro";
import { ListaBusca } from "@/components/os/portal/lista-busca";
import { SeloExemplo } from "@/components/os/selos";
import { SemAcesso } from "@/components/protegido";
import { formatarData, formatarNumero } from "@/lib/formato";
import { paraBrasilia } from "@/lib/os/tempo";
import { tempoAtras } from "@/lib/os/texto";
import { contexto } from "@/server/os/base";
import {
  DIAS_DA_MEDIA,
  type LinhaDoPortal,
  resumoDoPortal,
} from "@/server/os/portal";
import { gerarLinksEmLote } from "./actions";

export const metadata: Metadata = { title: "Portal e agenda" };

const FILTROS = {
  com_link: "Com link",
  sem_link: "Sem link",
  pedidos: "Com pedidos no mês",
  avaliadas: "Avaliadas",
} as const;
type Filtro = keyof typeof FILTROS;

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

const dia = (iso: string | null) =>
  iso ? formatarData(paraBrasilia(new Date(iso)).data) : null;

function passa(l: LinhaDoPortal, f: Filtro | null): boolean {
  switch (f) {
    case "com_link":
      return !!l.link;
    case "sem_link":
      return !l.link;
    case "pedidos":
      return l.pedidosNoMes > 0;
    case "avaliadas":
      return l.avaliacoes > 0;
    default:
      return true;
  }
}

async function Links({
  searchParams,
}: Pick<PageProps<"/os/portal">, "searchParams">) {
  const ctx = await contexto();
  if (!ctx.pode("os.portal")) {
    if (ctx.pode("os.portal_agenda")) redirect("/os/portal/agendas");
    return <SemAcesso />;
  }
  const sp = await searchParams;
  const f = (
    typeof sp.f === "string" && sp.f in FILTROS ? sp.f : null
  ) as Filtro | null;
  const agora = new Date();
  const r = await resumoDoPortal(agora);
  const linhas = r.linhas.filter((l) => passa(l, f));
  const alternar = (x: Filtro) =>
    f === x ? "/os/portal" : `/os/portal?f=${x}`;
  const media = (m: number | null) => (m === null ? "—" : formatarNumero(m, 1));

  return (
    <div className="flex flex-col gap-6">
      <Atualizado agora={agora} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoFiltro
          href={alternar("com_link")}
          ativo={f === "com_link"}
          titulo="Lojas com link"
          valor={formatarNumero(r.comLink)}
          detalhe={`de ${formatarNumero(r.linhas.length)} lojas vigentes`}
          tom="verde"
        />
        <CartaoFiltro
          href={alternar("sem_link")}
          ativo={f === "sem_link"}
          titulo="Sem link"
          valor={formatarNumero(r.semLink)}
          detalhe={
            r.semLink ? "ainda não podem usar o portal" : "todas têm link"
          }
        />
        <CartaoFiltro
          href={alternar("pedidos")}
          ativo={f === "pedidos"}
          titulo="Pedidos do portal no mês"
          valor={formatarNumero(r.pedidosNoMes)}
          detalhe="viraram chamados nos setores"
        />
        <CartaoFiltro
          href={alternar("avaliadas")}
          ativo={f === "avaliadas"}
          titulo="Avaliação média"
          valor={r.media === null ? "—" : `${media(r.media)} de 5`}
          detalhe={`${formatarNumero(r.avaliacoes)} avaliações nos últimos ${DIAS_DA_MEDIA} dias`}
        />
      </div>

      <Secao
        titulo={f ? `Lojas · ${FILTROS[f]}` : "Lojas vigentes"}
        descricao="Cada loja tem um link permanente. Se vazar ou o contrato terminar, cancele: o link para de funcionar na hora."
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {r.semLink > 0 && (
            <FormAcao
              acao={gerarLinksEmLote}
              rotulo={`Gerar link das ${r.semLink} lojas sem link`}
              rotuloEnviando="Gerando…"
              confirmar={`Gerar o link de ${r.semLink} lojas vigentes? Depois envie a cada uma pelo WhatsApp.`}
            />
          )}
          {ctx.pode("os.exportar") && (
            <BotaoExportar
              titulo="Links do portal"
              filtros={f ? FILTROS[f] : "Lojas vigentes"}
              nomeArquivo="links-do-portal"
              colunas={[
                { titulo: "LUC" },
                { titulo: "Loja" },
                { titulo: "Bloco" },
                { titulo: "Link" },
                { titulo: "Enviado em" },
                { titulo: "Último acesso" },
                { titulo: "Pedidos no mês", numero: true },
                { titulo: "Avaliação", numero: true },
              ]}
              linhas={linhas.map((l) => [
                l.loja.luc,
                l.loja.nome,
                l.loja.bloco,
                l.link ? "Ativo" : "Sem link",
                dia(l.link?.enviado_em ?? null),
                dia(l.link?.ultimo_acesso_em ?? null),
                l.pedidosNoMes,
                l.media,
              ])}
            />
          )}
        </div>
        <ListaBusca
          placeholder="Buscar pela LUC, nome ou bloco…"
          vazio={
            r.linhas.length
              ? "Nenhuma loja neste filtro."
              : "Nenhuma loja vigente. Cadastre as lojas na aba Lojas (contratos)."
          }
          itens={linhas.map((l) => ({
            chave: l.loja.id,
            busca: `${l.loja.luc} ${l.loja.nome} ${l.loja.bloco ?? ""}`,
            conteudo: <LinhaDaLoja l={l} agora={agora} />,
          }))}
        />
      </Secao>
    </div>
  );
}

function LinhaDaLoja({ l, agora }: { l: LinhaDoPortal; agora: Date }) {
  const detalhes = [
    l.link?.enviado_em ? `Enviado em ${dia(l.link.enviado_em)}` : null,
    l.link && !l.link.enviado_em ? "Ainda não enviado" : null,
    l.link?.ultimo_acesso_em
      ? `Último acesso ${tempoAtras(l.link.ultimo_acesso_em, agora)}`
      : l.link
        ? "Nunca acessado"
        : null,
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
          {l.link ? (
            <Situacao tipo="ok">Link ativo</Situacao>
          ) : (
            <Situacao tipo="neutro">Sem link</Situacao>
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
      <AcoesDoLink
        lojaId={l.loja.id}
        loja={l.loja.nome}
        link={
          l.link
            ? {
                url: l.link.url,
                whatsapp: l.link.whatsapp,
                temTelefone: !!l.loja.telefone,
              }
            : null
        }
      />
    </div>
  );
}
