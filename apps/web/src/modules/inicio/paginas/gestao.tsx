import type { Detalhe } from "@arp/shared/detalhe";
import {
  formatarData,
  formatarHoras,
  formatarMes,
  formatarNumero,
  formatarPct,
  formatarSaldoHoras,
  isoLocal,
} from "@arp/shared/formato";
import type { PessoasDoPainel } from "@arp/shared/gestao/contratos";
import { GRUPOS_SEMANA } from "@arp/shared/gestao/semana";
import { rotuloStatus, type Status } from "@arp/shared/indicadores";
import { ateNoMaximo, lerPeriodo } from "@arp/shared/periodo";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarCheck, Landmark } from "lucide-react";
import { Suspense, useDeferredValue, useMemo } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { AreaLinha } from "@/components/dashboard/graficos/area-linha";
import { BarrasDivergentes } from "@/components/dashboard/graficos/barras-divergentes";
import { ColunasEspelhadas } from "@/components/dashboard/graficos/colunas-espelhadas";
import { Faixas } from "@/components/dashboard/graficos/faixas";
import { Rosca } from "@/components/dashboard/graficos/rosca";
import { AbreDetalhe, ProvedorDetalhe } from "@/components/modal-detalhe";
import { Link, useBusca } from "@/lib/navegacao";
import { type Usuario, useSessao } from "@/lib/sessao";
import { consultaDaEmpresa } from "@/modules/admin/api";
import {
  consultaDaSemana,
  consultaDoPainel,
  filtrosDaBusca,
  tabelasDoMes,
} from "../api";

const COR_STATUS: Record<Status, string> = {
  ok: "#0ca30c",
  atencao: "#fab219",
  fora: "#d03b3b",
  sem_meta: "#8a8a8a",
  sem_dado: "#8a8a8a",
};

// O banner entra no esqueleto estático; o nome, os filtros e os números
// chegam cada um no seu <Suspense>. Os números e os detalhes ("quem forma
// este número") vêm prontos da API (GET /gestao/painel).

export default function Gestao() {
  return (
    <ProvedorDetalhe>
      <div className="flex flex-col gap-5">
        <Boasvindas>
          <Suspense fallback={<SaudacaoCarregando />}>
            <Saudacao />
          </Suspense>
        </Boasvindas>
        <Suspense fallback={<CartaoCarregando altura="h-40" />}>
          <MinhaSemana />
        </Suspense>
        <Suspense fallback={<EsqueletoPessoas />}>
          <Dashboard />
        </Suspense>
      </div>
    </ProvedorDetalhe>
  );
}

const veRh = (u: Usuario) => u.permissoes.some((p) => p.startsWith("rh."));
const veFinanceiro = (u: Usuario) =>
  u.permissoes.some((p) => p.startsWith("financeiro."));

/** Ponto de status: cor + texto (nunca só a cor). */
function PontoStatus({ s }: { s: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: COR_STATUS[s] }}
        aria-hidden
      />
      {rotuloStatus(s)}
    </span>
  );
}

/** Nome de quem entrou e da empresa no banner. */
function Saudacao() {
  const { usuario } = useSessao();
  const { data: dadosEmpresa } = useSuspenseQuery(consultaDaEmpresa);
  const nome = usuario.nome.split(/\s+/)[0] || usuario.nome;
  return (
    <>
      <p className="text-xs font-semibold tracking-[0.2em] text-[#8fd99b] uppercase">
        Gestão · {dadosEmpresa?.nome ?? "ARP"}
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
        Olá, {nome}
      </h1>
      <p className="mt-3 max-w-xl text-sm text-[rgb(255_255_255/0.82)] md:text-base">
        {veRh(usuario)
          ? "Quadro, jornada, banco de horas e movimento de pessoas em um só lugar."
          : veFinanceiro(usuario)
            ? "Os números do Financeiro entram aqui assim que a API do ENET for liberada."
            : "Seu acesso ainda não foi liberado. Fale com o administrador."}
      </p>
    </>
  );
}

/**
 * "Minha semana": a página inicial de cada pessoa, com os principais
 * desafios da semana nos módulos que ela acessa (agenda, Tickets, Comercial).
 */
function MinhaSemana() {
  const { data: s } = useSuspenseQuery(consultaDaSemana);
  const atrasados = s.desafios.filter((d) => d.atrasado).length;
  return (
    <section
      data-guia="minha-semana"
      data-guia-titulo="Minha semana"
      className="vidro flex flex-col gap-4 rounded-[2rem] p-6"
    >
      <header className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
          <CalendarCheck className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Minha semana</h2>
          <p className="text-xs text-neutral-500">
            {formatarData(s.de)} a {formatarData(s.ate)} ·{" "}
            {s.desafios.length
              ? `${formatarNumero(s.desafios.length)} ${s.desafios.length === 1 ? "item" : "itens"}${atrasados ? `, ${formatarNumero(atrasados)} atrasado${atrasados === 1 ? "" : "s"}` : ""}`
              : "nada pendente com você nesta semana"}
          </p>
        </div>
      </header>
      {s.desafios.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {s.desafios.slice(0, 12).map((d) => (
            <li key={`${d.href}|${d.titulo}`}>
              <Link
                href={d.href}
                className="flex h-full items-start gap-3 rounded-2xl bg-white/60 px-4 py-3 transition hover:bg-white"
              >
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${d.atrasado ? "bg-red-500/10 text-red-800" : "bg-neutral-900/[0.06] text-neutral-700"}`}
                >
                  {d.atrasado ? "Atrasado" : GRUPOS_SEMANA[d.grupo]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {d.titulo}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {d.atrasado ? `${GRUPOS_SEMANA[d.grupo]} · ` : ""}
                    {d.detalhe}
                  </span>
                </span>
                <ArrowUpRight
                  className="mt-0.5 size-4 shrink-0 text-neutral-400"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {s.desafios.length > 12 && (
        <p className="text-xs text-neutral-500">
          E mais {formatarNumero(s.desafios.length - 12)} — os atrasados e os
          mais próximos vêm primeiro.
        </p>
      )}
    </section>
  );
}

/** Filtro e cartões do RH; aviso do Financeiro. */
function Dashboard() {
  const { usuario } = useSessao();
  const busca = useBusca();
  // Data no futuro vira hoje (a API lê os mesmos parâmetros do mesmo jeito).
  const hoje = isoLocal(new Date());
  const periodo = ateNoMaximo(lerPeriodo(busca), hoje);
  const comRh = veRh(usuario);

  return (
    <>
      {comRh && (
        <FiltroPeriodo
          de={periodo.de}
          ate={periodo.ate}
          atalho={periodo.atalho}
          hoje={hoje}
        />
      )}

      {comRh && (
        <Suspense fallback={<EsqueletoPessoas />}>
          <Pessoas />
        </Suspense>
      )}

      {veFinanceiro(usuario) && (
        <section className="vidro flex flex-wrap items-center gap-4 rounded-[2rem] px-6 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
            <Landmark className="size-4" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-sm text-neutral-600">
            <span className="font-medium text-neutral-900">Financeiro:</span>{" "}
            inadimplência, faturado × recebido, contas a pagar e Performance &
            Capital ganham gráficos aqui quando a API do ENET for liberada.
          </p>
        </section>
      )}
    </>
  );
}

/**
 * A função que pede as listas de um mês, uma por competência: o modal
 * guarda o resultado pela função, então ela não pode mudar a cada desenho.
 */
const cargas = new Map<string, () => Promise<Detalhe["tabelas"]>>();
function cargaDoMes(c: string) {
  let carregar = cargas.get(c);
  if (!carregar) {
    carregar = () => tabelasDoMes(c);
    cargas.set(c, carregar);
  }
  return carregar;
}

/** Pessoas no período do filtro: quadro do Copiloto e ponto do Secullum. */
function Pessoas() {
  const busca = useBusca();
  // Adiado: ao trocar o filtro, a tela antiga fica até a nova chegar.
  const filtros = useDeferredValue(
    useMemo(() => filtrosDaBusca(busca), [busca]),
  );
  const { data: p } = useSuspenseQuery(consultaDoPainel(filtros));
  // As listas (todos os ativos de cada um dos 12 meses) vêm ao abrir.
  const meses = useMemo(
    () =>
      p?.detalhes.meses
        ? Object.fromEntries(
            Object.entries(p.detalhes.meses).map(
              ([c, d]): [string, Detalhe] => [
                c,
                { ...d, carregarTabelas: cargaDoMes(c) },
              ],
            ),
          )
        : undefined,
    [p],
  );
  if (!p) return null;
  return <Cartoes p={p} det={{ ...p.detalhes, meses }} />;
}

function Cartoes({
  p,
  det,
}: {
  p: PessoasDoPainel;
  det: Omit<PessoasDoPainel["detalhes"], "meses"> & {
    meses: Record<string, Detalhe> | undefined;
  };
}) {
  const {
    rotulo,
    mes,
    ate,
    ativos,
    ativosAnt,
    pendencias,
    totais,
    varAbs,
    movimento,
    evolucao,
    fluxo,
    tempoDeCasa,
    medianaCasa,
    setores,
    ultimaFolha,
  } = p;
  const maxAbs = Math.max(...setores.map((s) => s.absenteismo ?? 0), 1);
  const admissoes12 = fluxo.reduce((s, f) => s + f.acima, 0);
  const desligamentos12 = fluxo.reduce((s, f) => s + f.abaixo, 0);

  return (
    <>
      {(p.aviso.semDado || p.aviso.parcial) && (
        <p className="vidro rounded-2xl px-5 py-3 text-sm text-neutral-600">
          <span className="font-medium text-neutral-900">Ponto: </span>
          {p.aviso.semDado ?? p.aviso.parcial}
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Visão geral: cartão de destaque com os números do período. */}
        <section
          data-guia="secao"
          data-guia-titulo="Visão geral"
          className="destaque flex flex-col gap-6 rounded-[2rem] p-6 xl:col-span-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Visão geral</h2>
            <span className="ladrilho rounded-full px-3 py-1 text-xs">
              {rotulo}
            </span>
          </div>

          <div className="flex items-end gap-6">
            <AbreDetalhe
              detalhe={det.meses?.[mes]}
              className="-m-2 rounded-2xl p-2 hover:bg-[rgb(255_255_255/0.06)]"
            >
              <p className="text-6xl font-semibold tracking-tight">{ativos}</p>
              <p className="mt-1 text-sm text-[rgb(255_255_255/0.6)]">
                headcount · colaboradores ativos
              </p>
            </AbreDetalhe>
            <div
              className="mb-2 h-12 w-px bg-[rgb(255_255_255/0.15)]"
              aria-hidden
            />
            <div>
              <p className="text-4xl font-semibold tracking-tight">
                {pendencias}
              </p>
              <p className="mt-1 text-sm text-[rgb(255_255_255/0.6)]">
                pendências (no sino)
              </p>
            </div>
          </div>

          <div className="h-1 w-16 rounded-full bg-marca" aria-hidden />

          <div className="grid grid-cols-3 gap-3">
            <AbreDetalhe
              detalhe={det.absenteismo}
              className="ladrilho rounded-2xl p-3 hover:bg-[rgb(255_255_255/0.1)]"
            >
              <p className="text-[11px] text-[rgb(255_255_255/0.6)]">
                Absenteísmo
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {formatarPct(totais.absenteismo)}
              </p>
              <div className="mt-1 text-[rgb(255_255_255/0.75)]">
                <PontoStatus s={p.status.absenteismo} />
              </div>
              {varAbs && (
                <p className="mt-1 text-[11px] text-[rgb(255_255_255/0.45)]">
                  {varAbs} no mês
                </p>
              )}
            </AbreDetalhe>
            <AbreDetalhe
              detalhe={det.bancoPositivo}
              className="ladrilho rounded-2xl p-3 hover:bg-[rgb(255_255_255/0.1)]"
            >
              <p className="text-[11px] text-[rgb(255_255_255/0.6)]">
                Banco positivo
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {formatarSaldoHoras(totais.banco_positivo_min)}
              </p>
              <div className="mt-1 text-[rgb(255_255_255/0.75)]">
                <PontoStatus s={p.status.banco} />
              </div>
            </AbreDetalhe>
            <AbreDetalhe
              detalhe={det.meses?.[mes]}
              className="ladrilho rounded-2xl p-3 hover:bg-[rgb(255_255_255/0.1)]"
            >
              <p className="text-[11px] text-[rgb(255_255_255/0.6)]">
                Turnover
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {formatarPct(p.turnover)}
              </p>
              <div className="mt-1 text-[rgb(255_255_255/0.75)]">
                {p.status.turnover ? (
                  <PontoStatus s={p.status.turnover} />
                ) : (
                  <span
                    className="line-clamp-2 break-words text-xs"
                    title={p.turnoverMotivo ?? undefined}
                  >
                    {p.turnoverMotivo ?? ""}
                  </span>
                )}
              </div>
            </AbreDetalhe>
          </div>
        </section>

        {/* Evolução do quadro: área suave em vidro. */}
        <section
          data-guia="secao"
          data-guia-titulo="Evolução do headcount"
          className="vidro flex flex-col gap-4 rounded-[2rem] p-6 xl:col-span-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Evolução do headcount</h2>
              <p className="text-xs text-neutral-500">
                Colaboradores ativos no fim de cada mês
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-neutral-900 px-3 py-1 text-white">
                {ativos - ativosAnt >= 0 ? "+" : ""}
                {ativos - ativosAnt} vs {formatarData(p.anteriorAte)}
              </span>
              <span className="rounded-full border border-neutral-200 px-3 py-1 text-neutral-600">
                {movimento.admissoes} admissões
              </span>
              <span className="rounded-full border border-neutral-200 px-3 py-1 text-neutral-600">
                {movimento.desligamentos} desligamentos
              </span>
            </div>
          </div>
          <AreaLinha
            className="mt-auto"
            itens={evolucao}
            detalhes={det.meses}
            descricao="Colaboradores ativos no fim de cada mês, últimos 12 meses"
          />
        </section>
      </div>

      {/* Pessoas por setor: cartão preto largo, uma coluna por setor. */}
      <section
        data-guia="secao"
        data-guia-titulo="Pessoas por setor"
        className="tom-escuro rounded-[2rem] p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Pessoas por setor
            </h2>
            <p className="text-xs text-neutral-500">
              Ponto de {formatarData(mes)} a {formatarData(ate)}
              {ultimaFolha
                ? ` · última folha: ${formatarMes(ultimaFolha)}`
                : ""}
            </p>
          </div>
          <Link
            href="/rh"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-900/10 bg-neutral-900/[0.08] px-4 py-2 text-sm transition hover:bg-neutral-900/[0.14]"
          >
            Abrir o RH <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3 md:divide-x md:divide-neutral-900/10">
          {setores.map((s) => (
            <AbreDetalhe
              key={s.chave}
              detalhe={det.setores?.[s.chave]}
              className="flex flex-col gap-4 rounded-2xl p-2 hover:bg-neutral-900/[0.06] md:px-4 md:first:pl-2"
            >
              <div>
                <p className="text-base font-semibold">{s.departamento}</p>
                <p className="text-xs text-neutral-500">
                  {s.colaboradores} pessoas no ponto
                </p>
              </div>
              <div>
                <div className="flex items-baseline justify-between text-xs text-neutral-600">
                  <span>Absenteísmo</span>
                  <span className="text-sm font-semibold text-neutral-900">
                    {formatarPct(s.absenteismo)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-neutral-900/10">
                  <div
                    className="h-full rounded-full bg-neutral-900"
                    style={{
                      width: `${Math.max(((s.absenteismo ?? 0) / maxAbs) * 100, 2)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-4 text-xs text-neutral-600">
                <span>
                  Faltas{" "}
                  <b className="font-semibold text-neutral-900">
                    {formatarHoras(s.faltas_min)}
                  </b>
                </span>
                <span>
                  Banco{" "}
                  <b className="font-semibold text-neutral-900">
                    {formatarSaldoHoras(s.banco_saldo_min)}
                  </b>
                </span>
              </div>
            </AbreDetalhe>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Movimento de pessoas: admissões ↑ e desligamentos ↓ por mês. */}
        <section
          data-guia="secao"
          data-guia-titulo="Movimento de pessoas"
          className="vidro flex flex-col gap-4 rounded-[2rem] p-6 xl:col-span-5"
        >
          <div>
            <h2 className="text-lg font-semibold">Movimento de pessoas</h2>
            <p className="text-xs text-neutral-500">
              Últimos 12 meses: {admissoes12} admissões e {desligamentos12}{" "}
              desligamentos
            </p>
          </div>
          <ColunasEspelhadas
            itens={fluxo}
            detalhes={det.meses}
            rotulos={{ acima: "Admissões", abaixo: "Desligamentos" }}
            descricao="Admissões e desligamentos por mês, últimos 12 meses"
          />
        </section>

        {/* Banco de horas: débitos ← zero → créditos, por setor. */}
        <section
          data-guia="secao"
          data-guia-titulo="Banco de horas"
          className="destaque flex flex-col gap-5 rounded-[2rem] p-6 xl:col-span-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Banco de horas</h2>
              <p className="text-xs text-[rgb(255_255_255/0.6)]">
                Saldos do ponto por setor em {rotulo}
              </p>
            </div>
            <span className="ladrilho rounded-full px-3 py-1 text-xs">
              Saldo da empresa{" "}
              <b className="font-semibold">
                {formatarSaldoHoras(totais.banco_saldo_min)}
              </b>
            </span>
          </div>
          <BarrasDivergentes
            escuro
            detalhes={det.banco}
            descricao="Banco de horas por setor: débitos e créditos"
            rotulos={{
              negativo: "Débito (pessoas devem horas)",
              positivo: "Crédito (horas a folgar ou pagar)",
            }}
            linhas={setores.map((s) => ({
              chave: s.chave,
              rotulo: s.departamento,
              negativo: Math.abs(s.banco_negativo_min),
              positivo: s.banco_positivo_min,
              textoNegativo: formatarHoras(-Math.abs(s.banco_negativo_min)),
              textoPositivo: `${formatarSaldoHoras(s.banco_positivo_min)}`,
              resumo: `saldo ${formatarSaldoHoras(s.banco_saldo_min)}`,
              detalhe: `${s.colaboradores} pessoas · crédito ${formatarSaldoHoras(s.banco_positivo_min)} · débito ${formatarHoras(-Math.abs(s.banco_negativo_min))}`,
            }))}
          />
          <dl className="mt-auto grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                rotulo: "Créditos",
                valor: `${formatarSaldoHoras(totais.banco_positivo_min)}`,
              },
              {
                rotulo: "Débitos",
                valor: formatarHoras(-Math.abs(totais.banco_negativo_min)),
              },
              {
                rotulo: "Devem horas",
                valor: `${p.devemHoras} pessoas`,
              },
              {
                rotulo: "Têm crédito",
                valor: `${p.temCredito} pessoas`,
              },
            ].map((t) => (
              <div key={t.rotulo} className="ladrilho rounded-2xl p-3">
                <dt className="text-[11px] text-[rgb(255_255_255/0.6)]">
                  {t.rotulo}
                </dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">
                  {t.valor}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section
          data-guia="secao"
          data-guia-titulo="Tempo de casa"
          className="tom-verde flex flex-col gap-4 rounded-[2rem] p-6 xl:col-span-7"
        >
          <div>
            <h2 className="text-lg font-semibold">Tempo de casa</h2>
            <p className="text-xs text-neutral-500">
              Ativos em {formatarData(ate)} por faixa
              {medianaCasa !== null
                ? ` · metade está há até ${formatarNumero(medianaCasa / 12, 1)} anos`
                : ""}
            </p>
          </div>
          <Faixas
            className="flex-1"
            itens={tempoDeCasa}
            detalhes={det.tempo}
            descricao="Colaboradores ativos por faixa de tempo de casa"
          />
        </section>

        <section
          data-guia="secao"
          data-guia-titulo="Horas perdidas"
          className="vidro flex flex-col gap-4 rounded-[2rem] p-6 xl:col-span-5"
        >
          <div>
            <h2 className="text-lg font-semibold">Horas perdidas</h2>
            <p className="text-xs text-neutral-500">
              O que forma o absenteísmo de {rotulo}
            </p>
          </div>
          <Rosca
            detalhes={det.horas}
            descricao="Horas perdidas: faltas e atrasos"
            centro={{
              valor: formatarHoras(totais.faltas_min + totais.atrasos_min),
              rotulo: `de ${formatarHoras(totais.previstas_min)} previstas`,
            }}
            fatias={[
              {
                chave: "faltas",
                rotulo: "Faltas",
                valor: totais.faltas_min,
                texto: formatarHoras(totais.faltas_min),
                cor: 1,
              },
              {
                chave: "atrasos",
                rotulo: "Atrasos",
                valor: totais.atrasos_min,
                texto: formatarHoras(totais.atrasos_min),
                cor: 2,
              },
            ]}
          />
        </section>
      </div>
    </>
  );
}

/**
 * Banner de boas-vindas: fachada do Espaço ARP (letreiro à direita, à
 * mostra) levemente desfocada, sob um degradê preto à esquerda, onde fica o
 * texto. Escuro nos dois temas. A moldura e a foto não dependem da pessoa
 * (esqueleto estático); o texto chega em `children`.
 */
function Boasvindas({ children }: { children: React.ReactNode }) {
  return (
    <header className="relative isolate overflow-hidden rounded-[2rem] px-6 py-10 text-[#fff] shadow-[0_24px_50px_-28px_rgb(0_0_0/0.55)] md:px-10 md:py-12">
      <img
        src="/brand/banner-gestao.webp"
        alt=""
        fetchPriority="high"
        className="absolute inset-0 -z-30 size-full scale-105 object-cover object-[center_calc(36%_-_10px)] blur-[2px]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[linear-gradient(100deg,#0a0a0a_0%,rgb(10_10_10/0.92)_30%,rgb(10_10_10/0.55)_55%,rgb(10_10_10/0.12)_100%)]"
      />
      {children}
    </header>
  );
}

/** No lugar do texto do banner: as três linhas, na mesma altura. */
function SaudacaoCarregando() {
  const barra =
    "block animate-pulse rounded-full motion-reduce:animate-none bg-[rgb(255_255_255/0.12)]";
  return (
    <div aria-hidden>
      <span className={`${barra} h-4 w-40`} />
      <span className={`${barra} mt-2 h-10 w-64 md:h-12`} />
      <span className={`${barra} mt-3 h-5 w-full max-w-md md:h-6`} />
    </div>
  );
}

/** Blocos no lugar dos cartões de pessoas enquanto os dados chegam. */
function EsqueletoPessoas() {
  return (
    <TelaCarregando>
      <CartoesPessoasCarregando />
    </TelaCarregando>
  );
}

function CartoesPessoasCarregando() {
  return (
    <>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <CartaoCarregando className="xl:col-span-5" altura="h-80" />
        <CartaoCarregando className="xl:col-span-7" altura="h-80" />
      </div>
      <CartaoCarregando altura="h-72" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <CartaoCarregando className="xl:col-span-5" altura="h-80" />
        <CartaoCarregando className="xl:col-span-7" altura="h-80" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <CartaoCarregando className="xl:col-span-7" altura="h-80" />
        <CartaoCarregando className="xl:col-span-5" altura="h-80" />
      </div>
    </>
  );
}
