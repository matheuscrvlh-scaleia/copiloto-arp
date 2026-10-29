import {
  Building,
  FileSpreadsheet,
  Megaphone,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoIntegracao,
  COR_SITUACAO as COR,
  Ponto,
  situacao,
} from "@/components/admin/integracao";
import { Situacao } from "@/components/admin/ui";
import { Tabela } from "@/components/dashboard/tabela";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarDataHora, formatarNumero } from "@/lib/formato";
import { INTEGRACOES } from "@/lib/integracoes";
import { type Execucao, integracoesNaTela } from "@/server/admin/dados";

export const metadata: Metadata = { title: "Integrações" };

// "Sincronizar agora" roda depois da resposta, dentro deste limite.
export const maxDuration = 300;

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

async function Integracoes() {
  const { cofre, integracoes, historico } = await integracoesNaTela();
  const conectadas = integracoes.filter(
    (i) => situacao(i).tipo === "ok",
  ).length;

  return (
    <div className="flex flex-col gap-5">
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

      <Historico linhas={historico} />
    </div>
  );
}

const NOME_SISTEMA: Record<string, string> = Object.fromEntries(
  Object.entries(INTEGRACOES).map(([k, v]) => [k, v.nome]),
);

function Historico({ linhas }: { linhas: Execucao[] }) {
  return (
    <section className="vidro rounded-[2rem] p-6">
      <h2 className="text-lg font-semibold">Últimas sincronizações</h2>
      <p className="mt-1 text-xs text-neutral-500">
        As 15 execuções mais recentes, automáticas ou pedidas aqui.
      </p>
      <div className="mt-4">
        <Tabela
          linhas={linhas}
          chave={(l) => `${l.sistema}-${l.recurso}-${l.iniciado_em}`}
          vazio="Nenhuma sincronização ainda."
          colunas={[
            {
              titulo: "Sistema",
              valor: (l) => NOME_SISTEMA[l.sistema] ?? l.sistema,
            },
            { titulo: "Início", valor: (l) => formatarDataHora(l.iniciado_em) },
            {
              titulo: "Duração",
              numero: true,
              valor: (l) => duracao(l.iniciado_em, l.finalizado_em),
            },
            {
              titulo: "Situação",
              valor: (l) =>
                l.status === "sucesso" ? (
                  <Situacao tipo="ok">Sucesso</Situacao>
                ) : l.status === "erro" ? (
                  <Situacao tipo="erro">Erro</Situacao>
                ) : (
                  <Situacao tipo="rodando">Rodando</Situacao>
                ),
            },
            {
              titulo: "Registros",
              numero: true,
              valor: (l) => formatarNumero(l.registros),
            },
            {
              titulo: "Detalhe",
              valor: (l) =>
                l.erro || l.avisos.length === 0 ? (
                  <span
                    className="block max-w-md truncate text-xs text-neutral-500"
                    title={l.erro ?? undefined}
                  >
                    {l.erro ?? "—"}
                  </span>
                ) : (
                  <details className="max-w-md text-xs text-neutral-600">
                    <summary className="cursor-pointer font-medium text-amber-900">
                      {formatarNumero(l.avisos.length)}{" "}
                      {l.avisos.length > 1 ? "avisos" : "aviso"} para conferir
                    </summary>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {l.avisos.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </details>
                ),
            },
          ]}
        />
      </div>
    </section>
  );
}

function duracao(inicio: string, fim: string | null): string {
  if (!fim) return "—";
  const s = Math.max(
    0,
    Math.round((Date.parse(fim) - Date.parse(inicio)) / 1000),
  );
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
}
