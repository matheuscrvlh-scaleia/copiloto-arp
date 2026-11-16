import { diasEntre, navegar, tituloDoPeriodo } from "@arp/shared/os/calendario";
import { descreverFiltros, lerFiltros } from "@arp/shared/os/lista";
import { somarDias } from "@arp/shared/os/tempo";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link } from "@/lib/navegacao";
import { usePermissao } from "@/lib/sessao";
import { consultaDoCalendario } from "@/modules/os/api";
import { horaDaVisita, setoresPorId, useApoio } from "@/modules/os/apoio";
import { Calendario } from "@/modules/os/components/calendario/calendario";
import { CamposDoPeriodo } from "@/modules/os/components/calendario/campos-do-periodo";
import { BarraFiltros } from "@/modules/os/components/filtros/barra-filtros";
import {
  campoRecorte,
  campoSetor,
  campoTipoComOS,
  campoVisao,
} from "@/modules/os/components/filtros/opcoes";
import { Atualizado, PainelDaBusca } from "@/modules/os/components/lista/topo";
import { SeuDia } from "@/modules/os/components/seu-dia/seu-dia";
import { useBuscaDaTela } from "@/modules/os/components/telas/lista";

export default function Pagina() {
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
          <CalendarioDaTela />
          <Suspense fallback={null}>
            <SeuDia />
          </Suspense>
          <Suspense fallback={null}>
            <PainelDaBusca caminho="/os/calendario" />
          </Suspense>
        </Protegido>
      </Suspense>
    </>
  );
}

function CalendarioDaTela() {
  const params = useBuscaDaTela();
  const a = useApoio();
  // Os filtros (da URL ou lembrados), o período e os itens (prazos dos
  // chamados e das OS, visitas, agendamentos e preventivas) vêm da API.
  const { data: r } = useSuspenseQuery(consultaDoCalendario(params));
  const { lembrados, permitidos, padrao, comSetor, visao, data, hoje } = r;
  const { de, ate, itens } = r;
  const valores = lerFiltros("calendario", r.valores);
  const podeExportar = usePermissao("os.exportar");

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
  const setores = setoresPorId(a, r.setores);

  return (
    <div className="flex flex-col gap-5">
      <Atualizado hora={horaDaVisita(r.agora)} />
      <BarraFiltros
        tela="calendario"
        valores={valores}
        lembrados={lembrados}
        fixos={["recorte", "visao", "de", "ate"]}
        campos={[
          campoVisao,
          campoRecorte(permitidos, padrao),
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
        podeExportar={podeExportar}
      />
    </div>
  );
}
