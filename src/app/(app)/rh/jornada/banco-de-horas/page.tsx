import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { AbasDaJornada } from "@/components/rh/abas-jornada";
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  formatarNumero,
  formatarSaldoHoras,
  isoLocal,
} from "@/lib/formato";
import {
  ACOES_DO_BANCO,
  diferencaDoFechamento,
  podeFecharCiclo,
} from "@/lib/rh/banco-horas";
import { pode } from "@/server/auth";
import {
  fecharCiclo,
  finalizarCiclo,
  salvarFechamento,
} from "@/server/rh/acoes/banco-horas";
import {
  type CicloDoBanco,
  ciclosDoBanco,
  cicloVigente,
  fechamentoDoCiclo,
  type LinhaDoFechamento,
} from "@/server/rh/banco-horas";

export const metadata: Metadata = { title: "Fechamento do banco de horas" };

type Aba = "atual" | "anteriores";

export default function Page({
  searchParams,
}: PageProps<"/rh/jornada/banco-de-horas">) {
  return (
    <>
      <PageHeader
        title="Fechamento do banco de horas"
        description="Fim do ciclo: saldo final de cada pessoa, valor calculado, ação e valor realizado na folha. O fechamento não entra no custo de pessoal (o pago já vem da folha)."
      />
      <div className="mb-5">
        <AbasDaJornada />
      </div>
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="rh.jornada">
          <Fechamento busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Fechamento({
  busca,
}: {
  busca: PageProps<"/rh/jornada/banco-de-horas">["searchParams"];
}) {
  const [b, individual, parametros, ciclo] = await Promise.all([
    busca,
    pode("rh.custo_pessoal.individual"),
    pode("rh.parametros"),
    cicloVigente(),
  ]);
  if (!individual)
    return (
      <Secao titulo="Sem acesso ao fechamento">
        <p className="text-sm text-neutral-600">
          O valor de cada pessoa revela o salário: o fechamento pede o custo
          individual de pessoal no cargo.
        </p>
      </Secao>
    );
  const ciclos = await ciclosDoBanco();
  const podeMexer = parametros;
  const aba: Aba = b.aba === "anteriores" ? "anteriores" : "atual";
  const finalizados = ciclos.filter((c) => c.finalizado_em);

  return (
    <div className="flex flex-col gap-5">
      <nav
        data-guia="abas-ciclo"
        aria-label="Fechamento"
        className="vidro flex w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-fit"
      >
        {(
          [
            ["atual", "Ciclo atual"],
            ["anteriores", "Ciclos anteriores"],
          ] as const
        ).map(([id, rotulo]) => (
          <Link
            key={id}
            href={`?aba=${id}`}
            scroll={false}
            aria-current={aba === id ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
              aba === id
                ? "bg-neutral-900 text-white shadow-sm"
                : "text-neutral-600 hover:bg-white/60 hover:text-neutral-900"
            }`}
          >
            {rotulo}
            {id === "anteriores" && finalizados.length > 0 && (
              <span className="rounded-full bg-neutral-900/[0.06] px-1.5 py-0.5 text-[11px] tabular-nums">
                {finalizados.length}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {aba === "atual" && (
        <CicloAtual
          ciclo={ciclo}
          aberto={
            ciclo
              ? (ciclos.find(
                  (c) => c.inicio === ciclo.inicio && !c.finalizado_em,
                ) ?? null)
              : null
          }
          podeMexer={podeMexer}
        />
      )}
      {aba === "anteriores" && (
        <Anteriores
          ciclos={finalizados}
          escolhido={typeof b.ciclo === "string" ? b.ciclo : null}
        />
      )}
    </div>
  );
}

async function CicloAtual({
  ciclo,
  aberto,
  podeMexer,
}: {
  ciclo: Awaited<ReturnType<typeof cicloVigente>>;
  aberto: CicloDoBanco | null;
  podeMexer: boolean;
}) {
  if (!ciclo)
    return (
      <Secao titulo="Ciclo não configurado">
        <p className="text-sm text-neutral-600">
          Informe o início e o fim do ciclo do banco de horas em Configurações ›
          Parâmetros.
        </p>
      </Secao>
    );
  const liberado = podeFecharCiclo(isoLocal(new Date()), ciclo.fim);
  const linhas = aberto ? await fechamentoDoCiclo(aberto) : [];

  return (
    <>
      <Secao
        titulo="Ciclo do banco de horas"
        descricao="Datas dos Parâmetros. Ao finalizar, o próximo ciclo começa no dia seguinte ao fim, com a mesma duração."
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ["Início", formatarData(ciclo.inicio)],
              ["Fim", formatarData(ciclo.fim)],
              ["Adicional do positivo", `${formatarNumero(ciclo.adicional)}%`],
            ].map(([r, v]) => (
              <div
                key={r}
                className="rounded-2xl bg-neutral-900/[0.04] px-4 py-3"
              >
                <dt className="text-[11px] text-neutral-500">{r}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          {podeMexer && !aberto && (
            <div className="flex flex-col items-end gap-1">
              {liberado ? (
                <FormAcao
                  acao={fecharCiclo}
                  rotulo="Fechar ciclo"
                  rotuloEnviando="Fechando…"
                />
              ) : (
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-full bg-neutral-900/10 px-5 py-2.5 text-sm font-medium text-neutral-500"
                >
                  Fechar ciclo
                </button>
              )}
              {!liberado && (
                <p className="text-xs text-neutral-500">
                  Liberado a partir de {formatarData(ciclo.fim)}.
                </p>
              )}
            </div>
          )}
        </div>
      </Secao>

      {aberto && (
        <ListaDoFechamento
          ciclo={aberto}
          linhas={linhas}
          editavel={podeMexer}
        />
      )}
      {aberto && podeMexer && (
        <Secao
          titulo="Finalizar ciclo"
          descricao="Fica só leitura: guarda os totais, a data e quem finalizou, e os Parâmetros passam ao próximo ciclo. Quem ainda está com o valor da folha fica com ele. Salve a lista antes."
        >
          <div className="flex flex-wrap items-center gap-3">
            <FormAcao
              acao={finalizarCiclo}
              rotulo="Finalizar ciclo"
              rotuloEnviando="Finalizando…"
              confirmar={`Finalizar o ciclo de ${formatarData(aberto.inicio)} a ${formatarData(aberto.fim)}? Depois disso o fechamento não muda mais.`}
            >
              <input type="hidden" name="ciclo_id" value={aberto.id} />
            </FormAcao>
            <FormAcao
              acao={fecharCiclo}
              rotulo="Refazer a lista"
              rotuloEnviando="Refazendo…"
              variante="secundario"
              confirmar="Refazer a lista com o ponto de hoje? As ações e os valores realizados editados se perdem."
            >
              <input type="hidden" name="refazer" value="1" />
            </FormAcao>
          </div>
        </Secao>
      )}
      <Nota>
        Saldo final = BSaldo do ponto (Secullum) no último dia do ciclo.
        Calculado: positivo × salário/hora × (1 + adicional); negativo ×
        salário/hora (da última folha calculada até o fim do ciclo). Realizado:
        rubrica 408 e as do grupo “banco de horas” nas folhas do mês do fim e do
        seguinte; dá para editar. O saldo do próximo ciclo continua vindo do
        ponto: ele volta a zero quando o ciclo também é fechado no Secullum.
      </Nota>
    </>
  );
}

/** A lista por pessoa: editável enquanto o ciclo não é finalizado. */
function ListaDoFechamento({
  ciclo,
  linhas,
  editavel,
}: {
  ciclo: CicloDoBanco;
  linhas: LinhaDoFechamento[];
  editavel: boolean;
}) {
  const finalizado = !!ciclo.finalizado_em;
  const realizadoDe = (l: LinhaDoFechamento) =>
    l.valor_realizado ?? l.realizado_folha;
  const somar = (f: (l: LinhaDoFechamento) => number | null) =>
    linhas.reduce((s, l) => s + (f(l) ?? 0), 0);
  const totalCalculado = somar((l) => l.valor_calculado);
  const totalRealizado = somar(realizadoDe);
  const comDiferenca = linhas.filter(
    (l) =>
      (diferencaDoFechamento(l.valor_calculado, realizadoDe(l)) ?? 0) !== 0,
  ).length;

  const tabela = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] text-sm">
        <thead>
          <tr className="text-left text-xs text-neutral-500">
            <th className="py-2 pr-3 font-medium">Pessoa</th>
            <th className="py-2 pr-3 text-right font-medium">Saldo final</th>
            <th className="py-2 pr-3 text-right font-medium">Calculado</th>
            <th className="py-2 pr-3 font-medium">Ação</th>
            <th className="py-2 pr-3 text-right font-medium">Realizado</th>
            <th className="py-2 text-right font-medium">Diferença</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const realizado = realizadoDe(l);
            const dif = diferencaDoFechamento(l.valor_calculado, realizado);
            const destaque = dif !== null && dif !== 0;
            return (
              <tr
                key={l.colaborador_id}
                className={`border-t border-neutral-900/[0.06] tabular-nums ${destaque ? "bg-amber-50" : ""}`}
              >
                <td className="py-2 pr-3">
                  <p className="font-medium">{l.nome}</p>
                  <p className="text-xs text-neutral-500">{l.departamento}</p>
                </td>
                <td className="py-2 pr-3 text-right">
                  {formatarSaldoHoras(l.saldo_min)}
                </td>
                <td className="py-2 pr-3 text-right">
                  {l.valor_calculado === null
                    ? "sem salário/hora"
                    : formatarMoeda(l.valor_calculado)}
                </td>
                <td className="py-2 pr-3">
                  {editavel && !finalizado ? (
                    <select
                      name={`acao_${l.colaborador_id}`}
                      defaultValue={l.acao ?? ""}
                      aria-label={`Ação de ${l.nome}`}
                      className={classeCampo}
                    >
                      <option value="">—</option>
                      {Object.entries(ACOES_DO_BANCO).map(([v, r]) => (
                        <option key={v} value={v}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    (ACOES_DO_BANCO[l.acao as keyof typeof ACOES_DO_BANCO] ??
                    "—")
                  )}
                </td>
                <td className="py-2 pr-3 text-right">
                  {editavel && !finalizado ? (
                    <input
                      name={`realizado_${l.colaborador_id}`}
                      inputMode="decimal"
                      defaultValue={
                        l.valor_realizado === null
                          ? ""
                          : formatarNumero(l.valor_realizado, 2)
                      }
                      placeholder={
                        l.realizado_folha === null
                          ? "sem na folha"
                          : `${formatarNumero(l.realizado_folha, 2)} (folha)`
                      }
                      aria-label={`Valor realizado de ${l.nome}`}
                      className={`${classeCampo} w-36 text-right`}
                    />
                  ) : (
                    formatarMoeda(realizado)
                  )}
                </td>
                <td
                  className={`py-2 text-right ${destaque ? "font-semibold text-amber-800" : "text-neutral-500"}`}
                >
                  {dif === null
                    ? "—"
                    : `${dif > 0 ? "+" : ""}${formatarMoeda(dif)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-900/15 font-semibold tabular-nums">
            <td className="py-2 pr-3">Total</td>
            <td className="py-2 pr-3 text-right">
              {formatarSaldoHoras(linhas.reduce((s, l) => s + l.saldo_min, 0))}
            </td>
            <td className="py-2 pr-3 text-right">
              {formatarMoeda(totalCalculado)}
            </td>
            <td />
            <td className="py-2 pr-3 text-right">
              {formatarMoeda(totalRealizado)}
            </td>
            <td className="py-2 text-right">
              {formatarMoeda(totalRealizado - totalCalculado)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <Secao
      titulo={`Por pessoa: ${formatarData(ciclo.inicio)} a ${formatarData(ciclo.fim)}`}
      descricao={`${linhas.length} pessoas · ${comDiferenca} com diferença entre calculado e realizado (em destaque)${!finalizado ? " · realizado vazio = o da folha" : ""}`}
    >
      {editavel && !finalizado ? (
        <FormAcao acao={salvarFechamento} rotulo="Salvar fechamento">
          <input type="hidden" name="ciclo_id" value={ciclo.id} />
          {tabela}
        </FormAcao>
      ) : (
        tabela
      )}
    </Secao>
  );
}

async function Anteriores({
  ciclos,
  escolhido,
}: {
  ciclos: CicloDoBanco[];
  escolhido: string | null;
}) {
  if (ciclos.length === 0)
    return (
      <Secao titulo="Ciclos anteriores">
        <p className="text-sm text-neutral-600">
          Nenhum ciclo finalizado ainda.
        </p>
      </Secao>
    );
  const aberto = ciclos.find((c) => c.id === escolhido) ?? null;
  const linhas = aberto ? await fechamentoDoCiclo(aberto) : [];
  return (
    <>
      <Secao
        titulo="Ciclos anteriores"
        descricao="Ciclos finalizados, só leitura. Clique para ver cada pessoa."
      >
        <ul className="flex flex-col gap-2">
          {ciclos.map((c) => {
            const dif =
              c.total_realizado !== null && c.total_calculado !== null
                ? c.total_realizado - c.total_calculado
                : null;
            return (
              <li key={c.id}>
                <Link
                  href={`?aba=anteriores&ciclo=${c.id}`}
                  scroll={false}
                  className={`grid gap-x-4 gap-y-1 rounded-2xl px-4 py-3 ring-1 transition sm:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))] ${c.id === escolhido ? "bg-white ring-neutral-900/20" : "bg-white/50 ring-neutral-900/[0.06] hover:bg-white"}`}
                >
                  <span className="font-semibold">
                    {formatarData(c.inicio)} a {formatarData(c.fim)}
                  </span>
                  <span className="text-sm tabular-nums">
                    Saldo {formatarSaldoHoras(c.total_saldo_min ?? 0)}
                  </span>
                  <span className="text-sm tabular-nums">
                    Calculado {formatarMoeda(c.total_calculado)}
                  </span>
                  <span className="text-sm tabular-nums">
                    Realizado {formatarMoeda(c.total_realizado)}
                    {dif !== null && dif !== 0 && (
                      <span className="ml-1 text-amber-800">
                        ({dif > 0 ? "+" : ""}
                        {formatarMoeda(dif)})
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {c.finalizado_em
                      ? `${formatarDataHora(c.finalizado_em)} · ${c.finalizado_por ?? "—"}`
                      : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Secao>
      {aberto && (
        <ListaDoFechamento ciclo={aberto} linhas={linhas} editavel={false} />
      )}
    </>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-11" />
      <CartaoCarregando altura="h-40" />
      <CartaoCarregando altura="h-96" />
    </TelaCarregando>
  );
}
