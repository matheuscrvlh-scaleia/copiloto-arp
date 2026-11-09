"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  entrarNaGrade,
  type LadoDoPainel,
  montarPainel,
  proximaPosicao,
  STATUS,
  type StatusCaixa,
  type Tecla,
} from "@/lib/operacoes/energia";
import { COR_DO_STATUS, IconeDoStatus } from "./status";

// Desenho do quadro como o painel físico (spec 4.5): lado esquerdo e
// direito, cada caixa na coluna e linha reais, e no centro o barramento com
// o roteiro base e o disjuntor geral. Cada lado é uma grade (role="grid")
// com um só ponto de Tab: as setas andam pelas caixas (pulando os espaços
// vazios e cruzando o barramento), Home e End vão às pontas da linha e
// Enter abre a ficha. O que está fora do filtro fica apagado, mas no lugar.

export interface CelulaDoQuadro {
  id: string;
  numero: string;
  lado: string;
  coluna: number;
  linha: number;
  status: StatusCaixa;
  sala: string | null;
  ocupante: string | null;
  semTermo: boolean;
  novo: boolean;
  noFiltro: boolean;
  href: string;
}

const TECLAS = new Set<string>([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
]);

function descricao(c: CelulaDoQuadro): string {
  return [
    `Caixa ${c.numero}`,
    c.sala ?? "sem sala ligada",
    STATUS[c.status].rotulo,
    c.ocupante,
    c.novo ? "locatário novo sem termo" : c.semTermo ? "sem termo" : null,
    c.noFiltro ? null : "fora do filtro",
  ]
    .filter(Boolean)
    .join(", ");
}

export function GradeDoQuadro({
  nome,
  caixas,
  roteiroBase,
  disjuntorGeral,
  selecionada,
}: {
  nome: string;
  caixas: CelulaDoQuadro[];
  roteiroBase: string | null;
  disjuntorGeral: string | null;
  selecionada?: string | null;
}) {
  const painel = useMemo(() => montarPainel(caixas), [caixas]);
  const links = useRef(new Map<string, HTMLAnchorElement>());
  const primeira =
    caixas.find((c) => c.id === selecionada) ??
    caixas.find((c) => c.noFiltro) ??
    caixas[0];
  const [ativa, setAtiva] = useState<string | undefined>(primeira?.id);
  const ativaExiste = caixas.some((c) => c.id === ativa);
  const foco = ativaExiste ? ativa : primeira?.id;

  function ir(lado: "esquerdo" | "direito", l: number, c: number) {
    const alvo = painel[lado].grade[l]?.[c];
    if (!alvo) return;
    setAtiva(alvo.id);
    links.current.get(alvo.id)?.focus();
  }

  function aoTeclar(
    e: React.KeyboardEvent,
    lado: "esquerdo" | "direito",
    linha: number,
    coluna: number,
  ) {
    if (!TECLAS.has(e.key)) return;
    e.preventDefault();
    const tecla = e.key as Tecla;
    const aqui = painel[lado];
    const prox = proximaPosicao(aqui.grade, { linha, coluna }, tecla);
    if (prox) return ir(lado, prox.linha, prox.coluna);
    // Na borda do barramento: passa para o outro lado, na mesma altura.
    const cruza =
      (lado === "esquerdo" && tecla === "ArrowRight") ||
      (lado === "direito" && tecla === "ArrowLeft");
    if (!cruza) return;
    const outro = lado === "esquerdo" ? "direito" : "esquerdo";
    const entrada = entrarNaGrade(
      painel[outro].grade,
      linha,
      lado === "esquerdo" ? "esquerda" : "direita",
    );
    if (entrada) ir(outro, entrada.linha, entrada.coluna);
  }

  const lado = (
    qual: "esquerdo" | "direito",
    p: LadoDoPainel<CelulaDoQuadro>,
  ) =>
    p.grade.length === 0 ? (
      <p className="py-6 text-center text-xs text-neutral-500">
        Nenhuma caixa no lado {qual}.
      </p>
    ) : (
      <div className="min-w-0 overflow-x-auto pb-1">
        {/* Grade interativa do WAI-ARIA (tabela com role="grid" e um só ponto de Tab). */}
        {/* biome-ignore lint/a11y/useSemanticElements: já é uma tabela; o role grid diz que as setas andam pelas células */}
        <table
          // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: padrão de grade do WAI-ARIA, com navegação por teclado própria
          role="grid"
          aria-label={`${nome}: lado ${qual}`}
          className="w-full min-w-max table-fixed border-separate border-spacing-1.5"
        >
          <tbody>
            {p.grade.map((linha, l) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a linha do desenho é a identidade
              <tr key={l}>
                {linha.map((c, col) =>
                  c ? (
                    <td key={c.id} className="h-px w-[4.75rem] p-0 align-top">
                      <Link
                        href={c.href}
                        scroll={false}
                        prefetch={false}
                        ref={(el) => {
                          if (el) links.current.set(c.id, el);
                          else links.current.delete(c.id);
                        }}
                        tabIndex={c.id === foco ? 0 : -1}
                        aria-label={descricao(c)}
                        aria-current={c.id === selecionada ? "true" : undefined}
                        title={descricao(c)}
                        data-guia="op-energia-caixa"
                        onFocus={() => setAtiva(c.id)}
                        onKeyDown={(e) => aoTeclar(e, qual, l, col)}
                        className={`flex h-full min-h-[4.5rem] flex-col rounded-xl border px-2 py-1.5 text-left text-[11px] leading-tight outline-none transition hover:-translate-y-px hover:shadow-sm focus-visible:ring-4 focus-visible:ring-neutral-900/30 motion-reduce:transition-none ${COR_DO_STATUS[c.status]} ${c.semTermo ? "ring-2 ring-red-700 ring-inset" : ""} ${c.noFiltro ? "" : "opacity-25"} ${c.id === selecionada ? "outline-2 outline-offset-2 outline-neutral-900" : ""}`}
                      >
                        <span className="flex items-center justify-between gap-1">
                          <b className="truncate text-[12.5px] tabular-nums">
                            {c.numero}
                          </b>
                          <span className="flex items-center gap-0.5">
                            {c.semTermo && (
                              <TriangleAlert
                                className="size-3.5 text-red-700"
                                aria-hidden
                              />
                            )}
                            <IconeDoStatus status={c.status} />
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate">
                          {c.sala ?? "—"}
                        </span>
                        <span className="block truncate opacity-80">
                          {c.novo ? "Novo: " : ""}
                          {c.ocupante ??
                            (c.status === "livre" ? "Em espera" : "")}
                        </span>
                      </Link>
                    </td>
                  ) : (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: espaço vazio do desenho, a posição é a identidade
                      key={`vazio-${col}`}
                      className="h-[4.5rem] w-[4.75rem] rounded-xl border border-dashed border-neutral-300/70 p-0"
                    >
                      <span className="sr-only">Espaço vazio</span>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div
      id="mapa-do-quadro"
      data-guia="op-energia-grade"
      className="grid gap-3 rounded-[1.5rem] bg-neutral-100 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_7.5rem_minmax(0,1fr)] lg:items-start"
    >
      {lado("esquerdo", painel.esquerdo)}
      <div
        className="flex flex-row items-center justify-around gap-3 rounded-xl bg-gradient-to-b from-[#c79a4b] to-[#a8792e] px-3 py-3 text-center text-xs font-semibold text-[#fff] lg:min-h-52 lg:flex-col lg:justify-center lg:gap-4 lg:self-stretch"
        role="note"
        aria-label="Barramento"
      >
        <p>
          <span className="block text-[10px] tracking-wide opacity-85">
            ROTEIRO BASE
          </span>
          {roteiroBase ? (
            <span className="tabular-nums [overflow-wrap:anywhere]">
              {roteiroBase}
            </span>
          ) : (
            "—"
          )}
        </p>
        <p>
          <span className="block text-[10px] tracking-wide opacity-85">
            DISJUNTOR GERAL
          </span>
          {disjuntorGeral?.toLocaleUpperCase("pt-BR") ?? "—"}
        </p>
      </div>
      {lado("direito", painel.direito)}
    </div>
  );
}
