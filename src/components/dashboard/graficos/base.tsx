import { useEffect, useState } from "react";
import {
  type Detalhe,
  ESPERA_PRE_CARGA_MS,
  preCarregarDetalhe,
  useAbrirDetalhe,
} from "@/components/modal-detalhe";
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
export function useMontado() {
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return montado;
}

/** Dica flutuante (vidro fumê) presa a um ponto, em % do quadro do gráfico. */
export function Dica({
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
export function Explorar({
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
export function useDetalhes(detalhes?: Record<string, Detalhe>) {
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

/**
 * Pré-carga do item aceso (mouse parado em cima, dedo ou setas do teclado):
 * o modal dele abre sem esperar. Passar o mouse por cima de vários itens não
 * pede nenhum; só o item em que ele para.
 */
export function usePreCarga(
  detalhes: Record<string, Detalhe> | undefined,
  chave: string | undefined,
) {
  const detalhe = chave === undefined ? undefined : detalhes?.[chave];
  useEffect(() => {
    if (!detalhe?.carregarTabelas) return;
    const id = setTimeout(
      () => preCarregarDetalhe(detalhe),
      ESPERA_PRE_CARGA_MS,
    );
    return () => clearTimeout(id);
  }, [detalhe]);
}

export const ANEL_FOCO =
  "rounded-2xl outline-none has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-neutral-900/25 has-[input:focus-visible]:ring-offset-4 has-[input:focus-visible]:ring-offset-transparent";

/**
 * Caminho suave e monotônico (Fritsch–Carlson): a curva nunca passa acima ou
 * abaixo dos pontos vizinhos, então não inventa picos que os dados não têm.
 */
export function caminhoSuave(pts: { x: number; y: number }[]): string {
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
export function tetoRedondo(max: number, folga = 1.15): number {
  const alvo = Math.max(max * folga, 5);
  const base = 10 ** Math.floor(Math.log10(alvo));
  const passo = alvo / base <= 2 ? base / 2 : base;
  return Math.ceil(alvo / passo) * passo;
}

/** Eixo com passo redondo (1, 2, 2,5 ou 5 × 10ⁿ) e até 6 divisões. */
export function eixoJusto(max: number): { teto: number; passoEixo: number } {
  const alvo = Math.max(max, 1);
  const base = 10 ** Math.floor(Math.log10(alvo));
  for (const m of [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10]) {
    const passo = base * m;
    const teto = Math.ceil(alvo / passo) * passo;
    if (teto / passo <= 6) return { teto, passoEixo: passo };
  }
  return { teto: alvo, passoEixo: alvo };
}

/** Parte de um total em %, com uma casa abaixo de 10%. */
export function parteDe(v: number, total: number): string {
  const p = total > 0 ? (v / total) * 100 : 0;
  return `${formatarNumero(p, p > 0 && p < 10 ? 1 : 0)}%`;
}
