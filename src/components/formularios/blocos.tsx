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
