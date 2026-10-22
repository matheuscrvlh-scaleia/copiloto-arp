"use client";

import { useEffect, useId, useRef, useState } from "react";
import { type Detalhe, useAbrirDetalhe } from "@/components/modal-detalhe";
import { formatarNumero } from "@/lib/formato";

// Gráficos interativos. Passar o mouse (ou o dedo) mostra a dica com o valor
// exato; pelo teclado, Tab entra no gráfico e as setas andam pelos pontos.
// Uma série por gráfico (o título diz o que é); séries por categoria usam
// --serie-1..5 sempre na mesma ordem. Marcas finas, base reta, animação de
// entrada curta e desligada para quem pede menos movimento (motion-reduce).
// O número exato também está sempre numa tabela ou rótulo da tela.

export interface ItemGrafico {
  chave: string;
  /** Rótulo curto do eixo (ex.: "out"). */
  rotulo: string;
  valor: number;
  /** Valor formatado para leitura. */
  texto: string;
  /** Título da dica, se diferente do rótulo (ex.: "out/2026"). */
  titulo?: string;
  /** Linha extra da dica (ex.: "11 pessoas · faltas 134h03"). */
  detalhe?: string;
  /** Destaca o item (ex.: mês selecionado) na cor da marca. */
  destaque?: boolean;
}

/** true um quadro depois de montar: dispara as animações de entrada. */
function useMontado() {
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return montado;
}

/** Dica flutuante (vidro fumê) presa a um ponto, em % do quadro do gráfico. */
function Dica({
  x,
  y,
  titulo,
  valor,
  detalhe,
  clicavel = false,
  abaixo = false,
}: {
  x: number;
  y: number;
  titulo: string;
  valor: string;
  detalhe?: string;
  /** Mostra o convite para abrir o detalhe. */
  clicavel?: boolean;
  /** Abre para baixo do ponto (ex.: no topo de uma área com rolagem). */
  abaixo?: boolean;
}) {
  const lado = x < 18 ? "-8%" : x > 82 ? "-92%" : "-50%";
  return (
    <div
      className="fume pointer-events-none absolute z-20 rounded-2xl px-3 py-2 text-xs whitespace-nowrap transition-[left,top] duration-150 ease-out motion-reduce:transition-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(${lado}, ${abaixo ? "12px" : "calc(-100% - 12px)"})`,
        // Mais escura que o fumê comum: precisa ler bem sobre o vidro claro.
        backgroundColor: "rgb(14 14 14 / 0.86)",
      }}
    >
      <p className="text-[rgb(255_255_255/0.6)]">{titulo}</p>
      <p className="text-sm font-semibold tabular-nums">{valor}</p>
      {detalhe && (
        <p className="mt-0.5 text-[rgb(255_255_255/0.65)]">{detalhe}</p>
      )}
      {clicavel && (
        <p className="mt-1.5 text-[11px] font-medium text-[#8fd99b]">
          Clique para ver quem é →
        </p>
      )}
    </div>
  );
}

/**
 * Controle de teclado do gráfico: um slider invisível que anda pelos itens.
 * O leitor de tela lê o valor de cada um.
 */
function Explorar({
  itens,
  ativo,
  padrao,
  setAtivo,
  descricao,
  aoEscolher,
}: {
  itens: { titulo?: string; rotulo: string; texto: string }[];
  ativo: number | null;
  padrao: number;
  setAtivo: (i: number | null) => void;
  descricao: string;
  /** Enter abre o detalhe do item atual. */
  aoEscolher?: (i: number) => void;
}) {
  const atual = ativo ?? padrao;
  const item = itens[atual];
  if (itens.length === 0) return null;
  return (
    <input
      type="range"
      min={0}
      max={itens.length - 1}
      value={atual}
      aria-label={`${descricao}. Use as setas para percorrer${aoEscolher ? " e Enter para ver quem é" : ""}`}
      aria-valuetext={
        item ? `${item.titulo ?? item.rotulo}: ${item.texto}` : ""
      }
      onChange={(e) => setAtivo(Number(e.target.value))}
      onFocus={() => setAtivo(atual)}
      onBlur={() => setAtivo(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && aoEscolher) {
          e.preventDefault();
          aoEscolher(atual);
        }
      }}
      className="peer sr-only"
    />
  );
}

/**
 * Detalhe por item (quem forma aquele número). Clique ou toque abre o modal
 * da página; pelo teclado, Enter no controle de setas. Sem detalhes (ou sem
 * permissão para vê-los), o gráfico não é clicável.
 */
function useDetalhes(detalhes?: Record<string, Detalhe>) {
  const abrir = useAbrirDetalhe();
  const clicavel = Boolean(detalhes && abrir);
  return {
    clicavel,
    tem: (chave?: string) =>
      clicavel && chave !== undefined && Boolean(detalhes?.[chave]),
    abrir: (chave?: string) => {
      const d = chave === undefined ? undefined : detalhes?.[chave];
      if (d && abrir) abrir(d);
    },
  };
}

const ANEL_FOCO =
  "rounded-2xl outline-none has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-neutral-900/25 has-[input:focus-visible]:ring-offset-4 has-[input:focus-visible]:ring-offset-transparent";

// ---------------------------------------------------------------------------
// Área ao longo do tempo
// ---------------------------------------------------------------------------

/**
 * Caminho suave e monotônico (Fritsch–Carlson): a curva nunca passa acima ou
 * abaixo dos pontos vizinhos, então não inventa picos que os dados não têm.
 */
function caminhoSuave(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  const p = (i: number) => pts[i] ?? { x: 0, y: 0 };
  if (n === 1) return `M ${p(0).x} ${p(0).y}`;
  const dx = Array.from({ length: n - 1 }, (_, i) => p(i + 1).x - p(i).x);
  const inc = dx.map((h, i) => (h === 0 ? 0 : (p(i + 1).y - p(i).y) / h));
  const tg = pts.map((_, i) => {
    if (i === 0) return inc[0] ?? 0;
    if (i === n - 1) return inc[n - 2] ?? 0;
    const a = inc[i - 1] ?? 0;
    const b = inc[i] ?? 0;
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  let d = `M ${p(0).x} ${p(0).y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (dx[i] ?? 0) / 3;
    d += ` C ${p(i).x + h} ${p(i).y + (tg[i] ?? 0) * h}, ${p(i + 1).x - h} ${p(i + 1).y - (tg[i + 1] ?? 0) * h}, ${p(i + 1).x} ${p(i + 1).y}`;
  }
  return d;
}

/** Topo "redondo" do eixo: múltiplo de 5, 10, 50... acima do maior valor. */
function tetoRedondo(max: number, folga = 1.15): number {
  const alvo = Math.max(max * folga, 5);
  const base = 10 ** Math.floor(Math.log10(alvo));
  const passo = alvo / base <= 2 ? base / 2 : base;
  return Math.ceil(alvo / passo) * passo;
}

/** Eixo com passo redondo (1, 2, 2,5 ou 5 × 10ⁿ) e até 6 divisões. */
function eixoJusto(max: number): { teto: number; passoEixo: number } {
  const alvo = Math.max(max, 1);
  const base = 10 ** Math.floor(Math.log10(alvo));
  for (const m of [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10]) {
    const passo = base * m;
    const teto = Math.ceil(alvo / passo) * passo;
    if (teto / passo <= 6) return { teto, passoEixo: passo };
  }
  return { teto: alvo, passoEixo: alvo };
}

/**
 * Área suave com o eixo partindo do zero. Mira vertical e dica seguem o
 * mouse; a dica mostra a variação contra o ponto anterior.
 */
export function AreaLinha({
  itens,
  descricao,
  className = "",
  variacao = true,
  detalhes,
}: {
  itens: ItemGrafico[];
  descricao: string;
  className?: string;
  /** Mostra "+1 vs set" na dica. */
  variacao?: boolean;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const L = 600;
  const A = 190;
  const margem = { x: 14, topo: 22, base: 4 };
  const teto = tetoRedondo(Math.max(...itens.map((i) => i.valor), 0));
  const util = A - margem.topo - margem.base;
  const y = (v: number) => margem.topo + (1 - Math.max(v, 0) / teto) * util;
  const passo = itens.length > 1 ? (L - margem.x * 2) / (itens.length - 1) : 0;
  const pts = itens.map((i, k) => ({ x: margem.x + k * passo, y: y(i.valor) }));
  const linha = caminhoSuave(pts);
  const ultimo = pts.at(-1);
  const primeiro = pts[0];
  const chao = y(0);
  const area =
    ultimo && primeiro
      ? `${linha} L ${ultimo.x} ${chao} L ${primeiro.x} ${chao} Z`
      : "";
  const destaque = itens.findIndex((i) => i.destaque);
  const padrao = destaque >= 0 ? destaque : itens.length - 1;

  const [ativo, setAtivo] = useState<number | null>(null);
  const det = useDetalhes(detalhes);
  const montado = useMontado();
  const svg = useRef<SVGSVGElement>(null);
  const gradiente = `area-${useId().replace(/:/g, "")}`;

  function apontar(e: React.PointerEvent) {
    const r = svg.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const xv = ((e.clientX - r.left) / r.width) * L;
    const k = passo === 0 ? 0 : Math.round((xv - margem.x) / passo);
    setAtivo(Math.max(0, Math.min(itens.length - 1, k)));
  }

  const p = ativo === null ? undefined : pts[ativo];
  const item = ativo === null ? undefined : itens[ativo];
  const anterior = ativo ? itens[ativo - 1] : undefined;
  const delta = item && anterior ? item.valor - anterior.valor : null;
  const marcado = pts[padrao];

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        className={`relative touch-pan-y select-none ${det.clicavel ? "cursor-pointer" : ""} ${ANEL_FOCO}`}
        onPointerMove={apontar}
        onPointerUp={() =>
          det.abrir(ativo === null ? undefined : itens[ativo]?.chave)
        }
        onPointerDown={apontar}
        onPointerLeave={() => setAtivo(null)}
      >
        <svg
          ref={svg}
          viewBox={`0 0 ${L} ${A}`}
          className="w-full overflow-visible text-neutral-900"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradiente} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#58c069" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#58c069" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, teto / 2, teto].map((v) => (
            <g key={v}>
              <line
                x1={0}
                x2={L}
                y1={y(v)}
                y2={y(v)}
                className="stroke-neutral-900/10"
                strokeWidth={1}
              />
              {v > 0 && (
                <text
                  x={0}
                  y={y(v) - 5}
                  className="fill-neutral-400 text-[10px]"
                >
                  {formatarNumero(v)}
                </text>
              )}
            </g>
          ))}
          <path
            d={area}
            fill={`url(#${gradiente})`}
            className="transition-opacity duration-1000 motion-reduce:transition-none"
            style={{ opacity: montado ? 1 : 0 }}
          />
          <path
            d={linha}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={montado ? 0 : 1}
            className="transition-[stroke-dashoffset] duration-[1400ms] ease-out motion-reduce:transition-none"
          />
          {p && (
            <line
              x1={p.x}
              x2={p.x}
              y1={margem.topo - 12}
              y2={chao}
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeDasharray="3 4"
            />
          )}
          {/* Ponto marcado (mês escolhido) com anel na cor da superfície. */}
          {marcado && (
            <g
              className="transition-opacity duration-700"
              style={{ opacity: montado ? 1 : 0 }}
            >
              <circle
                cx={marcado.x}
                cy={marcado.y}
                r={7}
                className="fill-white"
              />
              <circle cx={marcado.x} cy={marcado.y} r={5} fill="#58c069" />
              {ativo === null && itens[padrao] && (
                <text
                  x={marcado.x}
                  y={marcado.y - 14}
                  textAnchor="middle"
                  className="fill-neutral-900 text-[13px] font-semibold"
                >
                  {itens[padrao].texto}
                </text>
              )}
            </g>
          )}
          {p && ativo !== padrao && (
            <g>
              <circle cx={p.x} cy={p.y} r={7} className="fill-white" />
              <circle cx={p.x} cy={p.y} r={4.5} fill="currentColor" />
            </g>
          )}
        </svg>
        {p && item && (
          <Dica
            x={(p.x / L) * 100}
            y={(p.y / A) * 100}
            titulo={item.titulo ?? item.rotulo}
            valor={item.texto}
            clicavel={det.tem(item.chave)}
            detalhe={
              variacao && delta !== null && anterior
                ? `${delta > 0 ? "+" : ""}${formatarNumero(delta)} vs ${anterior.titulo ?? anterior.rotulo}`
                : item.detalhe
            }
          />
        )}
        <Explorar
          itens={itens}
          ativo={ativo}
          padrao={padrao}
          setAtivo={setAtivo}
          descricao={descricao}
          aoEscolher={
            det.clicavel ? (k) => det.abrir(itens[k]?.chave) : undefined
          }
        />
      </div>
      <div className="flex justify-between px-1" aria-hidden>
        {itens.map((i, k) => (
          <span
            key={i.chave}
            className={`text-[11px] transition-colors ${k === ativo || (ativo === null && i.destaque) ? "font-medium text-neutral-900" : "text-neutral-500"}`}
          >
            {i.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colunas
// ---------------------------------------------------------------------------

/**
 * Colunas em cápsula sobre um trilho translúcido. Sobem em sequência ao
 * abrir; passar o mouse acende a coluna e apaga as outras.
 */
export function Colunas({
  itens,
  descricao,
  rotularTodas = false,
  detalhes,
}: {
  itens: ItemGrafico[];
  /** Texto para leitores de tela, ex.: "Colaboradores ativos no fim de cada mês". */
  descricao: string;
  /** Valor em cima de todas as colunas (poucas colunas, ex.: faixas). */
  rotularTodas?: boolean;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const max = Math.max(...itens.map((i) => i.valor), 0);
  const ultimo = itens.length - 1;
  const destaque = itens.findIndex((i) => i.destaque);
  const padrao = destaque >= 0 ? destaque : ultimo;
  const [ativo, setAtivo] = useState<number | null>(null);
  const det = useDetalhes(detalhes);
  const montado = useMontado();
  const altura = (v: number) => (max > 0 ? Math.max((v / max) * 86, 2) : 2);
  const item = ativo === null ? undefined : itens[ativo];

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative ${ANEL_FOCO}`}
        onPointerLeave={() => setAtivo(null)}
      >
        <div className="flex h-48 items-end gap-1.5 sm:gap-2">
          {itens.map((i, k) => {
            const h = altura(i.valor);
            const aceso = ativo === k;
            const apagado = ativo !== null && !aceso;
            const rotular =
              ativo === null && (rotularTodas || k === padrao || k === ultimo);
            return (
              <div
                key={i.chave}
                className={`relative flex h-full flex-1 justify-center ${det.tem(i.chave) ? "cursor-pointer" : ""}`}
                onPointerEnter={() => setAtivo(k)}
                onPointerUp={() => det.abrir(i.chave)}
                onPointerDown={() => setAtivo(k)}
              >
                <span className="absolute inset-y-0 w-full max-w-7 rounded-full bg-neutral-900/[0.05]" />
                <span
                  className={`absolute bottom-0 w-full max-w-7 rounded-full motion-reduce:transition-none ${
                    i.destaque
                      ? "bg-gradient-to-t from-marca-escuro to-marca"
                      : aceso
                        ? "bg-neutral-900"
                        : "bg-neutral-400/80"
                  }`}
                  style={{
                    height: montado ? `${h}%` : "0%",
                    opacity: apagado ? 0.4 : 1,
                    transition: `height 700ms cubic-bezier(.2,.8,.2,1) ${k * 35}ms, opacity 200ms, background-color 200ms`,
                  }}
                />
                {rotular && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium tabular-nums text-neutral-900 transition-opacity duration-500"
                    style={{
                      bottom: `calc(${h}% + 6px)`,
                      opacity: montado ? 1 : 0,
                    }}
                  >
                    {i.texto}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {item && ativo !== null && (
          <Dica
            x={((ativo + 0.5) / itens.length) * 100}
            y={100 - altura(item.valor)}
            titulo={item.titulo ?? item.rotulo}
            valor={item.texto}
            detalhe={item.detalhe}
            clicavel={det.tem(item.chave)}
          />
        )}
        <Explorar
          itens={itens}
          ativo={ativo}
          padrao={padrao}
          setAtivo={setAtivo}
          descricao={descricao}
          aoEscolher={
            det.clicavel ? (k) => det.abrir(itens[k]?.chave) : undefined
          }
        />
      </div>
      <div className="flex gap-1.5 sm:gap-2" aria-hidden>
        {itens.map((i, k) => (
          <span
            key={i.chave}
            className={`flex-1 truncate text-center text-[11px] ${k === ativo || i.destaque ? "font-medium text-neutral-900" : "text-neutral-500"}`}
          >
            {i.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Faixas: distribuição de um total em poucas faixas
// ---------------------------------------------------------------------------

/** Parte de um total em %, com uma casa abaixo de 10%. */
function parteDe(v: number, total: number): string {
  const p = total > 0 ? (v / total) * 100 : 0;
  return `${formatarNumero(p, p > 0 && p < 10 ? 1 : 0)}%`;
}

/**
 * Colunas largas que ocupam a altura do cartão, uma por faixa (ex.: tempo de
 * casa), com a quantidade e a parte do total escritas em cima de cada uma.
 */
export function Faixas({
  itens,
  descricao,
  className = "",
  detalhes,
}: {
  itens: ItemGrafico[];
  descricao: string;
  className?: string;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const det = useDetalhes(detalhes);
  const montado = useMontado();
  const total = itens.reduce((s, i) => s + Math.max(i.valor, 0), 0);
  const max = Math.max(...itens.map((i) => i.valor), 0);
  // Até 72% do trilho: sobra espaço para o número em cima da maior.
  const altura = (v: number) => (max > 0 ? Math.max((v / max) * 72, 1.5) : 1.5);

  return (
    <div className={`flex min-h-64 flex-col gap-3 ${className}`}>
      <div
        className={`relative flex flex-1 gap-2 sm:gap-3 ${ANEL_FOCO}`}
        onPointerLeave={() => setAtivo(null)}
      >
        {itens.map((i, k) => {
          const h = altura(i.valor);
          const aceso = ativo === k;
          const apagado = ativo !== null && !aceso;
          return (
            <div
              key={i.chave}
              className={`relative flex-1 rounded-2xl bg-neutral-900/[0.06] transition-opacity duration-200 ${det.tem(i.chave) ? "cursor-pointer" : ""}`}
              style={{ opacity: apagado ? 0.45 : 1 }}
              onPointerEnter={() => setAtivo(k)}
              onPointerUp={() => det.abrir(i.chave)}
              onPointerDown={() => setAtivo(k)}
            >
              <span
                className={`absolute inset-x-0 bottom-0 rounded-2xl motion-reduce:transition-none ${aceso ? "bg-neutral-900" : "bg-neutral-900/80"}`}
                style={{
                  height: montado ? `${h}%` : "0%",
                  transition: `height 700ms cubic-bezier(.2,.8,.2,1) ${k * 50}ms, background-color 200ms`,
                }}
              />
              {!aceso && (
                <span
                  className="absolute inset-x-0 text-center transition-opacity duration-500"
                  style={{
                    bottom: `calc(${h}% + 8px)`,
                    opacity: montado ? 1 : 0,
                  }}
                >
                  <span className="block text-2xl leading-none font-semibold tracking-tight tabular-nums text-neutral-900">
                    {i.texto}
                  </span>
                  <span className="mt-1 block text-xs tabular-nums text-neutral-500">
                    {parteDe(i.valor, total)}
                  </span>
                </span>
              )}
              {aceso && (
                <Dica
                  x={50}
                  y={100 - h}
                  titulo={i.titulo ?? i.rotulo}
                  valor={i.texto}
                  detalhe={i.detalhe}
                  clicavel={det.tem(i.chave)}
                />
              )}
            </div>
          );
        })}
        <Explorar
          itens={itens}
          ativo={ativo}
          padrao={0}
          setAtivo={setAtivo}
          descricao={descricao}
          aoEscolher={
            det.clicavel ? (k) => det.abrir(itens[k]?.chave) : undefined
          }
        />
      </div>
      <div className="flex gap-2 sm:gap-3" aria-hidden>
        {itens.map((i, k) => (
          <span
            key={i.chave}
            className={`flex-1 truncate text-center text-xs ${k === ativo ? "font-medium text-neutral-900" : "text-neutral-600"}`}
          >
            {i.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barras deitadas
// ---------------------------------------------------------------------------

/**
 * Barras deitadas em cápsula, uma por linha, com marcador da meta (quando
 * houver). Passar o mouse mostra o detalhe da linha.
 */
export function BarrasHorizontais({
  itens,
  vazio = "Sem dados no período.",
  meta,
  descricao = "Barras por categoria",
  rotuloLargo = false,
  detalhes,
}: {
  itens: ItemGrafico[];
  vazio?: string;
  /** Linha tracejada da meta, na mesma escala dos valores. */
  meta?: { valor: number; texto: string };
  descricao?: string;
  /** Coluna do nome mais larga (rótulos longos, ex.: cargos). */
  rotuloLargo?: boolean;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const det = useDetalhes(detalhes);
  const montado = useMontado();
  const max = Math.max(...itens.map((i) => i.valor), meta?.valor ?? 0, 0);
  if (itens.length === 0 || max <= 0) {
    return <p className="py-6 text-sm text-neutral-500">{vazio}</p>;
  }
  const escala = max * 1.08;
  const pct = (v: number) => (Math.max(v, 0) / escala) * 100;

  return (
    <div className={`relative ${ANEL_FOCO}`}>
      <ul className="flex flex-col gap-3" onPointerLeave={() => setAtivo(null)}>
        {itens.map((i, k) => {
          const aceso = ativo === k;
          const apagado = ativo !== null && !aceso;
          return (
            <li
              key={i.chave}
              className={`grid ${rotuloLargo ? "grid-cols-[minmax(7rem,17rem)_1fr_3.5rem]" : "grid-cols-[minmax(5rem,9rem)_1fr_4.5rem]"} items-center gap-3 transition-opacity duration-200 ${det.tem(i.chave) ? "cursor-pointer" : ""}`}
              style={{ opacity: apagado ? 0.5 : 1 }}
              onPointerEnter={() => setAtivo(k)}
              onPointerUp={() => det.abrir(i.chave)}
              onPointerDown={() => setAtivo(k)}
            >
              <span className="truncate text-sm text-neutral-600">
                {i.rotulo}
              </span>
              <span className="relative h-3.5 rounded-full bg-neutral-900/[0.06]">
                <span
                  className={`absolute inset-y-0 left-0 rounded-full motion-reduce:transition-none ${
                    i.destaque || aceso
                      ? "bg-gradient-to-r from-marca-escuro to-marca"
                      : "bg-neutral-900"
                  }`}
                  style={{
                    width: montado ? `${Math.max(pct(i.valor), 1.5)}%` : "0%",
                    transition: `width 800ms cubic-bezier(.2,.8,.2,1) ${k * 60}ms`,
                  }}
                />
                {meta && (
                  <span
                    aria-hidden
                    className="absolute -inset-y-1.5 border-l-2 border-dashed border-neutral-900/50"
                    style={{ left: `${pct(meta.valor)}%` }}
                  />
                )}
                {aceso && (
                  <Dica
                    x={Math.min(pct(i.valor), 100)}
                    y={0}
                    titulo={i.titulo ?? i.rotulo}
                    valor={i.texto}
                    detalhe={i.detalhe}
                    clicavel={det.tem(i.chave)}
                  />
                )}
              </span>
              <span className="text-right text-sm font-medium tabular-nums text-neutral-900">
                {i.texto}
              </span>
            </li>
          );
        })}
      </ul>
      {meta && (
        <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
          <span
            aria-hidden
            className="h-3 border-l-2 border-dashed border-neutral-900/50"
          />
          {meta.texto}
        </p>
      )}
      <Explorar
        itens={itens}
        ativo={ativo}
        padrao={0}
        setAtivo={setAtivo}
        descricao={descricao}
        aoEscolher={
          det.clicavel ? (k) => det.abrir(itens[k]?.chave) : undefined
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rosca: composição de um total
// ---------------------------------------------------------------------------

export interface FatiaRosca {
  chave: string;
  rotulo: string;
  valor: number;
  texto: string;
  /**
   * Posição fixa da categoria na paleta (--serie-1..5), nunca o ranking.
   * "neutro" (cinza) para o que não é categoria, como "Sem informação".
   */
  cor: 1 | 2 | 3 | 4 | 5 | "neutro";
}

/**
 * Rosca com o total no centro e a legenda ao lado. Passar o mouse numa
 * fatia ou na legenda acende as duas e mostra a parte no centro.
 */
export function Rosca({
  fatias,
  descricao,
  centro,
  vazio = "Sem dados no período.",
  detalhes,
}: {
  fatias: FatiaRosca[];
  descricao: string;
  centro: { valor: string; rotulo: string };
  vazio?: string;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const det = useDetalhes(detalhes);
  const montado = useMontado();
  const total = fatias.reduce((s, f) => s + Math.max(f.valor, 0), 0);
  if (total <= 0) {
    return <p className="py-6 text-sm text-neutral-500">{vazio}</p>;
  }
  const R = 40;
  const C = 2 * Math.PI * R;
  // 2px de superfície entre as fatias (em unidades do círculo).
  const vao = fatias.filter((f) => f.valor > 0).length > 1 ? 1.6 : 0;
  let acumulado = 0;
  const arcos = fatias.map((f) => {
    const comprimento = (Math.max(f.valor, 0) / total) * C;
    const arco = {
      tamanho: Math.max(comprimento - vao, 0),
      inicio: acumulado,
    };
    acumulado += comprimento;
    return arco;
  });
  const fatia = ativo === null ? undefined : fatias[ativo];
  const parte = (v: number) => parteDe(v, total);

  return (
    // Lado a lado só quando o quadro do gráfico tem largura (container query).
    <div className="@container">
      <div className="flex flex-col items-center gap-6 @md:flex-row">
        <div
          className={`relative size-48 shrink-0 ${ANEL_FOCO}`}
          onPointerLeave={() => setAtivo(null)}
        >
          <svg viewBox="0 0 100 100" className="-rotate-90" aria-hidden="true">
            <circle
              cx={50}
              cy={50}
              r={R}
              fill="none"
              className="stroke-neutral-900/[0.06]"
              strokeWidth={11}
            />
            {fatias.map((f, k) => {
              const a = arcos[k];
              if (!a || f.valor <= 0) return null;
              return (
                <circle
                  key={f.chave}
                  cx={50}
                  cy={50}
                  r={R}
                  fill="none"
                  stroke={`var(--serie-${f.cor})`}
                  strokeWidth={ativo === k ? 14 : 11}
                  strokeDasharray={`${montado ? a.tamanho : 0} ${C}`}
                  strokeDashoffset={-a.inicio}
                  className="cursor-pointer motion-reduce:transition-none"
                  style={{
                    opacity: ativo !== null && ativo !== k ? 0.3 : 1,
                    transition: `stroke-dasharray 900ms cubic-bezier(.2,.8,.2,1) ${k * 90}ms, stroke-width 200ms, opacity 200ms`,
                  }}
                  onPointerEnter={() => setAtivo(k)}
                  onPointerUp={() => det.abrir(f.chave)}
                  onPointerDown={() => setAtivo(k)}
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {fatia ? fatia.texto : centro.valor}
              </p>
              <p className="max-w-28 text-xs text-neutral-500">
                {fatia
                  ? `${parte(fatia.valor)} · ${fatia.rotulo}`
                  : centro.rotulo}
              </p>
            </div>
          </div>
          <Explorar
            itens={fatias}
            ativo={ativo}
            padrao={0}
            setAtivo={setAtivo}
            descricao={descricao}
            aoEscolher={
              det.clicavel ? (k) => det.abrir(fatias[k]?.chave) : undefined
            }
          />
        </div>
        <ul className="flex w-full min-w-0 flex-col gap-1">
          {fatias.map((f, k) => (
            <li key={f.chave}>
              <button
                type="button"
                onClick={() => det.abrir(f.chave)}
                onMouseEnter={() => setAtivo(k)}
                onMouseLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(k)}
                onBlur={() => setAtivo(null)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition ${ativo === k ? "bg-neutral-900/[0.06]" : ""} ${ativo !== null && ativo !== k ? "opacity-50" : ""}`}
              >
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(--serie-${f.cor})` }}
                />
                <span className="min-w-0 flex-1 truncate text-neutral-700">
                  {f.rotulo}
                </span>
                <span className="font-medium tabular-nums">{f.texto}</span>
                <span className="w-12 text-right text-xs tabular-nums text-neutral-500">
                  {parte(f.valor)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pontos: distribuição de pessoas num eixo
// ---------------------------------------------------------------------------

/**
 * Uma bolinha por pessoa no eixo do valor (enxame): mostra de uma vez onde
 * a maioria está e quem foge do padrão. A tabela da tela traz os números.
 */
export function Pontos({
  itens,
  descricao,
  meta,
  sufixo = "",
  casas = 0,
  detalhes,
}: {
  itens: ItemGrafico[];
  descricao: string;
  meta?: { valor: number; texto: string };
  /** Unidade dos rótulos do eixo (ex.: "%"). */
  sufixo?: string;
  casas?: number;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const det = useDetalhes(detalhes);
  const montado = useMontado();
  const ordenados = [...itens].sort((a, b) => a.valor - b.valor);
  const { teto, passoEixo } = eixoJusto(
    Math.max(...ordenados.map((i) => i.valor), meta?.valor ?? 0, 0),
  );
  const x = (v: number) => (Math.max(v, 0) / teto) * 100;

  // Faixas: cada bolinha vai para a primeira faixa (0, +1, −1, +2…) onde não
  // encosta na anterior da mesma faixa.
  const DISTANCIA = 1.6;
  // Até 5 faixas para cada lado; depois disso as bolinhas se sobrepõem
  // (a densidade aparece, e o gráfico não fica alto demais).
  const MAX_FAIXA = 5;
  const ultimaNaFaixa = new Map<number, number>();
  const ordemFaixas = Array.from({ length: MAX_FAIXA * 2 + 1 }, (_, i) =>
    i === 0 ? 0 : i % 2 ? (i + 1) / 2 : -i / 2,
  );
  const posicoes = ordenados.map((i) => {
    const px = x(i.valor);
    const faixa =
      ordemFaixas.find(
        (f) => px - (ultimaNaFaixa.get(f) ?? -Infinity) >= DISTANCIA,
      ) ??
      // Sem vaga: a faixa onde a última bolinha está mais longe.
      ordemFaixas.reduce((melhor, f) =>
        (ultimaNaFaixa.get(f) ?? 0) < (ultimaNaFaixa.get(melhor) ?? 0)
          ? f
          : melhor,
      );
    ultimaNaFaixa.set(faixa, px);
    return { px, faixa };
  });
  const faixas = Math.max(0, ...posicoes.map((p) => Math.abs(p.faixa)));
  const ALTURA_FAIXA = 12;
  const altura = (faixas * 2 + 1) * ALTURA_FAIXA + 24;
  const marcas = Array.from(
    { length: Math.round(teto / passoEixo) + 1 },
    (_, k) => k * passoEixo,
  );
  const item = ativo === null ? undefined : ordenados[ativo];
  const pos = ativo === null ? undefined : posicoes[ativo];

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative ${ANEL_FOCO}`}
        style={{ height: altura }}
        onPointerLeave={() => setAtivo(null)}
      >
        {marcas.map((m) => (
          <span
            key={m}
            aria-hidden
            className="absolute inset-y-0 border-l border-neutral-900/10"
            style={{ left: `${x(m)}%` }}
          />
        ))}
        {meta && (
          <span
            aria-hidden
            className="absolute inset-y-0 border-l-2 border-dashed border-neutral-900/50"
            style={{ left: `${x(meta.valor)}%` }}
          />
        )}
        {ordenados.map((i, k) => {
          const p = posicoes[k];
          if (!p) return null;
          const aceso = ativo === k;
          return (
            <span
              key={i.chave}
              aria-hidden
              className={`absolute size-3 cursor-pointer rounded-full ring-2 ring-white motion-reduce:transition-none ${aceso ? "z-10 bg-marca" : "bg-neutral-900/75"}`}
              style={{
                left: `calc(${p.px}% - 6px)`,
                top: `calc(50% - 6px + ${p.faixa * ALTURA_FAIXA}px)`,
                opacity: montado ? (ativo !== null && !aceso ? 0.35 : 1) : 0,
                transform: montado
                  ? aceso
                    ? "scale(1.5)"
                    : "scale(1)"
                  : "scale(0)",
                transition: `opacity 300ms, transform 300ms cubic-bezier(.2,.8,.2,1) ${montado && ativo === null ? `${k * 12}ms` : "0ms"}, background-color 150ms`,
              }}
              onPointerEnter={() => setAtivo(k)}
              onPointerUp={() => det.abrir(i.chave)}
              onPointerDown={() => setAtivo(k)}
            />
          );
        })}
        {item && pos && (
          <Dica
            x={pos.px}
            y={((altura / 2 + pos.faixa * ALTURA_FAIXA - 6) / altura) * 100}
            titulo={item.titulo ?? item.rotulo}
            valor={item.texto}
            detalhe={item.detalhe}
            clicavel={det.tem(item.chave)}
          />
        )}
        <Explorar
          itens={ordenados}
          ativo={ativo}
          padrao={ordenados.length - 1}
          setAtivo={setAtivo}
          descricao={descricao}
          aoEscolher={
            det.clicavel ? (k) => det.abrir(ordenados[k]?.chave) : undefined
          }
        />
      </div>
      <div className="relative h-4 text-[11px] text-neutral-500" aria-hidden>
        {marcas.map((m, k) => (
          <span
            key={m}
            className="absolute"
            style={{
              left: `${x(m)}%`,
              transform:
                k === 0
                  ? undefined
                  : k === marcas.length - 1
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
            }}
          >
            {formatarNumero(m, casas)}
            {sufixo}
          </span>
        ))}
      </div>
      {meta && (
        <p className="flex items-center gap-2 text-xs text-neutral-500">
          <span
            aria-hidden
            className="h-3 border-l-2 border-dashed border-neutral-900/50"
          />
          {meta.texto}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Minigráfico de tendência (dentro dos cartões de indicador)
// ---------------------------------------------------------------------------

/** Tendência dos últimos meses, sem eixo. O cartão já mostra o valor atual. */
export function MiniArea({
  itens,
  descricao,
}: {
  itens: ItemGrafico[];
  descricao: string;
}) {
  const L = 200;
  const A = 48;
  const [ativo, setAtivo] = useState<number | null>(null);
  const montado = useMontado();
  const svg = useRef<SVGSVGElement>(null);
  const gradiente = `mini-${useId().replace(/:/g, "")}`;
  if (itens.length < 2) return null;
  const valores = itens.map((i) => i.valor);
  // Folga mínima de 25% do maior valor: variações pequenas (31 → 34) não
  // viram montanha-russa.
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const amplitude = Math.max(maior - menor, Math.abs(maior) * 0.25, 1);
  const min = menor - (amplitude - (maior - menor)) / 2;
  const passo = L / (itens.length - 1);
  const pts = itens.map((i, k) => ({
    x: k * passo,
    y: 6 + (1 - (i.valor - min) / amplitude) * (A - 12),
  }));
  const linha = caminhoSuave(pts);
  const area = `${linha} L ${L} ${A} L 0 ${A} Z`;
  const p = ativo === null ? pts.at(-1) : pts[ativo];
  const item = ativo === null ? undefined : itens[ativo];

  function apontar(e: React.PointerEvent) {
    const r = svg.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const k = Math.round((((e.clientX - r.left) / r.width) * L) / passo);
    setAtivo(Math.max(0, Math.min(itens.length - 1, k)));
  }

  return (
    <div
      className={`relative -mx-1 touch-pan-y ${ANEL_FOCO}`}
      onPointerMove={apontar}
      onPointerDown={apontar}
      onPointerLeave={() => setAtivo(null)}
    >
      <svg
        ref={svg}
        viewBox={`0 0 ${L} ${A}`}
        preserveAspectRatio="none"
        className="h-12 w-full overflow-visible text-neutral-900"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradiente} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#58c069" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#58c069" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={area}
          fill={`url(#${gradiente})`}
          className="transition-opacity duration-1000"
          style={{ opacity: montado ? 1 : 0 }}
        />
        <path
          d={linha}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={montado ? 0 : 1}
          className="transition-[stroke-dashoffset] duration-[1200ms] ease-out motion-reduce:transition-none"
        />
      </svg>
      {p && (
        <span
          aria-hidden
          className="absolute size-2.5 rounded-full bg-marca ring-2 ring-white"
          style={{
            left: `calc(${(p.x / L) * 100}% - 5px)`,
            top: `calc(${(p.y / A) * 100}% - 5px)`,
          }}
        />
      )}
      {item && p && (
        <Dica
          x={(p.x / L) * 100}
          y={(p.y / A) * 100}
          titulo={item.titulo ?? item.rotulo}
          valor={item.texto}
        />
      )}
      <Explorar
        itens={itens}
        ativo={ativo}
        padrao={itens.length - 1}
        setAtivo={setAtivo}
        descricao={descricao}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barras divergentes: dois lados a partir do zero (ex.: banco de horas)
// ---------------------------------------------------------------------------

export interface LinhaDivergente {
  chave: string;
  rotulo: string;
  /** Tamanho do lado negativo (sem sinal). */
  negativo: number;
  positivo: number;
  textoNegativo: string;
  textoPositivo: string;
  /** Resumo da linha, embaixo do rótulo (ex.: "saldo −32h56"). */
  resumo: string;
  detalhe?: string;
}

/**
 * Par divergente azul ↔ vermelho (polos que leem como opostos). No cartão
 * escuro de destaque valem sempre os tons para fundo escuro.
 */
const DIVERGENTE_ESCURO = { negativo: "#e66767", positivo: "#3987e5" };

/**
 * Uma linha por categoria: o lado negativo cresce para a esquerda e o
 * positivo para a direita, a partir da linha do zero. Mesma escala nos dois
 * lados; os valores ficam escritos na ponta de cada barra.
 */
export function BarrasDivergentes({
  linhas,
  rotulos,
  descricao,
  escuro = false,
  rolar = false,
  detalhes,
}: {
  linhas: LinhaDivergente[];
  rotulos: { negativo: string; positivo: string };
  descricao: string;
  /** Desenhado sobre o cartão escuro de destaque. */
  escuro?: boolean;
  /**
   * Ocupa a altura do quadro e rola as linhas por dentro (a legenda fica
   * presa embaixo). O quadro precisa ter altura definida.
   */
  rolar?: boolean;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  // Linha encostada no topo da rolagem: a dica abre para baixo.
  const [abaixo, setAbaixo] = useState(false);
  const lista = useRef<HTMLUListElement>(null);
  const det = useDetalhes(detalhes);
  const montado = useMontado();
  function acender(k: number | null, linha?: Element) {
    setAtivo(k);
    const topo = lista.current?.getBoundingClientRect().top;
    setAbaixo(
      rolar &&
        topo !== undefined &&
        linha !== undefined &&
        linha.getBoundingClientRect().top - topo < 80,
    );
  }
  const max = Math.max(...linhas.flatMap((l) => [l.negativo, l.positivo]), 1);
  const metade = (v: number) => (Math.max(v, 0) / max) * 100;
  const corNeg = escuro ? DIVERGENTE_ESCURO.negativo : "var(--div-negativo)";
  const corPos = escuro ? DIVERGENTE_ESCURO.positivo : "var(--div-positivo)";
  const suave = escuro ? "text-[rgb(255_255_255/0.6)]" : "text-neutral-500";
  const forte = escuro ? "text-[#fff]" : "text-neutral-900";
  const trilho = escuro
    ? "bg-[rgb(255_255_255/0.06)]"
    : "bg-neutral-900/[0.05]";
  const linhaZero = escuro ? "bg-[rgb(255_255_255/0.35)]" : "bg-neutral-900/30";

  return (
    <div className={`flex flex-col gap-4 ${rolar ? "h-full min-h-0" : ""}`}>
      <ul
        ref={lista}
        className={`relative flex flex-col gap-4 ${rolar ? "-mr-2 min-h-0 flex-1 overflow-y-auto pr-2" : ""} ${ANEL_FOCO}`}
        onPointerLeave={() => setAtivo(null)}
      >
        {linhas.map((l, k) => {
          const neg = metade(l.negativo);
          const pos = metade(l.positivo);
          const apagado = ativo !== null && ativo !== k;
          return (
            <li
              key={l.chave}
              className={`grid grid-cols-1 gap-2 transition-opacity duration-200 sm:grid-cols-[minmax(7rem,10rem)_1fr] sm:items-center sm:gap-4 ${det.tem(l.chave) ? "cursor-pointer" : ""}`}
              style={{ opacity: apagado ? 0.45 : 1 }}
              onPointerEnter={(e) => acender(k, e.currentTarget)}
              onPointerUp={() => det.abrir(l.chave)}
              onPointerDown={(e) => acender(k, e.currentTarget)}
            >
              <span className="min-w-0">
                <span className={`block truncate text-sm font-medium ${forte}`}>
                  {l.rotulo}
                </span>
                <span className={`block text-xs ${suave}`}>{l.resumo}</span>
              </span>
              <span className={`relative h-7 rounded-full ${trilho}`}>
                <span
                  aria-hidden
                  className={`absolute -inset-y-1 left-1/2 w-px ${linhaZero}`}
                />
                {/* Lado negativo: cresce do centro para a esquerda. */}
                <span
                  className="absolute inset-y-1 right-1/2 rounded-l-full motion-reduce:transition-none"
                  style={{
                    width: montado ? `${neg / 2}%` : "0%",
                    backgroundColor: corNeg,
                    transition: `width 800ms cubic-bezier(.2,.8,.2,1) ${k * 70}ms`,
                  }}
                />
                <span
                  className="absolute inset-y-1 left-1/2 rounded-r-full motion-reduce:transition-none"
                  style={{
                    width: montado ? `${pos / 2}%` : "0%",
                    backgroundColor: corPos,
                    transition: `width 800ms cubic-bezier(.2,.8,.2,1) ${k * 70}ms`,
                  }}
                />
                {/* Valores na ponta de fora; dentro da barra quando ela é longa. */}
                <span
                  className={`absolute top-1/2 -translate-y-1/2 text-xs font-semibold tabular-nums ${neg > 70 ? "text-[#fff]" : forte}`}
                  style={{
                    right:
                      neg > 70
                        ? `calc(50% + ${neg / 2}% - 4.5rem)`
                        : `calc(50% + ${neg / 2}% + 6px)`,
                  }}
                >
                  {l.textoNegativo}
                </span>
                <span
                  className={`absolute top-1/2 -translate-y-1/2 text-xs font-semibold tabular-nums ${pos > 70 ? "text-[#fff]" : forte}`}
                  style={{
                    left:
                      pos > 70
                        ? `calc(50% + ${pos / 2}% - 4.5rem)`
                        : `calc(50% + ${pos / 2}% + 6px)`,
                  }}
                >
                  {l.textoPositivo}
                </span>
                {ativo === k && (
                  <Dica
                    x={50}
                    y={abaixo ? 100 : 0}
                    abaixo={abaixo}
                    titulo={l.rotulo}
                    valor={l.resumo}
                    detalhe={l.detalhe}
                    clicavel={det.tem(l.chave)}
                  />
                )}
              </span>
            </li>
          );
        })}
        <Explorar
          itens={linhas.map((l) => ({
            rotulo: l.rotulo,
            texto: `${rotulos.negativo} ${l.textoNegativo}, ${rotulos.positivo} ${l.textoPositivo}, ${l.resumo}`,
          }))}
          ativo={ativo}
          padrao={0}
          setAtivo={(k) => {
            // Pelo teclado, a linha da vez entra na área visível.
            const linha =
              k === null ? undefined : lista.current?.children.item(k);
            if (rolar) linha?.scrollIntoView({ block: "nearest" });
            acender(k, linha ?? undefined);
          }}
          descricao={descricao}
          aoEscolher={
            det.clicavel ? (k) => det.abrir(linhas[k]?.chave) : undefined
          }
        />
      </ul>
      <div
        className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs ${suave}`}
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: corNeg }}
          />
          ← {rotulos.negativo}
        </span>
        <span className="flex items-center gap-2">
          {rotulos.positivo} →
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: corPos }}
          />
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colunas espelhadas: entradas para cima, saídas para baixo
// ---------------------------------------------------------------------------

export interface ParMensal {
  chave: string;
  rotulo: string;
  titulo: string;
  acima: number;
  abaixo: number;
  destaque?: boolean;
}

/**
 * Duas séries opostas no mesmo mês (ex.: admissões ↑ e desligamentos ↓) a
 * partir de uma linha base. Legenda sempre visível (são duas séries) e o
 * número escrito na ponta de cada coluna.
 */
export function ColunasEspelhadas({
  itens,
  rotulos,
  descricao,
  detalhes,
}: {
  itens: ParMensal[];
  rotulos: { acima: string; abaixo: string };
  descricao: string;
  /** Quem forma cada item, pela chave (abre o modal ao clicar). */
  detalhes?: Record<string, Detalhe>;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const det = useDetalhes(detalhes);
  const montado = useMontado();
  const max = Math.max(...itens.flatMap((i) => [i.acima, i.abaixo]), 1);
  const alt = (v: number) => (v / max) * 82;
  const destaque = itens.findIndex((i) => i.destaque);
  const item = ativo === null ? undefined : itens[ativo];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: "var(--serie-1)" }}
          />
          {rotulos.acima} ↑
        </span>
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: "var(--serie-2)" }}
          />
          {rotulos.abaixo} ↓
        </span>
      </div>
      <div
        className={`relative ${ANEL_FOCO}`}
        onPointerLeave={() => setAtivo(null)}
      >
        <div className="relative flex h-52 gap-1.5 sm:gap-2">
          <span
            aria-hidden
            className="absolute inset-x-0 top-1/2 h-px bg-neutral-900/25"
          />
          {itens.map((i, k) => {
            const apagado = ativo !== null && ativo !== k;
            return (
              <div
                key={i.chave}
                className={`relative flex-1 rounded-full transition-colors ${ativo === k ? "bg-neutral-900/[0.05]" : ""} ${det.tem(i.chave) ? "cursor-pointer" : ""}`}
                style={{ opacity: apagado ? 0.45 : 1 }}
                onPointerEnter={() => setAtivo(k)}
                onPointerUp={() => det.abrir(i.chave)}
                onPointerDown={() => setAtivo(k)}
              >
                {/* Para cima e para baixo a partir da linha base. */}
                <span
                  className="absolute bottom-1/2 left-1/2 w-full max-w-5 -translate-x-1/2 rounded-t-full motion-reduce:transition-none"
                  style={{
                    height: montado ? `${alt(i.acima) / 2}%` : "0%",
                    backgroundColor: "var(--serie-1)",
                    transition: `height 700ms cubic-bezier(.2,.8,.2,1) ${k * 35}ms`,
                  }}
                />
                <span
                  className="absolute top-1/2 left-1/2 w-full max-w-5 -translate-x-1/2 rounded-b-full motion-reduce:transition-none"
                  style={{
                    height: montado ? `${alt(i.abaixo) / 2}%` : "0%",
                    backgroundColor: "var(--serie-2)",
                    transition: `height 700ms cubic-bezier(.2,.8,.2,1) ${k * 35}ms`,
                  }}
                />
                {i.acima > 0 && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 text-[11px] font-medium tabular-nums text-neutral-700"
                    style={{ bottom: `calc(50% + ${alt(i.acima) / 2}% + 2px)` }}
                  >
                    {i.acima}
                  </span>
                )}
                {i.abaixo > 0 && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 text-[11px] font-medium tabular-nums text-neutral-700"
                    style={{ top: `calc(50% + ${alt(i.abaixo) / 2}% + 2px)` }}
                  >
                    {i.abaixo}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {item && ativo !== null && (
          <Dica
            x={((ativo + 0.5) / itens.length) * 100}
            y={50 - alt(item.acima) / 2}
            titulo={item.titulo}
            clicavel={det.tem(item.chave)}
            valor={`+${item.acima} / −${item.abaixo}`}
            detalhe={`${item.acima} ${rotulos.acima.toLowerCase()} · ${item.abaixo} ${rotulos.abaixo.toLowerCase()}`}
          />
        )}
        <Explorar
          itens={itens.map((i) => ({
            rotulo: i.titulo,
            texto: `${i.acima} ${rotulos.acima.toLowerCase()}, ${i.abaixo} ${rotulos.abaixo.toLowerCase()}`,
          }))}
          ativo={ativo}
          padrao={destaque >= 0 ? destaque : itens.length - 1}
          setAtivo={setAtivo}
          descricao={descricao}
          aoEscolher={
            det.clicavel ? (k) => det.abrir(itens[k]?.chave) : undefined
          }
        />
      </div>
      <div className="flex gap-1.5 sm:gap-2" aria-hidden>
        {itens.map((i, k) => (
          <span
            key={i.chave}
            className={`flex-1 truncate text-center text-[11px] ${k === ativo || i.destaque ? "font-medium text-neutral-900" : "text-neutral-500"}`}
          >
            {i.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}
