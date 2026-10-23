import { CalendarClock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { type Coluna, Tabela } from "@/components/dashboard/tabela";
import { SeloExemplo } from "@/components/os/selos";
import {
  formatarData,
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import { rotaAtivo } from "@/lib/os/rotas";
import type { FaixasSinal } from "@/lib/os/sinal";
import type { AtivoNaLista } from "@/server/os/ativos";
import {
  SeloCriterio,
  SeloIncompleto,
  SeloSinal,
  SeloSituacaoAtivo,
} from "./selos";

// Lista de ativos e visão "Decisão de troca". Tabela no computador e
// cartões empilhados no celular. Reais só com os.custos.

function NomeDoAtivo({ a }: { a: AtivoNaLista }) {
  return (
    <span className="flex min-w-0 flex-col">
      <Link
        href={rotaAtivo(a.ativo.id)}
        className="font-medium underline-offset-2 hover:underline"
      >
        {a.ativo.nome}
      </Link>
      <span className="font-mono text-[11px] text-neutral-500">
        {a.ativo.codigo}
        {a.categoria ? ` · ${a.categoria}` : ""}
      </span>
    </span>
  );
}

function Abrir({ a }: { a: AtivoNaLista }) {
  return (
    <Link
      href={rotaAtivo(a.ativo.id)}
      aria-label={`Abrir a ficha de ${a.ativo.nome}`}
      className="grid size-7 place-items-center rounded-full text-neutral-400 transition hover:bg-white hover:text-neutral-900"
    >
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}

function Preventiva({ a, hoje }: { a: AtivoNaLista; hoje: string }) {
  if (a.preventivasAtrasadas > 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-red-700">
        <CalendarClock className="size-3.5" aria-hidden />
        {a.preventivasAtrasadas === 1
          ? "1 atrasada"
          : `${a.preventivasAtrasadas} atrasadas`}
      </span>
    );
  if (!a.proximaPreventiva) return <span className="text-neutral-400">—</span>;
  return (
    <span
      className={
        a.proximaPreventiva < hoje ? "text-red-700" : "text-neutral-700"
      }
    >
      {formatarData(a.proximaPreventiva)}
    </span>
  );
}

const pct = (v: number | null) => (v === null ? "—" : formatarPct(v, 0));

export function TabelaAtivos({
  ativos,
  verCustos,
  hoje,
}: {
  ativos: AtivoNaLista[];
  verCustos: boolean;
  hoje: string;
}) {
  const colunas: Coluna<AtivoNaLista>[] = [
    { titulo: "Ativo", valor: (a) => <NomeDoAtivo a={a} /> },
    {
      titulo: "Local",
      valor: (a) => (
        <span className="block max-w-56 truncate" title={a.local}>
          {a.local}
        </span>
      ),
    },
    {
      titulo: "Situação",
      valor: (a) => <SeloSituacaoAtivo situacao={a.ativo.situacao} />,
    },
    {
      titulo: "Corretivas 12m",
      valor: (a) => a.resumo.corretivas12m,
      numero: true,
    },
    ...(verCustos
      ? [
          {
            titulo: "Custo 12m",
            valor: (a: AtivoNaLista) => formatarMoeda(a.resumo.custo12m),
            numero: true,
          },
        ]
      : []),
    { titulo: "Peso", valor: (a) => pct(a.sinal.pesoPct), numero: true },
    {
      titulo: "Sinal",
      valor: (a) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <SeloSinal sinal={a.sinal.sinal} />
          {a.ativo.exemplo && <SeloExemplo />}
        </span>
      ),
    },
    {
      titulo: "Próxima preventiva",
      valor: (a) => <Preventiva a={a} hoje={hoje} />,
    },
    { titulo: "", valor: (a) => <Abrir a={a} /> },
  ];
  return (
    <>
      <div className="hidden md:block">
        <Tabela
          colunas={colunas}
          linhas={ativos}
          chave={(a) => a.ativo.id}
          vazio="Nenhum ativo com esses filtros."
        />
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {ativos.length === 0 && (
          <li className="py-6 text-sm text-neutral-500">
            Nenhum ativo com esses filtros.
          </li>
        )}
        {ativos.map((a) => (
          <li key={a.ativo.id}>
            <Link
              href={rotaAtivo(a.ativo.id)}
              className="flex flex-col gap-2 rounded-2xl bg-white/55 p-4 transition hover:bg-white/80"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-medium">{a.ativo.nome}</span>
                  <span className="block font-mono text-[11px] text-neutral-500">
                    {a.ativo.codigo}
                    {a.categoria ? ` · ${a.categoria}` : ""}
                  </span>
                </span>
                <ChevronRight
                  className="mt-1 size-4 shrink-0 text-neutral-400"
                  aria-hidden
                />
              </span>
              <span className="truncate text-xs text-neutral-500">
                {a.local}
              </span>
              <span className="flex flex-wrap gap-1.5">
                <SeloSituacaoAtivo situacao={a.ativo.situacao} />
                <SeloSinal sinal={a.sinal.sinal} />
                {a.faltas.length > 0 && a.sinal.sinal !== "incompleto" && (
                  <SeloIncompleto faltas={a.faltas} />
                )}
              </span>
              <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                <span>{a.resumo.corretivas12m} corretivas em 12m</span>
                {verCustos && (
                  <span>{formatarMoeda(a.resumo.custo12m)} em 12m</span>
                )}
                <span>
                  Preventiva: <Preventiva a={a} hoje={hoje} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Barra do peso da manutenção com as faixas de avaliar e trocar marcadas. */
function BarraPeso({
  peso,
  faixas,
}: {
  peso: number | null;
  faixas: FaixasSinal;
}) {
  if (peso === null) return <SeloCriterio criterio="sem_dado" />;
  // A escala vai até um pouco além do limite de troca (ou do próprio peso).
  const teto = Math.max(faixas.pesoTrocar * 1.5, peso * 1.05);
  const pos = (v: number) => `${Math.min(100, (v / teto) * 100)}%`;
  const cor =
    peso > faixas.pesoTrocar
      ? "#d03b3b"
      : peso >= faixas.pesoAvaliar
        ? "#fab219"
        : "#0ca30c";
  return (
    <span className="flex min-w-40 items-center gap-2">
      <span
        aria-hidden
        className="relative h-2 flex-1 overflow-hidden rounded-full bg-neutral-900/[0.08]"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: pos(peso), backgroundColor: cor }}
        />
        <span
          className="absolute inset-y-0 w-px bg-neutral-900/40"
          style={{ left: pos(faixas.pesoAvaliar) }}
        />
        <span
          className="absolute inset-y-0 w-px bg-neutral-900/70"
          style={{ left: pos(faixas.pesoTrocar) }}
        />
      </span>
      <span className="w-12 text-right font-medium tabular-nums">
        {formatarPct(peso, 0)}
      </span>
    </span>
  );
}

const idade = (a: AtivoNaLista) =>
  a.sinal.idadePct === null
    ? undefined
    : `${formatarNumero(a.idadeAnos ?? 0, 1)} de ${formatarNumero(a.ativo.vida_util_anos ?? 0, 0)} anos`;

export function DecisaoDeTroca({
  ativos,
  faixas,
  verCustos,
  inicio = 0,
}: {
  ativos: AtivoNaLista[];
  faixas: FaixasSinal;
  verCustos: boolean;
  /** Posição da primeira linha no ranking (páginas seguintes). */
  inicio?: number;
}) {
  const colunas: Coluna<AtivoNaLista>[] = [
    { titulo: "Ativo", valor: (a) => <NomeDoAtivo a={a} /> },
    {
      titulo: "Peso da manutenção",
      valor: (a) => <BarraPeso peso={a.sinal.pesoPct} faixas={faixas} />,
    },
    ...(verCustos
      ? [
          {
            titulo: "Custo 12m / reposição",
            valor: (a: AtivoNaLista) =>
              `${formatarMoeda(a.resumo.custo12m, 0)} / ${formatarMoeda(a.ativo.valor_reposicao, 0)}`,
            numero: true,
          },
        ]
      : []),
    {
      titulo: "Corretivas 12m",
      valor: (a) => (
        <SeloCriterio
          criterio={a.sinal.criterios.corretivas}
          texto={String(a.resumo.corretivas12m)}
        />
      ),
    },
    {
      titulo: "Idade",
      valor: (a) => (
        <SeloCriterio criterio={a.sinal.criterios.idade} texto={idade(a)} />
      ),
    },
    { titulo: "Sinal", valor: (a) => <SeloSinal sinal={a.sinal.sinal} /> },
    { titulo: "", valor: (a) => <Abrir a={a} /> },
  ];
  return (
    <>
      <div className="hidden md:block">
        <Tabela
          colunas={colunas}
          linhas={ativos}
          chave={(a) => a.ativo.id}
          vazio="Nenhum ativo com esses filtros."
        />
      </div>
      <ol className="flex flex-col gap-2 md:hidden">
        {ativos.map((a, i) => (
          <li key={a.ativo.id}>
            <Link
              href={rotaAtivo(a.ativo.id)}
              className="flex flex-col gap-2.5 rounded-2xl bg-white/55 p-4 transition hover:bg-white/80"
            >
              <span className="flex items-start gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-900/[0.06] text-xs font-semibold tabular-nums">
                  {inicio + i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{a.ativo.nome}</span>
                  <span className="block font-mono text-[11px] text-neutral-500">
                    {a.ativo.codigo}
                  </span>
                </span>
                <SeloSinal sinal={a.sinal.sinal} />
              </span>
              <BarraPeso peso={a.sinal.pesoPct} faixas={faixas} />
              <span className="flex flex-wrap gap-1.5 text-xs">
                <SeloCriterio
                  criterio={a.sinal.criterios.corretivas}
                  texto={`${a.resumo.corretivas12m} corretivas`}
                />
                <SeloCriterio
                  criterio={a.sinal.criterios.idade}
                  texto={idade(a) ?? "Idade sem dado"}
                />
              </span>
              {verCustos && (
                <span className="text-xs text-neutral-600">
                  {formatarMoeda(a.resumo.custo12m)} em 12 meses · reposição{" "}
                  {formatarMoeda(a.ativo.valor_reposicao)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
