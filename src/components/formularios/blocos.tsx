import { Secao } from "@/components/dashboard/tabela";
import { formatarNumero } from "@/lib/formato";
import {
  type Campo,
  type Resumo,
  ROTULO_TIPO,
  recebeResposta,
  resumir,
} from "@/lib/formularios/campos";
import { ROTULO_SITUACAO, type Situacao } from "@/lib/formularios/formulario";

// Peças das telas de Formulários (servidor): o selo da situação e o resumo
// das respostas, pergunta a pergunta.

const TOM: Record<Situacao, string> = {
  rascunho: "bg-neutral-900/[0.06] text-neutral-700",
  publicado: "bg-green-400/20 text-green-800",
  encerrado: "bg-amber-400/20 text-amber-800",
};

export function SeloSituacao({
  situacao,
  detalhe,
}: {
  situacao: Situacao;
  /** Ex.: "limite atingido". */
  detalhe?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TOM[situacao]}`}
    >
      {ROTULO_SITUACAO[situacao]}
      {detalhe && <span className="font-normal opacity-80">· {detalhe}</span>}
    </span>
  );
}

/** Uma barra por opção (ou nota), com quantidade e %. */
function Barras({
  itens,
  base,
}: {
  itens: { rotulo: string; n: number }[];
  base: number;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((i) => {
        const pct = base ? (i.n / base) * 100 : 0;
        return (
          <li key={i.rotulo} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 break-words">{i.rotulo}</span>
              <span className="shrink-0 tabular-nums text-neutral-500">
                {formatarNumero(i.n)} · {formatarNumero(pct)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-900/[0.06]">
              <div
                className="h-full rounded-full bg-neutral-900"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CorpoDoResumo({ r }: { r: Resumo }) {
  if (r.respondidas === 0)
    return <p className="text-sm text-neutral-500">Ninguém respondeu ainda.</p>;
  switch (r.tipo) {
    case "contagem":
      return <Barras itens={r.itens} base={r.respondidas} />;
    case "nota":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-3xl font-semibold tabular-nums">
            {formatarNumero(r.media, 1)}
            <span className="ml-1 text-sm font-normal text-neutral-500">
              de média
            </span>
          </p>
          <Barras itens={r.itens} base={r.respondidas} />
        </div>
      );
    case "numero":
      return (
        <dl className="grid grid-cols-3 gap-3 text-sm">
          {[
            ["Média", r.media],
            ["Menor", r.min],
            ["Maior", r.max],
          ].map(([rotulo, v]) => (
            <div key={rotulo as string}>
              <dt className="text-xs text-neutral-500">{rotulo}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatarNumero(v as number, 2)}
              </dd>
            </div>
          ))}
        </dl>
      );
    case "texto":
      return (
        <ul className="flex flex-col gap-1.5 text-sm">
          {r.recentes.map((t, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: respostas repetidas são possíveis
              key={i}
              className="break-words rounded-xl bg-white/60 px-3 py-2"
            >
              {t}
            </li>
          ))}
          {r.respondidas > r.recentes.length && (
            <li className="text-xs text-neutral-500">
              e mais {formatarNumero(r.respondidas - r.recentes.length)} na
              lista de respostas.
            </li>
          )}
        </ul>
      );
  }
}

/** Um bloco por pergunta respondível, na ordem do formulário. */
export function ResumoDasRespostas({
  campos,
  respostas,
}: {
  campos: Campo[];
  respostas: Record<string, unknown>[];
}) {
  const perguntas = campos.filter(recebeResposta);
  if (!perguntas.length) return null;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {perguntas.map((c, i) => {
        const r = resumir(
          c,
          respostas.map((x) => x[c.id]),
        );
        return (
          <Secao
            key={c.id}
            titulo={`${i + 1}. ${c.titulo}`}
            descricao={`${ROTULO_TIPO[c.tipo]} · ${formatarNumero(r.respondidas)} de ${formatarNumero(respostas.length)} responderam`}
          >
            <CorpoDoResumo r={r} />
          </Secao>
        );
      })}
    </div>
  );
}

const DIA = 86_400_000;
/** "aaaa-mm-dd" do dia em Brasília (UTC-3). */
const diaDe = (t: number) =>
  new Date(t - 3 * 3_600_000).toISOString().slice(0, 10);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Barras das respostas por dia nos últimos `dias` dias (Brasília). */
export function RespostasPorDia({
  datas,
  agora,
  dias = 30,
}: {
  datas: string[];
  agora: Date;
  dias?: number;
}) {
  const lista = Array.from({ length: dias }, (_, i) =>
    diaDe(agora.getTime() - (dias - 1 - i) * DIA),
  );
  const conta = new Map(lista.map((d) => [d, 0]));
  for (const iso of datas) {
    const d = diaDe(new Date(iso).getTime());
    const n = conta.get(d);
    if (n !== undefined) conta.set(d, n + 1);
  }
  const valores = lista.map((d) => ({ d, n: conta.get(d) ?? 0 }));
  const total = valores.reduce((s, v) => s + v.n, 0);
  const pico = valores.reduce((m, v) => (v.n > m.n ? v : m), {
    d: "",
    n: 0,
  });
  const max = Math.max(pico.n, 1);
  return (
    <Secao
      titulo="Respostas por dia"
      descricao={`${formatarNumero(total)} ${total === 1 ? "resposta" : "respostas"} nos últimos ${dias} dias${pico.n ? ` · pico em ${ddmm(pico.d)}, com ${formatarNumero(pico.n)}` : ""}.`}
    >
      <div
        role="img"
        aria-label={`Respostas por dia nos últimos ${dias} dias: ${formatarNumero(total)} no total.`}
        className="flex h-32 items-end gap-[3px]"
      >
        {valores.map((v) => (
          <div
            key={v.d}
            title={`${ddmm(v.d)}: ${formatarNumero(v.n)}`}
            className="flex h-full min-w-0 flex-1 items-end"
          >
            <div
              className={`w-full rounded-t-[3px] ${v.n ? "bg-neutral-900" : "bg-neutral-900/[0.08]"}`}
              style={{ height: v.n ? `${(v.n / max) * 100}%` : "3px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-neutral-500 tabular-nums">
        <span>{ddmm(lista[0] ?? "")}</span>
        <span>{ddmm(lista[Math.floor(dias / 2)] ?? "")}</span>
        <span>hoje</span>
      </div>
    </Secao>
  );
}
