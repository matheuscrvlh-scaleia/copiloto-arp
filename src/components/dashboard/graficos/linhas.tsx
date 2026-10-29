"use client";

import { useEffect, useRef, useState } from "react";
import {
  ANEL_FOCO,
  caminhoSuave,
  Dica,
  Explorar,
  eixoJusto,
  rotuloVisivel,
  useMontado,
} from "./base";
import { Legenda } from "./colunas-empilhadas";
import {
  corDa,
  formatar,
  formatarEixo,
  type PontoEixo,
  type Serie,
  type Unidade,
} from "./series";

// Linhas ao longo do tempo, uma por série, no mesmo eixo (nunca dois
// eixos). Linha de 2px, marcador no último ponto com o valor escrito, mira
// vertical com a dica de todas as séries, e a linha tracejada da meta quando
// houver. Com 2 ou mais séries a legenda fica sempre visível.

export function Linhas({
  pontos,
  series,
  unidade = "numero",
  descricao,
  meta,
  zero = true,
  altura = 200,
}: {
  pontos: PontoEixo[];
  series: Serie[];
  unidade?: Unidade;
  descricao: string;
  /** Linha tracejada da meta, na mesma escala. */
  meta?: { valor: number; texto: string };
  /** Eixo começa no zero (padrão). Sem ele, encaixa no menor valor. */
  zero?: boolean;
  altura?: number;
}) {
  // Largura real do quadro: 1 unidade = 1px, então o texto do SVG não
  // encolhe em cartão estreito.
  const caixa = useRef<HTMLDivElement>(null);
  const [L, setL] = useState(600);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => {
      if (e && e.contentRect.width > 0) setL(e.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const A = altura;
  const margem = { esq: 46, dir: 14, topo: 16, base: 6 };
  const todos = series.flatMap((s) =>
    s.valores.filter((v): v is number => v !== null),
  );
  const maior = Math.max(...todos, meta?.valor ?? 0, 0);
  const menor = zero
    ? 0
    : Math.min(...todos, meta?.valor ?? Number.POSITIVE_INFINITY);
  const { teto, passoEixo } = eixoJusto(maior - (zero ? 0 : menor));
  const base = zero ? 0 : Math.floor(menor / passoEixo) * passoEixo;
  const topo =
    base + (zero ? teto : Math.ceil((maior - base) / passoEixo) * passoEixo);
  const util = A - margem.topo - margem.base;
  const y = (v: number) =>
    margem.topo + (1 - (v - base) / (topo - base || 1)) * util;
  const passo =
    pontos.length > 1 ? (L - margem.esq - margem.dir) / (pontos.length - 1) : 0;
  const x = (k: number) => margem.esq + k * passo;
  const marcas: number[] = [];
  for (let v = base; v <= topo + 1e-9; v += passoEixo) marcas.push(v);

  const [ativo, setAtivo] = useState<number | null>(null);
  const montado = useMontado();
  const svg = useRef<SVGSVGElement>(null);
  const ultimo = pontos.length - 1;

  function apontar(e: React.PointerEvent) {
    const r = svg.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const xv = ((e.clientX - r.left) / r.width) * L;
    const k = passo === 0 ? 0 : Math.round((xv - margem.esq) / passo);
    setAtivo(Math.max(0, Math.min(ultimo, k)));
  }

  const caminhos = series.map((s) => {
    // Linha quebra onde falta dado.
    const trechos: { x: number; y: number }[][] = [[]];
    s.valores.forEach((v, k) => {
      if (v === null) trechos.push([]);
      else trechos.at(-1)?.push({ x: x(k), y: y(v) });
    });
    return trechos
      .filter((t) => t.length)
      .map(caminhoSuave)
      .join(" ");
  });

  const p = ativo === null ? null : pontos[ativo];
  const maiorNoAtivo =
    ativo === null
      ? 0
      : Math.max(...series.map((s) => s.valores[ativo] ?? base), base);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={caixa}
        className={`relative touch-pan-y select-none ${ANEL_FOCO}`}
        onPointerMove={apontar}
        onPointerDown={apontar}
        onPointerLeave={() => setAtivo(null)}
      >
        <svg
          ref={svg}
          viewBox={`0 0 ${L} ${A}`}
          className="w-full overflow-visible text-neutral-900"
          aria-hidden="true"
        >
          {marcas.map((v) => (
            <g key={v}>
              <line
                x1={margem.esq}
                x2={L - margem.dir}
                y1={y(v)}
                y2={y(v)}
                className="stroke-neutral-900/10"
                strokeWidth={1}
              />
              <text
                x={margem.esq - 6}
                y={y(v) + 3}
                textAnchor="end"
                className="fill-neutral-400 text-[10px]"
              >
                {formatarEixo(v, unidade)}
              </text>
            </g>
          ))}
          {/* O texto da meta fica na legenda: aqui batia no valor do último ponto. */}
          {meta && (
            <line
              x1={margem.esq}
              x2={L - margem.dir}
              y1={y(meta.valor)}
              y2={y(meta.valor)}
              stroke="currentColor"
              strokeOpacity={0.55}
              strokeDasharray="5 5"
              strokeWidth={1.5}
            />
          )}
          {series.map((s, i) => (
            <path
              key={s.chave}
              d={caminhos[i]}
              fill="none"
              stroke={corDa(s.cor)}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={montado ? 0 : 1}
              className="transition-[stroke-dashoffset] duration-[1200ms] ease-out motion-reduce:transition-none"
            />
          ))}
          {ativo !== null && (
            <line
              x1={x(ativo)}
              x2={x(ativo)}
              y1={margem.topo - 6}
              y2={A - margem.base}
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeDasharray="3 4"
            />
          )}
          {series.map((s) => {
            const k = ativo ?? ultimo;
            const v = s.valores[k];
            if (v === null || v === undefined) return null;
            return (
              <g
                key={s.chave}
                className="transition-opacity duration-500"
                style={{ opacity: montado ? 1 : 0 }}
              >
                <circle cx={x(k)} cy={y(v)} r={6} className="fill-white" />
                <circle cx={x(k)} cy={y(v)} r={4} fill={corDa(s.cor)} />
                {ativo === null && series.length === 1 && (
                  <text
                    x={x(k)}
                    y={y(v) - 12}
                    textAnchor="end"
                    className="fill-neutral-900 text-[12px] font-semibold"
                  >
                    {formatar(v, unidade)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {p && ativo !== null && (
          <Dica
            x={(x(ativo) / L) * 100}
            y={(y(maiorNoAtivo) / A) * 100}
            titulo={p.titulo ?? p.rotulo}
            valor={
              series.length === 1
                ? formatar(series[0]?.valores[ativo] ?? null, unidade)
                : `${series.length} séries`
            }
            detalhe={
              series.length === 1
                ? meta
                  ? meta.texto
                  : undefined
                : series
                    .map(
                      (s) =>
                        `${s.rotulo}: ${formatar(s.valores[ativo] ?? null, unidade)}`,
                    )
                    .join(" · ")
            }
          />
        )}
        <Explorar
          itens={pontos.map((pt, k) => ({
            titulo: pt.titulo,
            rotulo: pt.rotulo,
            texto: series
              .map(
                (s) => `${s.rotulo} ${formatar(s.valores[k] ?? null, unidade)}`,
              )
              .join(", "),
          }))}
          ativo={ativo}
          padrao={ultimo}
          setAtivo={setAtivo}
          descricao={descricao}
        />
      </div>
      <div className="relative h-4" aria-hidden>
        {pontos.map(
          (pt, k) =>
            rotuloVisivel(k, pontos.length, ativo) && (
              <span
                key={pt.chave}
                // O último encosta na direita, para não sair do cartão.
                className={`absolute whitespace-nowrap text-[11px] ${k === ultimo && k > 0 ? "-translate-x-full" : "-translate-x-1/2"} ${k === ativo ? "font-medium text-neutral-900" : "text-neutral-500"}`}
                style={{
                  left: k === ultimo && k > 0 ? L - margem.dir + 6 : x(k),
                }}
              >
                {pt.rotulo}
              </span>
            ),
        )}
      </div>
      {(series.length > 1 || meta) && (
        <Legenda
          series={series.length > 1 ? series : []}
          extra={
            meta ? (
              <li className="flex items-center gap-1.5">
                <span
                  className="w-4 border-t-2 border-dashed border-neutral-500"
                  aria-hidden
                />
                {meta.texto}
              </li>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
