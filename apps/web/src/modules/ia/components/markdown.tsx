import { type GraficoDaIa, lerGrafico } from "@arp/shared/ia/regras";
import { Fragment, type ReactNode } from "react";
import { AreaLinha } from "@/components/dashboard/graficos/area-linha";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { Rosca } from "@/components/dashboard/graficos/rosca";
import { formatar, type Unidade } from "@/components/dashboard/graficos/series";
import { Link } from "@/lib/navegacao";

// Markdown da resposta da IA, desenhado com elementos do React (nunca HTML
// cru): parágrafos, títulos, listas, tabelas, código, **negrito**,
// *itálico*, `código`, links (tela do sistema ou site externo) e o bloco
// ```grafico, que vira um gráfico do sistema.

const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[[^\]\n]+\]\([^)\s]+\))|(\*[^*\s][^*\n]*\*)|(_[^_\s][^_\n]*_)/g;

function Inline({ texto }: { texto: string }) {
  const partes: ReactNode[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(INLINE)) {
    const i = m.index;
    if (i > ultimo) partes.push(texto.slice(ultimo, i));
    const t = m[0];
    const chave = `${i}`;
    if (m[1]) {
      partes.push(
        <code
          key={chave}
          className="rounded-md bg-neutral-100 px-1 py-0.5 font-mono text-[0.85em]"
        >
          {t.slice(1, -1)}
        </code>,
      );
    } else if (m[2]) {
      partes.push(
        <strong key={chave} className="font-semibold text-neutral-900">
          <Inline texto={t.slice(2, -2)} />
        </strong>,
      );
    } else if (m[3]) {
      const [, rotulo = "", href = ""] =
        /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t) ?? [];
      partes.push(<Ligacao key={chave} href={href} rotulo={rotulo} />);
    } else {
      partes.push(
        <em key={chave}>
          <Inline texto={t.slice(1, -1)} />
        </em>,
      );
    }
    ultimo = i + t.length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return <>{partes}</>;
}

function Ligacao({ href, rotulo }: { href: string; rotulo: string }) {
  const classe =
    "font-medium text-marca-escuro underline decoration-marca/40 underline-offset-2 hover:decoration-marca dark:text-marca";
  if (href.startsWith("/") && !href.startsWith("//"))
    return (
      <Link href={href} className={classe}>
        {rotulo}
      </Link>
    );
  if (/^https:\/\//.test(href))
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={classe}
      >
        {rotulo}
      </a>
    );
  return <>{rotulo}</>;
}

const celulas = (linha: string) =>
  linha
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

const SEPARADOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const ITEM = /^\s*([-*•]|\d+[.)])\s+(.*)$/;

type Bloco =
  | { tipo: "p"; texto: string }
  | { tipo: "titulo"; nivel: number; texto: string }
  | { tipo: "lista"; ordenada: boolean; itens: string[] }
  | { tipo: "tabela"; cabeca: string[]; linhas: string[][] }
  | { tipo: "codigo"; lingua: string; texto: string; aberto: boolean }
  | { tipo: "linha" };

export function blocos(md: string): Bloco[] {
  const linhas = md.replace(/\r\n/g, "\n").split("\n");
  const r: Bloco[] = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i] ?? "";
    const cerca = /^\s*```\s*([\w-]*)\s*$/.exec(l);
    if (cerca) {
      const corpo: string[] = [];
      i++;
      while (i < linhas.length && !/^\s*```\s*$/.test(linhas[i] ?? ""))
        corpo.push(linhas[i++] ?? "");
      const aberto = i >= linhas.length;
      i++;
      r.push({
        tipo: "codigo",
        lingua: cerca[1] ?? "",
        texto: corpo.join("\n"),
        aberto,
      });
      continue;
    }
    if (!l.trim()) {
      i++;
      continue;
    }
    const titulo = /^(#{1,4})\s+(.*)$/.exec(l);
    if (titulo) {
      r.push({
        tipo: "titulo",
        nivel: titulo[1]?.length ?? 1,
        texto: titulo[2] ?? "",
      });
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) {
      r.push({ tipo: "linha" });
      i++;
      continue;
    }
    if (l.trim().startsWith("|") && SEPARADOR.test(linhas[i + 1] ?? "")) {
      const cabeca = celulas(l);
      i += 2;
      const corpo: string[][] = [];
      while (i < linhas.length && (linhas[i] ?? "").trim().startsWith("|"))
        corpo.push(celulas(linhas[i++] ?? ""));
      r.push({ tipo: "tabela", cabeca, linhas: corpo });
      continue;
    }
    const item = ITEM.exec(l);
    if (item) {
      const ordenada = /\d/.test(item[1] ?? "");
      const itens: string[] = [];
      while (i < linhas.length) {
        const m = ITEM.exec(linhas[i] ?? "");
        if (m) itens.push(m[2] ?? "");
        else if (/^\s{2,}\S/.test(linhas[i] ?? "") && itens.length)
          itens[itens.length - 1] += ` ${(linhas[i] ?? "").trim()}`;
        else break;
        i++;
      }
      r.push({ tipo: "lista", ordenada, itens });
      continue;
    }
    const paragrafo: string[] = [];
    while (i < linhas.length) {
      const x = linhas[i] ?? "";
      if (
        !x.trim() ||
        /^\s*```/.test(x) ||
        /^#{1,4}\s/.test(x) ||
        ITEM.test(x) ||
        (x.trim().startsWith("|") && SEPARADOR.test(linhas[i + 1] ?? ""))
      )
        break;
      paragrafo.push(x);
      i++;
    }
    r.push({ tipo: "p", texto: paragrafo.join("\n") });
  }
  return r;
}

function Paragrafo({ texto }: { texto: string }) {
  const linhas = texto.split("\n");
  return (
    <p>
      {linhas.map((l, k) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: linhas fixas do parágrafo
        <Fragment key={k}>
          {k > 0 && <br />}
          <Inline texto={l} />
        </Fragment>
      ))}
    </p>
  );
}

export function Markdown({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-neutral-700">
      {blocos(texto).map((b, k) => {
        const chave = `${b.tipo}-${k}`;
        switch (b.tipo) {
          case "p":
            return <Paragrafo key={chave} texto={b.texto} />;
          case "titulo":
            return (
              <p
                key={chave}
                className={`font-semibold text-neutral-900 ${b.nivel <= 2 ? "text-base" : "text-sm"}`}
              >
                <Inline texto={b.texto} />
              </p>
            );
          case "linha":
            return <hr key={chave} className="border-neutral-200" />;
          case "lista": {
            const Tag = b.ordenada ? "ol" : "ul";
            return (
              <Tag
                key={chave}
                className={`flex flex-col gap-1 pl-5 ${b.ordenada ? "list-decimal" : "list-disc"} marker:text-neutral-400`}
              >
                {b.itens.map((it, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: itens na ordem do texto
                  <li key={j}>
                    <Inline texto={it} />
                  </li>
                ))}
              </Tag>
            );
          }
          case "tabela":
            return (
              <div
                key={chave}
                className="overflow-x-auto rounded-2xl border border-neutral-200"
              >
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500">
                    <tr>
                      {b.cabeca.map((c, j) => (
                        <th
                          // biome-ignore lint/suspicious/noArrayIndexKey: colunas fixas
                          key={j}
                          className="px-3 py-2 font-medium whitespace-nowrap"
                        >
                          <Inline texto={c} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {b.linhas.map((linha, j) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: linhas na ordem do texto
                      <tr key={j}>
                        {linha.map((c, n) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: colunas fixas
                          <td key={n} className="px-3 py-2 tabular-nums">
                            <Inline texto={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "codigo": {
            if (b.lingua === "grafico") {
              const g = b.aberto ? null : lerGrafico(b.texto);
              if (g) return <GraficoDaResposta key={chave} g={g} />;
              return b.aberto ? (
                <p key={chave} className="text-xs text-neutral-400">
                  Montando o gráfico…
                </p>
              ) : null;
            }
            return (
              <pre
                key={chave}
                className="overflow-x-auto rounded-2xl bg-neutral-100 p-3 font-mono text-xs"
              >
                {b.texto}
              </pre>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}

const CORES = [1, 2, 3, 4, 5] as const;

function GraficoDaResposta({ g }: { g: GraficoDaIa }) {
  const unidade: Unidade = g.unidade;
  const itens = g.itens.map((it, k) => ({
    chave: `${k}`,
    rotulo: it.rotulo,
    valor: it.valor,
    texto: formatar(it.valor, unidade),
  }));
  return (
    <figure className="rounded-2xl border border-neutral-200 bg-white/40 p-4">
      <figcaption className="mb-3 text-xs font-medium text-neutral-500">
        {g.titulo}
      </figcaption>
      {g.tipo === "colunas" && <Colunas itens={itens} descricao={g.titulo} />}
      {g.tipo === "barras" && (
        <BarrasHorizontais itens={itens} descricao={g.titulo} rotuloLargo />
      )}
      {g.tipo === "linha" && <AreaLinha itens={itens} descricao={g.titulo} />}
      {g.tipo === "rosca" && (
        <Rosca
          descricao={g.titulo}
          fatias={itens.map((it, k) => ({
            ...it,
            cor: k < CORES.length ? (CORES[k] ?? "neutro") : "neutro",
          }))}
          centro={{
            valor: formatar(
              itens.reduce((s, it) => s + it.valor, 0),
              unidade,
            ),
            rotulo: "total",
          }}
        />
      )}
    </figure>
  );
}
