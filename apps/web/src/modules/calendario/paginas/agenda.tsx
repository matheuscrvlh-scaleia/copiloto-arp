import { DIAS_DA_AGENDA, VISOES, type Visao } from "@arp/shared/calendario";
import { ehChaveDe } from "@arp/shared/calendario/contratos";
import { intervaloDaVisao, navegar } from "@arp/shared/os/calendario";
import { hojeEmBrasilia, somarDias } from "@arp/shared/os/tempo";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Suspense, useDeferredValue } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { useParametrosDeBusca } from "@/lib/navegacao";
import { usePermissao, useSessao } from "@/lib/sessao";
import { consultaDoPublico, consultaDosItens, consultaDosTipos } from "../api";
import { Agenda, type Navegacao } from "../components/agenda";

// /calendario: a agenda da empresa. A visão e a data ficam na URL
// (?visao=semana&data=2026-11-16); os itens chegam já filtrados pelo RLS.

export default function Pagina() {
  return (
    <>
      <PageHeader
        title="Agenda"
        description="Eventos, reuniões, obras, tarefas e feriados da empresa num lugar só. Cada item escolhe quem vê: todos, alguns setores, cargos ou pessoas, ou só você."
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
        <Protegido permissao="calendario.ver">
          <AgendaDaTela />
        </Protegido>
      </Suspense>
    </>
  );
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function AgendaDaTela() {
  const params = useParametrosDeBusca();
  const { usuario } = useSessao();
  const podeCriar = usePermissao("calendario.criar");
  const hoje = hojeEmBrasilia(new Date());
  // Ao trocar de período, a agenda anterior fica na tela até a nova chegar.
  const [dataBruta = "", visaoBruta = ""] = useDeferredValue(
    `${params.get("data") ?? ""}|${params.get("visao") ?? ""}`,
  ).split("|");
  const data = DATA.test(dataBruta) ? dataBruta : hoje;
  const visao: Visao = ehChaveDe(VISOES, visaoBruta) ? visaoBruta : "mes";
  const { de, ate } =
    visao === "agenda"
      ? { de: data, ate: somarDias(data, DIAS_DA_AGENDA - 1) }
      : intervaloDaVisao(visao, data);

  const [{ data: tipos }, { data: opcoes }, { data: itens }] =
    useSuspenseQueries({
      queries: [
        consultaDosTipos,
        consultaDoPublico,
        consultaDosItens({ de, ate }),
      ],
    });

  const href = (v: Visao, d: string) => `/calendario?visao=${v}&data=${d}`;
  const passo = (n: -1 | 1) =>
    visao === "agenda"
      ? somarDias(data, n * DIAS_DA_AGENDA)
      : navegar(visao, data, n);
  const nav: Navegacao = {
    anterior: href(visao, passo(-1)),
    proximo: href(visao, passo(1)),
    hoje: href(visao, hoje),
    visoes: {
      mes: href("mes", data),
      semana: href("semana", data),
      dia: href("dia", data),
      agenda: href("agenda", data),
    },
    dia: href("dia", "DATA"),
  };

  return (
    <Agenda
      tipos={tipos}
      opcoes={opcoes}
      itens={itens}
      visao={visao}
      data={data}
      hoje={hoje}
      de={de}
      ate={ate}
      meuId={usuario.id}
      podeCriar={podeCriar}
      nav={nav}
    />
  );
}
