import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { AbasMkt, hrefCom, TopoDaTela } from "@/components/marketing/tela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarDataHora } from "@/lib/formato";
import {
  avisoSemDados,
  BLOCOS,
  type Bloco,
  classificarLandingPages,
  conferirAsana,
  landingPagesSemTipo,
  nomesDoAsana,
} from "@/lib/marketing/parametros";
import {
  contextoMkt,
  landingPages,
  locatarios,
  metasMkt,
  parametros,
  regrasAlerta,
  temasEcodigos,
} from "@/server/marketing/base";
import { dadosAsana, dadosRd } from "@/server/marketing/fontes";
import { historicoMkt, LIMITE_HISTORICO } from "@/server/marketing/parametros";
import {
  BlocoAsana,
  BlocoEstacionamento,
  BlocoLandingPages,
  BlocoLocatarios,
  BlocoMetas,
  BlocoRegras,
  BlocoReputacao,
  BlocoRonda,
} from "./blocos";
import { BlocoHistorico } from "./historico";

export const metadata: Metadata = { title: "Parâmetros do Marketing" };

const BASE = "/marketing/parametros";

export default function Page({
  searchParams,
}: PageProps<"/marketing/parametros">) {
  return (
    <>
      <PageHeader
        title="Parâmetros e cadastros"
        description="Tudo o que as ferramentas não entregam e o Marketing informa: locatários, landing pages, metas, regras de alerta e os valores das contas. Cada alteração fica no histórico, com a opção de voltar."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="marketing.parametros">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

type Busca = Record<string, string | string[] | undefined>;

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const b = await busca;
  const pedido = Array.isArray(b.bloco) ? b.bloco[0] : b.bloco;
  const bloco: Bloco =
    pedido && pedido in BLOCOS ? (pedido as Bloco) : "locatarios";

  const [ctx, p, locs, lps, regras, temasCodigos, metas, rd, asana, historico] =
    await Promise.all([
      contextoMkt(),
      parametros(),
      locatarios(),
      landingPages(),
      regrasAlerta(),
      temasEcodigos(),
      metasMkt(),
      dadosRd(),
      dadosAsana(),
      // Fora da aba Histórico, só a última alteração (para o topo).
      historicoMkt(bloco === "historico" ? LIMITE_HISTORICO : 1),
    ]);

  // Avisos das abas: o que pede atenção em cada bloco.
  const linhasLp = classificarLandingPages(rd.landingPages, lps);
  const semTipo = landingPagesSemTipo(linhasLp).length;
  const nomesAsana = nomesDoAsana(asana);
  const asanaFaltando = conferirAsana(p, nomesAsana).filter((c) => !c.existe);
  const semDados = locs.filter((l) => l.ativo && avisoSemDados(l)).length;
  const avisos: Partial<Record<Bloco, number>> = {
    landing_pages: semTipo,
    asana: asanaFaltando.length,
  };

  const ultima = historico[0];
  const dadosDe = ultima
    ? (() => {
        const [d, h] = formatarDataHora(ultima.em).split(" ");
        return `Última alteração em ${d} às ${h}, por ${ultima.autor}`;
      })()
    : "Nenhuma alteração registrada ainda";

  return (
    <div className="flex flex-col gap-6">
      <TopoDaTela dadosDe={dadosDe} exemplo={false} />
      <AbasMkt
        rotulo="Blocos dos parâmetros"
        ativa={bloco}
        abas={(Object.keys(BLOCOS) as Bloco[]).map((k) => ({
          chave: k,
          rotulo: BLOCOS[k],
          href: hrefCom(BASE, b, { bloco: k === "locatarios" ? null : k }),
          aviso: avisos[k] ? String(avisos[k]) : undefined,
        }))}
      />
      {bloco === "locatarios" && (
        <BlocoLocatarios
          locatarios={locs}
          hoje={ctx.hoje}
          semDados={semDados}
        />
      )}
      {bloco === "landing_pages" && <BlocoLandingPages linhas={linhasLp} />}
      {bloco === "metas" && <BlocoMetas metas={metas} hoje={ctx.hoje} />}
      {bloco === "regras" && <BlocoRegras regras={regras} />}
      {bloco === "reputacao" && (
        <BlocoReputacao parametros={p} temas={temasCodigos.temas} />
      )}
      {bloco === "asana" && (
        <BlocoAsana
          parametros={p}
          projetos={nomesAsana.projetos}
          tags={nomesAsana.tags}
          faltando={asanaFaltando}
        />
      )}
      {bloco === "ronda" && <BlocoRonda codigos={temasCodigos.codigos} />}
      {bloco === "estacionamento" && <BlocoEstacionamento parametros={p} />}
      {bloco === "historico" && <BlocoHistorico linhas={historico} />}
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-12" />
      <CartaoCarregando altura="h-96" />
      <CartaoCarregando altura="h-56" />
    </TelaCarregando>
  );
}
