import type { Metadata } from "next";
import { Suspense } from "react";
import { Agenda, type Navegacao } from "@/components/calendario/agenda";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { DIAS_DA_AGENDA, VISOES, type Visao } from "@/lib/calendario";
import { intervaloDaVisao, navegar } from "@/lib/os/calendario";
import { hojeEmBrasilia, somarDias } from "@/lib/os/tempo";
import { usuarioAtual } from "@/server/auth";
import { itensEntre, opcoesDePublico, tipos } from "@/server/calendario/base";

export const metadata: Metadata = { title: "Agenda" };

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
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
          <AgendaDaTela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function AgendaDaTela({ busca }: { busca: Promise<Busca> }) {
  const [params, usuario] = await Promise.all([busca, usuarioAtual()]);
  const hoje = hojeEmBrasilia(new Date());
  const dataBruta = um(params.data);
  const data = dataBruta && DATA.test(dataBruta) ? dataBruta : hoje;
  const visaoBruta = um(params.visao);
  const visao: Visao =
    visaoBruta && visaoBruta in VISOES ? (visaoBruta as Visao) : "mes";
  const { de, ate } =
    visao === "agenda"
      ? { de: data, ate: somarDias(data, DIAS_DA_AGENDA - 1) }
      : intervaloDaVisao(visao, data);

  const [listaTipos, opcoes, itens] = await Promise.all([
    tipos(),
    opcoesDePublico(),
    itensEntre(de, ate),
  ]);

  const href = (v: Visao, d: string) => `/calendario?visao=${v}&data=${d}`;
  const passo = (n: -1 | 1) =>
    visao === "agenda"
      ? somarDias(data, n * DIAS_DA_AGENDA)
      : navegar(visao, data, n);
  const nav: Navegacao = {
    anterior: href(visao, passo(-1)),
    proximo: href(visao, passo(1)),
    hoje: href(visao, hoje),
    visoes: Object.fromEntries(
      (Object.keys(VISOES) as Visao[]).map((v) => [v, href(v, data)]),
    ) as Record<Visao, string>,
    dia: href("dia", "DATA"),
  };

  return (
    <Agenda
      tipos={listaTipos}
      opcoes={opcoes}
      itens={itens}
      visao={visao}
      data={data}
      hoje={hoje}
      de={de}
      ate={ate}
      meuId={usuario.id}
      podeCriar={usuario.permissoes.includes("calendario.criar")}
      nav={nav}
    />
  );
}
