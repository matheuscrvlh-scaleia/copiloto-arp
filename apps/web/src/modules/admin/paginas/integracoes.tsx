import {
  INTEGRACOES,
  RETORNO_RD,
  RETORNO_RD_CRM,
  type ResultadoRd,
} from "@arp/shared/integracoes";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Building,
  CircleCheck,
  FileSpreadsheet,
  Leaf,
  Megaphone,
  TriangleAlert,
} from "lucide-react";
import { Suspense, useEffect } from "react";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link, useBusca } from "@/lib/navegacao";
import { HistoricoDasIntegracoes } from "@/modules/admin/components/historico-integracoes";
import {
  CartaoIntegracao,
  COR_SITUACAO as COR,
  Ponto,
  situacao,
} from "@/modules/admin/components/integracao";
import { Situacao } from "@/modules/admin/components/ui";
import { consultaDasIntegracoes } from "../api";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Integrações"
        description="Acesso de cada sistema externo. Senhas e tokens são cifrados no servidor antes de gravar e nunca voltam para a tela."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="admin.integracoes">
          <Integracoes />
        </Protegido>
      </Suspense>
    </>
  );
}

const ehResultado = (v: unknown): v is ResultadoRd =>
  typeof v === "string" && v in RETORNO_RD;

function Integracoes() {
  const { rd, rdcrm } = useBusca();
  const retorno = ehResultado(rd)
    ? RETORNO_RD[rd]
    : ehResultado(rdcrm)
      ? RETORNO_RD_CRM[rdcrm]
      : null;
  const {
    data: { cofre, integracoes, historico },
  } = useSuspenseQuery(consultaDasIntegracoes("admin"));
  // A volta de uma autorização aponta o cartão (#rd_crm), que só existe
  // depois de os dados chegarem.
  useEffect(() => {
    const alvo = window.location.hash.slice(1);
    if (alvo) document.getElementById(alvo)?.scrollIntoView();
  }, []);
  const conectadas = integracoes.filter(
    (i) => situacao(i).tipo === "ok",
  ).length;

  return (
    <div className="flex flex-col gap-5">
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
            senhas e tokens. Gere 32 bytes em base64 e cadastre antes de
            continuar.
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
                de {integracoes.length}
              </span>
            </p>
          </div>
          <p className="max-w-sm text-xs text-[rgb(255_255_255/0.6)]">
            Cada uma é testada ao salvar, só com leituras. O teste do ponto não
            gasta o limite de cálculos por hora do Secullum.
          </p>
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {integracoes.map((i) => {
            const s = situacao(i);
            return (
              <li key={i.sistema}>
                <a
                  href={`#${i.sistema}`}
                  className="ladrilho flex h-full flex-col gap-2 rounded-2xl p-4 transition hover:bg-[rgb(255_255_255/0.1)]"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Ponto cor={COR[s.tipo]} />
                    {INTEGRACOES[i.sistema].nome}
                  </span>
                  <span className="text-xs text-[rgb(255_255_255/0.6)]">
                    {s.texto}
                  </span>
                </a>
              </li>
            );
          })}
          <li className="ladrilho flex flex-col gap-2 rounded-2xl p-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Ponto cor={COR.neutro} />
              ERP (ENET / EASE)
            </span>
            <span className="text-xs text-[rgb(255_255_255/0.6)]">
              API ainda não liberada
            </span>
          </li>
          <li>
            <Link
              href="/marketing/configuracoes/integracoes"
              className="ladrilho flex h-full flex-col gap-2 rounded-2xl p-4 transition hover:bg-[rgb(255_255_255/0.1)]"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Megaphone
                  className="size-3.5 text-[rgb(255_255_255/0.6)]"
                  aria-hidden
                />
                Ferramentas do Marketing
              </span>
              <span className="text-xs text-[rgb(255_255_255/0.6)]">
                Em Marketing › Configurações › Integrações →
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/sustentabilidade/configuracoes/integracoes"
              className="ladrilho flex h-full flex-col gap-2 rounded-2xl p-4 transition hover:bg-[rgb(255_255_255/0.1)]"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Leaf
                  className="size-3.5 text-[rgb(255_255_255/0.6)]"
                  aria-hidden
                />
                Energia solar (Growatt)
              </span>
              <span className="text-xs text-[rgb(255_255_255/0.6)]">
                Em Sustentabilidade › Configurações › Integrações →
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/rh/configuracoes/importacoes"
              className="ladrilho flex h-full flex-col gap-2 rounded-2xl p-4 transition hover:bg-[rgb(255_255_255/0.1)]"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheet
                  className="size-3.5 text-[rgb(255_255_255/0.6)]"
                  aria-hidden
                />
                Folha (Sousa e Couto)
              </span>
              <span className="text-xs text-[rgb(255_255_255/0.6)]">
                Por arquivo, em RH › Importar folha →
              </span>
            </Link>
          </li>
        </ul>
      </section>

      {integracoes.map((i) => (
        <CartaoIntegracao key={i.sistema} i={i} cofre={cofre} />
      ))}

      <section className="vidro flex flex-col items-start gap-4 rounded-[2rem] p-6 sm:flex-row sm:items-center">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
          <Building className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">ERP (ENET / EASE)</h2>
          <p className="text-sm text-neutral-500">
            Financeiro, faturamento e custos. O cadastro do token entra aqui
            assim que a EASE liberar a API.
          </p>
        </div>
        <Situacao tipo="neutro">Aguardando a EASE</Situacao>
      </section>

      <HistoricoDasIntegracoes linhas={historico} />
    </div>
  );
}
