import type { Metadata } from "next";
import { Suspense } from "react";
import { AbasMkt, hrefCom } from "@/components/marketing/tela";
import { Protegido } from "@/components/protegido";
import {
  avisoSemDados,
  BLOCOS,
  type Bloco,
  classificarLandingPages,
  landingPagesSemTipo,
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
import { dadosRd } from "@/server/marketing/fontes";
import { historicoMkt } from "@/server/marketing/parametros";
import {
  BlocoEstacionamento,
  BlocoLandingPages,
  BlocoLocatarios,
  BlocoMetas,
  BlocoRegras,
  BlocoReputacao,
  BlocoRonda,
} from "./blocos";
import { EsqueletoConfiguracoes, TopoConfiguracoes } from "./topo";

export const metadata: Metadata = { title: "Configurações do Marketing" };

const BASE = "/marketing/configuracoes";

// Asana fica em Integrações e o histórico na subtela dele.
const CADASTROS = [
  "locatarios",
  "landing_pages",
  "metas",
  "regras",
  "reputacao",
  "ronda",
  "estacionamento",
] as const satisfies Bloco[];
type Cadastro = (typeof CADASTROS)[number];

export default function Page({
  searchParams,
}: PageProps<"/marketing/configuracoes">) {
  return (
    <Suspense fallback={<EsqueletoConfiguracoes />}>
      <Protegido permissao="marketing.parametros">
        <Tela busca={searchParams} />
      </Protegido>
    </Suspense>
  );
}

type Busca = Record<string, string | string[] | undefined>;

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const b = await busca;
  const pedido = Array.isArray(b.bloco) ? b.bloco[0] : b.bloco;
  const bloco: Cadastro = CADASTROS.includes(pedido as Cadastro)
    ? (pedido as Cadastro)
    : "locatarios";

  const [ctx, p, locs, lps, regras, temasCodigos, metas, rd, historico] =
    await Promise.all([
      contextoMkt(),
      parametros(),
      locatarios(),
      landingPages(),
      regrasAlerta(),
      temasEcodigos(),
      metasMkt(),
      dadosRd(),
      historicoMkt(1),
    ]);

  // Avisos das abas: o que pede atenção em cada bloco.
  const linhasLp = classificarLandingPages(rd.landingPages, lps);
  const semTipo = landingPagesSemTipo(linhasLp).length;
  const semDados = locs.filter((l) => l.ativo && avisoSemDados(l)).length;
  const avisos: Partial<Record<Cadastro, number>> = {
    landing_pages: semTipo,
  };

  return (
    <div className="flex flex-col gap-6">
      <TopoConfiguracoes ultima={historico[0]} />
      <AbasMkt
        rotulo="Cadastros e regras"
        ativa={bloco}
        abas={CADASTROS.map((k) => ({
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
      {bloco === "ronda" && <BlocoRonda codigos={temasCodigos.codigos} />}
      {bloco === "estacionamento" && <BlocoEstacionamento parametros={p} />}
    </div>
  );
}
