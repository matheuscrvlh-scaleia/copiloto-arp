import { formatarNumero } from "@arp/shared/formato";
import {
  type Campo,
  type Resumo,
  ROTULO_OUTRO,
  ROTULO_TIPO,
  recebeResposta,
  resumir,
} from "@arp/shared/formularios/campos";
import {
  ROTULO_SITUACAO,
  type Situacao,
} from "@arp/shared/formularios/formulario";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { type FatiaRosca, Rosca } from "@/components/dashboard/graficos/rosca";
import { Secao } from "@/components/dashboard/tabela";

// Peças das telas de Formulários (servidor): o selo da situação e o resumo
// das respostas, pergunta a pergunta (rosca, colunas das notas ou barras).

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

/** Escolha única, lista ou sim/não com até 5 opções: cabe numa rosca. */
const NA_ROSCA = 5;

const CORES = [1, 2, 3, 4, 5] as const;

/** Fatias na ordem das opções (a cor é da opção, não do ranking). */
function RoscaDasOpcoes({
  itens,
  base,
}: {
  itens: { rotulo: string; n: number }[];
  base: number;
}) {
  const top = itens.reduce((a, i) => (i.n > a.n ? i : a), { rotulo: "", n: 0 });
  const fatias: FatiaRosca[] = itens.map((i, k) => ({
    chave: i.rotulo,
    rotulo: i.rotulo,
    valor: i.n,
    texto: `${formatarNumero(i.n)} · ${formatarNumero(base ? (i.n / base) * 100 : 0)}%`,
    cor: i.rotulo === ROTULO_OUTRO ? "neutro" : (CORES[k % CORES.length] ?? 1),
  }));
  return (
    <Rosca
      fatias={fatias}
      descricao="Respostas por opção"
      centro={{
        valor: `${formatarNumero(base ? (top.n / base) * 100 : 0)}%`,
        rotulo: top.rotulo,
      }}
    />
  );
}

function CorpoDoResumo({ c, r }: { c: Campo; r: Resumo }) {
  if (r.respondidas === 0)
    return <p className="text-sm text-neutral-500">Ninguém respondeu ainda.</p>;
  switch (r.tipo) {
    case "contagem":
      if (c.tipo !== "multipla" && r.itens.length <= NA_ROSCA)
        return <RoscaDasOpcoes itens={r.itens} base={r.respondidas} />;
      return (
        <div className="flex flex-col gap-3">
          <Barras itens={r.itens} base={r.respondidas} />
          {c.tipo === "multipla" && (
            <p className="text-xs text-neutral-500">
              Cada pessoa pode marcar mais de uma opção; a % é sobre quem
              respondeu.
            </p>
          )}
        </div>
      );
    case "nota": {
      // "Notas altas": a metade de cima da escala (ex.: 4 e 5 de 1 a 5).
      const metade = Math.ceil(r.itens.length / 2);
      const altas = r.itens.slice(-metade).reduce((s, i) => s + i.n, 0);
      const maior = Number(r.itens.at(-1)?.rotulo ?? 0);
      return (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <p className="text-3xl font-semibold tabular-nums">
              {formatarNumero(r.media, 1)}
              <span className="ml-1 text-sm font-normal text-neutral-500">
                de {formatarNumero(maior)} em média
              </span>
            </p>
            <p className="text-sm text-neutral-500">
              <span className="font-semibold text-neutral-900 tabular-nums">
                {formatarNumero((altas / r.respondidas) * 100)}%
              </span>{" "}
              deram nota{" "}
              {r.itens
                .slice(-metade)
                .map((i) => i.rotulo)
                .join(" ou ")}
            </p>
          </div>
          <Colunas
            rotularTodas
            descricao="Quantas pessoas deram cada nota"
            itens={r.itens.map((i) => ({
              chave: i.rotulo,
              rotulo: i.rotulo,
              titulo: `Nota ${i.rotulo}`,
              valor: i.n,
              texto: `${formatarNumero(i.n)} · ${formatarNumero((i.n / r.respondidas) * 100)}%`,
            }))}
          />
        </div>
      );
    }
    case "numero":
      return (
        <dl className="grid grid-cols-3 gap-3 text-sm">
          {(
            [
              ["Média", r.media],
              ["Menor", r.min],
              ["Maior", r.max],
            ] as const
          ).map(([rotulo, v]) => (
            <div key={rotulo}>
              <dt className="text-xs text-neutral-500">{rotulo}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatarNumero(v, 2)}
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
            <CorpoDoResumo c={c} r={r} />
          </Secao>
        );
      })}
    </div>
  );
}
