import { SeloStatus } from "@/components/dashboard/indicador";
import { formatarData, formatarMoeda, formatarPct } from "@/lib/formato";
import {
  type EtapaPrevista,
  type Lancado,
  type LinhaComparacao,
  type LinhaEtapa,
  type Mes,
  normalizar,
  porMes,
  ROTULO_MUDANCA,
  rotuloMes,
  rotuloMesLongo,
} from "@/lib/operacoes/obras";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";

// Tabelas da obra (spec 4.9): previsto × realizado por etapa, a grade mês a
// mês (uma linha por etapa, uma coluna por mês, totais por linha e coluna) e
// a comparação entre revisões. Cada uma tem o par colunas/linhas do Exportar
// com exatamente o que está na tela. Valores negativos em vermelho.

const reais = (c: number) => formatarMoeda(c / 100);
const r2 = (c: number) => c / 100;
const vermelho = (c: number) => (c < 0 ? "text-red-700" : "");
const TH = "px-3 py-2 text-left text-xs font-medium text-neutral-500";
const TD = "px-3 py-2.5 align-top";
const NUM = "whitespace-nowrap text-right tabular-nums";

// ---------------------------------------------------------------------------
// Por etapa
// ---------------------------------------------------------------------------

export function TabelaPorEtapa({
  linhas,
  mesRef,
}: {
  linhas: LinhaEtapa[];
  mesRef: Mes;
}) {
  if (!linhas.length)
    return (
      <p className="py-6 text-sm text-neutral-500">
        Nenhuma etapa nesta revisão.
      </p>
    );
  const soma = (f: (l: LinhaEtapa) => number) =>
    linhas.reduce((s, l) => s + f(l), 0);
  const previsto = soma((l) => l.previsto);
  const realizado = soma((l) => l.realizado);
  return (
    <div data-guia="op-obras-por-etapa" className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">Previsto e realizado por etapa</caption>
        <thead>
          <tr>
            <th className={TH}>Etapa</th>
            <th className={`${TH} text-right`}>Previsto</th>
            <th className={`${TH} text-right`}>
              Previsto até {rotuloMes(mesRef)}
            </th>
            <th className={`${TH} text-right`}>Realizado</th>
            <th className={`${TH} text-right`}>Executado</th>
            <th className={`${TH} text-right`}>Saldo</th>
            <th className={TH}>Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900/[0.06]">
          {linhas.map((l) => (
            <tr key={l.nome}>
              <td className={TD}>
                <span className="font-medium">{l.nome}</span>
                {!l.naRevisao && (
                  <div className="text-xs text-amber-700">
                    Realizado de etapa fora desta revisão
                  </div>
                )}
                {l.observacao && (
                  <div className="max-w-72 text-xs text-neutral-500">
                    {l.observacao}
                  </div>
                )}
              </td>
              <td className={`${TD} ${NUM}`}>{reais(l.previsto)}</td>
              <td className={`${TD} ${NUM}`}>{reais(l.previstoAteMes)}</td>
              <td className={`${TD} ${NUM} ${vermelho(l.realizado)}`}>
                {reais(l.realizado)}
              </td>
              <td className={`${TD} ${NUM}`}>{formatarPct(l.pctExecutado)}</td>
              <td className={`${TD} ${NUM} ${vermelho(l.saldo)}`}>
                {reais(l.saldo)}
              </td>
              <td className={TD} title={l.orcamento.detalhe}>
                <SeloStatus
                  status={l.orcamento.status}
                  rotulo={l.orcamento.rotulo}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-900/10 font-semibold">
            <td className={TD}>Total</td>
            <td className={`${TD} ${NUM}`}>{reais(previsto)}</td>
            <td className={`${TD} ${NUM}`}>
              {reais(soma((l) => l.previstoAteMes))}
            </td>
            <td className={`${TD} ${NUM}`}>{reais(realizado)}</td>
            <td className={`${TD} ${NUM}`}>
              {formatarPct(previsto > 0 ? (realizado / previsto) * 100 : null)}
            </td>
            <td className={`${TD} ${NUM} ${vermelho(previsto - realizado)}`}>
              {reais(previsto - realizado)}
            </td>
            <td className={TD} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function exportarPorEtapa(linhas: LinhaEtapa[], mesRef: Mes) {
  const colunas: ColunaExportar[] = [
    { titulo: "Etapa" },
    { titulo: "Previsto (R$)", numero: true },
    { titulo: `Previsto até ${rotuloMes(mesRef)} (R$)`, numero: true },
    { titulo: "Realizado (R$)", numero: true },
    { titulo: "Executado (%)", numero: true },
    { titulo: "Saldo (R$)", numero: true },
    { titulo: "Situação" },
  ];
  const corpo: CelulaExportar[][] = linhas.map((l) => [
    l.naRevisao ? l.nome : `${l.nome} (fora desta revisão)`,
    r2(l.previsto),
    r2(l.previstoAteMes),
    r2(l.realizado),
    l.pctExecutado === null ? null : Math.round(l.pctExecutado * 10) / 10,
    r2(l.saldo),
    l.orcamento.rotulo,
  ]);
  return { colunas, linhas: corpo };
}

// ---------------------------------------------------------------------------
// Mês a mês
// ---------------------------------------------------------------------------

interface GradeEtapa {
  nome: string;
  previsto: Map<Mes, number>;
  realizado: Map<Mes, number>;
}

/** Linhas da grade: etapas da revisão e as do realizado que não casam. */
export function gradeMensal(
  etapas: EtapaPrevista[],
  lancados: Lancado[],
): GradeEtapa[] {
  const norm = normalizar;
  const grade = [...etapas]
    .sort((a, b) => a.ordem - b.ordem)
    .map((e) => ({
      nome: e.nome,
      previsto: porMes(e.previsto),
      realizado: new Map<Mes, number>(),
    }));
  const porNome = new Map(grade.map((g) => [norm(g.nome), g]));
  for (const l of lancados) {
    let g = porNome.get(norm(l.etapa));
    if (!g) {
      g = { nome: l.etapa, previsto: new Map(), realizado: new Map() };
      porNome.set(norm(l.etapa), g);
      grade.push(g);
    }
    g.realizado.set(l.mes, (g.realizado.get(l.mes) ?? 0) + l.centavos);
  }
  return grade;
}

const somaMapa = (m: Map<Mes, number>, meses: Mes[]) =>
  meses.reduce((s, mes) => s + (m.get(mes) ?? 0), 0);

export function TabelaMensal({
  grade,
  meses,
}: {
  grade: GradeEtapa[];
  meses: Mes[];
}) {
  if (!meses.length || !grade.length)
    return (
      <p className="py-6 text-sm text-neutral-500">
        Nada previsto nem realizado no período escolhido.
      </p>
    );
  const valor = (c: number | undefined) => (c ? reais(c) : "");
  const fixa =
    "sticky left-0 z-[1] bg-white/95 backdrop-blur dark:bg-neutral-100/95";
  const totalPrev = (m: Mes) =>
    grade.reduce((s, g) => s + (g.previsto.get(m) ?? 0), 0);
  const totalReal = (m: Mes) =>
    grade.reduce((s, g) => s + (g.realizado.get(m) ?? 0), 0);
  return (
    <div data-guia="op-obras-mensal" className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">
          Previsto e realizado por etapa e por mês
        </caption>
        <thead>
          <tr>
            <th className={`${TH} ${fixa}`}>Etapa</th>
            <th className={TH}>
              <span className="sr-only">Tipo</span>
            </th>
            {meses.map((m) => (
              <th key={m} className={`${TH} text-right`}>
                <abbr title={rotuloMesLongo(m)} className="no-underline">
                  {rotuloMes(m)}
                </abbr>
              </th>
            ))}
            <th className={`${TH} text-right`}>Total</th>
          </tr>
        </thead>
        {grade.map((g) => {
          const tp = somaMapa(g.previsto, meses);
          const tr = somaMapa(g.realizado, meses);
          return (
            <tbody key={g.nome} className="border-t border-neutral-900/[0.06]">
              <tr>
                <th
                  scope="rowgroup"
                  rowSpan={2}
                  className={`${TD} ${fixa} text-left font-medium`}
                >
                  {g.nome}
                </th>
                <td className={`${TD} text-xs text-neutral-500`}>Previsto</td>
                {meses.map((m) => (
                  <td
                    key={m}
                    className={`${TD} ${NUM} ${vermelho(g.previsto.get(m) ?? 0)}`}
                  >
                    {valor(g.previsto.get(m))}
                  </td>
                ))}
                <td className={`${TD} ${NUM} font-semibold`}>{reais(tp)}</td>
              </tr>
              <tr className="bg-neutral-900/[0.025]">
                <td className={`${TD} text-xs text-neutral-500`}>Realizado</td>
                {meses.map((m) => (
                  <td
                    key={m}
                    className={`${TD} ${NUM} ${vermelho(g.realizado.get(m) ?? 0)}`}
                  >
                    {valor(g.realizado.get(m))}
                  </td>
                ))}
                <td className={`${TD} ${NUM} font-semibold`}>{reais(tr)}</td>
              </tr>
            </tbody>
          );
        })}
        <tfoot className="border-t-2 border-neutral-900/10 font-semibold">
          <tr>
            <th scope="row" rowSpan={2} className={`${TD} ${fixa} text-left`}>
              Total do mês
            </th>
            <td className={`${TD} text-xs font-normal text-neutral-500`}>
              Previsto
            </td>
            {meses.map((m) => (
              <td key={m} className={`${TD} ${NUM}`}>
                {valor(totalPrev(m))}
              </td>
            ))}
            <td className={`${TD} ${NUM}`}>
              {reais(meses.reduce((s, m) => s + totalPrev(m), 0))}
            </td>
          </tr>
          <tr className="bg-neutral-900/[0.025]">
            <td className={`${TD} text-xs font-normal text-neutral-500`}>
              Realizado
            </td>
            {meses.map((m) => (
              <td key={m} className={`${TD} ${NUM}`}>
                {valor(totalReal(m))}
              </td>
            ))}
            <td className={`${TD} ${NUM}`}>
              {reais(meses.reduce((s, m) => s + totalReal(m), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function exportarMensal(grade: GradeEtapa[], meses: Mes[]) {
  const colunas: ColunaExportar[] = [
    { titulo: "Etapa" },
    { titulo: "Tipo" },
    ...meses.map((m) => ({ titulo: rotuloMes(m), numero: true })),
    { titulo: "Total (R$)", numero: true },
  ];
  const linha = (
    nome: string,
    tipo: string,
    m: (mes: Mes) => number,
  ): CelulaExportar[] => [
    nome,
    tipo,
    ...meses.map((mes) => (m(mes) ? r2(m(mes)) : null)),
    r2(meses.reduce((s, mes) => s + m(mes), 0)),
  ];
  const corpo = grade.flatMap((g) => [
    linha(g.nome, "Previsto", (m) => g.previsto.get(m) ?? 0),
    linha(g.nome, "Realizado", (m) => g.realizado.get(m) ?? 0),
  ]);
  corpo.push(
    linha("Total do mês", "Previsto", (m) =>
      grade.reduce((s, g) => s + (g.previsto.get(m) ?? 0), 0),
    ),
    linha("Total do mês", "Realizado", (m) =>
      grade.reduce((s, g) => s + (g.realizado.get(m) ?? 0), 0),
    ),
  );
  return { colunas, linhas: corpo };
}

// ---------------------------------------------------------------------------
// Comparação entre revisões
// ---------------------------------------------------------------------------

const periodo = (p: { de: Mes; ate: Mes } | null) =>
  !p
    ? "—"
    : p.de === p.ate
      ? rotuloMes(p.de)
      : `${rotuloMes(p.de)} a ${rotuloMes(p.ate)}`;

const COR_MUDANCA: Record<
  LinhaComparacao["mudanca"],
  "ok" | "atencao" | "fora" | "sem_dado"
> = {
  igual: "ok",
  valor: "atencao",
  periodo: "atencao",
  valor_e_periodo: "atencao",
  nova: "sem_dado",
  removida: "fora",
};

export function TabelaComparacao({
  linhas,
  antes,
  depois,
}: {
  linhas: LinhaComparacao[];
  antes: string;
  depois: string;
}) {
  const soma = (f: (l: LinhaComparacao) => number | null) =>
    linhas.reduce((s, l) => s + (f(l) ?? 0), 0);
  const ta = soma((l) => l.antes);
  const td = soma((l) => l.depois);
  return (
    <div data-guia="op-obras-comparacao" className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">
          O que mudou de {antes} para {depois}, por etapa
        </caption>
        <thead>
          <tr>
            <th className={TH}>Etapa</th>
            <th className={`${TH} text-right`}>{antes}</th>
            <th className={`${TH} text-right`}>{depois}</th>
            <th className={`${TH} text-right`}>Diferença</th>
            <th className={TH}>Meses na {antes}</th>
            <th className={TH}>Meses na {depois}</th>
            <th className={TH}>O que mudou</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900/[0.06]">
          {linhas.map((l) => (
            <tr key={l.nome}>
              <td className={`${TD} font-medium`}>{l.nome}</td>
              <td className={`${TD} ${NUM}`}>
                {l.antes === null ? "—" : reais(l.antes)}
              </td>
              <td className={`${TD} ${NUM}`}>
                {l.depois === null ? "—" : reais(l.depois)}
              </td>
              <td className={`${TD} ${NUM} ${vermelho(l.diferenca)}`}>
                {l.diferenca
                  ? `${l.diferenca > 0 ? "+" : ""}${reais(l.diferenca)}`
                  : "—"}
              </td>
              <td className={`${TD} whitespace-nowrap`}>
                {periodo(l.periodoAntes)}
              </td>
              <td className={`${TD} whitespace-nowrap`}>
                {periodo(l.periodoDepois)}
              </td>
              <td className={TD}>
                <SeloStatus
                  status={COR_MUDANCA[l.mudanca]}
                  rotulo={
                    l.mesesAlterados &&
                    l.mudanca !== "igual" &&
                    l.mudanca !== "nova" &&
                    l.mudanca !== "removida"
                      ? `${ROTULO_MUDANCA[l.mudanca]} · ${l.mesesAlterados} ${l.mesesAlterados === 1 ? "mês" : "meses"}`
                      : ROTULO_MUDANCA[l.mudanca]
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-900/10 font-semibold">
            <td className={TD}>Total</td>
            <td className={`${TD} ${NUM}`}>{reais(ta)}</td>
            <td className={`${TD} ${NUM}`}>{reais(td)}</td>
            <td className={`${TD} ${NUM} ${vermelho(td - ta)}`}>
              {td - ta ? `${td - ta > 0 ? "+" : ""}${reais(td - ta)}` : "—"}
            </td>
            <td className={TD} colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function exportarComparacao(
  linhas: LinhaComparacao[],
  antes: string,
  depois: string,
) {
  const colunas: ColunaExportar[] = [
    { titulo: "Etapa" },
    { titulo: `${antes} (R$)`, numero: true },
    { titulo: `${depois} (R$)`, numero: true },
    { titulo: "Diferença (R$)", numero: true },
    { titulo: `Meses na ${antes}` },
    { titulo: `Meses na ${depois}` },
    { titulo: "O que mudou" },
  ];
  return {
    colunas,
    linhas: linhas.map((l): CelulaExportar[] => [
      l.nome,
      l.antes === null ? null : r2(l.antes),
      l.depois === null ? null : r2(l.depois),
      r2(l.diferenca),
      periodo(l.periodoAntes),
      periodo(l.periodoDepois),
      ROTULO_MUDANCA[l.mudanca],
    ]),
  };
}

// ---------------------------------------------------------------------------
// Revisões da obra
// ---------------------------------------------------------------------------

export interface RevisaoNaLista {
  codigo: string;
  data: string | null;
  total: number;
  totalArquivo: number | null;
  vigente: boolean;
  status: string | null;
  avisos: number;
  importadaEm: string | null;
}

export function ListaDeRevisoes({ revisoes }: { revisoes: RevisaoNaLista[] }) {
  return (
    <div data-guia="op-obras-revisoes" className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">Revisões do orçamento</caption>
        <thead>
          <tr>
            <th className={TH}>Revisão</th>
            <th className={TH}>Data</th>
            <th className={`${TH} text-right`}>Soma das etapas</th>
            <th className={`${TH} text-right`}>Total da planilha</th>
            <th className={TH}>Situação</th>
            <th className={`${TH} text-right`}>Avisos</th>
            <th className={TH}>Importada em</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900/[0.06]">
          {revisoes.map((r) => (
            <tr key={r.codigo}>
              <td className={`${TD} font-medium`}>{r.codigo}</td>
              <td className={TD}>{formatarData(r.data)}</td>
              <td className={`${TD} ${NUM}`}>{reais(r.total)}</td>
              <td className={`${TD} ${NUM}`}>
                {r.totalArquivo === null ? "—" : reais(r.totalArquivo)}
              </td>
              <td className={TD}>
                {r.status === "previa" ? (
                  <SeloStatus status="atencao" rotulo="Prévia, a confirmar" />
                ) : r.vigente ? (
                  <SeloStatus status="ok" rotulo="Vigente" />
                ) : (
                  <SeloStatus status="sem_dado" rotulo="Guardada" />
                )}
              </td>
              <td className={`${TD} ${NUM}`}>{r.avisos || "—"}</td>
              <td className={TD}>{formatarData(r.importadaEm)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
