import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Calendario } from "@/components/os/calendario/calendario";
import { CamposDoPeriodo } from "@/components/os/calendario/campos-do-periodo";
import { BarraFiltros } from "@/components/os/filtros/barra-filtros";
import {
  campoRecorte,
  campoSetor,
  campoTipoComOS,
  campoVisao,
} from "@/components/os/filtros/opcoes";
import { Atualizado, PainelDaBusca } from "@/components/os/lista/topo";
import { SeuDia } from "@/components/os/seu-dia/seu-dia";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  diasEntre,
  intervaloDaVisao,
  navegar,
  periodoEscolhido,
  tituloDoPeriodo,
} from "@/lib/os/calendario";
import { type Busca, descreverFiltros, type Recorte } from "@/lib/os/lista";
import { deBrasilia, hojeEmBrasilia, somarDias } from "@/lib/os/tempo";
import { buscarChamados } from "@/server/os/base";
import {
  apoio,
  filtrosDaTela,
  horaDaVisita,
  itensDeAgendamento,
  itensDePlano,
  itensDePrazo,
  itensDeVisita,
  paraConsulta,
  paraLinha,
  setoresDisponiveis,
} from "@/server/os/visoes";

export const metadata: Metadata = { title: "Calendário" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <PageHeader
        title="Calendário"
        description="Prazos dos chamados, agendamentos (telhado, vistorias), visitas de terceirizados e preventivas. Arraste um prazo para outro dia para mudar a data."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <span
              aria-hidden
              className="carregando h-12 w-full max-w-3xl rounded-full"
            />
            <CartaoCarregando altura="h-[40rem]" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="os.acessar">
          <CalendarioDaTela busca={searchParams} />
          <Suspense fallback={null}>
            <SeuDia />
          </Suspense>
          <Suspense fallback={null}>
            <PainelDaBusca busca={searchParams} caminho="/os/calendario" />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

async function CalendarioDaTela({ busca }: { busca: Promise<Busca> }) {
  const params = await busca;
  const [a, { filtros, lembrados }] = await Promise.all([
    apoio(),
    filtrosDaTela("calendario", params),
  ]);
  const hoje = hojeEmBrasilia(a.agora);
  const dataBruta = Array.isArray(params.data) ? params.data[0] : params.data;
  const data =
    typeof dataBruta === "string" && DATA.test(dataBruta) ? dataBruta : hoje;
  const visao = filtros.visao ?? "mes";
  const { de, ate } =
    visao === "periodo"
      ? periodoEscolhido(filtros.de, filtros.ate, data)
      : intervaloDaVisao(visao, data);

  const permitidos: Recorte[] = [
    "minha_caixa",
    ...(a.ctx.pode("os.meu_setor") ? (["meu_setor"] as const) : []),
    "abertos_por_mim",
    ...(a.ctx.pode("os.todos_setores") ? (["todos"] as const) : []),
  ];
  const recorte =
    filtros.recorte && permitidos.includes(filtros.recorte)
      ? filtros.recorte
      : "minha_caixa";
  const comSetor = recorte === "meu_setor" || recorte === "todos";
  const valores = {
    ...filtros,
    recorte,
    setor: comSetor ? filtros.setor : undefined,
  };

  // Tudo de uma vez: os prazos do período (chamados e OS, filtrados no
  // banco), as visitas das OS do recorte, os agendamentos e as preventivas.
  // O tipo OS lê só as OS; outro tipo, só os chamados.
  const consulta = paraConsulta({ ...valores, status: undefined }, recorte);
  const soOS = valores.tipo === "os";
  const semOS = !!valores.tipo && !soOS;
  const prazoEntre = {
    de: deBrasilia(de).toISOString(),
    ate: deBrasilia(somarDias(ate, 1)).toISOString(),
  };
  const [chamados, ordens, visitas, agendamentos, planos] = await Promise.all([
    soOS ? [] : buscarChamados({ ...consulta, prazoEntre }),
    semOS ? [] : buscarChamados({ ...consulta, ordens: true, prazoEntre }),
    semOS
      ? []
      : itensDeVisita(
          de,
          ate,
          recorte === "todos" && !valores.setor ? null : consulta,
        ),
    itensDeAgendamento(de, ate),
    itensDePlano(a, de, ate, valores.setor ?? null),
  ]);
  const linhas = [...chamados, ...ordens].map((c) => paraLinha(c, a));
  const itens = [
    ...itensDePrazo(linhas, de, ate),
    ...visitas,
    ...agendamentos,
    ...planos,
  ];

  const href = (d: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params))
      if (typeof v === "string" && k !== "c") p.set(k, v);
    p.set("data", d);
    return `/os/calendario?${p.toString()}`;
  };
  // No período, as setas andam o tamanho dele e "Hoje" começa nele.
  const tamanho = diasEntre(de, ate);
  const hrefPeriodo = (inicio: string) => {
    const p = new URLSearchParams(href(inicio).split("?")[1]);
    p.set("de", inicio);
    p.set("ate", somarDias(inicio, tamanho - 1));
    return `/os/calendario?${p.toString()}`;
  };
  const anterior =
    visao === "periodo"
      ? hrefPeriodo(somarDias(de, -tamanho))
      : href(navegar(visao, data, -1));
  const proximo =
    visao === "periodo"
      ? hrefPeriodo(somarDias(de, tamanho))
      : href(navegar(visao, data, 1));
  const setores =
    recorte === "todos"
      ? a.setores.filter((s) => s.ativo)
      : setoresDisponiveis(a);

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(a)} />
      <BarraFiltros
        tela="calendario"
        valores={valores}
        lembrados={lembrados}
        fixos={["recorte", "visao", "de", "ate"]}
        campos={[
          campoVisao,
          campoRecorte(permitidos),
          ...(comSetor ? [campoSetor(setores)] : []),
          campoTipoComOS,
        ]}
      />
      <nav aria-label="Período" className="flex flex-wrap items-center gap-2">
        <div className="vidro inline-flex items-center gap-0.5 rounded-full p-1">
          <Link
            href={anterior}
            scroll={false}
            aria-label="Período anterior"
            className="grid size-9 place-items-center rounded-full text-neutral-700 transition hover:bg-white/80 dark:hover:bg-white/10"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link
            href={visao === "periodo" ? hrefPeriodo(hoje) : href(hoje)}
            scroll={false}
            className="rounded-full px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-white/80 dark:hover:bg-white/10"
          >
            Hoje
          </Link>
          <Link
            href={proximo}
            scroll={false}
            aria-label="Próximo período"
            className="grid size-9 place-items-center rounded-full text-neutral-700 transition hover:bg-white/80 dark:hover:bg-white/10"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        {visao === "periodo" ? (
          <CamposDoPeriodo de={de} ate={ate} valores={valores} />
        ) : (
          <h2 className="text-xl font-semibold tracking-tight first-letter:uppercase">
            {tituloDoPeriodo(visao, data)}
          </h2>
        )}
      </nav>
      <Calendario
        itens={itens}
        visao={visao}
        data={data}
        hoje={hoje}
        de={de}
        ate={ate}
        // O período já vai no rodapé da exportação ("dd/mm a dd/mm").
        filtros={descreverFiltros(
          "calendario",
          { ...valores, de: undefined, ate: undefined },
          {
            setor: valores.setor
              ? (a.setorPorId.get(valores.setor)?.nome ?? null)
              : null,
          },
        )}
        podeExportar={a.ctx.pode("os.exportar")}
      />
    </div>
  );
}
