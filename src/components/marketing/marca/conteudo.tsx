import { Ban, Check, FileQuestion } from "lucide-react";
import { Poppins } from "next/font/google";
import { TOM } from "@/components/estilos";
import { tonsDaTela } from "@/components/os/tons";
import {
  type Conteudo,
  estaVazio,
  type ItemLista,
  rgbDe,
} from "@/lib/marketing/marca";
import { normalizar } from "@/lib/marketing/revisor";
import { AmostraCor } from "./amostra-cor";

// Desenho do conteúdo de cada bloco da marca, pelo jeito que ele é lido:
// propósito e tagline em letra grande, atributos e palavras em "chips",
// tons e personas em cartões, jornada em etapas, cores em amostras.

// Só esta tela carrega a Poppins (amostra da tipografia da marca).
const poppins = Poppins({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

/** Aviso de bloco ainda não transcrito. */
export function AindaVazio({ fonte }: { fonte: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-neutral-900/15 bg-white/30 px-4 py-5 text-sm text-neutral-500">
      <FileQuestion className="size-5 shrink-0 text-neutral-400" aria-hidden />
      <span>
        Ainda não preenchido — transcrever do <strong>{fonte}</strong>.
      </span>
    </div>
  );
}

function SemExplicacao() {
  return (
    <span className="text-xs italic text-neutral-400">
      explicação a preencher
    </span>
  );
}

function Chips({
  itens,
  tom = "neutro",
}: {
  itens: ItemLista[];
  tom?: "neutro" | "usar" | "evitar";
}) {
  const classe = {
    neutro: "border-neutral-900/10 bg-white/80 text-neutral-800",
    usar: "border-green-700/20 bg-green-500/10 text-green-800",
    evitar: "border-red-700/20 bg-red-500/10 text-red-700",
  }[tom];
  const Icone = tom === "usar" ? Check : tom === "evitar" ? Ban : null;
  return (
    <ul className="flex flex-wrap gap-2">
      {itens.map((i) => (
        <li
          key={i.titulo}
          title={i.texto}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium ${classe}`}
        >
          {Icone && <Icone className="size-3.5" aria-hidden />}
          {i.titulo}
        </li>
      ))}
    </ul>
  );
}

function Cartoes({
  itens,
  colunas = "sm:grid-cols-2 xl:grid-cols-3",
  numerar = false,
  colorir = true,
}: {
  itens: ItemLista[];
  colunas?: string;
  numerar?: boolean;
  /** Falso dentro de bloco já colorido: os cartões ficam neutros. */
  colorir?: boolean;
}) {
  // Mesmo ritmo de cores dos cartões das outras telas, fixo por bloco.
  const tons = colorir
    ? tonsDaTela(`marca:${itens[0]?.titulo ?? ""}`, itens.length)
    : itens.map(() => "claro" as const);
  return (
    <ul className={`grid grid-cols-1 gap-3 ${colunas}`}>
      {itens.map((i, n) => (
        <li
          key={i.titulo}
          className={`${TOM[tons[n] ?? "claro"]} flex flex-col gap-1.5 rounded-2xl p-4`}
        >
          <p className="flex items-baseline gap-2 font-semibold tracking-tight">
            {numerar && (
              <span
                className={`text-xs tabular-nums ${tons[n] === "claro" ? "text-marca-escuro" : "text-neutral-500"}`}
              >
                {String(n + 1).padStart(2, "0")}
              </span>
            )}
            {i.titulo}
          </p>
          {i.texto ? (
            <p className="text-sm leading-relaxed text-neutral-600">
              {i.texto}
            </p>
          ) : (
            <SemExplicacao />
          )}
        </li>
      ))}
    </ul>
  );
}

function Etapas({ itens }: { itens: ItemLista[] }) {
  const tons = tonsDaTela(`marca:${itens[0]?.titulo ?? ""}`, itens.length);
  return (
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {itens.map((i, n) => (
        <li
          key={i.titulo}
          className={`${TOM[tons[n] ?? "claro"]} relative flex flex-col gap-1.5 rounded-2xl p-4 pt-3`}
        >
          <span
            className={`text-[11px] font-semibold uppercase tracking-wider ${tons[n] === "claro" ? "text-marca-escuro" : "text-neutral-500"}`}
          >
            Etapa {n + 1}
          </span>
          <p className="font-semibold tracking-tight">{i.titulo}</p>
          {i.texto ? (
            <p className="text-sm leading-relaxed text-neutral-600">
              {i.texto}
            </p>
          ) : (
            <SemExplicacao />
          )}
        </li>
      ))}
    </ol>
  );
}

function Lista({ itens }: { itens: ItemLista[] }) {
  return (
    <ul className="flex flex-col divide-y divide-neutral-900/5">
      {itens.map((i) => (
        <li key={i.titulo} className="py-2.5 first:pt-0 last:pb-0">
          <p className="font-medium">{i.titulo}</p>
          {i.texto && (
            <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">
              {i.texto}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function Tipografia({ itens }: { itens: ItemLista[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {itens.map((i) => {
        const nome = normalizar(i.titulo);
        const ehPoppins = nome.includes("poppins");
        const ehHaboro = nome.includes("haboro");
        return (
          <li
            key={i.titulo}
            className="flex flex-col gap-3 rounded-2xl border border-neutral-900/10 bg-white/60 p-5"
          >
            <div
              className={
                ehPoppins ? poppins.className : ehHaboro ? "font-serif" : ""
              }
            >
              <p className="text-5xl leading-none tracking-tight">Aa</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight">
                ARP. Onde tudo acontece.
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
              </p>
            </div>
            <div>
              <p className="font-semibold">{i.titulo}</p>
              {i.texto ? (
                <p className="text-sm text-neutral-600">{i.texto}</p>
              ) : (
                <SemExplicacao />
              )}
              {ehHaboro && (
                <p className="mt-2 text-[11px] leading-snug text-neutral-400">
                  A Haboro Contrast é licenciada e não está no Google Fonts: a
                  amostra usa a serifada do sistema. A fonte original está no
                  pacote do rebranding (aba Arquivos).
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Conteúdo de um bloco, desenhado pelo que ele é. */
export function ConteudoBloco({
  chave,
  conteudo,
  fonte,
}: {
  chave: string;
  conteudo: Conteudo;
  /** De onde transcrever, se estiver vazio. */
  fonte: string;
}) {
  if (estaVazio(conteudo)) return <AindaVazio fonte={fonte} />;

  if (conteudo.tipo === "texto") {
    if (chave === "proposito")
      return (
        <p className="text-2xl leading-snug font-semibold tracking-tight text-balance md:text-3xl">
          {conteudo.texto}
        </p>
      );
    if (chave === "tagline")
      return (
        <p className="text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl">
          {conteudo.texto}
        </p>
      );
    if (chave === "arquetipo")
      return (
        <p className="text-4xl font-semibold tracking-tight">
          {conteudo.texto}
        </p>
      );
    return (
      <div className="flex max-w-3xl flex-col gap-3 text-[15px] leading-relaxed text-neutral-700">
        {conteudo.texto
          .split(/\n\s*\n/)
          .filter((p) => p.trim())
          .map((p) => (
            <p key={p.slice(0, 40)} className="whitespace-pre-line">
              {p}
            </p>
          ))}
      </div>
    );
  }

  if (conteudo.tipo === "cores")
    return (
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {conteudo.itens.map((c) => (
          <li key={`${c.nome}${c.hex}`}>
            <AmostraCor
              nome={c.nome}
              hex={c.hex}
              uso={c.uso}
              {...rgbDe(c.hex)}
            />
          </li>
        ))}
      </ul>
    );

  const { itens } = conteudo;
  switch (chave) {
    case "palavras_proprietarias":
      return <Chips itens={itens} tom="usar" />;
    case "palavras_proibidas":
      return <Chips itens={itens} tom="evitar" />;
    case "tons":
      return <Cartoes itens={itens} colunas="sm:grid-cols-2 xl:grid-cols-5" />;
    case "personas":
      return <Cartoes itens={itens} />;
    case "direcionadores":
      return <Cartoes itens={itens} numerar colorir={false} />;
    case "jornada":
      return <Etapas itens={itens} />;
    case "tipografia":
      return <Tipografia itens={itens} />;
    default:
      // Lista com explicação vira lista; só nomes, chips.
      return itens.some((i) => i.texto) ? (
        <Lista itens={itens} />
      ) : (
        <Chips itens={itens} />
      );
  }
}
