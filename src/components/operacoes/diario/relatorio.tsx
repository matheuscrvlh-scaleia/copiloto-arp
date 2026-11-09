import Link from "next/link";
import { type Coluna, Secao, Tabela } from "@/components/dashboard/tabela";
import type { Relatorio } from "@/connectors/diario-de-obras/schemas";
import { formatarHoras, formatarNumero } from "@/lib/formato";
import {
  efetivo,
  homemHora,
  producao,
  tiposMarcados,
} from "@/lib/operacoes/diario";
import { BASE, Condicao, dataHoraDoApp, pct, SeloTarefa } from "./comum";
import { Anexos, Galeria, Videos } from "./midia";

// Tela 4 — relatório completo, nas seções e na ordem do aplicativo.

const minutos = (m: number | null | undefined) =>
  m === null || m === undefined ? "—" : formatarHoras(m);
const vazio = (t: string) => <p className="text-sm text-neutral-500">{t}</p>;

type Turno = NonNullable<NonNullable<Relatorio["clima"]>["manha"]>;
type Atividade = Relatorio["atividades"][number];
type Ocorrencia = Relatorio["ocorrencias"][number];
type Pessoa = NonNullable<Relatorio["maoDeObra"]>["personalizada"][number];

const COLUNAS_CLIMA: Coluna<{ periodo: string; t: Turno | null }>[] = [
  { titulo: "Período", valor: (l) => l.periodo },
  { titulo: "Clima", valor: (l) => l.t?.clima ?? "—" },
  { titulo: "Condição", valor: (l) => <Condicao texto={l.t?.condicao} /> },
  {
    titulo: "Expediente",
    valor: (l) =>
      l.t?.ativo === false ? (
        <span className="text-neutral-500">Sem expediente</span>
      ) : (
        "Sim"
      ),
  },
];

const COLUNAS_PESSOAS: Coluna<Pessoa>[] = [
  { titulo: "Nome", valor: (p) => p.nome },
  { titulo: "Função", valor: (p) => p.funcao ?? "—" },
  {
    titulo: "Presença",
    valor: (p) =>
      p.presenca ? "Sim" : <span className="text-red-700">Não</span>,
  },
  {
    titulo: "Horário",
    valor: (p) =>
      p.horaInicio && p.horaFim ? `${p.horaInicio}–${p.horaFim}` : "—",
  },
  {
    titulo: "Intervalo",
    numero: true,
    valor: (p) => minutos(p.horasIntervalo),
  },
  {
    titulo: "Horas trabalhadas",
    numero: true,
    valor: (p) => minutos(p.horasTrabalhadas),
  },
];

function colunasAtividades(obraId: string): Coluna<Atividade>[] {
  return [
    { titulo: "Item", valor: (a) => a.item ?? "—" },
    {
      titulo: "Atividade",
      valor: (a) => (
        <span className="flex flex-col">
          {a.cronograma && a.tarefaId ? (
            <Link
              href={`${BASE}/${encodeURIComponent(obraId)}/tarefas/${encodeURIComponent(a.tarefaId)}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {a.descricao}
            </Link>
          ) : (
            a.descricao
          )}
          {a.etapa?.descricao && (
            <span className="text-xs text-neutral-500">
              Etapa {a.etapa.item ?? ""} {a.etapa.descricao}
            </span>
          )}
          {a.observacao && (
            <span className="text-xs text-neutral-600">{a.observacao}</span>
          )}
        </span>
      ),
    },
    {
      titulo: "Anterior → atual",
      numero: true,
      valor: (a) =>
        `${pct(a.porcentagemAnterior ?? null)} → ${pct(a.porcentagem ?? null)}`,
    },
    {
      titulo: "Produção",
      valor: (a) => {
        const p = producao(a.controleDeProducao);
        return p
          ? `${formatarNumero(p.acumulado, 2)} de ${formatarNumero(p.quantidade, 2)} ${p.unidade}`
          : "—";
      },
    },
    {
      titulo: "Horário",
      valor: (a) =>
        a.horario?.inicio && a.horario.fim
          ? `${a.horario.inicio}–${a.horario.fim}`
          : (a.horario?.descricao ?? "—"),
    },
    {
      titulo: "Status",
      valor: (a) => <SeloTarefa id={a.status?.id ?? null} />,
    },
    {
      titulo: "Fotos",
      numero: true,
      valor: (a) => formatarNumero(a.fotos.length),
    },
  ];
}

function Ocorrencias({ lista }: { lista: Ocorrencia[] }) {
  if (lista.length === 0) return vazio("Nenhuma ocorrência.");
  return (
    <ul className="flex flex-col gap-3">
      {lista.map((o) => {
        const tipos = tiposMarcados(o);
        return (
          <li
            key={o._id}
            className="rounded-2xl bg-neutral-900/[0.04] px-4 py-3 text-sm"
          >
            {tipos.length > 0 && (
              <p className="mb-1 flex flex-wrap gap-1.5">
                {tipos.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900"
                  >
                    {t}
                  </span>
                ))}
              </p>
            )}
            <p>{o.descricao}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {[
                o.tarefa?.descricao ? `Tarefa: ${o.tarefa.descricao}` : null,
                o.horario?.inicio && o.horario.fim
                  ? `${o.horario.inicio}–${o.horario.fim}`
                  : null,
                o.fotos.length
                  ? `${o.fotos.length} ${o.fotos.length === 1 ? "foto" : "fotos"}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {o.fotos.length > 0 && (
              <div className="mt-2">
                <Galeria fotos={o.fotos} limite={12} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Materiais({ r }: { r: Relatorio }) {
  const m = r.controleDeMaterial;
  const linha = (
    titulo: string,
    itens: { descricao: string; quantidade?: string | null }[],
  ) => (
    <div>
      <h3 className="text-xs font-medium text-neutral-500">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-sm text-neutral-500">Nada lançado.</p>
      ) : (
        <ul className="mt-1 text-sm">
          {itens.map((i, k) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: o mesmo material pode aparecer duas vezes; a posição é a identidade
            <li key={k}>
              {i.descricao}:{" "}
              <span className="tabular-nums">{i.quantidade ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {linha("Recebido", m?.recebido ?? [])}
      {linha("Utilizado", m?.utilizado ?? [])}
    </div>
  );
}

/** Seções do relatório completo (Tela 4). */
export function RelatorioCompleto({
  r,
  obraId,
}: {
  r: Relatorio;
  obraId: string;
}) {
  const h = r.horarioDeTrabalho;
  const m = r.maoDeObra;
  const opcao = m?.opcaoSelecionada;
  const ef = efetivo(m);
  const hh = homemHora(m);
  const fotosNaGaleria = r.galeriaDeFotos;
  return (
    <div className="flex flex-col gap-6" data-guia="op-diario-relatorio">
      <Secao titulo="Horário de trabalho">
        {h ? (
          <p className="text-sm">
            Expediente {h.expedienteInicio ?? "—"}–{h.expedienteFim ?? "—"} ·
            intervalo {h.intervaloInicio ?? "—"}–{h.intervaloFim ?? "—"} ·{" "}
            <strong>{minutos(h.horasTrabalhadas)}</strong> trabalhadas
          </p>
        ) : (
          vazio("Não informado.")
        )}
      </Secao>

      <Secao titulo="Clima">
        <Tabela
          colunas={COLUNAS_CLIMA}
          chave={(l) => l.periodo}
          linhas={[
            { periodo: "Manhã", t: r.clima?.manha ?? null },
            { periodo: "Tarde", t: r.clima?.tarde ?? null },
            { periodo: "Noite", t: r.clima?.noite ?? null },
          ]}
        />
        <p className="mt-2 text-xs text-neutral-500">
          Índice pluviométrico:{" "}
          {r.clima?.indicePluviometrico ?? "não informado"}
        </p>
      </Secao>

      <Secao
        titulo="Mão de obra"
        descricao={`${opcao === "padrao" ? "Padrão (quantidade por função)" : opcao === "personalizada" ? "Personalizada (por pessoa)" : "Opção não informada"} · efetivo ${ef === null ? "—" : formatarNumero(ef)}${hh === null ? "" : ` · ${formatarHoras(hh)} homem-hora`}`}
      >
        {opcao === "padrao" || (!opcao && (m?.padrao.length ?? 0) > 0) ? (
          (m?.padrao.length ?? 0) === 0 ? (
            vazio("Nada lançado.")
          ) : (
            <ul className="flex flex-wrap gap-2 text-sm">
              {m?.padrao.map((p) => (
                <li
                  key={p._id}
                  className="rounded-full bg-neutral-900/[0.05] px-3 py-1"
                >
                  {p.descricao}:{" "}
                  <strong className="tabular-nums">
                    {formatarNumero(p.quantidade)}
                  </strong>
                </li>
              ))}
            </ul>
          )
        ) : (
          <Tabela
            colunas={COLUNAS_PESSOAS}
            linhas={m?.personalizada ?? []}
            chave={(p) => p._id}
            vazio="Nada lançado."
          />
        )}
      </Secao>

      <Secao titulo="Equipamentos">
        {r.equipamentos.length === 0 ? (
          vazio("Nenhum equipamento.")
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {r.equipamentos.map((e) => (
              <li
                key={e._id}
                className="rounded-full bg-neutral-900/[0.05] px-3 py-1"
              >
                {e.descricao}:{" "}
                <strong className="tabular-nums">
                  {formatarNumero(e.quantidade)}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao
        titulo="Atividades"
        descricao="Percentual anterior e atual, produção (quando o controle está ativo), horário e fotos. Clique numa tarefa do cronograma para ver o histórico dela."
      >
        <Tabela
          colunas={colunasAtividades(obraId)}
          linhas={r.atividades.map((a, k) => ({ ...a, k }))}
          chave={(a) => String(a.k)}
          vazio="Nenhuma atividade."
        />
      </Secao>

      <Secao titulo="Ocorrências">
        <Ocorrencias lista={r.ocorrencias} />
      </Secao>

      <Secao titulo="Controle de material">
        <Materiais r={r} />
        <p className="mt-2 text-[11px] text-neutral-400">
          Quantidades como vieram do aplicativo (texto livre, não somadas).
        </p>
      </Secao>

      <Secao titulo="Comentários">
        {r.comentarios.length === 0 ? (
          vazio("Nenhum comentário.")
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {/* Comentários não têm id na API: a posição é a identidade. */}
            {r.comentarios
              .map((c, posicao) => ({ ...c, posicao }))
              .map((c) => (
                <li
                  key={c.posicao}
                  className="rounded-2xl bg-neutral-900/[0.04] px-4 py-3"
                >
                  <p>{c.descricao}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {c.usuario?.nome ?? "—"} · {dataHoraDoApp(c.dataHora)}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </Secao>

      <Secao
        titulo="Galeria de fotos"
        descricao={`${formatarNumero(fotosNaGaleria.length)} fotos. Abrem do aplicativo, numa aba nova.`}
      >
        <Galeria fotos={fotosNaGaleria} vazio="Nenhuma foto." />
      </Secao>

      <Secao titulo="Vídeos">
        <Videos videos={r.videos} />
      </Secao>

      <Secao titulo="Anexos">
        <Anexos anexos={r.anexos} />
      </Secao>
    </div>
  );
}
