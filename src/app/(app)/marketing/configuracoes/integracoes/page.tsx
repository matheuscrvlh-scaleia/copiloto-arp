import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoIntegracao,
  COR_SITUACAO,
  Ponto,
  situacao,
} from "@/components/admin/integracao";
import { Secao } from "@/components/dashboard/tabela";
import { Fonte } from "@/components/marketing/tela";
import { Protegido } from "@/components/protegido";
import type { Sistema } from "@/lib/integracoes";
import { conferirAsana, nomesDoAsana } from "@/lib/marketing/parametros";
import { type IntegracaoNaTela, integracoesNaTela } from "@/server/admin/dados";
import { parametros } from "@/server/marketing/base";
import { dadosAsana } from "@/server/marketing/fontes";
import { historicoMkt } from "@/server/marketing/parametros";
import { BlocoAsana } from "../blocos";
import { EsqueletoConfiguracoes, TopoConfiguracoes } from "../topo";

export const metadata: Metadata = { title: "Integrações do Marketing" };

// Ferramentas que alimentam o módulo (spec 4.1). Só leitura: nada é
// publicado, pausado ou respondido nelas. O acesso de cada uma é salvo e
// testado aqui (cifrado, como em Administração › Integrações). Quem libera
// cada acesso está em docs/integracoes.md.
const FERRAMENTAS: {
  nome: string;
  detalhe: string;
  sistemas: Sistema[];
  telas: [string, string][];
}[] = [
  {
    nome: "Meta Ads",
    detalhe: "Facebook e Instagram",
    sistemas: ["mkt_meta_ads"],
    telas: [["Performance de anúncios", "/marketing/anuncios"]],
  },
  {
    nome: "Google Ads",
    detalhe: "Inclui YouTube e termos de pesquisa",
    sistemas: ["mkt_google_ads"],
    telas: [["Performance de anúncios", "/marketing/anuncios"]],
  },
  {
    nome: "TikTok",
    detalhe: "Ads e conta Business",
    sistemas: ["mkt_tiktok"],
    telas: [
      ["Performance de anúncios", "/marketing/anuncios"],
      ["Redes sociais", "/marketing/redes"],
    ],
  },
  {
    nome: "Google Analytics 4 e Search Console",
    detalhe: "Tráfego do site e buscas no Google",
    sistemas: ["mkt_ga4"],
    telas: [["Site e leads", "/marketing/site"]],
  },
  {
    nome: "RD Station Marketing",
    detalhe: "Leads e landing pages; base do custo por lead",
    sistemas: ["mkt_rd_station"],
    telas: [
      ["Site e leads", "/marketing/site"],
      ["Performance de anúncios", "/marketing/anuncios"],
    ],
  },
  {
    nome: "Instagram, Facebook e YouTube",
    detalhe: "Foto diária de seguidores, alcance e posts",
    sistemas: ["mkt_redes_meta", "mkt_youtube"],
    telas: [["Redes sociais", "/marketing/redes"]],
  },
  {
    nome: "Google Perfil da Empresa",
    detalhe: "Avaliações da ARP e dos locatários monitorados",
    sistemas: ["mkt_google_perfil"],
    telas: [["Reputação", "/marketing/reputacao"]],
  },
  {
    nome: "Asana",
    detalhe: "Tarefas, calendário de eventos e ronda (nomes logo abaixo)",
    sistemas: ["mkt_asana"],
    telas: [["Radar operacional", "/marketing/radar"]],
  },
];

export default function Page() {
  return (
    <Suspense fallback={<EsqueletoConfiguracoes />}>
      <Protegido permissao="marketing.parametros">
        <Tela />
      </Protegido>
    </Suspense>
  );
}

async function Tela() {
  const [p, asana, historico, { cofre, integracoes }] = await Promise.all([
    parametros(),
    dadosAsana(),
    historicoMkt(1),
    integracoesNaTela("marketing"),
  ]);
  const nomes = nomesDoAsana(asana);
  const faltando = conferirAsana(p, nomes).filter((c) => !c.existe);
  const porSistema = new Map<Sistema, IntegracaoNaTela>(
    integracoes.map((i) => [i.sistema, i]),
  );
  const conectadas = integracoes.filter(
    (i) => situacao(i).tipo === "ok",
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <TopoConfiguracoes ultima={historico[0]} />
      <Secao
        tom="escuro"
        titulo="Ferramentas ligadas"
        descricao={`De onde vem cada número do Marketing. ${conectadas} de ${integracoes.length} acessos conectados. O módulo só lê: nada é publicado, pausado ou respondido nas ferramentas.`}
      >
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {FERRAMENTAS.map((f) => (
            <li
              key={f.nome}
              className="flex min-w-0 flex-col gap-2 rounded-2xl border border-neutral-200 bg-white/60 p-4"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{f.nome}</span>
                <span className="block text-xs text-neutral-500">
                  {f.detalhe}
                </span>
              </span>
              <span className="flex flex-col gap-1">
                {f.sistemas.map((sistema) => {
                  const i = porSistema.get(sistema);
                  if (!i) return null;
                  const s = situacao(i);
                  return (
                    <a
                      key={sistema}
                      href={`#${sistema}`}
                      className="flex items-center gap-2 text-xs font-medium hover:underline"
                    >
                      <Ponto cor={COR_SITUACAO[s.tipo]} />
                      {f.sistemas.length > 1 &&
                        `${sistema === "mkt_youtube" ? "YouTube" : "Instagram e Facebook"}: `}
                      {s.texto}
                    </a>
                  );
                })}
              </span>
              <span className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {f.telas.map(([rotulo, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-neutral-600 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900"
                  >
                    {rotulo}
                  </Link>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <Fonte>
          Os números das telas continuam de exemplo até a leitura diária de cada
          ferramenta entrar (V3); ela vai usar os acessos conectados aqui.
        </Fonte>
      </Secao>

      {!cofre && (
        <p
          role="alert"
          className="flex items-start gap-3 rounded-[1.75rem] bg-amber-50 p-5 text-sm text-amber-900"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Falta a chave <code className="font-mono">INTEGRACOES_CHAVE</code>{" "}
            nas variáveis do servidor (Vercel). Sem ela não dá para salvar
            tokens.
          </span>
        </p>
      )}

      {integracoes.map((i) => (
        <CartaoIntegracao key={i.sistema} i={i} cofre={cofre} />
      ))}

      <BlocoAsana
        parametros={p}
        projetos={nomes.projetos}
        tags={nomes.tags}
        faltando={faltando}
      />
    </div>
  );
}
