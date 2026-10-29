import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SeloIlustrativo } from "@/components/dashboard/indicador";
import { Secao } from "@/components/dashboard/tabela";
import { Fonte } from "@/components/marketing/tela";
import { Protegido } from "@/components/protegido";
import { conferirAsana, nomesDoAsana } from "@/lib/marketing/parametros";
import { parametros } from "@/server/marketing/base";
import { dadosAsana, FONTE_EXEMPLO } from "@/server/marketing/fontes";
import { historicoMkt } from "@/server/marketing/parametros";
import { BlocoAsana } from "../blocos";
import { EsqueletoConfiguracoes, TopoConfiguracoes } from "../topo";

export const metadata: Metadata = { title: "Integrações do Marketing" };

// Ferramentas que alimentam o módulo (spec 4.1). Só leitura: nada é
// publicado, pausado ou respondido nelas. Por ora todas entregam os dados de
// exemplo; quem libera cada acesso está em docs/integracoes.md.
const FERRAMENTAS = [
  {
    nome: "Meta Ads",
    detalhe: "Facebook e Instagram",
    telas: [["Performance de anúncios", "/marketing/anuncios"]],
  },
  {
    nome: "Google Ads",
    detalhe: "Inclui YouTube e termos de pesquisa",
    telas: [["Performance de anúncios", "/marketing/anuncios"]],
  },
  {
    nome: "TikTok",
    detalhe: "Ads e conta Business",
    telas: [
      ["Performance de anúncios", "/marketing/anuncios"],
      ["Redes sociais", "/marketing/redes"],
    ],
  },
  {
    nome: "Google Analytics 4 e Search Console",
    detalhe: "Tráfego do site e buscas no Google",
    telas: [["Site e leads", "/marketing/site"]],
  },
  {
    nome: "RD Station Marketing",
    detalhe: "Leads e landing pages; base do custo por lead",
    telas: [
      ["Site e leads", "/marketing/site"],
      ["Performance de anúncios", "/marketing/anuncios"],
    ],
  },
  {
    nome: "Instagram, Facebook e YouTube",
    detalhe: "Foto diária de seguidores, alcance e posts",
    telas: [["Redes sociais", "/marketing/redes"]],
  },
  {
    nome: "Google Perfil da Empresa",
    detalhe: "Avaliações da ARP e dos locatários monitorados",
    telas: [["Reputação", "/marketing/reputacao"]],
  },
  {
    nome: "Asana",
    detalhe: "Tarefas, calendário de eventos e ronda (nomes logo abaixo)",
    telas: [["Radar operacional", "/marketing/radar"]],
  },
  {
    nome: "Estacionamento (WPS)",
    detalhe: "Passagens nas cancelas; a placa nunca sai do servidor",
    telas: [["Público e visitação", "/marketing/publico"]],
  },
] as const;

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
  const [p, asana, historico] = await Promise.all([
    parametros(),
    dadosAsana(),
    historicoMkt(1),
  ]);
  const nomes = nomesDoAsana(asana);
  const faltando = conferirAsana(p, nomes).filter((c) => !c.existe);

  return (
    <div className="flex flex-col gap-6">
      <TopoConfiguracoes ultima={historico[0]} />
      <Secao
        tom="escuro"
        titulo="Ferramentas ligadas"
        descricao="De onde vem cada número do Marketing. O módulo só lê: nada é publicado, pausado ou respondido nas ferramentas."
      >
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {FERRAMENTAS.map((f) => (
            <li
              key={f.nome}
              className="flex min-w-0 flex-col gap-2 rounded-2xl border border-neutral-200 bg-white/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{f.nome}</span>
                  <span className="block text-xs text-neutral-500">
                    {f.detalhe}
                  </span>
                </span>
                <SeloIlustrativo texto="Dados de exemplo" />
              </div>
              <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
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
        <Fonte>{FONTE_EXEMPLO}</Fonte>
      </Secao>
      <BlocoAsana
        parametros={p}
        projetos={nomes.projetos}
        tags={nomes.tags}
        faltando={faltando}
      />
    </div>
  );
}
