import Link from "next/link";
import type {
  ColunaLista,
  LinhaLista,
} from "@/components/dashboard/tabela-lista";
import type { CelulaExportar, ColunaExportar } from "@/components/os/exportar";
import { formatarNumero } from "@/lib/formato";
import {
  type Contagem,
  STATUS,
  semTermo,
  textoDoDisjuntor,
} from "@/lib/operacoes/energia";
import type {
  Caixa,
  Quadro,
  ResumoDoQuadro,
  Sala,
} from "@/server/operacoes/quadros";
import { SeloDoStatus, SeloSemTermo, statusValido } from "./status";

// Lista de caixas (visão tabela, para exportar), com as colunas da aba
// "Todas as Caixas Físicas" do catálogo, o resumo por bloco e as salas sem
// caixa (spec 4.5). Tudo pronto no servidor; a tabela só ordena e busca.

const blocoDe = (c: Caixa, q: Map<string, Quadro>) =>
  `Bloco ${c.sala_bloco ?? q.get(c.quadro_id)?.bloco ?? "—"}`;

const disjuntor = (c: Caixa) =>
  textoDoDisjuntor(c.disjuntor_amperes, c.ligacao) || c.disjuntor_texto || "";

const medidor = (c: Caixa) =>
  [c.medidor_situacao, c.medidor_numero].filter(Boolean).join(" · ");

export const COLUNAS_CAIXAS: ColunaLista[] = [
  { titulo: "Bloco" },
  { titulo: "Caixa" },
  { titulo: "Sala" },
  { titulo: "Status" },
  { titulo: "Ocupante" },
  { titulo: "Disjuntor" },
  { titulo: "Medidor" },
  { titulo: "Rota" },
  { titulo: "Observações", classe: "min-w-64" },
];

export function linhasDeCaixas(
  caixas: Caixa[],
  quadros: Map<string, Quadro>,
  hrefDe: (c: Caixa) => string,
): LinhaLista[] {
  return caixas.map((c) => {
    const s = statusValido(c.status);
    return {
      chave: c.id,
      href: hrefDe(c),
      tom: c.locatario_novo ? "alerta" : semTermo(c) ? "atencao" : undefined,
      busca: [c.numero, c.numero_antigo, c.sala, c.ocupante, c.rota]
        .filter(Boolean)
        .join(" "),
      ordem: [
        blocoDe(c, quadros),
        c.numero,
        c.sala,
        STATUS[s].rotulo,
        c.ocupante,
        disjuntor(c),
        medidor(c),
        c.rota,
        c.observacoes,
      ],
      celulas: [
        blocoDe(c, quadros),
        <span key="n" className="font-medium tabular-nums">
          {c.numero}
          {c.numero_antigo && (
            <span className="block text-[11px] font-normal text-neutral-500">
              antiga {c.numero_antigo}
            </span>
          )}
        </span>,
        c.sala ?? "—",
        <span key="s" className="flex flex-wrap gap-1">
          <SeloDoStatus status={s} />
          {semTermo(c) && <SeloSemTermo />}
        </span>,
        c.ocupante ?? "—",
        disjuntor(c) || "—",
        medidor(c) || "—",
        <span key="r" className="tabular-nums">
          {c.rota ?? "—"}
        </span>,
        <span key="o" className="line-clamp-2 text-xs text-neutral-600">
          {c.observacoes ?? ""}
        </span>,
      ],
    };
  });
}

/** Total por status no rodapé (uma célula por coluna). */
export function rodapeDasCaixas(n: Contagem): React.ReactNode[] {
  return [
    `${formatarNumero(n.caixas)} caixas`,
    "",
    "",
    `${formatarNumero(n.ocupadas)} ocupadas · ${formatarNumero(n.reservadas)} reservadas · ${formatarNumero(n.livres)} livres`,
    `${formatarNumero(n.semTermo)} sem termo`,
    "",
    "",
    "",
    "",
  ];
}

export const COLUNAS_EXPORTAR: ColunaExportar[] = [
  { titulo: "Bloco" },
  { titulo: "Caixa" },
  { titulo: "Numeração antiga" },
  { titulo: "Sala" },
  { titulo: "Pavimento" },
  { titulo: "Status" },
  { titulo: "Sem termo" },
  { titulo: "Ocupante" },
  { titulo: "Disjuntor" },
  { titulo: "Medidor" },
  { titulo: "Rota" },
  { titulo: "Observações" },
];

/** Linhas do Excel e do PDF: exatamente o que a lista mostra. */
export function exportarCaixas(
  caixas: Caixa[],
  quadros: Map<string, Quadro>,
): CelulaExportar[][] {
  return caixas.map((c) => [
    blocoDe(c, quadros),
    c.numero,
    c.numero_antigo,
    c.sala,
    c.pavimento,
    STATUS[statusValido(c.status)].rotulo,
    semTermo(c) ? "Sim" : "",
    c.ocupante,
    disjuntor(c) || null,
    medidor(c) || null,
    c.rota,
    c.observacoes,
  ]);
}

/** Resumo por bloco (todos os quadros); clicar leva ao quadro. */
export function ResumoPorBloco({
  quadros,
  resumo,
  hrefDe,
  atual,
}: {
  quadros: Quadro[];
  resumo: Map<string, ResumoDoQuadro>;
  hrefDe: (q: Quadro) => string;
  atual: string | null;
}) {
  const total = { caixas: 0, ocupadas: 0, reservadas: 0, livres: 0, sem: 0 };
  for (const q of quadros) {
    const r = resumo.get(q.id);
    total.caixas += r?.caixas ?? 0;
    total.ocupadas += r?.ocupadas ?? 0;
    total.reservadas += r?.reservadas ?? 0;
    total.livres += r?.livres ?? 0;
    total.sem += r?.sem_termo ?? 0;
  }
  const n = (v: number) => (
    <td className="px-2 py-2 text-right tabular-nums">{formatarNumero(v)}</td>
  );
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="text-left text-xs text-neutral-500">
            <th className="px-2 py-2 font-medium">Bloco</th>
            <th className="px-2 py-2 font-medium">Projeto</th>
            <th className="px-2 py-2 text-right font-medium">Caixas</th>
            <th className="px-2 py-2 text-right font-medium">Ocupadas</th>
            <th className="px-2 py-2 text-right font-medium">Reservadas</th>
            <th className="px-2 py-2 text-right font-medium">Livres</th>
            <th className="px-2 py-2 text-right font-medium">Sem termo</th>
          </tr>
        </thead>
        <tbody>
          {quadros.map((q) => {
            const r = resumo.get(q.id);
            return (
              <tr
                key={q.id}
                aria-current={q.id === atual ? "true" : undefined}
                className="border-t border-neutral-900/[0.06] aria-[current=true]:bg-neutral-900/[0.04]"
              >
                <td className="px-2 py-2">
                  <Link
                    href={hrefDe(q)}
                    scroll={false}
                    className="font-medium text-neutral-900 underline-offset-4 hover:underline"
                  >
                    {q.nome}
                  </Link>
                </td>
                <td className="px-2 py-2 text-neutral-600">
                  {q.projeto ?? "—"}
                </td>
                {n(r?.caixas ?? 0)}
                {n(r?.ocupadas ?? 0)}
                {n(r?.reservadas ?? 0)}
                {n(r?.livres ?? 0)}
                <td
                  className={`px-2 py-2 text-right tabular-nums ${(r?.sem_termo ?? 0) > 0 ? "font-semibold text-red-700" : ""}`}
                >
                  {formatarNumero(r?.sem_termo ?? 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-900/15 font-semibold">
            <td className="px-2 py-2" colSpan={2}>
              Total
            </td>
            {n(total.caixas)}
            {n(total.ocupadas)}
            {n(total.reservadas)}
            {n(total.livres)}
            {n(total.sem)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Salas do cadastro sem caixa ligada (blocos sem quadro próprio, por exemplo). */
export function SalasSemCaixa({ salas }: { salas: Sala[] }) {
  if (!salas.length)
    return (
      <p className="text-sm text-neutral-500">
        Todas as salas do cadastro têm caixa ligada.
      </p>
    );
  return (
    <ul className="flex flex-wrap gap-2 text-sm">
      {salas.map((s) => (
        <li
          key={s.id}
          className="rounded-full border border-neutral-200 px-3 py-1 text-neutral-700"
        >
          {s.codigo}
          {s.pavimento && (
            <span className="text-neutral-500"> · {s.pavimento}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
