import type { IntegracaoNaTela } from "@arp/shared/admin/contratos";
import {
  type Descoberta,
  ehSistema,
  ehSistemaGoogle,
  INTEGRACOES,
  MODULOS_DE_INTEGRACAO,
  RETORNO_GOOGLE,
  RETORNO_RD,
  RETORNO_RD_CRM,
  RETORNO_TIKTOK,
  type Sistema,
  type SistemaGoogle,
} from "@arp/shared/integracoes";
import { useSuspenseQueries } from "@tanstack/react-query";
import {
  Bot,
  Building,
  CircleCheck,
  Handshake,
  type LucideIcon,
  Megaphone,
  Plug,
  Store,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Carregando } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { clienteDeConsultas } from "@/lib/consulta";
import { Link, useBusca } from "@/lib/navegacao";
import { useSessao } from "@/lib/sessao";
import { consultaDasIntegracoes } from "@/modules/admin/api";
import { HistoricoDasIntegracoes } from "@/modules/admin/components/historico-integracoes";
import {
  CartaoIntegracao,
  COR_SITUACAO as COR,
  Ponto,
  situacao,
} from "@/modules/admin/components/integracao";
import { Situacao } from "@/modules/admin/components/ui";
import { consultaDasDescobertas } from "@/modules/marketing/api";
import { FerramentasDoMarketing } from "@/modules/marketing/components/configuracoes/ferramentas";
import {
  PERMISSOES_INTEGRACOES,
  PERMISSOES_POR_MODULO,
} from "../permissoes-integracoes";

// Configurações › Integrações: todos os sistemas externos numa tela só,
// agrupados pela área do shopping que cada um alimenta (não pelo módulo que
// guarda a credencial). Cada grupo aparece para quem pode configurar alguma
// integração dele: admin.integracoes vê tudo; marketing.parametros e
// sustentabilidade.parametros veem as do próprio módulo (o servidor confere
// de novo em GET /admin/integracoes?modulo=).

interface Grupo {
  id: string;
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  sistemas: Sistema[];
}

const GRUPOS: Grupo[] = [
  {
    id: "pessoas",
    titulo: "Pessoas e ponto",
    descricao:
      "Funcionários, jornada e batidas de ponto. A folha (Sousa e Couto) entra por arquivo, em RH › Configurações › Importações.",
    icone: Users,
    sistemas: ["secullum", "copiloto_rh"],
  },
  {
    id: "operacao",
    titulo: "Operação do shopping",
    descricao:
      "Estacionamento, fluxo de pessoas, obras e a geração da usina solar.",
    icone: Store,
    sistemas: ["wps", "cameras", "diario_de_obras", "sus_growatt"],
  },
  {
    id: "comercial",
    titulo: "Comercial e leads",
    descricao:
      "Negociações do CRM e leads das landing pages (o Comercial e o Marketing usam os dois).",
    icone: Handshake,
    sistemas: ["rd_crm", "mkt_rd_station"],
  },
  {
    id: "marketing",
    titulo: "Marketing e redes",
    descricao:
      "Anúncios, redes sociais, site, reputação e tarefas. Só leitura: nada é publicado, pausado ou respondido nas ferramentas.",
    icone: Megaphone,
    sistemas: [
      "mkt_google",
      "mkt_youtube",
      "mkt_meta",
      "mkt_tiktok",
      "mkt_asana",
      "mkt_site",
    ],
  },
  {
    id: "ia",
    titulo: "Inteligência artificial",
    descricao: "A chave e o modelo do assistente IA ARP.",
    icone: Bot,
    sistemas: ["claude"],
  },
];

/** Sistema novo que ainda não ganhou grupo não some da tela. */
const SEM_GRUPO = new Set<Sistema>(GRUPOS.flatMap((g) => g.sistemas));

export default function Page() {
  return (
    <Suspense fallback={<Carregando />}>
      <Protegido permissao={PERMISSOES_INTEGRACOES}>
        <Integracoes />
      </Protegido>
    </Suspense>
  );
}

/** O que a conta Google conectada acessa (nunca falha: null). */
const buscarDescobertas = (
  sistema: SistemaGoogle,
): Promise<Record<string, Descoberta> | null> =>
  clienteDeConsultas
    .fetchQuery(consultaDasDescobertas(sistema))
    .then((r) => r.descobertas)
    .catch(() => null);

const texto = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

/** v é uma das chaves de o (o texto da volta de uma autorização). */
const ehChave = <T extends object>(
  o: T,
  v: string | undefined,
): v is Extract<keyof T, string> => v !== undefined && v in o;

/** Aviso da volta de uma autorização (RD, RD CRM, Google, YouTube, TikTok). */
function useRetorno() {
  const b = useBusca();
  const [rd, rdcrm, google, sistema, tiktok] = [
    texto(b.rd),
    texto(b.rdcrm),
    texto(b.google),
    texto(b.sistema),
    texto(b.tiktok),
  ];
  if (ehChave(RETORNO_RD, rd)) return RETORNO_RD[rd];
  if (ehChave(RETORNO_RD, rdcrm)) return RETORNO_RD_CRM[rdcrm];
  const textosGoogle =
    RETORNO_GOOGLE[
      sistema && ehSistemaGoogle(sistema) ? sistema : "mkt_google"
    ];
  if (ehChave(textosGoogle, google)) return textosGoogle[google];
  if (ehChave(RETORNO_TIKTOK, tiktok)) return RETORNO_TIKTOK[tiktok];
  return null;
}

function Integracoes() {
  const sessao = useSessao();
  const retorno = useRetorno();
  const modulos = MODULOS_DE_INTEGRACAO.filter((m) =>
    sessao.pode(PERMISSOES_POR_MODULO[m]),
  );
  const respostas = useSuspenseQueries({
    queries: modulos.map((m) => consultaDasIntegracoes(m)),
  });
  const cofre = respostas.every((r) => r.data.cofre);
  const todas = respostas.flatMap((r) => r.data.integracoes);
  const porSistema = new Map<Sistema, IntegracaoNaTela>(
    todas.map((i) => [i.sistema, i]),
  );
  const grupos = [
    ...GRUPOS,
    {
      id: "outras",
      titulo: "Outras",
      descricao: "Integrações ainda sem área definida.",
      icone: Plug,
      sistemas: todas.map((i) => i.sistema).filter((s) => !SEM_GRUPO.has(s)),
    },
  ]
    .map((g) => ({
      ...g,
      itens: g.sistemas.flatMap((s) => {
        const i = porSistema.get(s);
        return i ? [i] : [];
      }),
    }))
    .filter((g) => g.itens.length > 0);
  const historico = (respostas[0]?.data.historico ?? []).filter(
    (h) => ehSistema(h.sistema) && porSistema.has(h.sistema),
  );
  const conectadas = todas.filter((i) => situacao(i).tipo === "ok").length;
  const comErro = todas.filter((i) => situacao(i).tipo === "erro").length;

  // As listas do Google e do YouTube (o que cada conta acessa) chegam
  // depois, no cartão. A mesma promessa em todo desenho da tela.
  const [descobertas] = useState(() =>
    modulos.includes("marketing")
      ? {
          mkt_google: buscarDescobertas("mkt_google"),
          mkt_youtube: buscarDescobertas("mkt_youtube"),
        }
      : null,
  );
  // A volta de uma autorização aponta o cartão (#mkt_google), que só existe
  // depois de os dados chegarem.
  useEffect(() => {
    const alvo = window.location.hash.slice(1);
    if (alvo) document.getElementById(alvo)?.scrollIntoView();
  }, []);

  return (
    <div className="flex flex-col gap-6">
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
            nas variáveis do servidor. Sem ela não dá para salvar senhas e
            tokens. Gere 32 bytes em base64 e cadastre antes de continuar.
          </span>
        </p>
      )}

      <section className="destaque rounded-[2rem] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[rgb(255_255_255/0.6)]">Conectadas</p>
            <p className="mt-1 text-5xl font-semibold tracking-tight">
              {conectadas}
              <span className="text-2xl text-[rgb(255_255_255/0.4)]">
                {" "}
                de {todas.length}
              </span>
            </p>
            {comErro > 0 && (
              <p className="mt-1 text-sm text-amber-300">
                {comErro} com falha no último teste
              </p>
            )}
          </div>
          <p className="max-w-sm text-xs text-[rgb(255_255_255/0.6)]">
            Senhas e tokens são cifrados no servidor antes de gravar e nunca
            voltam para a tela. Cada acesso é testado ao salvar, só com
            leituras; o teste do ponto não gasta o limite de cálculos por hora
            do Secullum.
          </p>
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {grupos.map((g) => {
            const ok = g.itens.filter((i) => situacao(i).tipo === "ok").length;
            return (
              <li key={g.id}>
                <a
                  href={`#grupo-${g.id}`}
                  className="ladrilho flex h-full flex-col gap-2 rounded-2xl p-4 transition hover:bg-[rgb(255_255_255/0.1)]"
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <g.icone
                        className="size-3.5 text-[rgb(255_255_255/0.6)]"
                        aria-hidden
                      />
                      {g.titulo}
                    </span>
                    <span className="text-xs text-[rgb(255_255_255/0.6)]">
                      {ok}/{g.itens.length}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {g.itens.map((i) => (
                      <span
                        key={i.sistema}
                        className="flex items-center gap-1.5 text-xs text-[rgb(255_255_255/0.6)]"
                      >
                        <Ponto cor={COR[situacao(i).tipo]} />
                        {INTEGRACOES[i.sistema].nome}
                      </span>
                    ))}
                  </span>
                </a>
              </li>
            );
          })}
          {modulos.includes("admin") && (
            <li className="ladrilho flex flex-col gap-2 rounded-2xl p-4">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Building
                  className="size-3.5 text-[rgb(255_255_255/0.6)]"
                  aria-hidden
                />
                Financeiro (ERP)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[rgb(255_255_255/0.6)]">
                <Ponto cor={COR.neutro} />
                ENET / EASE: API ainda não liberada
              </span>
            </li>
          )}
        </ul>
      </section>

      {grupos.map((g) => (
        <section
          key={g.id}
          id={`grupo-${g.id}`}
          aria-labelledby={`titulo-${g.id}`}
          className="flex scroll-mt-6 flex-col gap-4"
        >
          <header className="flex items-start gap-3 px-1">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
              <g.icone className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id={`titulo-${g.id}`} className="text-xl font-semibold">
                {g.titulo}
              </h2>
              <p className="text-sm text-neutral-500">{g.descricao}</p>
            </div>
          </header>
          {g.id === "marketing" && (
            <FerramentasDoMarketing integracoes={todas} />
          )}
          {g.id === "operacao" && porSistema.has("sus_growatt") && (
            <p className="px-1 text-sm text-neutral-600">
              Energia solar: depois de testar a Growatt, escolha “portal do
              inversor” como fonte da geração em{" "}
              <Link
                href="/operacoes/configuracoes/parametros?aba=contas"
                className="underline underline-offset-2"
              >
                Operações › Configurações › Parâmetros
              </Link>
              . A primeira leitura busca o histórico desde a criação da usina e
              leva alguns minutos.
            </p>
          )}
          {g.itens.map((i) => (
            <CartaoIntegracao
              key={i.sistema}
              i={i}
              cofre={cofre}
              descobertas={
                descobertas && ehSistemaGoogle(i.sistema)
                  ? descobertas[i.sistema]
                  : undefined
              }
            />
          ))}
        </section>
      ))}

      {modulos.includes("admin") && (
        <section
          id="grupo-financeiro"
          className="vidro flex flex-col items-start gap-4 rounded-[2rem] p-6 sm:flex-row sm:items-center"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
            <Building className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">
              Financeiro: ERP (ENET / EASE)
            </h2>
            <p className="text-sm text-neutral-500">
              Financeiro, faturamento e custos. O cadastro do token entra aqui
              assim que a EASE liberar a API.
            </p>
          </div>
          <Situacao tipo="neutro">Aguardando a EASE</Situacao>
        </section>
      )}

      <HistoricoDasIntegracoes linhas={historico} />
    </div>
  );
}
