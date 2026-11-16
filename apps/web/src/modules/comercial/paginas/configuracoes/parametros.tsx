import type { RespostaParametros } from "@arp/shared/comercial/contratos/configuracoes";
import {
  BLOCOS,
  type Bloco,
  blocoDaAuditoria,
  ORDEM_BLOCOS,
} from "@arp/shared/comercial/parametros/index";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Protegido } from "@/components/protegido";
import { useBusca } from "@/lib/navegacao";
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
} from "@/modules/comercial/components/configuracoes/blocos";
import { TopoConfiguracoes } from "@/modules/comercial/components/configuracoes/historico";
import { AbasDaTela, hrefCom } from "@/modules/comercial/components/tela";
import {
  consultaBlocoEventos,
  consultaBlocoFunil,
  consultaBlocoOcupacao,
  consultaCalendario,
  consultaParametros,
} from "../../api/configuracoes";

// /comercial/configuracoes/parametros

const BASE = "/comercial/configuracoes/parametros";

export default function Page() {
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
        <Tela />
      </Protegido>
    </Suspense>
  );
}

function Tela() {
  const b = useBusca();
  const pedido = Array.isArray(b.bloco) ? b.bloco[0] : b.bloco;
  const bloco: Bloco = ORDEM_BLOCOS.includes(pedido as Bloco)
    ? (pedido as Bloco)
    : "funil";

  const {
    data: { parametros: p, listas: ls, ultima: lida, ...ctx },
  } = useSuspenseQuery(consultaParametros);
  const ultima = lida ?? undefined;

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

type P = RespostaParametros["parametros"];
type L = RespostaParametros["listas"];

// A API já devolve as fontes e os funis do RD e os tipos do ENET sem
// repetição e em ordem (o `unicos` de antes).
function Funil({ p, listas: ls }: { p: P; listas: L }) {
  const {
    data: { fontes, fontesDoRd, funisDoRd },
  } = useSuspenseQuery(consultaBlocoFunil);
  return (
    <BlocoFunil
      parametros={p}
      fontes={fontes}
      listas={ls}
      fontesDoRd={fontesDoRd}
      funisDoRd={funisDoRd}
    />
  );
}

function Ocupacao({ p }: { p: P }) {
  const {
    data: { tipos, tiposDoEnet },
  } = useSuspenseQuery(consultaBlocoOcupacao);
  return (
    <BlocoOcupacao parametros={p} tipos={tipos} tiposDoEnet={tiposDoEnet} />
  );
}

function Eventos({ p, listas: ls }: { p: P; listas: L }) {
  const {
    data: { faixas },
  } = useSuspenseQuery(consultaBlocoEventos);
  return <BlocoEventos parametros={p} faixas={faixas} listas={ls} />;
}

// Feriados nacionais de hoje e do ano que vem (a API pede à BrasilAPI).
function Calendario({ hoje }: { hoje: string }) {
  const {
    data: { nacionais, cadastrados },
  } = useSuspenseQuery(consultaCalendario);
  return (
    <BlocoCalendario
      nacionais={nacionais}
      cadastrados={cadastrados}
      hoje={hoje}
    />
  );
}
