import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import {
  BlocoCalendario,
  BlocoCenso,
  BlocoContratos,
  BlocoEventos,
  BlocoFicha,
  BlocoFunil,
  BlocoKit,
  BlocoOcupacao,
  BlocoPesquisa,
  BlocoVencimentos,
} from "@/components/comercial/configuracoes/blocos";
import { TopoConfiguracoes } from "@/components/comercial/configuracoes/historico";
import { AbasDaTela, hrefCom } from "@/components/comercial/tela";
import { Protegido } from "@/components/protegido";
import {
  BLOCOS,
  type Bloco,
  blocoDaAuditoria,
  ORDEM_BLOCOS,
} from "@/lib/comercial/parametros";
import {
  contextoCom,
  faixasEvento,
  fontesDePara,
  listas,
  parametros,
  tiposLuc,
} from "@/server/comercial/base";
import { dadosEnet, dadosRd } from "@/server/comercial/fontes";
import {
  feriadosCadastrados,
  historicoCom,
} from "@/server/comercial/parametros";
import { feriadosNacionais } from "@/server/comercial/publicos";

export const metadata: Metadata = { title: "Parâmetros do Comercial" };

const BASE = "/comercial/configuracoes/parametros";

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: PageProps<"/comercial/configuracoes/parametros">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-12" />
          <CartaoCarregando altura="h-96" />
        </TelaCarregando>
      }
    >
      <Protegido permissao="comercial.parametros.editar">
        <Tela busca={searchParams} />
      </Protegido>
    </Suspense>
  );
}

const unicos = (vs: (string | null | undefined)[]) =>
  [...new Set(vs.filter((v): v is string => !!v))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const b = await busca;
  const pedido = Array.isArray(b.bloco) ? b.bloco[0] : b.bloco;
  const bloco: Bloco = ORDEM_BLOCOS.includes(pedido as Bloco)
    ? (pedido as Bloco)
    : "funil";

  const [ctx, p, ls, historico] = await Promise.all([
    contextoCom(),
    parametros(),
    listas(),
    historicoCom("parametros", 1),
  ]);
  const ultima = historico[0];

  return (
    <div className="flex flex-col gap-6">
      <TopoConfiguracoes
        ultima={ultima}
        bloco={ultima ? blocoDaAuditoria(ultima) : null}
      />
      <AbasDaTela
        rotulo="Blocos de parâmetros"
        ativa={bloco}
        abas={ORDEM_BLOCOS.map((k) => ({
          chave: k,
          rotulo: BLOCOS[k],
          href: hrefCom(BASE, b, { bloco: k === "funil" ? null : k }),
        }))}
      />
      {bloco === "funil" && <Funil p={p} listas={ls} />}
      {bloco === "ocupacao" && <Ocupacao p={p} />}
      {bloco === "vencimentos" && (
        <BlocoVencimentos parametros={p} listas={ls} />
      )}
      {bloco === "contratos" && <BlocoContratos parametros={p} />}
      {bloco === "ficha" && <BlocoFicha parametros={p} listas={ls} />}
      {bloco === "censo" && <BlocoCenso parametros={p} listas={ls} />}
      {bloco === "kit" && <BlocoKit parametros={p} listas={ls} />}
      {bloco === "eventos" && <Eventos p={p} listas={ls} />}
      {bloco === "pesquisa" && <BlocoPesquisa parametros={p} listas={ls} />}
      {bloco === "calendario" && <Calendario hoje={ctx.hoje} />}
    </div>
  );
}

type P = Awaited<ReturnType<typeof parametros>>;
type L = Awaited<ReturnType<typeof listas>>;

async function Funil({ p, listas: ls }: { p: P; listas: L }) {
  const [fontes, rd] = await Promise.all([fontesDePara(), dadosRd()]);
  return (
    <BlocoFunil
      parametros={p}
      fontes={fontes}
      listas={ls}
      fontesDoRd={unicos(rd.oportunidades.map((o) => o.deal_source?.name))}
      funisDoRd={unicos(rd.oportunidades.map((o) => o.deal_pipeline.name))}
    />
  );
}

async function Ocupacao({ p }: { p: P }) {
  const [tipos, enet] = await Promise.all([tiposLuc(), dadosEnet()]);
  return (
    <BlocoOcupacao
      parametros={p}
      tipos={tipos}
      tiposDoEnet={unicos(enet.lucs.map((l) => l.tipo_loja))}
    />
  );
}

async function Eventos({ p, listas: ls }: { p: P; listas: L }) {
  return (
    <BlocoEventos parametros={p} faixas={await faixasEvento()} listas={ls} />
  );
}

async function Calendario({ hoje }: { hoje: string }) {
  const ano = Number(hoje.slice(0, 4));
  const [nacionais, cadastrados] = await Promise.all([
    feriadosNacionais([ano, ano + 1]),
    feriadosCadastrados(),
  ]);
  return (
    <BlocoCalendario
      nacionais={nacionais}
      cadastrados={cadastrados}
      hoje={hoje}
    />
  );
}
