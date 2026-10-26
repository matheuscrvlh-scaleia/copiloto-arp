import {
  Building,
  CalendarClock,
  Car,
  FileSpreadsheet,
  HardHat,
  KeyRound,
  type LucideIcon,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Situacao } from "@/components/admin/ui";
import { Tabela } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarDataHora, formatarNumero } from "@/lib/formato";
import { INTEGRACOES, type Sistema } from "@/lib/integracoes";
import {
  removerIntegracao,
  salvarIntegracao,
  sincronizarAgora,
  testarIntegracao,
} from "@/server/admin/acoes/integracoes";
import {
  type Execucao,
  type IntegracaoNaTela,
  integracoesNaTela,
} from "@/server/admin/dados";

export const metadata: Metadata = { title: "Integrações" };

// "Sincronizar agora" roda depois da resposta, dentro deste limite.
export const maxDuration = 300;

const ICONE: Record<Sistema, LucideIcon> = {
  secullum: CalendarClock,
  wps: Car,
  diario_de_obras: HardHat,
  copiloto_rh: Users,
};

const COR = { ok: "#58c069", erro: "#d03b3b", neutro: "#6e6e6e" } as const;

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

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

type Tipo = "ok" | "erro" | "neutro";

function situacao(i: IntegracaoNaTela): { tipo: Tipo; texto: string } {
  if (i.origem === null) return { tipo: "neutro", texto: "Não configurada" };
  if (!i.ativa) return { tipo: "neutro", texto: "Desativada" };
  if (i.origem === "ambiente")
    return { tipo: "neutro", texto: "Pelo ambiente do servidor" };
  if (i.testeOk === true) return { tipo: "ok", texto: "Conectada" };
  if (i.testeOk === false) return { tipo: "erro", texto: "Falhou no teste" };
  return { tipo: "neutro", texto: "Não testada" };
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
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
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

function Ponto({ cor }: { cor: string }) {
  return (
    <span
      className="size-2.5 shrink-0 rounded-full shadow-[0_0_12px_currentColor]"
      style={{ backgroundColor: cor, color: cor }}
      aria-hidden
    />
  );
}

function CartaoIntegracao({
  i,
  cofre,
}: {
  i: IntegracaoNaTela;
  cofre: boolean;
}) {
  const def = INTEGRACOES[i.sistema];
  const Icone = ICONE[i.sistema];
  const s = situacao(i);
  const salva = i.origem === "tela";

  return (
    <section
      id={i.sistema}
      className="vidro grid scroll-mt-6 grid-cols-1 gap-6 rounded-[2rem] p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
            <Icone className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{def.nome}</h2>
            <p className="text-sm text-neutral-500">{def.serve}</p>
          </div>
        </div>
        <div>
          <Situacao tipo={s.tipo}>{s.texto}</Situacao>
        </div>
        <dl className="flex flex-col gap-1 text-xs text-neutral-500">
          {i.testeMensagem && (
            <div>
              <dt className="sr-only">Último teste</dt>
              <dd className="text-sm text-neutral-700">{i.testeMensagem}</dd>
            </div>
          )}
          {i.testadoEm && (
            <div>
              <dt className="inline">Testada em </dt>
              <dd className="inline">{formatarDataHora(i.testadoEm)}</dd>
            </div>
          )}
          {salva && i.configuradoEm && (
            <div>
              <dt className="inline">Configurada em </dt>
              <dd className="inline">
                {formatarDataHora(i.configuradoEm)}
                {i.configuradoPor ? ` por ${i.configuradoPor}` : ""}
              </dd>
            </div>
          )}
          {i.origem === "ambiente" && (
            <div>
              <dt className="sr-only">Origem</dt>
              <dd>
                Funcionando com as variáveis de ambiente do servidor. Salve aqui
                para gerenciar pela tela; a credencial salva passa a valer.
              </dd>
            </div>
          )}
        </dl>
        {i.origem !== null && (
          <div className="mt-auto flex flex-wrap gap-2">
            <FormAcao
              acao={testarIntegracao}
              rotulo="Testar conexão"
              rotuloEnviando="Testando…"
              variante="secundario"
            >
              <input type="hidden" name="sistema" value={i.sistema} />
            </FormAcao>
            {(i.sistema === "secullum" ||
              i.sistema === "copiloto_rh" ||
              i.sistema === "wps") &&
              i.ativa && (
                <FormAcao
                  acao={sincronizarAgora}
                  rotulo="Sincronizar agora"
                  rotuloEnviando="Iniciando…"
                  variante="secundario"
                >
                  <input type="hidden" name="sistema" value={i.sistema} />
                </FormAcao>
              )}
            {salva && (
              <FormAcao
                acao={removerIntegracao}
                rotulo="Remover"
                rotuloEnviando="Removendo…"
                variante="perigo"
                confirmar={`Remover a credencial de ${def.nome}? Sem ela, a integração volta a usar o ambiente do servidor (se houver) ou para.`}
              >
                <input type="hidden" name="sistema" value={i.sistema} />
              </FormAcao>
            )}
          </div>
        )}
      </div>

      <FormAcao
        acao={salvarIntegracao}
        rotulo="Salvar e testar"
        rotuloEnviando="Testando…"
        className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white/60 p-5"
      >
        <input type="hidden" name="sistema" value={i.sistema} />
        <fieldset disabled={!cofre} className="flex flex-col gap-4">
          <legend className="sr-only">Acesso a {def.nome}</legend>
          {def.campos.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {def.campos.map((c) => (
                <label key={c.nome} className={rotulo}>
                  {c.rotulo}
                  <input
                    name={c.nome}
                    type={c.tipo === "number" ? "text" : c.tipo}
                    inputMode={c.tipo === "number" ? "numeric" : undefined}
                    required
                    autoComplete="off"
                    placeholder={c.exemplo}
                    defaultValue={
                      salva ? String(i.parametros[c.nome] ?? "") : undefined
                    }
                    className={classeCampo}
                  />
                  {c.ajuda && (
                    <span className="font-normal text-neutral-400">
                      {c.ajuda}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
          <label className={rotulo}>
            <span className="flex items-center gap-1.5">
              <KeyRound className="size-3.5" aria-hidden />
              {def.segredo.rotulo}
            </span>
            <input
              name="segredo"
              type="password"
              autoComplete="new-password"
              required={!salva}
              placeholder={
                salva ? "•••••••• salva — deixe em branco para manter" : ""
              }
              className={`${classeCampo} font-mono`}
            />
            {def.segredo.ajuda && (
              <span className="font-normal text-neutral-400">
                {def.segredo.ajuda}
              </span>
            )}
          </label>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="ativa"
                defaultChecked={salva ? i.ativa : true}
                className="size-4 accent-neutral-900"
              />
              Ativa
            </label>
            <label className="flex items-center gap-2 text-neutral-500">
              <input
                type="checkbox"
                name="sem_teste"
                className="size-4 accent-neutral-900"
              />
              Salvar mesmo se o teste falhar
            </label>
          </div>
        </fieldset>
      </FormAcao>
    </section>
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
