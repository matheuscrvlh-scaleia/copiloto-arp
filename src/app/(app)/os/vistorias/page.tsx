import { ChevronRight, FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { CartaoIndicador } from "@/components/dashboard/indicador";
import { type Coluna, Secao, Tabela } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/os/exportar";
import { SeloExemplo } from "@/components/os/selos";
import { CLASSE_MARCADO, tonsDaTela } from "@/components/os/tons";
import { FiltrosVistorias } from "@/components/os/vistorias/filtros";
import {
  SeloSituacaoVistoria,
  SeloTipoVistoria,
  tipoCurto,
} from "@/components/os/vistorias/selos";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { formatarData, formatarNumero } from "@/lib/formato";
import { ROTAS_OS, rotaVistoria } from "@/lib/os/rotas";
import {
  STATUS_VISTORIA,
  type StatusVistoria,
  TIPOS_VISTORIA,
  type TipoVistoria,
} from "@/lib/os/rotulos";
import { hojeEmBrasilia, paraBrasilia } from "@/lib/os/tempo";
import {
  localDaUnidade,
  ROTULOS_SITUACAO,
  situacaoDaVistoria,
} from "@/lib/os/vistoria-regras";
import { dataValida } from "@/lib/periodo";
import { contexto } from "@/server/os/base";
import { listarVistorias, type VistoriaResumo } from "@/server/os/vistorias";

const TONS = tonsDaTela("vistorias");

export const metadata: Metadata = { title: "Vistorias" };

type Busca = Record<string, string | string[] | undefined>;

export default function Page({ searchParams }: PageProps<"/os/vistorias">) {
  return (
    <>
      <PageHeader
        title="Vistorias"
        description="Laudos de entrada, saída, preventivos e extraordinários. A vistoria nasce do contrato, é feita no celular e a saída é comparada com a entrada."
      />
      <Suspense fallback={<Esqueleto />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const CARTOES = {
  andamento: "Em andamento",
  assinatura: "Aguardando assinatura",
  concluidas: "Concluídas no mês",
  com_os: "Com OS gerada",
} as const;
type Cartao = keyof typeof CARTOES;

interface Filtro {
  q: string;
  tipo: string;
  status: string;
  vistoriador: string;
  bloco: string;
  de: string;
  ate: string;
  cartao: Cartao | "";
}

function lerFiltro(sp: Busca): Filtro {
  const cartao = um(sp.cartao);
  return {
    q: um(sp.q).trim(),
    tipo: um(sp.tipo),
    status: um(sp.status),
    vistoriador: um(sp.vistoriador),
    bloco: um(sp.bloco),
    de: dataValida(um(sp.de)) ? um(sp.de) : "",
    ate: dataValida(um(sp.ate)) ? um(sp.ate) : "",
    cartao: Object.hasOwn(CARTOES, cartao) ? (cartao as Cartao) : "",
  };
}

/** Endereço com os filtros de agora, trocando alguns. */
function link(sp: Busca, mudancas: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const valor = um(v);
    if (valor) p.set(k, valor);
  }
  for (const [k, v] of Object.entries(mudancas)) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const q = p.toString();
  return q ? `${ROTAS_OS.vistorias}?${q}` : ROTAS_OS.vistorias;
}

const vistoriadorDe = (v: VistoriaResumo) =>
  v.vistoriador_id ?? v.vistoriador_nome;

function noCartao(v: VistoriaResumo, cartao: Cartao, mes: string): boolean {
  const s = situacaoDaVistoria(v);
  switch (cartao) {
    case "andamento":
      return s === "andamento";
    case "assinatura":
      return s === "aguardando_assinatura";
    case "concluidas":
      return s === "concluida" && v.data.startsWith(mes);
    case "com_os":
      return v.ordens > 0;
  }
}

function filtrar(lista: VistoriaResumo[], f: Filtro, mes: string) {
  const termo = sem(f.q);
  return lista.filter(
    (v) =>
      (!f.tipo || v.tipo === f.tipo) &&
      (!f.status || v.status === f.status) &&
      (!f.vistoriador || vistoriadorDe(v) === f.vistoriador) &&
      (!f.bloco || (v.bloco.trim() || "sem") === f.bloco) &&
      (!f.de || v.data >= f.de) &&
      (!f.ate || v.data <= f.ate) &&
      (!f.cartao || noCartao(v, f.cartao, mes)) &&
      (!termo ||
        sem(`${v.codigo} ${v.locatario} ${v.bloco} ${v.unidade}`).includes(
          termo,
        )),
  );
}

async function Conteudo({ searchParams }: { searchParams: Promise<Busca> }) {
  const ctx = await contexto();
  if (!ctx.pode("os.vistorias")) return <SemAcesso />;
  const [sp, todas] = await Promise.all([searchParams, listarVistorias()]);
  const agora = new Date();
  const mes = hojeEmBrasilia(agora).slice(0, 7);
  const f = lerFiltro(sp);
  const lista = filtrar(todas, f, mes);

  const conta = (c: Cartao) => todas.filter((v) => noCartao(v, c, mes)).length;
  const detalhes: Record<Cartao, string> = {
    andamento: "sendo preenchidas",
    assinatura: "finalizadas sem as duas assinaturas",
    concluidas: "finalizadas e assinadas neste mês",
    com_os: "algum ambiente virou OS",
  };

  const vistoriadores = new Map<string, string>();
  for (const v of todas)
    vistoriadores.set(vistoriadorDe(v), v.vistoriador_nome);
  const blocos = [...new Set(todas.map((v) => v.bloco.trim() || "sem"))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );

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
          {v.exemplo && <SeloExemplo />}
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
            href={`${rotaVistoria(v.id)}/laudo`}
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
          {ctx.pode("os.exportar") && (
            <BotaoExportar
              titulo="Vistorias"
              filtros={descricaoFiltros}
              nomeArquivo="vistorias"
              colunas={[
                { titulo: "Código" },
                { titulo: "Tipo" },
                { titulo: "Locatário(a)" },
                { titulo: "Bloco / Área" },
                { titulo: "Locação / Unidade" },
                { titulo: "Data" },
                { titulo: "Vistoriador" },
                { titulo: "Status" },
                { titulo: "Situação" },
                { titulo: "OS geradas", numero: true },
              ]}
              linhas={lista.map((v) => [
                v.codigo,
                tipoCurto(v.tipo),
                v.locatario,
                v.bloco,
                v.unidade,
                formatarData(v.data),
                v.vistoriador_nome,
                STATUS_VISTORIA[v.status],
                ROTULOS_SITUACAO[situacaoDaVistoria(v)],
                v.ordens,
              ])}
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
              valor={formatarNumero(conta(c))}
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
        titulo={`${formatarNumero(lista.length)} ${lista.length === 1 ? "vistoria" : "vistorias"}`}
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
