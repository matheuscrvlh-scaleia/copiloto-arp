import type { IntegracaoNaTela } from "@arp/shared/admin/contratos";
import {
  INTEGRACOES,
  resultadoDoProduto,
  type Sistema,
} from "@arp/shared/integracoes";
import { Link } from "@/lib/navegacao";
import {
  COR_SITUACAO,
  Ponto,
  situacao,
} from "@/modules/admin/components/integracao";

// De onde vem cada número do Marketing (spec 4.1), no grupo do Marketing em
// Configurações › Integrações. Um login do Google e um token da Meta servem
// a vários produtos, cada um testado à parte; o YouTube tem login próprio
// (o canal está em outra conta Google). Quem libera cada acesso está em
// docs/integracoes.md.
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
    detalhe: "Tarefas, calendário de eventos e ronda",
    fontes: [{ sistema: "mkt_asana" }],
    telas: [
      ["Radar operacional", "/marketing/radar"],
      ["Nomes dos projetos", "/marketing/configuracoes?bloco=asana"],
    ],
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

/** Cada ferramenta do Marketing, a situação de cada produto e as telas que ela alimenta. */
export function FerramentasDoMarketing({
  integracoes,
}: {
  integracoes: IntegracaoNaTela[];
}) {
  const porSistema = new Map<Sistema, IntegracaoNaTela>(
    integracoes.map((i) => [i.sistema, i]),
  );
  return (
    <details className="group rounded-[1.75rem] border border-neutral-200 bg-white/50 p-5">
      <summary className="cursor-pointer text-sm font-semibold">
        De onde vem cada número do Marketing
        <span className="ml-2 text-xs font-normal text-neutral-500">
          produto por produto e as telas que cada um alimenta
        </span>
      </summary>
      <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
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
      <p className="mt-3 text-xs text-neutral-500">
        Ferramenta ainda não ligada (YouTube, Perfil da Empresa e TikTok) fica
        vazia nas telas, sem número de exemplo, até a leitura diária dela
        entrar. A agenda do site já é a real, relida a cada hora.
      </p>
    </details>
  );
}
