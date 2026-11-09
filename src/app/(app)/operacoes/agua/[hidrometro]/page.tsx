import { ArrowLeft, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { TopoDaTela } from "@/components/dashboard/tela";
import { BOTAO_SECUNDARIO } from "@/components/operacoes/agua/estilos";
import {
  exportarExtrato,
  FotosDoExtrato,
  GraficoDeConsumo,
  TabelaDoExtrato,
} from "@/components/operacoes/agua/extrato";
import {
  Alertas,
  BASE_AGUA,
  EXEMPLO_AGUA,
  TipoFaturamento,
} from "@/components/operacoes/agua/tela";
import {
  CorrigirVinculo,
  RemoverVinculo,
} from "@/components/operacoes/agua/vinculo";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { dadosDe } from "@/lib/comercial/formato";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { codigoHidrometro } from "@/lib/operacoes/agua";
import { alertasDaLeitura, mesesAntes } from "@/lib/operacoes/agua-alertas";
import { mesesEntre } from "@/lib/operacoes/agua-extrato";
import {
  formatarM3,
  formatarVisor,
  rotuloMes,
} from "@/lib/operacoes/agua-formato";
import {
  leiturasDoHidrometro,
  linksDasFotos,
  locatariosDe,
  nomesDe,
  vinculos,
} from "@/server/operacoes/agua";
import { contextoOp, parametros } from "@/server/operacoes/base";

export async function generateMetadata({
  params,
}: PageProps<"/operacoes/agua/[hidrometro]">): Promise<Metadata> {
  const { hidrometro } = await params;
  return { title: `Hidrômetro ${decodeURIComponent(hidrometro)}` };
}

const CODIGO = /^[A-Z0-9-]{1,40}$/;

export default function Page({
  params,
}: PageProps<"/operacoes/agua/[hidrometro]">) {
  return (
    <>
      <Link
        href={BASE_AGUA}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Água
      </Link>
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-48" />
            <CartaoCarregando altura="h-[32rem]" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="operacoes.agua.ver">
          <Tela params={params} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({ params }: { params: Promise<{ hidrometro: string }> }) {
  const hidrometro = codigoHidrometro(
    decodeURIComponent((await params).hidrometro),
  );
  if (!CODIGO.test(hidrometro)) notFound();
  const [ctx, leituras, todas, p] = await Promise.all([
    contextoOp(),
    leiturasDoHidrometro(hidrometro),
    vinculos(),
    parametros(),
  ]);
  const ultima = leituras.at(-1);
  if (!ultima) notFound();
  const correcoes = todas.filter((v) => v.hidrometro === hidrometro);
  const [locatarios, links, nomes] = await Promise.all([
    locatariosDe(ultima.bloco, ultima.sala),
    linksDasFotos(leituras),
    nomesDe(correcoes.map((c) => c.criado_por)),
  ]);
  const comValores = ctx.pode("operacoes.agua.valores");
  const podeVinculo = ctx.pode("operacoes.agua.vinculo");
  const meses = mesesEntre(
    mesesAntes(ultima.referencia, 23),
    ultima.referencia,
  );
  const alertas = alertasDaLeitura(
    {
      hidrometro,
      referencia: ultima.referencia,
      cliente: ultima.cliente,
      leituraAnterior: ultima.leituraAnterior,
      leituraAtual: ultima.leituraAtual,
      consumo: ultima.consumo,
      temFoto: ultima.foto !== null,
    },
    {
      parametros: {
        limiteM3: Number(p.agua_limite_m3),
        variacaoPct: Number(p.agua_variacao_pct),
        variacaoMeses: p.agua_variacao_meses,
        variacaoMinM3: Number(p.agua_variacao_min_m3),
      },
      historico: leituras
        .filter((l) => l.referencia < ultima.referencia)
        .map((l) => ({ referencia: l.referencia, consumo: l.consumo })),
      enet: locatarios ? { locatarios } : null,
    },
  );
  const exemplo = leituras.some((l) => l.exemplo);
  const exportar = exportarExtrato(leituras, comValores);
  const pode = ctx.pode("operacoes.exportar");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Hidrômetro ${hidrometro}`}
        description="Histórico mês a mês, para mostrar ao locatário ou resolver uma contestação."
      />
      <TopoDaTela
        dadosDe={dadosDe(new Date())}
        filtros={`Bloco ${ultima.bloco} · sala ${ultima.sala || "—"} · ${leituras.length} leitura(s), de ${rotuloMes(leituras[0]?.referencia ?? ultima.referencia)} a ${rotuloMes(ultima.referencia)}`}
        exemplo={exemplo ? EXEMPLO_AGUA : undefined}
        acoes={
          pode ? (
            <>
              <a
                href={`${BASE_AGUA}/extrato/pdf?h=${encodeURIComponent(hidrometro)}`}
                data-guia="op-agua-imprimir"
                className={BOTAO_SECUNDARIO}
              >
                <Printer className="size-4" aria-hidden />
                Imprimir extrato
              </a>
              <BotaoExportar
                titulo={`Extrato do hidrômetro ${hidrometro}`}
                filtros={`Bloco ${ultima.bloco} · sala ${ultima.sala}`}
                nomeArquivo={`agua-extrato-${hidrometro}`}
                colunas={exportar.colunas}
                linhas={exportar.linhas}
              />
            </>
          ) : undefined
        }
      />

      <Secao titulo="Hidrômetro" exemplo={exemplo && EXEMPLO_AGUA}>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-xs text-neutral-500">Bloco e sala</dt>
            <dd className="font-medium">
              Bloco {ultima.bloco} · sala {ultima.sala || "—"}
              {ultima.noArquivo && (
                <span className="block text-xs font-normal text-neutral-500">
                  No arquivo: {ultima.noArquivo.bloco} ·{" "}
                  {ultima.noArquivo.sala || "—"}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Cliente no faturamento</dt>
            <dd className="font-medium">{ultima.cliente || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Locatário no ENET</dt>
            <dd className="font-medium">
              {locatarios === null
                ? "ENET indisponível"
                : locatarios.join(" · ") || "Sem contrato vigente"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">
              Leitura de {rotuloMes(ultima.referencia)}
            </dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-neutral-900 px-2 py-1 font-mono text-white tabular-nums">
                {formatarVisor(ultima.leituraAtual)} m³
              </span>
              <span className="tabular-nums">
                consumo {formatarM3(ultima.consumo)}
              </span>
              <TipoFaturamento tipo={ultima.tipo} />
            </dd>
          </div>
        </dl>
        {alertas.length > 0 && (
          <div className="mt-4">
            <Alertas alertas={alertas} />
          </div>
        )}
      </Secao>

      <Secao
        titulo="Vínculo com sala e bloco"
        descricao="Bloco, sala e cliente são guardados mês a mês, como vieram no arquivo. A correção vale a partir do mês escolhido, com o motivo e quem mudou."
      >
        {correcoes.length ? (
          <ul className="mb-4 flex flex-col gap-2 text-sm">
            {correcoes.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-neutral-50 px-4 py-2"
              >
                <span className="font-medium">
                  Desde {rotuloMes(c.desde)}: Bloco {c.bloco} · sala {c.sala}
                </span>
                <span className="text-neutral-600">“{c.motivo}”</span>
                <span className="text-xs text-neutral-500">
                  {(c.criado_por && nomes.get(c.criado_por)) || "—"} em{" "}
                  {formatarDataHora(c.criado_em)}
                </span>
                {podeVinculo && (
                  <span className="ml-auto">
                    <RemoverVinculo id={c.id} desde={rotuloMes(c.desde)} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-neutral-500">
            Sem correção: vale a sala e o bloco de cada arquivo.
          </p>
        )}
        {podeVinculo && (
          <CorrigirVinculo
            hidrometro={hidrometro}
            bloco={ultima.bloco}
            sala={ultima.sala}
            mes={ultima.referencia.slice(0, 7)}
          />
        )}
      </Secao>

      <Secao
        titulo="Consumo por mês"
        descricao={`Consumo medido em m³, de ${rotuloMes(meses[0] ?? ultima.referencia)} a ${rotuloMes(ultima.referencia)}.`}
      >
        <GraficoDeConsumo leituras={leituras} meses={meses} />
      </Secao>

      <Secao
        titulo="Leituras"
        descricao={`Da mais nova para a mais antiga. Datas da leitura do parceiro (${formatarData(ultima.dataAtual)} a mais recente).${comValores ? "" : " Valores em reais só para quem tem a permissão."}`}
      >
        <TabelaDoExtrato
          leituras={leituras}
          comValores={comValores}
          links={links}
          comHidrometro={false}
        />
      </Secao>

      <Secao titulo="Fotos do visor">
        <FotosDoExtrato leituras={leituras} links={links} />
      </Secao>
    </div>
  );
}
