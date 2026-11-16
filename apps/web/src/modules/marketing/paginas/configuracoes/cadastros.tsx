import {
  avisoSemDados,
  BLOCOS,
  type Bloco,
  classificarLandingPages,
  landingPagesSemTipo,
} from "@arp/shared/marketing/parametros";
import { paginaDaUrl } from "@arp/shared/os/paginacao";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Suspense } from "react";
import { AbasDaTela, hrefCom } from "@/components/dashboard/tela";
import { Protegido } from "@/components/protegido";
import { useBusca } from "@/lib/navegacao";
import {
  consultaDasLandingPages,
  consultaDasMetas,
  consultaDasReferencias,
  consultaDasRegras,
  consultaDoHistorico,
  consultaDoRd,
  consultaDosLocatarios,
  consultaDosParametros,
  consultaDosTemasECodigos,
} from "../../api";
import { useContextoMkt } from "../../base";
import {
  BlocoBenchmark,
  BlocoLandingPages,
  BlocoLocatarios,
  BlocoMetas,
  BlocoRegras,
  BlocoReputacao,
  BlocoRonda,
} from "../../components/configuracoes/blocos";
import {
  EsqueletoConfiguracoes,
  TopoConfiguracoes,
} from "../../components/configuracoes/topo";

// app/(app)/marketing/configuracoes/page.tsx

const BASE = "/marketing/configuracoes";

// Asana fica em Integrações e o histórico na subtela dele.
const CADASTROS = [
  "locatarios",
  "landing_pages",
  "metas",
  "regras",
  "reputacao",
  "ronda",
  "benchmark",
] as const satisfies Bloco[];
type Cadastro = (typeof CADASTROS)[number];

export default function Page() {
  return (
    <Suspense fallback={<EsqueletoConfiguracoes />}>
      <Protegido permissao="marketing.parametros">
        <Tela />
      </Protegido>
    </Suspense>
  );
}

function Tela() {
  const b = useBusca();
  const ctx = useContextoMkt();
  const pedido = Array.isArray(b.bloco) ? b.bloco[0] : b.bloco;
  const bloco: Cadastro = CADASTROS.includes(pedido as Cadastro)
    ? (pedido as Cadastro)
    : "locatarios";

  const [
    { data: p },
    { data: locs },
    { data: lps },
    { data: regras },
    { data: temasCodigos },
    { data: metas },
    { data: rd },
    { data: historico },
    { data: refs },
  ] = useSuspenseQueries({
    queries: [
      consultaDosParametros,
      consultaDosLocatarios,
      consultaDasLandingPages,
      consultaDasRegras,
      consultaDosTemasECodigos,
      consultaDasMetas,
      consultaDoRd,
      consultaDoHistorico(1),
      consultaDasReferencias,
    ],
  });

  // Avisos das abas: o que pede atenção em cada bloco.
  // Landing pages do RD e os formulários que aparecem nas conversões.
  const linhasLp = classificarLandingPages(
    [
      ...rd.landingPages,
      ...rd.conversoes.map((c) => ({
        conversion_identifier: c.conversion_identifier,
        nome: c.conversion_identifier,
      })),
    ],
    lps,
  );
  const semTipo = landingPagesSemTipo(linhasLp).length;
  const semDados = locs.filter((l) => l.ativo && avisoSemDados(l)).length;
  const avisos: Partial<Record<Cadastro, number>> = {
    landing_pages: semTipo,
  };

  return (
    <div className="flex flex-col gap-6">
      <TopoConfiguracoes ultima={historico[0]} />
      <AbasDaTela
        rotulo="Cadastros e regras"
        ativa={bloco}
        abas={CADASTROS.map((k) => ({
          chave: k,
          rotulo: BLOCOS[k],
          href: hrefCom(BASE, b, {
            bloco: k === "locatarios" ? null : k,
            pagina: null,
          }),
          aviso: avisos[k] ? String(avisos[k]) : undefined,
        }))}
      />
      {bloco === "locatarios" && (
        <BlocoLocatarios
          locatarios={locs}
          hoje={ctx.hoje}
          semDados={semDados}
          pagina={paginaDaUrl(b.pagina)}
          hrefPagina={(p) =>
            hrefCom(BASE, b, { pagina: p > 1 ? String(p) : null })
          }
        />
      )}
      {bloco === "landing_pages" && <BlocoLandingPages linhas={linhasLp} />}
      {bloco === "metas" && <BlocoMetas metas={metas} hoje={ctx.hoje} />}
      {bloco === "regras" && <BlocoRegras regras={regras} />}
      {bloco === "reputacao" && (
        <BlocoReputacao parametros={p} temas={temasCodigos.temas} />
      )}
      {bloco === "ronda" && <BlocoRonda codigos={temasCodigos.codigos} />}
      {bloco === "benchmark" && (
        <BlocoBenchmark referencias={refs} termos={p.termos_marca} />
      )}
    </div>
  );
}
