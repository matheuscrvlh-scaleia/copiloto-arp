import { formatarData, formatarNumero } from "@arp/shared/formato";
import type { VistoriaResumo } from "@arp/shared/os/contratos/vistorias";
import { paginaDaUrl } from "@arp/shared/os/paginacao";
import { ROTAS_OS, rotaVistoria } from "@arp/shared/os/rotas";
import {
  STATUS_VISTORIA,
  type StatusVistoria,
  TIPOS_VISTORIA,
  type TipoVistoria,
} from "@arp/shared/os/rotulos";
import { paraBrasilia } from "@arp/shared/os/tempo";
import {
  localDaUnidade,
  situacaoDaVistoria,
} from "@arp/shared/os/vistoria-regras";
import {
  CARTOES_VISTORIA as CARTOES,
  type CartaoVistoria as Cartao,
  lerFiltroVistorias,
} from "@arp/shared/os/vistorias-lista";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight, FileText, Plus } from "lucide-react";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { CartaoIndicador } from "@/components/dashboard/indicador";
import { type Coluna, Secao, Tabela } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { CLASSE_MARCADO, tonsDaTela } from "@/components/tons";
import { Link, Redirecionar, useBusca } from "@/lib/navegacao";
import { usePermissao } from "@/lib/sessao";
import {
  consultaDasVistorias,
  exportarVistorias,
  hrefDoLaudo,
} from "@/modules/os/api-vistorias";
import { hrefDaPagina, Paginacao } from "@/modules/os/components/paginacao";
import { FiltrosVistorias } from "@/modules/os/components/vistorias/filtros";
import {
  SeloSituacaoVistoria,
  SeloTipoVistoria,
} from "@/modules/os/components/vistorias/selos";

// /os/vistorias: cartões, filtros e a lista das vistorias de locação.

const TONS = tonsDaTela("vistorias");

type Busca = Record<string, string | string[] | undefined>;

export default function Pagina() {
  return (
    <>
      <PageHeader
        title="Vistorias"
        description="Laudos de entrada, saída, preventivos e extraordinários. A vistoria nasce do contrato, é feita no celular e a saída é comparada com a entrada."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="os.vistorias">
          <Conteudo />
        </Protegido>
      </Suspense>
    </>
  );
}

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/** Endereço com os filtros de agora, trocando alguns (volta à página 1). */
function link(sp: Busca, mudancas: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const valor = um(v);
    if (valor && k !== "pagina") p.set(k, valor);
  }
  for (const [k, v] of Object.entries(mudancas)) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const q = p.toString();
  return q ? `${ROTAS_OS.vistorias}?${q}` : ROTAS_OS.vistorias;
}

function Conteudo() {
  const sp = useBusca();
  const podeExportar = usePermissao("os.exportar");
  const agora = new Date();
  const f = lerFiltroVistorias(sp);
  const pagina = paginaDaUrl(sp.pagina);
  // Só a página mostrada vem do banco; os cartões são contagens.
  const { data } = useSuspenseQuery(consultaDasVistorias(sp));
  const { vistorias: lista, total, contagem } = data;
  if (data.pagina !== pagina)
    return (
      <Redirecionar para={hrefDaPagina(ROTAS_OS.vistorias, sp, data.pagina)} />
    );
  const vistoriadores = new Map(data.vistoriadores);
  const { blocos } = data;

  const detalhes: Record<Cartao, string> = {
    andamento: "sendo preenchidas",
    assinatura: "finalizadas sem as duas assinaturas",
    concluidas: "finalizadas e assinadas neste mês",
    com_os: "algum ambiente virou OS",
  };

  const descricaoFiltros = [
    f.cartao && CARTOES[f.cartao],
    f.q && `Busca: ${f.q}`,
    f.tipo && `Tipo: ${TIPOS_VISTORIA[f.tipo as TipoVistoria] ?? f.tipo}`,
    f.status &&
      `Status: ${STATUS_VISTORIA[f.status as StatusVistoria] ?? f.status}`,
    f.vistoriador && `Vistoriador: ${vistoriadores.get(f.vistoriador) ?? ""}`,
    f.bloco && `Bloco: ${f.bloco === "sem" ? "sem bloco" : f.bloco}`,
    (f.de || f.ate) &&
      `Período: ${f.de ? formatarData(f.de) : "início"} a ${f.ate ? formatarData(f.ate) : "hoje"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const busca: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp))
    if (typeof v === "string" && k !== "pagina") busca[k] = v;

  const colunas: Coluna<VistoriaResumo>[] = [
    {
      titulo: "Código",
      valor: (v) => (
        <span className="flex items-center gap-2">
          <Link
            href={rotaVistoria(v.id)}
            className="font-medium underline-offset-2 hover:underline"
          >
            {v.codigo}
          </Link>
        </span>
      ),
    },
    { titulo: "Tipo", valor: (v) => <SeloTipoVistoria tipo={v.tipo} /> },
    {
      titulo: "Locatário(a)",
      valor: (v) => (
        <span className="block max-w-64 truncate" title={v.locatario}>
          {v.locatario || "—"}
        </span>
      ),
    },
    {
      titulo: "Local",
      valor: (v) => localDaUnidade(v.bloco, v.unidade) || "—",
    },
    { titulo: "Data", valor: (v) => formatarData(v.data), numero: true },
    { titulo: "Vistoriador", valor: (v) => v.vistoriador_nome },
    {
      titulo: "Situação",
      valor: (v) => <SeloSituacaoVistoria situacao={situacaoDaVistoria(v)} />,
    },
    {
      titulo: "OS",
      valor: (v) => (v.ordens ? formatarNumero(v.ordens) : "—"),
      numero: true,
    },
    {
      titulo: "",
      valor: (v) => (
        <span className="flex justify-end gap-1">
          <a
            href={hrefDoLaudo(v.id)}
            target="_blank"
            rel="noopener"
            title="Abrir o laudo em PDF"
            className="grid size-7 place-items-center rounded-full text-neutral-400 transition hover:bg-white hover:text-neutral-900"
          >
            <FileText className="size-4" aria-hidden />
            <span className="sr-only">Laudo de {v.codigo} em PDF</span>
          </a>
          <Link
            href={rotaVistoria(v.id)}
            aria-label={`Abrir a vistoria ${v.codigo}`}
            className="grid size-7 place-items-center rounded-full text-neutral-400 transition hover:bg-white hover:text-neutral-900"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">
          Atualizado às {paraBrasilia(agora).hora}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {podeExportar && (
            <BotaoExportar
              titulo="Vistorias"
              filtros={descricaoFiltros}
              nomeArquivo="vistorias"
              total={total}
              carregar={() => exportarVistorias(busca)}
            />
          )}
          <Link
            href={`${ROTAS_OS.vistorias}/nova`}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-neutral-800"
          >
            <Plus className="size-4" aria-hidden />
            Nova vistoria
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(CARTOES) as Cartao[]).map((c, i) => (
          <Link
            key={c}
            href={link(sp, { cartao: f.cartao === c ? "" : c })}
            scroll={false}
            aria-current={f.cartao === c ? "true" : undefined}
            className={`flex rounded-[1.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca *:flex-1 ${f.cartao === c ? CLASSE_MARCADO : ""}`}
          >
            <CartaoIndicador
              titulo={CARTOES[c]}
              valor={formatarNumero(contagem[c])}
              detalhe={detalhes[c]}
              tom={TONS[i]}
            />
          </Link>
        ))}
      </div>

      <FiltrosVistorias
        busca={f.q}
        de={f.de}
        ate={f.ate}
        filtros={[
          {
            chave: "tipo",
            rotulo: "Tipo",
            opcoes: [
              { valor: "", rotulo: "Todos os tipos" },
              ...Object.entries(TIPOS_VISTORIA).map(([valor, rotulo]) => ({
                valor,
                rotulo,
              })),
            ],
          },
          {
            chave: "status",
            rotulo: "Status",
            opcoes: [
              { valor: "", rotulo: "Todos os status" },
              ...Object.entries(STATUS_VISTORIA).map(([valor, rotulo]) => ({
                valor,
                rotulo,
              })),
            ],
          },
          {
            chave: "vistoriador",
            rotulo: "Vistoriador",
            opcoes: [
              { valor: "", rotulo: "Todos os vistoriadores" },
              ...[...vistoriadores]
                .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
                .map(([valor, rotulo]) => ({ valor, rotulo })),
            ],
          },
          {
            chave: "bloco",
            rotulo: "Bloco",
            opcoes: [
              { valor: "", rotulo: "Todos os blocos" },
              ...blocos.map((b) => ({
                valor: b,
                rotulo: b === "sem" ? "Sem bloco" : b,
              })),
            ],
          },
        ]}
      />

      <Secao
        titulo={`${formatarNumero(total)} ${total === 1 ? "vistoria" : "vistorias"}`}
        descricao="Abra uma vistoria para preencher, assinar e enviar o laudo"
      >
        {/* Celular: cartões empilhados; telas maiores: a tabela. */}
        <ul className="flex flex-col gap-2 md:hidden">
          {lista.length === 0 && (
            <li className="py-6 text-sm text-neutral-500">
              Nenhuma vistoria com esses filtros.
            </li>
          )}
          {lista.map((v) => (
            <li key={v.id}>
              <Link
                href={rotaVistoria(v.id)}
                className="flex flex-col gap-2 rounded-2xl border border-neutral-900/[0.06] bg-white/60 p-4 transition hover:bg-white"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{v.codigo}</span>
                  <SeloTipoVistoria tipo={v.tipo} />
                  <SeloSituacaoVistoria situacao={situacaoDaVistoria(v)} />
                </span>
                <span className="text-sm">
                  {v.locatario || "Sem locatário"}
                </span>
                <span className="text-xs text-neutral-500">
                  {[
                    localDaUnidade(v.bloco, v.unidade),
                    formatarData(v.data),
                    v.vistoriador_nome,
                    v.ordens ? `${v.ordens} OS` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden md:block">
          <Tabela
            colunas={colunas}
            linhas={lista}
            chave={(v) => v.id}
            vazio="Nenhuma vistoria com esses filtros."
          />
        </div>
        <div className="mt-4">
          <Paginacao
            pagina={pagina}
            total={total}
            href={(p) => hrefDaPagina(ROTAS_OS.vistorias, sp, p)}
          />
        </div>
      </Secao>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <IndicadoresCarregando quantidade={4} />
      <FiltrosCarregando />
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}
