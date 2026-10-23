import { CircleDashed, FolderTree, Plus, QrCode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Abas } from "@/components/admin/ui";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { CartaoIndicador } from "@/components/dashboard/indicador";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { FiltrosAtivos } from "@/components/os/ativos/filtros";
import { DecisaoDeTroca, TabelaAtivos } from "@/components/os/ativos/lista";
import { BotaoExportar } from "@/components/os/exportar";
import { CLASSE_MARCADO, tonsDaTela } from "@/components/os/tons";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { formatarNumero, formatarPct } from "@/lib/formato";
import { ordenarPorPeso } from "@/lib/os/ativos";
import { ROTAS_OS } from "@/lib/os/rotas";
import { SITUACOES_ATIVO, type SituacaoAtivo } from "@/lib/os/rotulos";
import { SINAIS, type Sinal } from "@/lib/os/sinal";
import { hojeEmBrasilia, paraBrasilia } from "@/lib/os/tempo";
import { type AtivoNaLista, listarAtivos } from "@/server/os/ativos";
import { contexto } from "@/server/os/base";

const TONS = tonsDaTela("ativos");

export const metadata: Metadata = { title: "Ativos" };

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  return (
    <>
      <PageHeader
        title="Ativos"
        description="Cada ativo junta as OS feitas nele: quanto custou, quanto quebrou e quando vale trocar."
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

interface Filtro {
  visao: "lista" | "decisao";
  q: string;
  cat: string;
  local: string;
  situacao: string;
  sinal: string;
  incompleto: boolean;
  preventiva: boolean;
}

function lerFiltro(sp: Busca): Filtro {
  return {
    visao: um(sp.visao) === "decisao" ? "decisao" : "lista",
    q: um(sp.q).trim(),
    cat: um(sp.cat),
    local: um(sp.local),
    situacao: um(sp.situacao),
    sinal: um(sp.sinal),
    incompleto: um(sp.incompleto) === "1",
    preventiva: um(sp.preventiva) === "atrasada",
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
  return q ? `${ROTAS_OS.ativos}?${q}` : ROTAS_OS.ativos;
}

function filtrar(lista: AtivoNaLista[], f: Filtro): AtivoNaLista[] {
  const termo = sem(f.q);
  return lista.filter((a) => {
    const x = a.ativo;
    if (f.situacao === "") {
      if (x.situacao === "baixado") return false;
    } else if (f.situacao !== "todas" && x.situacao !== f.situacao)
      return false;
    if (f.cat && (x.categoria_id ?? "sem") !== f.cat) return false;
    if (f.local && (x.bloco?.trim() || "sem") !== f.local) return false;
    if (f.sinal && a.sinal.sinal !== f.sinal) return false;
    if (f.incompleto && a.faltas.length === 0) return false;
    if (f.preventiva && a.preventivasAtrasadas === 0) return false;
    if (
      termo &&
      !sem(
        `${x.codigo} ${x.nome} ${x.numero_serie ?? ""} ${x.fabricante ?? ""} ${x.modelo ?? ""}`,
      ).includes(termo)
    )
      return false;
    return true;
  });
}

async function Conteudo({ searchParams }: { searchParams: Promise<Busca> }) {
  const ctx = await contexto();
  if (!ctx.pode("os.ativos") && !ctx.pode("os.ativos_gerenciar"))
    return <SemAcesso />;
  const sp = await searchParams;
  const agora = new Date();
  const hoje = hojeEmBrasilia(agora);
  const f = lerFiltro(sp);
  const { ativos, faixas, categorias } = await listarAtivos(agora);
  const verCustos = ctx.pode("os.custos");
  const gerenciar = ctx.pode("os.ativos_gerenciar");

  const emUso = ativos.filter((a) => a.ativo.situacao !== "baixado");
  const incompletos = emUso.filter((a) => a.faltas.length > 0).length;
  const atrasadas = emUso.reduce((s, a) => s + a.preventivasAtrasadas, 0);
  const comAtraso = emUso.filter((a) => a.preventivasAtrasadas > 0).length;
  const manutencao = emUso.filter(
    (a) => a.ativo.situacao === "em_manutencao",
  ).length;
  const parados = emUso.filter((a) => a.ativo.situacao === "parado").length;
  const trocar = emUso.filter((a) => a.sinal.sinal === "trocar").length;

  const filtrados = filtrar(ativos, f);
  const linhas =
    f.visao === "decisao"
      ? ordenarPorPeso(
          filtrados.map((a) => ({ ...a, pesoPct: a.sinal.pesoPct })),
        )
      : filtrados;

  const blocos = [
    ...new Set(ativos.map((a) => a.ativo.bloco?.trim()).filter(Boolean)),
  ] as string[];
  const cartoes: {
    titulo: string;
    valor: string;
    detalhe: string;
    href: string;
    ativo: boolean;
  }[] = [
    {
      titulo: "Ativos",
      valor: formatarNumero(emUso.length),
      detalhe: `em uso, em manutenção ou parados${incompletos ? ` · ${incompletos} com cadastro incompleto` : ""}`,
      href: ROTAS_OS.ativos + (f.visao === "decisao" ? "?visao=decisao" : ""),
      ativo: false,
    },
    {
      titulo: "Preventivas atrasadas",
      valor: formatarNumero(atrasadas),
      detalhe: atrasadas
        ? `em ${comAtraso} ${comAtraso === 1 ? "ativo" : "ativos"}`
        : "nenhuma OS de plano vencida",
      href: link(sp, { preventiva: f.preventiva ? "" : "atrasada" }),
      ativo: f.preventiva,
    },
    {
      titulo: "Em manutenção",
      valor: formatarNumero(manutencao),
      detalhe: `${parados} ${parados === 1 ? "parado" : "parados"}`,
      href: link(sp, {
        situacao: f.situacao === "em_manutencao" ? "" : "em_manutencao",
      }),
      ativo: f.situacao === "em_manutencao",
    },
    {
      titulo: "Sinal Trocar",
      valor: formatarNumero(trocar),
      detalhe: "pelo pior dos três critérios",
      href: link(sp, { sinal: f.sinal === "trocar" ? "" : "trocar" }),
      ativo: f.sinal === "trocar",
    },
  ];

  const descricaoFiltros = [
    f.q && `Busca: ${f.q}`,
    f.cat &&
      `Categoria: ${f.cat === "sem" ? "sem categoria" : (categorias.find((c) => c.id === f.cat)?.nome ?? "")}`,
    f.local && `Local: ${f.local === "sem" ? "sem bloco" : f.local}`,
    f.situacao &&
      `Situação: ${f.situacao === "todas" ? "todas" : (SITUACOES_ATIVO[f.situacao as SituacaoAtivo] ?? f.situacao)}`,
    f.sinal && `Sinal: ${SINAIS[f.sinal as Sinal] ?? f.sinal}`,
    f.incompleto && "Só cadastro incompleto",
    f.preventiva && "Só com preventiva atrasada",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">
          Atualizado às {paraBrasilia(agora).hora}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {ctx.pode("os.exportar") && (
            <BotaoExportar
              titulo={f.visao === "decisao" ? "Decisão de troca" : "Ativos"}
              filtros={descricaoFiltros}
              nomeArquivo={
                f.visao === "decisao" ? "decisao-de-troca" : "ativos"
              }
              colunas={[
                { titulo: "Código" },
                { titulo: "Nome" },
                { titulo: "Categoria" },
                { titulo: "Local" },
                { titulo: "Situação" },
                { titulo: "Corretivas 12m", numero: true },
                ...(verCustos
                  ? [
                      {
                        titulo: "Custo 12m (R$)",
                        numero: true,
                        formato: "#,##0.00",
                      },
                      {
                        titulo: "Reposição (R$)",
                        numero: true,
                        formato: "#,##0.00",
                      },
                    ]
                  : []),
                { titulo: "Peso (%)", numero: true, formato: "0.0" },
                {
                  titulo: "Idade (% da vida útil)",
                  numero: true,
                  formato: "0",
                },
                { titulo: "Sinal" },
              ]}
              linhas={linhas.map((a) => [
                a.ativo.codigo,
                a.ativo.nome,
                a.categoria ?? "",
                a.local,
                SITUACOES_ATIVO[a.ativo.situacao],
                a.resumo.corretivas12m,
                ...(verCustos
                  ? [a.resumo.custo12m, a.ativo.valor_reposicao]
                  : []),
                a.sinal.pesoPct === null
                  ? null
                  : Math.round(a.sinal.pesoPct * 10) / 10,
                a.sinal.idadePct === null ? null : Math.round(a.sinal.idadePct),
                SINAIS[a.sinal.sinal],
              ])}
            />
          )}
          {gerenciar && (
            <>
              <Link
                href={`${ROTAS_OS.ativos}/categorias`}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
              >
                <FolderTree className="size-4" aria-hidden />
                Categorias
              </Link>
              <Link
                href={`${ROTAS_OS.ativos}/etiquetas`}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
              >
                <QrCode className="size-4" aria-hidden />
                Etiquetas
              </Link>
              <Link
                href={`${ROTAS_OS.ativos}/novo`}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-neutral-800"
              >
                <Plus className="size-4" aria-hidden />
                Novo ativo
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cartoes.map((c, i) => (
          <Link
            key={c.titulo}
            href={c.href}
            scroll={false}
            aria-current={c.ativo ? "true" : undefined}
            className={`flex rounded-[1.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca *:flex-1 ${c.ativo ? CLASSE_MARCADO : ""}`}
          >
            <CartaoIndicador
              titulo={c.titulo}
              valor={c.valor}
              detalhe={c.detalhe}
              tom={TONS[i]}
            />
          </Link>
        ))}
      </div>

      {incompletos > 0 && !f.incompleto && (
        <Link
          href={link(sp, { incompleto: "1" })}
          scroll={false}
          className="flex items-center gap-3 rounded-3xl border border-dashed border-amber-300 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 transition hover:bg-amber-50"
        >
          <CircleDashed className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">
            {incompletos === 1
              ? "1 ativo está com o cadastro incompleto"
              : `${incompletos} ativos estão com o cadastro incompleto`}{" "}
            (local, compra, reposição ou vida útil). Sem esses dados o sinal de
            troca não sai.
          </span>
          <span className="font-medium whitespace-nowrap">Ver quais →</span>
        </Link>
      )}

      <div className="flex flex-col gap-3">
        <Abas
          atual={link(sp, { visao: f.visao === "decisao" ? "decisao" : "" })}
          abas={[
            { href: link(sp, { visao: "" }), rotulo: "Lista" },
            {
              href: link(sp, { visao: "decisao" }),
              rotulo: "Decisão de troca",
            },
          ]}
        />
        <FiltrosAtivos
          busca={f.q}
          filtros={[
            {
              chave: "cat",
              rotulo: "Categoria",
              opcoes: [
                { valor: "", rotulo: "Todas as categorias" },
                ...categorias.map((c) => ({ valor: c.id, rotulo: c.nome })),
                { valor: "sem", rotulo: "Sem categoria" },
              ],
            },
            {
              chave: "local",
              rotulo: "Local",
              opcoes: [
                { valor: "", rotulo: "Todos os locais" },
                ...blocos
                  .sort((a, b) =>
                    a.localeCompare(b, "pt-BR", { numeric: true }),
                  )
                  .map((b) => ({ valor: b, rotulo: b })),
                { valor: "sem", rotulo: "Sem bloco" },
              ],
            },
            {
              chave: "situacao",
              rotulo: "Situação",
              opcoes: [
                { valor: "", rotulo: "Em uso, manutenção e parados" },
                ...Object.entries(SITUACOES_ATIVO).map(([valor, rotulo]) => ({
                  valor,
                  rotulo,
                })),
                { valor: "todas", rotulo: "Todas, com os baixados" },
              ],
            },
            {
              chave: "sinal",
              rotulo: "Sinal",
              opcoes: [
                { valor: "", rotulo: "Todos os sinais" },
                ...Object.entries(SINAIS).map(([valor, rotulo]) => ({
                  valor,
                  rotulo,
                })),
              ],
            },
          ]}
        />
      </div>

      {f.visao === "decisao" ? (
        <Secao
          titulo="Decisão de troca"
          descricao={`Do maior para o menor peso da manutenção (custo de 12 meses ÷ valor de reposição). Avaliar a partir de ${formatarPct(faixas.pesoAvaliar, 0)}, trocar acima de ${formatarPct(faixas.pesoTrocar, 0)}; corretivas: avaliar a partir de ${faixas.corretivasAvaliar}, trocar a partir de ${faixas.corretivasTrocar}; idade: avaliar a partir de ${formatarPct(faixas.idadeAvaliarPct, 0)} da vida útil.`}
        >
          <DecisaoDeTroca
            ativos={linhas}
            faixas={faixas}
            verCustos={verCustos}
          />
        </Secao>
      ) : (
        <Secao
          titulo={`${formatarNumero(linhas.length)} ${linhas.length === 1 ? "ativo" : "ativos"}`}
          descricao={descricaoFiltros || "Clique no nome para abrir a ficha"}
        >
          <TabelaAtivos ativos={linhas} verCustos={verCustos} hoje={hoje} />
        </Secao>
      )}

      <Nota>
        Custo e corretivas somam as OS do ativo (sem as canceladas), pela data
        de abertura. Corretiva é toda OS que não vem de plano preventivo nem de
        categoria preventiva. Faixas do sinal em Configurações › Parâmetros.
        {verCustos ? "" : " Valores em reais ficam com quem vê custos."}
      </Nota>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <IndicadoresCarregando quantidade={4} />
      <FiltrosCarregando />
      <CartaoCarregando altura="h-[36rem]" />
    </TelaCarregando>
  );
}
