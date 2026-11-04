import { Fonte, Valor } from "@/components/comercial/tela";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import { Secao } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import { BotaoExportar } from "@/components/os/exportar";
import {
  FAIXAS,
  type Faixa,
  type LimitesCurva,
  type LinhaCarteira,
  porAtividade,
  type Resumo,
  resumoPorFaixa,
  rotuloDaFaixa,
} from "@/lib/comercial/carteira";
import {
  type ColunasMovimento,
  INDICADORES,
  type Indicador,
  type LinhaLuc,
  type LinhaQuadro,
} from "@/lib/comercial/ocupacao";
import {
  formatarData,
  formatarMes,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";

// Abas da Ocupação e estoque (spec 4.5): lista de LUCs, quadros por bloco e
// por tipo, entradas e saídas e curva da carteira. Recebem as linhas já sem
// valores quando a pessoa não tem a permissão.

const ENET_LUCS =
  "ENET — LUCs (Número, Local, Piso, Rua, Tipo loja, ABL, Área útil, Status)";
const m2 = (v: number) => formatarNumero(v, 2);
const pct = (v: number | null) => (v === null ? "—" : formatarPct(v, 1));

// ---------------------------------------------------------------------------
// LUCs
// ---------------------------------------------------------------------------

export function colunasLucs(comValores: boolean) {
  return [
    { titulo: "LUC" },
    { titulo: "Bloco" },
    { titulo: "Piso" },
    { titulo: "Rua" },
    { titulo: "Tipo" },
    { titulo: "ABL (m²)", numero: true },
    { titulo: "Área útil (m²)", numero: true },
    { titulo: "Status" },
    { titulo: "Locatário", classe: "min-w-48" },
    { titulo: "Início do contrato" },
    ...(comValores ? [{ titulo: "Aluguel", numero: true }] : []),
  ];
}

export function exportarLucs(
  ls: LinhaLuc[],
  comValores: boolean,
): CelulaExportar[][] {
  return ls.map((l) => [
    l.numero,
    l.bloco,
    l.piso,
    l.rua,
    l.tipo,
    l.abl,
    l.areaUtil,
    l.status,
    l.locatario ?? "",
    l.inicio ? formatarData(l.inicio) : "",
    ...(comValores ? [l.aluguel] : []),
  ]);
}

export function colunasExportarLucs(comValores: boolean): ColunaExportar[] {
  return colunasLucs(comValores).map((c) => ({
    titulo: c.titulo,
    numero: c.numero,
    formato: c.numero ? "#,##0.00" : undefined,
  }));
}

export const COLUNAS_DISPONIVEIS: ColunaExportar[] = [
  { titulo: "LUC" },
  { titulo: "Bloco" },
  { titulo: "Piso" },
  { titulo: "Rua" },
  { titulo: "Tipo" },
  { titulo: "ABL (m²)", numero: true, formato: "#,##0.00" },
  { titulo: "Área útil (m²)", numero: true, formato: "#,##0.00" },
];

export const exportarDisponiveis = (ls: LinhaLuc[]): CelulaExportar[][] =>
  ls.map((l) => [l.numero, l.bloco, l.piso, l.rua, l.tipo, l.abl, l.areaUtil]);

export function SeloStatus({ status }: { status: LinhaLuc["status"] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${status === "Locado" ? "bg-green-400/20 text-green-800" : "bg-amber-400/20 text-amber-800"}`}
    >
      {status}
    </span>
  );
}

export function ListaDeLucs({
  linhas,
  todas,
  comValores,
  hrefDe,
  exportar,
  filtros,
}: {
  linhas: LinhaLuc[];
  /** Do filtro, sem o status: de onde sai a lista de disponíveis. */
  todas: LinhaLuc[];
  comValores: boolean;
  hrefDe: (numero: string) => string;
  exportar: boolean;
  filtros: string;
}) {
  const vagos = todas.filter((l) => l.status === "Vago");
  const abl = linhas.reduce((t, l) => t + l.abl, 0);
  const util = linhas.reduce((t, l) => t + l.areaUtil, 0);
  const aluguel = linhas.reduce((t, l) => t + (l.aluguel ?? 0), 0);
  return (
    <Secao
      titulo="LUCs"
      descricao={`Uma linha por LUC, com o locatário do contrato ativo.${comValores ? "" : " Aluguel só para quem tem a permissão de valores."}`}
    >
      {exportar && (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2 text-xs text-neutral-500">
          Imóveis disponíveis ({formatarNumero(vagos.length)} vagos)
          <BotaoExportar
            titulo="Imóveis disponíveis"
            filtros={filtros}
            nomeArquivo="imoveis-disponiveis"
            colunas={COLUNAS_DISPONIVEIS}
            linhas={exportarDisponiveis(vagos)}
          />
        </div>
      )}
      <TabelaLista
        colunas={colunasLucs(comValores)}
        placeholder="Buscar LUC, locatário, rua…"
        vazio="Nenhum LUC nesse filtro."
        alturaMax="max-h-[40rem]"
        linhas={linhas.map((l) => ({
          chave: l.numero,
          busca: [
            l.numero,
            l.bloco,
            l.piso,
            l.rua,
            l.tipo,
            l.status,
            l.locatario,
          ]
            .filter(Boolean)
            .join(" "),
          href: hrefDe(l.numero),
          celulas: [
            <span key="n" className="font-mono text-xs font-medium">
              {l.numero}
            </span>,
            l.bloco,
            l.piso,
            l.rua,
            l.tipo,
            <Valor key="a" valor={l.abl} />,
            <Valor key="u" valor={l.areaUtil} />,
            <SeloStatus key="s" status={l.status} />,
            l.locatario ?? (
              <span key="l" className="text-neutral-400">
                —
              </span>
            ),
            l.inicio ? (
              formatarData(l.inicio)
            ) : (
              <span key="i" className="text-neutral-400">
                —
              </span>
            ),
            ...(comValores ? [<Valor key="v" valor={l.aluguel} />] : []),
          ],
          ordem: [
            l.numero,
            l.bloco,
            l.piso,
            l.rua,
            l.tipo,
            l.abl,
            l.areaUtil,
            l.status,
            l.locatario,
            l.inicio,
            ...(comValores ? [l.aluguel] : []),
          ],
        }))}
        rodape={[
          "Total",
          `${formatarNumero(linhas.length)} LUCs`,
          "",
          "",
          "",
          m2(abl),
          m2(util),
          "",
          "",
          "",
          ...(comValores ? [m2(aluguel)] : []),
        ]}
      />
      <Fonte>
        {ENET_LUCS} e ENET — Contratos (locatário, início e aluguel do contrato
        ativo). Área publicitária não tem ABL: conta na quantidade, não nos m².
      </Fonte>
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Quadros por bloco e por tipo
// ---------------------------------------------------------------------------

export function colunasQuadro(por: string): ColunaExportar[] {
  return [
    { titulo: por },
    { titulo: "LUCs", numero: true },
    { titulo: "Locados", numero: true },
    { titulo: "Vagos", numero: true },
    { titulo: "ABL locada (m²)", numero: true, formato: "#,##0.00" },
    { titulo: "ABL vaga (m²)", numero: true, formato: "#,##0.00" },
    { titulo: "% de ocupação", numero: true, formato: "0.0" },
  ];
}

const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

export function exportarQuadro(
  q: LinhaQuadro[],
  total: LinhaQuadro,
): CelulaExportar[][] {
  return [...q, total].map((x) => [
    x.chave,
    x.quantidade,
    x.locados,
    x.vagos,
    x.ablLocada,
    x.ablVaga,
    r1(x.pct),
  ]);
}

export function Quadro({
  titulo,
  descricao,
  por,
  linhas,
  total,
}: {
  titulo: string;
  descricao: string;
  por: string;
  linhas: LinhaQuadro[];
  total: LinhaQuadro;
}) {
  const celulas = (x: LinhaQuadro) => [
    formatarNumero(x.quantidade),
    formatarNumero(x.locados),
    formatarNumero(x.vagos),
    m2(x.ablLocada),
    m2(x.ablVaga),
    pct(x.pct),
  ];
  return (
    <Secao titulo={titulo} descricao={descricao}>
      <TabelaLista
        colunas={colunasQuadro(por).map((c) => ({
          titulo: c.titulo,
          numero: c.numero,
        }))}
        semBusca
        vazio="Nenhum LUC nesse filtro."
        linhas={linhas.map((x) => ({
          chave: x.chave,
          busca: x.chave,
          celulas: [
            <span key="c" className="font-medium">
              {x.chave}
            </span>,
            ...celulas(x),
          ],
          ordem: [
            x.chave,
            x.quantidade,
            x.locados,
            x.vagos,
            x.ablLocada,
            x.ablVaga,
            x.pct,
          ],
        }))}
        rodape={["Total", ...celulas(total)]}
      />
      <Fonte>{ENET_LUCS}. % de ocupação = ABL locada ÷ ABL total.</Fonte>
    </Secao>
  );
}

export function GraficoPorBloco({ linhas }: { linhas: LinhaQuadro[] }) {
  const com = linhas.filter((x) => x.pct !== null);
  return (
    <Secao
      tom="escuro"
      titulo="% de ocupação por bloco"
      descricao="Em m² (ABL locada ÷ ABL total); blocos sem ABL ficam fora."
      calculo="ABL dos LUCs locados dividida pela ABL de todos os LUCs do bloco, com os filtros da tela. Fonte: ENET — LUCs e contratos ativos."
    >
      <BarrasHorizontais
        descricao="Percentual de ocupação por bloco, em m²"
        vazio="Nenhum bloco com ABL nesse filtro."
        itens={com.map((x) => ({
          chave: x.chave,
          rotulo: x.chave,
          valor: x.pct ?? 0,
          texto: pct(x.pct),
          detalhe: `${m2(x.ablLocada)} de ${m2(x.ablTotal)} m² · ${x.locados} locados, ${x.vagos} vagos`,
        }))}
      />
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Entradas, saídas e transferências
// ---------------------------------------------------------------------------

const COLS_MOV = ["Entrada", "Saída", "Transferência", "Saldo"];
const valoresMov = (c: ColunasMovimento) => [
  c.entrada,
  c.saida,
  c.transferencia,
  c.saldo,
];

export function colunasExportarMov(i: Indicador): ColunaExportar[] {
  const formato = i === "quantidade" ? "#,##0" : "#,##0.00";
  return [
    { titulo: "Mês ou bloco" },
    ...COLS_MOV.map((t) => ({ titulo: t, numero: true, formato })),
  ];
}

export function exportarMov(
  meses: { mes: string; colunas: ColunasMovimento }[],
  blocos: { bloco: string; colunas: ColunasMovimento }[],
  total: ColunasMovimento,
): CelulaExportar[][] {
  return [
    ...meses.map((m) => [formatarMes(m.mes), ...valoresMov(m.colunas)]),
    ["Total do ano", ...valoresMov(total)],
    ["", "", "", "", ""],
    ["Por bloco", "", "", "", ""],
    ...blocos.map((b) => [b.bloco, ...valoresMov(b.colunas)]),
    ["Total", ...valoresMov(total)],
  ];
}

export function QuadrosMovimento({
  ano,
  indicador,
  meses,
  blocos,
  total,
  dias,
}: {
  ano: number;
  indicador: Indicador;
  meses: { mes: string; colunas: ColunasMovimento }[];
  blocos: { bloco: string; colunas: ColunasMovimento }[];
  total: ColunasMovimento;
  dias: number;
}) {
  const casas = indicador === "quantidade" ? 0 : 2;
  const celulas = (c: ColunasMovimento) =>
    valoresMov(c).map((v, k) => (
      <Valor key={COLS_MOV[k]} valor={v} casas={casas} />
    ));
  const colunas = (primeira: string) => [
    { titulo: primeira },
    ...COLS_MOV.map((titulo) => ({ titulo, numero: true })),
  ];
  const descricao = `${ano} · ${INDICADORES[indicador]} · transferência: o mesmo CPF ou CNPJ rescindiu um LUC e começou outro em até ${dias} dias (parâmetro). Saldo = entradas − saídas.`;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Secao titulo="Por mês" descricao={descricao}>
        <TabelaLista
          colunas={colunas("Mês")}
          semBusca
          linhas={meses.map((m) => ({
            chave: m.mes,
            busca: m.mes,
            celulas: [formatarMes(m.mes), ...celulas(m.colunas)],
            ordem: [m.mes, ...valoresMov(m.colunas)],
          }))}
          rodape={["Total", ...celulas(total)]}
        />
        <Fonte>
          ENET — Contratos (LUC, locatário, início, rescisão, aluguel) e
          Clientes (CPF ou CNPJ). Entrada na data de início; saída na rescisão.
        </Fonte>
      </Secao>
      <Secao tom="escuro" titulo="Por bloco" descricao={descricao}>
        <TabelaLista
          colunas={colunas("Bloco")}
          semBusca
          vazio="Nenhum movimento no ano."
          linhas={blocos.map((b) => ({
            chave: b.bloco,
            busca: b.bloco,
            celulas: [b.bloco, ...celulas(b.colunas)],
            ordem: [b.bloco, ...valoresMov(b.colunas)],
          }))}
          rodape={["Total", ...celulas(total)]}
        />
        <Fonte>ENET — Contratos e LUCs (Local).</Fonte>
      </Secao>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Curva da carteira
// ---------------------------------------------------------------------------

export const COLUNAS_CARTEIRA: ColunaExportar[] = [
  { titulo: "Locatário" },
  { titulo: "Atividade" },
  { titulo: "LUCs", numero: true },
  { titulo: "m²", numero: true, formato: "#,##0.00" },
  { titulo: "Aluguel", numero: true, formato: "#,##0.00" },
  { titulo: "Valor por m²", numero: true, formato: "#,##0.00" },
  { titulo: "% do total", numero: true, formato: "0.00" },
  { titulo: "% acumulado", numero: true, formato: "0.0" },
  { titulo: "Faixa" },
];

const r2 = (v: number) => Math.round(v * 100) / 100;

export const exportarCarteira = (ls: LinhaCarteira[]): CelulaExportar[][] =>
  ls.map((l) => [
    l.locatario,
    l.atividade,
    l.lucs,
    l.m2,
    l.aluguel,
    l.valorM2,
    r2(l.pct),
    r1(l.acumulado),
    l.faixa,
  ]);

const TOM_FAIXA: Record<Faixa, string> = {
  A: "bg-sky-400/20 text-sky-800",
  B: "bg-green-400/20 text-green-800",
  C: "bg-neutral-900/[0.06] text-neutral-700",
};

export function SeloFaixa({ faixa }: { faixa: Faixa }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${TOM_FAIXA[faixa]}`}
    >
      {faixa}
    </span>
  );
}

export function TabelasCarteira({
  linhas,
  total,
  limites,
}: {
  linhas: LinhaCarteira[];
  total: Resumo;
  limites: LimitesCurva;
}) {
  const atividades = porAtividade(linhas);
  const faixas = resumoPorFaixa(linhas);
  return (
    <>
      <Secao
        titulo="Resumo por faixa"
        descricao="Locatários ordenados pelo aluguel em contrato; a faixa vem do % acumulado (limites nos parâmetros)."
      >
        <TabelaLista
          colunas={[
            { titulo: "Faixa" },
            { titulo: "Clientes", numero: true },
            { titulo: "Valor", numero: true },
            { titulo: "m²", numero: true },
          ]}
          semBusca
          linhas={FAIXAS.map((fx) => ({
            chave: fx,
            busca: fx,
            celulas: [
              <span key="f" className="inline-flex items-center gap-2">
                <SeloFaixa faixa={fx} />
                {rotuloDaFaixa(fx, limites)}
              </span>,
              formatarNumero(faixas[fx].clientes),
              m2(faixas[fx].aluguel),
              m2(faixas[fx].m2),
            ],
            ordem: [fx, faixas[fx].clientes, faixas[fx].aluguel, faixas[fx].m2],
          }))}
          rodape={[
            "Total",
            formatarNumero(total.clientes),
            m2(total.aluguel),
            m2(total.m2),
          ]}
        />
        <Fonte>ENET — Contratos ativos (aluguel) e LUCs (m²).</Fonte>
      </Secao>
      <Secao
        titulo="Locatários pelo aluguel em contrato"
        descricao={`Uma linha por locatário (soma todos os LUCs dele), do maior aluguel para o menor. Faixas: ${FAIXAS.map((f) => `${f} ${rotuloDaFaixa(f, limites)}`).join(" · ")} (parâmetros).`}
      >
        <TabelaLista
          colunas={COLUNAS_CARTEIRA.map((c) => ({
            titulo: c.titulo,
            numero: c.numero,
            classe: c.titulo === "Locatário" ? "min-w-48" : undefined,
          }))}
          placeholder="Buscar locatário ou atividade…"
          vazio="Nenhum contrato ativo nesse filtro."
          alturaMax="max-h-[40rem]"
          linhas={linhas.map((l) => ({
            chave: l.cliente,
            busca: `${l.locatario} ${l.atividade} faixa ${l.faixa}`,
            celulas: [
              <span key="n" className="font-medium">
                {l.locatario}
              </span>,
              l.atividade,
              formatarNumero(l.lucs),
              m2(l.m2),
              m2(l.aluguel),
              <Valor key="m" valor={l.valorM2} />,
              formatarPct(l.pct, 2),
              formatarPct(l.acumulado, 1),
              <SeloFaixa key="f" faixa={l.faixa} />,
            ],
            ordem: [
              l.locatario,
              l.atividade,
              l.lucs,
              l.m2,
              l.aluguel,
              l.valorM2,
              l.pct,
              l.acumulado,
              l.faixa,
            ],
          }))}
          rodape={[
            "Total",
            `${formatarNumero(total.clientes)} locatários`,
            formatarNumero(total.lucs),
            m2(total.m2),
            m2(total.aluguel),
            total.m2 ? m2(total.aluguel / total.m2) : "—",
            "100%",
            "",
            "",
          ]}
        />
        <Fonte>
          ENET — Contratos ativos (aluguel, LUC) e Clientes (atividade); m² do
          ENET — LUCs.
        </Fonte>
      </Secao>
      <Secao
        tom="escuro"
        titulo="Por atividade"
        descricao="Mesma carteira agrupada pela atividade do locatário."
      >
        <TabelaLista
          colunas={[
            { titulo: "Atividade" },
            { titulo: "Locatários", numero: true },
            { titulo: "LUCs", numero: true },
            { titulo: "m²", numero: true },
            { titulo: "Aluguel", numero: true },
            { titulo: "% do total", numero: true },
          ]}
          semBusca
          linhas={atividades.map((a) => ({
            chave: a.atividade,
            busca: a.atividade,
            celulas: [
              <span key="a" className="font-medium">
                {a.atividade}
              </span>,
              formatarNumero(a.clientes),
              formatarNumero(a.lucs),
              m2(a.m2),
              m2(a.aluguel),
              formatarPct(a.pct, 1),
            ],
            ordem: [a.atividade, a.clientes, a.lucs, a.m2, a.aluguel, a.pct],
          }))}
          rodape={[
            "Total",
            formatarNumero(total.clientes),
            formatarNumero(total.lucs),
            m2(total.m2),
            m2(total.aluguel),
            "100%",
          ]}
        />
        <Fonte>ENET — Clientes (atividade) e Contratos ativos.</Fonte>
      </Secao>
    </>
  );
}
