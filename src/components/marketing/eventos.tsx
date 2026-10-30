import { CalendarDays, Clock, ExternalLink, Globe } from "lucide-react";
import Link from "next/link";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { Secao } from "@/components/dashboard/tabela";
import { BarraDeFiltros } from "@/components/marketing/filtros";
import {
  CartaoMkt,
  Cartoes,
  Fonte,
  hrefCom,
  TopoDaTela,
} from "@/components/marketing/tela";
import { BotaoExportar } from "@/components/os/exportar";
import {
  formatarData,
  formatarDataHora,
  formatarMes,
  formatarNumero,
} from "@/lib/formato";
import { type EventoSite, eventosEntre } from "@/lib/marketing/eventos";
import {
  diaDaSemana,
  linhaDeFiltros,
  somarDias,
} from "@/lib/marketing/periodo";
import { fimDoMes, mesesAFrente } from "@/lib/marketing/radar";
import type { AgendaDoSite } from "@/server/marketing/eventos";
import { Mes, TrocaVisao } from "./radar/calendario";
import { type PropsAba, plural } from "./radar/comum";

// Tela "Eventos do site": os eventos publicados no site da ARP (WordPress),
// lidos ao vivo pela integração de Configurações › Integrações. Mostra os
// próximos 6 meses em cartões ou em mês, e quantos eventos houve por mês.

export const BASE_EVENTOS = "/marketing/eventos";
const FONTE_SITE = "Site da ARP (agenda de eventos)";
const CARTOES: Record<string, string> = {
  semana: "Próximos 7 dias",
  proximos30: "Próximos 30 dias",
  mes: "Neste mês",
};
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const INTEGRACAO = "/marketing/configuracoes/integracoes#mkt_site";

export function AgendaDeEventos({
  p,
  agenda,
  meses,
}: {
  p: PropsAba;
  agenda: AgendaDoSite;
  /** Os 6 meses ("aaaa-mm-01"), do atual em diante. */
  meses: string[];
}) {
  if (agenda.situacao !== "ok") return <SemAgenda agenda={agenda} />;

  const { hoje } = p;
  const cartao = p.um("cartao");
  const visao = p.um("visao") === "mes" ? "mes" : "lista";
  const q = p.um("q").trim().toLowerCase();
  const mesUrl = `${p.um("mes")}-01`;
  const mes = meses.includes(mesUrl) ? mesUrl : (meses[0] as string);
  const ate6 = fimDoMes(meses.at(-1) as string);
  const mesAtual = meses[0] as string;

  const todos = agenda.eventos.filter(
    (e) => !q || `${e.titulo} ${e.descricao}`.toLowerCase().includes(q),
  );
  const futuros = eventosEntre(todos, hoje, ate6);
  const em7 = eventosEntre(futuros, hoje, somarDias(hoje, 6));
  const em30 = eventosEntre(futuros, hoje, somarDias(hoje, 29));
  const noMes = eventosEntre(todos, mesAtual, fimDoMes(mesAtual));
  const lista =
    cartao === "semana"
      ? em7
      : cartao === "proximos30"
        ? em30
        : cartao === "mes"
          ? noMes
          : futuros;
  const passados = todos.filter((e) => e.fim < hoje).length;

  const lidoEm = `Agenda lida do site em ${formatarDataHora(agenda.lidoEm)}`;
  const linhaFiltros = linhaDeFiltros([
    {
      rotulo: "Período",
      valor: `Próximos 6 meses (${formatarData(hoje)} a ${formatarData(ate6)})`,
    },
    ...(cartao ? [{ rotulo: "Cartão", valor: CARTOES[cartao] ?? cartao }] : []),
    ...(q ? [{ rotulo: "Busca", valor: p.um("q") }] : []),
  ]);
  const hrefCartao = (k: string) =>
    hrefCom(BASE_EVENTOS, p.busca, { cartao: cartao === k ? null : k });

  // 6 meses para trás, o atual e 5 para frente. Do dia 1, −180 dias cai
  // sempre no 6º mês anterior (6 meses têm de 181 a 184 dias).
  const porMes = mesesAFrente(somarDias(mesAtual, -180), 12).map((m) => ({
    mes: m,
    eventos: eventosEntre(todos, m, fimDoMes(m)).length,
  }));

  return (
    <>
      <BarraDeFiltros
        tela="eventos"
        hoje={hoje}
        lembrado={p.lembrado}
        busca={{
          chave: "q",
          valor: p.um("q"),
          placeholder: "Buscar evento do site…",
        }}
      />

      <TopoDaTela
        dadosDe={lidoEm}
        filtros={linhaFiltros}
        exemplo={false}
        acoes={
          p.exportar ? (
            <BotaoExportar
              titulo="Agenda de eventos do site"
              filtros={`${linhaFiltros} · ${lidoEm}`}
              nomeArquivo="agenda-do-site"
              colunas={COLUNAS_EXPORTAR}
              linhas={lista.map((e) => [
                formatarData(e.inicio),
                e.fim !== e.inicio ? formatarData(e.fim) : "",
                e.horario ?? "",
                e.titulo,
                e.descricao,
                e.link,
              ])}
            />
          ) : undefined
        }
      />

      <Cartoes>
        <CartaoMkt
          titulo="Próximos 7 dias"
          valor={formatarNumero(em7.length)}
          detalhe={proximoTexto(em7[0])}
          fonte={FONTE_SITE}
          href={hrefCartao("semana")}
          ativo={cartao === "semana"}
        />
        <CartaoMkt
          titulo="Próximos 30 dias"
          valor={formatarNumero(em30.length)}
          detalhe={`${plural(futuros.length, "evento", "eventos")} nos próximos 6 meses`}
          fonte={FONTE_SITE}
          href={hrefCartao("proximos30")}
          ativo={cartao === "proximos30"}
        />
        <CartaoMkt
          titulo={`Em ${formatarMes(mesAtual)}`}
          valor={formatarNumero(noMes.length)}
          detalhe={`${noMes.filter((e) => e.fim < hoje).length} já passaram`}
          fonte={FONTE_SITE}
          href={hrefCartao("mes")}
          ativo={cartao === "mes"}
        />
        <CartaoMkt
          titulo="Publicados no site"
          valor={formatarNumero(todos.length)}
          detalhe={`${formatarNumero(passados)} já aconteceram`}
          fonte={FONTE_SITE}
        />
      </Cartoes>

      <TrocaVisao visao={visao} busca={p.busca} base={BASE_EVENTOS} />

      {visao === "lista" ? (
        <Secao
          titulo={cartao ? (CARTOES[cartao] ?? "Eventos") : "Próximos eventos"}
          descricao="Do mais próximo ao mais distante, como estão publicados no site."
        >
          {lista.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Nenhum evento nesse filtro.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {agruparPorMes(lista, hoje).map(([m, evs]) => (
                <section key={m} className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold capitalize text-neutral-700">
                    {formatarMes(m)}
                    <span className="ml-2 font-normal text-neutral-400">
                      {plural(evs.length, "evento", "eventos")}
                    </span>
                  </h3>
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {evs.map((e) => (
                      <CartaoEvento key={e.id} e={e} hoje={hoje} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <Fonte>
            {FONTE_SITE}: título, data e hora, descrição, imagem e link de cada
            evento publicado. Evento de vários dias aparece no mês em que
            começa.
          </Fonte>
        </Secao>
      ) : (
        <Secao titulo={`Calendário de ${formatarMes(mes)}`}>
          <Mes
            mes={mes}
            meses={meses}
            hoje={hoje}
            eventos={todos}
            busca={p.busca}
            base={BASE_EVENTOS}
            chave={(e) => String(e.id)}
            chip={(e, largo) => <Chip e={e} largo={largo} />}
          />
          <Fonte>
            {FONTE_SITE}. Clique no evento para abrir a página dele.
          </Fonte>
        </Secao>
      )}

      <Secao
        tom="escuro"
        titulo="Eventos por mês"
        descricao="Publicados no site, dos últimos 6 meses aos próximos 5"
      >
        <Colunas
          descricao="Eventos do site por mês"
          itens={porMes.map((m) => ({
            chave: m.mes,
            rotulo: formatarMes(m.mes).slice(0, 3),
            titulo:
              m.mes === mesAtual
                ? `${formatarMes(m.mes)} (mês atual)`
                : formatarMes(m.mes),
            valor: m.eventos,
            texto: formatarNumero(m.eventos),
            destaque: m.mes === mesAtual,
          }))}
        />
        <Fonte>
          {FONTE_SITE}. Evento de vários dias conta em cada mês que ele ocupa;
          os meses à frente só têm o que já foi publicado.
        </Fonte>
      </Secao>
    </>
  );
}

function SemAgenda({
  agenda,
}: {
  agenda: Exclude<AgendaDoSite, { situacao: "ok" }>;
}) {
  const texto =
    agenda.situacao === "erro"
      ? `${agenda.mensagem} Confira o endereço e use "Testar conexão".`
      : agenda.situacao === "desativada"
        ? "A integração com o site está desativada."
        : "Falta o endereço da agenda de eventos do site.";
  return (
    <Secao
      titulo="Eventos do site"
      descricao="Os eventos publicados no site da ARP aparecem aqui."
    >
      <p
        role={agenda.situacao === "erro" ? "alert" : undefined}
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600"
      >
        <Globe className="size-4 shrink-0" aria-hidden />
        {texto}
        <Link
          href={INTEGRACAO}
          className="font-medium text-neutral-900 underline underline-offset-4"
        >
          Abrir Configurações › Integrações
        </Link>
      </p>
    </Secao>
  );
}

function proximoTexto(e: EventoSite | undefined): string {
  if (!e) return "Nenhum evento publicado para a semana";
  return `Próximo: ${e.titulo} (${formatarData(e.inicio).slice(0, 5)})`;
}

/** Eventos agrupados pelo mês em que começam (ou o atual, se já começaram). */
function agruparPorMes(
  lista: EventoSite[],
  hoje: string,
): [string, EventoSite[]][] {
  const grupos = new Map<string, EventoSite[]>();
  for (const e of lista) {
    const m = `${(e.inicio < hoje ? hoje : e.inicio).slice(0, 7)}-01`;
    const g = grupos.get(m);
    if (g) g.push(e);
    else grupos.set(m, [e]);
  }
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function quando(e: EventoSite, hoje: string): string {
  const dia = (d: string) =>
    `${SEMANA[diaDaSemana(d) % 7]}, ${formatarData(d).slice(0, 5)}`;
  if (e.fim !== e.inicio)
    return e.inicio < hoje
      ? `Em cartaz até ${dia(e.fim)}`
      : `${dia(e.inicio)} a ${dia(e.fim)}`;
  if (e.inicio === hoje) return "Hoje";
  if (e.inicio === somarDias(hoje, 1)) return `Amanhã, ${dia(e.inicio)}`;
  return dia(e.inicio);
}

function CartaoEvento({ e, hoje }: { e: EventoSite; hoje: string }) {
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-neutral-900/[0.06] bg-white/70">
      <a
        href={e.link}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-[16/9] overflow-hidden bg-neutral-100"
      >
        {e.imagem ? (
          // biome-ignore lint/performance/noImgElement: imagem do site da ARP (domínio de terceiros, sem otimização do Next)
          <img
            src={e.imagem}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <CalendarDays
            className="absolute inset-0 m-auto size-8 text-neutral-300"
            aria-hidden
          />
        )}
        <span className="absolute top-3 left-3 rounded-full bg-neutral-900/85 px-3 py-1 text-xs font-semibold text-white">
          {quando(e, hoje)}
        </span>
      </a>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h4 className="text-sm leading-snug font-semibold">
          <a
            href={e.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {e.titulo}
          </a>
        </h4>
        {e.horario && (
          <p className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Clock className="size-3.5" aria-hidden />
            {e.horario}
          </p>
        )}
        {e.descricao && (
          <p className="line-clamp-2 text-xs text-neutral-600">{e.descricao}</p>
        )}
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs font-medium">
          <a
            href={e.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-700 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900"
          >
            Ver no site
          </a>
          {e.linkExterno && (
            <a
              href={e.linkExterno}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-neutral-500 hover:text-neutral-900"
            >
              Link do evento
              <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

function Chip({ e, largo }: { e: EventoSite; largo: boolean }) {
  return (
    <a
      href={e.link}
      target="_blank"
      rel="noopener noreferrer"
      title={`${e.titulo}${e.horario ? ` · ${e.horario}` : ""}`}
      className={`block rounded-lg border-l-[3px] border-neutral-900 bg-white/70 px-1.5 py-1 text-xs hover:bg-white ${largo ? "" : "truncate"}`}
    >
      {e.horario && !largo && (
        <span className="mr-1 text-neutral-500 tabular-nums">
          {e.horario.slice(0, 5)}
        </span>
      )}
      <span className="font-medium">{e.titulo}</span>
      {largo && e.horario && (
        <span className="block text-neutral-500">{e.horario}</span>
      )}
    </a>
  );
}

const COLUNAS_EXPORTAR = [
  { titulo: "Início" },
  { titulo: "Fim" },
  { titulo: "Horário" },
  { titulo: "Evento" },
  { titulo: "Descrição" },
  { titulo: "Link" },
];
