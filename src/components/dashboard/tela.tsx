import { Clock, PlugZap, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Children, cloneElement, isValidElement } from "react";
import type { ItemGrafico } from "@/components/dashboard/graficos/base";
import {
  CartaoIndicador,
  type Variacao,
} from "@/components/dashboard/indicador";
import type { Tom } from "@/components/estilos";
import type { Detalhe } from "@/components/modal-detalhe";
import { tonsDaTela } from "@/components/os/tons";
import { formatarNumero } from "@/lib/formato";
import type { Direcao, Status } from "@/lib/indicadores";
import { variacaoPct } from "@/lib/marketing/periodo";

// Peças do padrão das telas de consulta do Marketing e do Comercial (spec 4.3): topo com "Dados de…",
// a linha de filtros escrita e os botões de exportar; cartão com variação
// contra o período anterior e a fonte; abas pela URL; e a nota de fonte em
// letra pequena embaixo de cada tabela.

/** "Meta Ads e leads do RD Station" com as fontes reais da tela; senão undefined. */
export function fontesReais(
  ...fontes: (string | false | null | undefined)[]
): string | undefined {
  const lista = fontes.filter((f): f is string => !!f);
  if (!lista.length) return undefined;
  return lista.length === 1
    ? lista[0]
    : `${lista.slice(0, -1).join(", ")} e ${lista.at(-1)}`;
}

/** Topo: "Dados de dd/mm/aaaa às hh:mm", linha de filtros e exportação. */
export function TopoDaTela({
  dadosDe,
  filtros,
  acoes,
  reais,
  aviso,
  exemplo,
}: {
  /** Ex.: "Dados de 29/10/2026 às 06:00" ou "Versão de 12/10/2026, por Ana". */
  dadosDe?: string;
  /** Linha de filtros escrita (sai igual no Excel e no PDF). */
  filtros?: string;
  /** Botões de exportar (só para quem tem a permissão de exportar do módulo). */
  acoes?: React.ReactNode;
  /** Fontes já ligadas de verdade (ex.: "RD Station"): selo verde. */
  reais?: string;
  /** Fonte real que não respondeu (ex.: a Meta): selo amarelo. */
  aviso?: string;
  /** Fontes ainda de exemplo (ex.: "RD Station CRM"): selo de dado fictício. */
  exemplo?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        {(dadosDe || reais || aviso || exemplo) && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            {dadosDe && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden />
                {dadosDe}
              </span>
            )}
            {reais && (
              <span
                title="Lidos da ferramenta (sincronização diária ou leitura de hora em hora)."
                className="inline-flex items-center gap-1 rounded-full bg-green-400/20 px-2 py-0.5 font-medium text-green-800"
              >
                <PlugZap className="size-3" aria-hidden />
                Dados reais: {reais}
              </span>
            )}
            {exemplo && (
              <span
                title="Gerados no sistema nos campos da API, até a integração ser ligada."
                className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 font-medium text-amber-800"
              >
                <TriangleAlert className="size-3" aria-hidden />
                Dados de exemplo (fictícios): {exemplo}
              </span>
            )}
            {aviso && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 font-medium text-amber-800">
                <TriangleAlert className="size-3" aria-hidden />
                {aviso}
              </span>
            )}
          </p>
        )}
        {filtros && (
          <p className="text-sm text-neutral-700">
            <span className="sr-only">Filtros em uso: </span>
            {filtros}
          </p>
        )}
      </div>
      {acoes && <div className="flex shrink-0 gap-2">{acoes}</div>}
    </div>
  );
}

/** "Fonte: Meta Ads e Google Ads", em letra pequena. */
export function Fonte({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[11px] leading-snug text-neutral-400">
      Fonte: {children}
    </p>
  );
}

/**
 * Variação contra o período anterior, em %. Queda fica em vermelho (spec
 * 4.3), a não ser quando menor é melhor (custo por lead caindo é bom).
 */
export function variacaoContra(
  atual: number,
  anterior: number,
  rotulo: string,
  direcao: Direcao | "neutro" = "maior_melhor",
): Variacao | undefined {
  const v = variacaoPct(atual, anterior);
  if (v === null) return undefined;
  const parado = Math.abs(v) < 0.05;
  const subiu = v > 0;
  const bom = direcao === "menor_melhor" ? !subiu : subiu;
  return {
    texto: `${subiu ? "+" : ""}${formatarNumero(v, 1)}% vs ${rotulo}`,
    sentido:
      parado || direcao === "neutro"
        ? subiu || parado
          ? "neutro"
          : "ruim"
        : bom
          ? "bom"
          : "ruim",
  };
}

/**
 * Cartão da tela: o cartão de indicador do sistema com a fonte em letra
 * pequena. Com `href`, clicar filtra a lista da tela (spec 4.3); `ativo`
 * marca o filtro em uso com um contorno (a cor do cartão é a do ritmo da
 * linha, como nos outros módulos).
 */
export function CartaoDaTela({
  titulo,
  valor,
  fonte,
  href,
  ativo = false,
  detalhe,
  variacao,
  meta,
  status,
  direcao,
  serie,
  calculo,
  exemplo,
  origem,
  tom,
}: {
  titulo: string;
  valor: string;
  fonte: string;
  href?: string;
  ativo?: boolean;
  detalhe?: string;
  variacao?: Variacao;
  meta?: string;
  status?: Status;
  direcao?: Direcao;
  serie?: ItemGrafico[];
  calculo?: string;
  /** O que é de exemplo no número: alerta no canto (só nos cartões com dado fictício). */
  exemplo?: string | false;
  origem?: Detalhe;
  tom?: Tom;
}) {
  const cartao = (
    <CartaoIndicador
      titulo={titulo}
      valor={valor}
      detalhe={detalhe}
      variacao={variacao}
      meta={meta}
      status={status}
      direcao={direcao}
      serie={serie}
      calculo={calculo}
      exemplo={exemplo}
      origem={href ? undefined : origem}
      tom={tom}
    >
      <p className="mt-auto text-[11px] leading-snug text-neutral-400">
        Fonte: {fonte}
        {href && (
          <span className="ml-1 text-neutral-500">
            · {ativo ? "filtrando a lista" : "clique para filtrar"}
          </span>
        )}
      </p>
    </CartaoIndicador>
  );
  if (!href) return cartao;
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={ativo ? "true" : undefined}
      className={`flex rounded-[1.75rem] outline-none *:flex-1 focus-visible:ring-2 focus-visible:ring-neutral-900/25 ${ativo ? "ring-2 ring-neutral-900 ring-offset-2 ring-offset-transparent" : ""}`}
    >
      {cartao}
    </Link>
  );
}

/**
 * Grade dos cartões do topo (no máximo 4 por tela ou aba). Como no RH e nos
 * Tickets, a linha mistura vidro claro, preto e verde da marca; o ritmo é
 * sorteado pelo título do primeiro cartão, então é fixo em cada tela e muda
 * de uma tela para outra. Cartão com `tom` próprio fica como está.
 */
export function Cartoes({
  modulo,
  children,
}: {
  /** Entra no sorteio do ritmo (ex.: "marketing"). */
  modulo: string;
  children: React.ReactNode;
}) {
  const itens = Children.toArray(children).filter((c) =>
    isValidElement<{ titulo?: string; tom?: Tom }>(c),
  ) as React.ReactElement<{ titulo?: string; tom?: Tom }>[];
  const tons = tonsDaTela(
    `${modulo}:${itens[0]?.props.titulo ?? ""}`,
    itens.length,
  );
  return (
    <div
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${itens.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}
    >
      {itens.map((c, i) =>
        c.props.tom === undefined ? cloneElement(c, { tom: tons[i] }) : c,
      )}
    </div>
  );
}

/** Abas da tela pela URL (?aba=…), mantendo os outros filtros. */
export function AbasDaTela({
  abas,
  ativa,
  rotulo,
}: {
  abas: { chave: string; rotulo: string; href: string; aviso?: string }[];
  ativa: string;
  rotulo: string;
}) {
  return (
    <nav
      aria-label={rotulo}
      className="vidro flex w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-fit"
    >
      {abas.map((a) => (
        <Link
          key={a.chave}
          href={a.href}
          scroll={false}
          aria-current={a.chave === ativa ? "page" : undefined}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-white/60 hover:text-neutral-900 aria-[current=page]:bg-neutral-900 aria-[current=page]:text-white aria-[current=page]:shadow-sm"
        >
          {a.rotulo}
          {a.aviso && (
            <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
              {a.aviso}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** Link "Abrir na ferramenta" (o módulo só consulta). */
export function AbrirNaFerramenta({
  href,
  ferramenta,
  compacto = false,
}: {
  href: string;
  ferramenta: string;
  compacto?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        compacto
          ? "whitespace-nowrap text-xs font-medium text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline"
          : "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
      }
    >
      {compacto ? `Abrir no ${ferramenta}` : `Abrir no ${ferramenta} ↗`}
    </a>
  );
}

/** Href da tela com os parâmetros atuais trocados (null remove). */
export function hrefCom(
  base: string,
  busca: Record<string, string | string[] | undefined>,
  muda: Record<string, string | null>,
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(busca)) {
    if (k === "limpar") continue;
    const um = Array.isArray(v) ? v[0] : v;
    if (um) p.set(k, um);
  }
  for (const [k, v] of Object.entries(muda)) {
    if (v === null || v === "") p.delete(k);
    else p.set(k, v);
  }
  const q = p.toString();
  return q ? `${base}?${q}` : base;
}
