import { CircleCheck, TriangleAlert } from "lucide-react";
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
import { Fonte } from "@/components/dashboard/tela";
import { Protegido } from "@/components/protegido";
import {
  ehSistemaGoogle,
  INTEGRACOES,
  RETORNO_GOOGLE,
  RETORNO_RD,
  RETORNO_TIKTOK,
  type ResultadoAutorizacao,
  type ResultadoGoogle,
  type ResultadoRd,
  resultadoDoProduto,
  type Sistema,
} from "@/lib/integracoes";
import { conferirAsana, nomesDoAsana } from "@/lib/marketing/parametros";
import { type IntegracaoNaTela, integracoesNaTela } from "@/server/admin/dados";
import { parametros } from "@/server/marketing/base";
import { descobertasDaTela } from "@/server/marketing/descoberta-google";
import { dadosAsana } from "@/server/marketing/fontes";
import { historicoMkt } from "@/server/marketing/parametros";
import { BlocoAsana } from "../blocos";
import { EsqueletoConfiguracoes, TopoConfiguracoes } from "../topo";

export const metadata: Metadata = { title: "Integrações do Marketing" };
// "Sincronizar agora" do RD roda depois de responder (after), nesta página.
export const maxDuration = 300;

// Ferramentas que alimentam o módulo (spec 4.1). Só leitura: nada é
// publicado, pausado ou respondido nelas. São 7 acessos, salvos e testados
// aqui (cifrados, como em Administração › Integrações): um login do Google e
// um token da Meta servem a vários produtos, cada um testado à parte; o
// YouTube tem login próprio (o canal está em outra conta Google). Quem
// libera cada acesso está em docs/integracoes.md.
interface Origem {
  sistema: Sistema;
  /** Produto de uma conexão que serve a vários (PRODUTOS). */
  produto?: string;
}

const FERRAMENTAS: {
  nome: string;
  detalhe: string;
  fontes: Origem[];
  telas: [string, string][];
}[] = [
  {
    nome: "Meta Ads",
    detalhe: "Facebook e Instagram",
    fontes: [{ sistema: "mkt_meta", produto: "Meta Ads" }],
    telas: [["Performance de anúncios", "/marketing/anuncios"]],
  },
  {
    nome: "Google Ads",
    detalhe: "Inclui anúncios no YouTube e termos de pesquisa",
    fontes: [{ sistema: "mkt_google", produto: "Google Ads" }],
    telas: [["Performance de anúncios", "/marketing/anuncios"]],
  },
  {
    nome: "TikTok",
    detalhe: "Ads e conta Business",
    fontes: [{ sistema: "mkt_tiktok" }],
    telas: [
      ["Performance de anúncios", "/marketing/anuncios"],
      ["Redes sociais", "/marketing/redes"],
    ],
  },
  {
    nome: "Google Analytics 4 e Search Console",
    detalhe: "Tráfego do site e buscas no Google",
    fontes: [
      { sistema: "mkt_google", produto: "Analytics 4" },
      { sistema: "mkt_google", produto: "Search Console" },
    ],
    telas: [["Site e leads", "/marketing/site"]],
  },
  {
    nome: "RD Station Marketing",
    detalhe: "Leads e landing pages; base do custo por lead",
    fontes: [{ sistema: "mkt_rd_station" }],
    telas: [
      ["Site e leads", "/marketing/site"],
      ["Performance de anúncios", "/marketing/anuncios"],
    ],
  },
  {
    nome: "Instagram, Facebook e YouTube",
    detalhe: "Foto diária de seguidores, alcance e posts",
    fontes: [
      { sistema: "mkt_meta", produto: "Instagram" },
      { sistema: "mkt_meta", produto: "Facebook" },
      { sistema: "mkt_youtube" },
    ],
    telas: [["Redes sociais", "/marketing/redes"]],
  },
  {
    nome: "Google Perfil da Empresa",
    detalhe: "Avaliações da ARP e dos locatários monitorados",
    fontes: [{ sistema: "mkt_google", produto: "Perfil da Empresa" }],
    telas: [["Reputação", "/marketing/reputacao"]],
  },
  {
    nome: "Asana",
    detalhe: "Tarefas, calendário de eventos e ronda (nomes logo abaixo)",
    fontes: [{ sistema: "mkt_asana" }],
    telas: [["Radar operacional", "/marketing/radar"]],
  },
  {
    nome: "Site (agenda de eventos)",
    detalhe: "Eventos publicados no WordPress; endereço público",
    fontes: [{ sistema: "mkt_site" }],
    telas: [["Eventos", "/marketing/eventos"]],
  },
];

/** Situação de um produto: a da conexão, refinada pelo último teste. */
function situacaoDaFonte(i: IntegracaoNaTela, produto?: string) {
  const s = situacao(i);
  if (!produto || i.origem === null || !i.ativa || i.testeOk === null) return s;
  const r = resultadoDoProduto(i.testeMensagem, produto);
  if (r === true) return { tipo: "ok" as const, texto: "Conectado" };
  if (r === false) return { tipo: "erro" as const, texto: "Falhou no teste" };
  return { tipo: "neutro" as const, texto: "Id não preenchido" };
}

export default function Page({
  searchParams,
}: PageProps<"/marketing/configuracoes/integracoes">) {
  return (
    <Suspense fallback={<EsqueletoConfiguracoes />}>
      <Protegido permissao="marketing.parametros">
        <Tela busca={searchParams} />
      </Protegido>
    </Suspense>
  );
}

async function Tela({
  busca,
}: {
  busca: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { rd, google, sistema, tiktok } = await busca;
  const textosGoogle =
    RETORNO_GOOGLE[ehSistemaGoogle(sistema) ? sistema : "mkt_google"];
  const retorno =
    typeof rd === "string" && rd in RETORNO_RD
      ? RETORNO_RD[rd as ResultadoRd]
      : typeof google === "string" && google in textosGoogle
        ? textosGoogle[google as ResultadoGoogle]
        : typeof tiktok === "string" && tiktok in RETORNO_TIKTOK
          ? RETORNO_TIKTOK[tiktok as ResultadoAutorizacao]
          : null;
  // As listas do Google e do YouTube (o que cada conta acessa) chegam
  // depois, no cartão.
  const descobertas = {
    mkt_google: descobertasDaTela("mkt_google"),
    mkt_youtube: descobertasDaTela("mkt_youtube"),
  };
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
                {f.fontes.map(({ sistema, produto }) => {
                  const i = porSistema.get(sistema);
                  if (!i) return null;
                  const s = situacaoDaFonte(i, produto);
                  return (
                    <a
                      key={`${sistema}-${produto}`}
                      href={`#${sistema}`}
                      className="flex items-center gap-2 text-xs font-medium hover:underline"
                    >
                      <Ponto cor={COR_SITUACAO[s.tipo]} />
                      {f.fontes.length > 1 &&
                        `${produto ?? INTEGRACOES[sistema].nome}: `}
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
          ferramenta entrar (V3); ela vai usar os acessos conectados aqui. A
          agenda do site já é a real, relida a cada hora.
        </Fonte>
      </Secao>

      {retorno && (
        <p
          role={retorno.ok ? "status" : "alert"}
          className={`flex items-start gap-3 rounded-[1.75rem] p-5 text-sm ${retorno.ok ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}
        >
          {retorno.ok ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <span>{retorno.texto}</span>
        </p>
      )}

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
        <CartaoIntegracao
          key={i.sistema}
          i={i}
          cofre={cofre}
          descobertas={
            ehSistemaGoogle(i.sistema) ? descobertas[i.sistema] : undefined
          }
        />
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
