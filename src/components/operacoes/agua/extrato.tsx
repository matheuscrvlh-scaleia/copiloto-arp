import Link from "next/link";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { type Coluna, Tabela } from "@/components/dashboard/tabela";
import { formatarData, formatarNumero } from "@/lib/formato";
import { consumoPorMes } from "@/lib/operacoes/agua-extrato";
import {
  formatarM3,
  MESES_ABREV,
  ROTULO_TIPO,
  rotuloMes,
} from "@/lib/operacoes/agua-formato";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import type { Leitura } from "@/server/operacoes/agua";
import { Foto, legendaDaFoto } from "./leituras";
import { BASE_AGUA, TipoFaturamento } from "./tela";

// Extrato da água (spec 4.4, Tela 3): tabela mês a mês, gráfico do consumo
// e as fotos de cada mês. Usado no hidrômetro e na aba Extrato (sala ou
// cliente, que mostra também as trocas de hidrômetro).

const n2 = (v: number | null) => (v === null ? "—" : formatarNumero(v, 2));

export function GraficoDeConsumo({
  leituras,
  meses,
}: {
  leituras: Pick<Leitura, "referencia" | "consumo">[];
  meses: string[];
}) {
  const serie = consumoPorMes(leituras, meses);
  return (
    <div data-guia="op-agua-grafico">
      <Colunas
        descricao="Consumo de água em m³ por mês"
        itens={serie.map((s) => ({
          chave: s.referencia,
          rotulo: (
            MESES_ABREV[Number(s.referencia.slice(5, 7)) - 1] ?? ""
          ).toLowerCase(),
          titulo: rotuloMes(s.referencia),
          valor: s.consumo ?? 0,
          texto: s.consumo === null ? "sem leitura" : formatarM3(s.consumo),
        }))}
      />
    </div>
  );
}

export function TabelaDoExtrato({
  leituras,
  comValores,
  links,
  comHidrometro,
}: {
  leituras: Leitura[];
  comValores: boolean;
  links: Map<string, string>;
  /** Mostra bloco, sala e hidrômetro (extrato por sala ou cliente). */
  comHidrometro: boolean;
}) {
  const colunas: Coluna<Leitura>[] = [
    { titulo: "Referência", valor: (l) => rotuloMes(l.referencia) },
    ...(comHidrometro
      ? [
          {
            titulo: "Bloco · sala",
            valor: (l: Leitura) => `${l.bloco} · ${l.sala || "—"}`,
          },
          { titulo: "Cliente", valor: (l: Leitura) => l.cliente || "—" },
          {
            titulo: "Hidrômetro",
            valor: (l: Leitura) => (
              <Link
                href={`${BASE_AGUA}/${encodeURIComponent(l.hidrometro)}`}
                className="underline-offset-4 hover:underline"
              >
                {l.hidrometro}
              </Link>
            ),
          },
        ]
      : [
          {
            titulo: "Bloco · sala",
            valor: (l: Leitura) => `${l.bloco} · ${l.sala || "—"}`,
          },
        ]),
    { titulo: "Data ant.", valor: (l) => formatarData(l.dataAnterior) },
    { titulo: "Data atual", valor: (l) => formatarData(l.dataAtual) },
    { titulo: "Dias", valor: (l) => l.dias ?? "—", numero: true },
    {
      titulo: "Leit. anterior",
      valor: (l) => n2(l.leituraAnterior),
      numero: true,
    },
    { titulo: "Leit. atual", valor: (l) => n2(l.leituraAtual), numero: true },
    { titulo: "Consumo (m³)", valor: (l) => n2(l.consumo), numero: true },
    { titulo: "Faturado (m³)", valor: (l) => n2(l.volume), numero: true },
    ...(comValores
      ? [
          {
            titulo: "Valor (R$)",
            valor: (l: Leitura) => n2(l.valor),
            numero: true,
          },
        ]
      : []),
    { titulo: "Tipo", valor: (l) => <TipoFaturamento tipo={l.tipo} /> },
    { titulo: "Foto do visor", valor: (l) => <Foto l={l} links={links} /> },
  ];
  const soma = (f: (l: Leitura) => number, casas: number) =>
    leituras.reduce((s, l) => s + Math.round(f(l) * 10 ** casas), 0) /
    10 ** casas;
  const antes = colunas.findIndex((c) => c.titulo === "Consumo (m³)");
  const rodape = [
    `${leituras.length} ${leituras.length === 1 ? "leitura" : "leituras"}`,
    ...Array.from({ length: antes - 1 }, () => ""),
    n2(soma((l) => l.consumo, 3)),
    n2(soma((l) => l.volume, 3)),
    ...(comValores ? [n2(soma((l) => l.valor ?? 0, 2))] : []),
    "",
    "",
  ];
  return (
    <div data-guia="op-agua-extrato-tabela">
      <Tabela
        colunas={colunas}
        linhas={[...leituras].reverse()}
        chave={(l) => l.id}
        rodape={rodape}
        vazio="Nenhuma leitura no período."
      />
    </div>
  );
}

export function FotosDoExtrato({
  leituras,
  links,
}: {
  leituras: Leitura[];
  links: Map<string, string>;
}) {
  const comFoto = leituras.filter((l) => l.foto);
  if (!comFoto.length)
    return (
      <p className="text-sm text-neutral-500">
        Nenhuma foto do visor no período.
      </p>
    );
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {[...comFoto].reverse().map((l) => (
        <li key={l.id} className="flex flex-col gap-1">
          <Foto l={l} links={links} className="aspect-[4/3] w-full" />
          <span className="text-xs text-neutral-600">{legendaDaFoto(l)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Excel e PDF do extrato: as colunas da tabela. */
export function exportarExtrato(
  leituras: Leitura[],
  comValores: boolean,
): { colunas: ColunaExportar[]; linhas: CelulaExportar[][] } {
  const m3 = { numero: true, formato: "#,##0.00" };
  return {
    colunas: [
      { titulo: "Referência" },
      { titulo: "Bloco" },
      { titulo: "Sala" },
      { titulo: "Cliente" },
      { titulo: "Hidrômetro" },
      { titulo: "Data anterior" },
      { titulo: "Data atual" },
      { titulo: "Dias", numero: true },
      { titulo: "Leitura anterior", ...m3 },
      { titulo: "Leitura atual", ...m3 },
      { titulo: "Consumo (m³)", ...m3 },
      { titulo: "Faturado (m³)", ...m3 },
      ...(comValores ? [{ titulo: "Valor (R$)", ...m3 }] : []),
      { titulo: "Tipo" },
      { titulo: "Foto" },
    ],
    linhas: leituras.map((l) => [
      rotuloMes(l.referencia),
      l.bloco,
      l.sala,
      l.cliente,
      l.hidrometro,
      l.dataAnterior ? formatarData(l.dataAnterior) : "",
      l.dataAtual ? formatarData(l.dataAtual) : "",
      l.dias,
      l.leituraAnterior,
      l.leituraAtual,
      l.consumo,
      l.volume,
      ...(comValores ? [l.valor] : []),
      ROTULO_TIPO[l.tipo],
      l.foto ? "Sim" : "Sem foto",
    ]),
  };
}
