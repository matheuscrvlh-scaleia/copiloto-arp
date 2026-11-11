import { ListChecks, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  CartaoCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { type Coluna, Secao, Tabela } from "@/components/dashboard/tabela";
import {
  AbasDaTela,
  CartaoDaTela,
  Cartoes,
  hrefCom,
} from "@/components/dashboard/tela";
import {
  AvisosDoDiario,
  BASE,
  Campos,
  dias,
  FONTE,
  Negativo,
  OBRAS,
  pct,
  pontos,
  SeloObra,
  TopoDiario,
  Voltar,
} from "@/components/operacoes/diario/comum";
import { FiltrosDiario } from "@/components/operacoes/diario/filtros";
import { Anexos, Galeria, Videos } from "@/components/operacoes/diario/midia";
import {
  Cronograma,
  FotoGrande,
  ListaDeOcorrencias,
} from "@/components/operacoes/diario/obra";
import { ListaDeRelatorios } from "@/components/operacoes/diario/relatorios";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { linhaDeFiltros } from "@/lib/comercial/formato";
import { formatarData, formatarHoras, formatarNumero } from "@/lib/formato";
import {
  desvioFisico,
  equipamentosTotais,
  media,
  ocorrenciasPorTipo,
  periodoDaBusca,
  prazoConsumido,
  prazoVencido,
} from "@/lib/operacoes/diario";
import type { ContextoOp } from "@/server/operacoes/base";
import { contextoOp } from "@/server/operacoes/base";
import {
  estadoDoDiario,
  obraDoDiario,
  partesDosRelatorios,
  relatoriosDoPeriodo,
} from "@/server/operacoes/diario";
import { obraLigadaAoDiario } from "@/server/operacoes/obras";

export const metadata: Metadata = { title: "Obra — Diário de Obra" };

type Busca = Record<string, string | string[] | undefined>;
const um = (b: Busca, k: string) => {
  const v = b[k];
  return (Array.isArray(v) ? v[0] : v) ?? "";
};

const ABAS = {
  cronograma: "Cronograma",
  relatorios: "Relatórios",
  ocorrencias: "Ocorrências",
  efetivo: "Efetivo e clima",
  equipamentos: "Equipamentos e materiais",
  fotos: "Fotos, vídeos e anexos",
} as const;
type Aba = keyof typeof ABAS;

type Obra = NonNullable<Awaited<ReturnType<typeof obraDoDiario>>>;

export default function Page({
  params,
  searchParams,
}: PageProps<"/operacoes/obras/diario/[obra]">) {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Protegido permissao="operacoes.obras.diario">
        <Tela params={params} busca={searchParams} />
      </Protegido>
    </Suspense>
  );
}

async function Tela({
  params,
  busca,
}: {
  params: Promise<{ obra: string }>;
  busca: Promise<Busca>;
}) {
  const [{ obra: id }, b, ctx, estado] = await Promise.all([
    params,
    busca,
    contextoOp(),
    estadoDoDiario(),
  ]);
  const idDoApp = decodeURIComponent(id);
  const [obra, orcamento] = await Promise.all([
    obraDoDiario(idDoApp),
    ctx.pode("operacoes.obras.ver")
      ? obraLigadaAoDiario(idDoApp)
      : Promise.resolve(null),
  ]);
  if (!obra) notFound();
  const ficha = obra.ficha;
  const aba = (um(b, "aba") in ABAS ? um(b, "aba") : "cronograma") as Aba;
  const consumido = prazoConsumido(obra.prazo);
  const desvio = desvioFisico(obra.realizado, consumido);
  const vencido = prazoVencido(
    {
      statusId: obra.statusId,
      aVencer: obra.prazo.aVencer,
      dataFim: obra.dataFim,
    },
    ctx.hoje,
  );
  const total = ficha?.visaoGeral?.total;
  const t = obra.tarefas;
  const base = `${BASE}/${encodeURIComponent(obra.id)}`;
  const numero = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : formatarNumero(v);

  return (
    <div className="flex flex-col gap-6">
      <Voltar href={OBRAS}>Obras</Voltar>
      <div className="flex items-start gap-4">
        <FotoGrande url={ficha?.fotoUrl ?? null} nome={obra.nome} />
        <div className="min-w-0 flex-1">
          <PageHeader
            title={obra.nome}
            description="Execução da obra: ficha, cronograma e o que os relatórios do aplicativo Diário de Obra registraram. Só consulta."
          />
          {orcamento && (
            <Link
              href={`${OBRAS}/${orcamento.id}`}
              className="-mt-2 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
            >
              <Wallet className="size-4" aria-hidden />
              Ver orçamento (previsto × realizado)
            </Link>
          )}
        </div>
      </div>
      <TopoDiario
        estado={estado}
        podeAtualizar={ctx.pode("operacoes.obras.atualizar")}
      />
      <AvisosDoDiario estado={estado} />

      <Campos
        itens={[
          { rotulo: "Status", valor: <SeloObra id={obra.statusId} /> },
          { rotulo: "Grupo", valor: obra.grupo },
          { rotulo: "Endereço", valor: ficha?.endereco },
          { rotulo: "Contrato", valor: ficha?.numeroContrato },
          {
            rotulo: ficha?.tipoContratanteContratada
              ? `Cliente (${ficha.tipoContratanteContratada.toLowerCase()})`
              : "Cliente",
            valor: ficha?.cliente,
          },
          { rotulo: "Responsável", valor: obra.responsavel },
          {
            rotulo: "Início · fim",
            valor: `${formatarData(obra.dataInicio)} · ${formatarData(obra.dataFim)}`,
          },
          {
            rotulo: "Prazo",
            valor: (
              <span>
                {dias(obra.prazo.contratual)} · decorrido{" "}
                {dias(obra.prazo.decorrido)} · a vencer{" "}
                <span className={vencido ? "font-semibold text-red-700" : ""}>
                  {dias(obra.prazo.aVencer)}
                  {vencido ? " (vencido)" : ""}
                </span>
              </span>
            ),
          },
          { rotulo: "Prazo consumido", valor: pct(consumido) },
          {
            rotulo: "Desvio físico × prazo",
            valor: <Negativo valor={desvio} texto={pontos(desvio)} />,
          },
          ...(ficha?.observacao
            ? [{ rotulo: "Observação", valor: ficha.observacao }]
            : []),
        ]}
      />

      <Cartoes modulo="operacoes">
        <CartaoDaTela
          titulo="Avanço físico"
          valor={pct(obra.realizado)}
          detalhe={
            t
              ? `${formatarNumero(t.concluida)} concluídas · ${formatarNumero(t.emAndamento)} em andamento · ${formatarNumero(t.naoIniciada)} não iniciadas`
              : "Sem lista de tarefas"
          }
          fonte={`${FONTE}, lista de tarefas`}
          href={hrefCom(base, b, { aba: "cronograma" })}
          ativo={aba === "cronograma"}
        />
        <CartaoDaTela
          titulo="Relatórios"
          valor={numero(total?.relatorios)}
          detalhe="No aplicativo, desde o início"
          fonte={FONTE}
          href={hrefCom(base, b, { aba: "relatorios" })}
          ativo={aba === "relatorios"}
        />
        <CartaoDaTela
          titulo="Ocorrências"
          valor={numero(total?.ocorrencias)}
          detalhe="No aplicativo, desde o início"
          fonte={FONTE}
          href={hrefCom(base, b, { aba: "ocorrencias" })}
          ativo={aba === "ocorrencias"}
        />
        <CartaoDaTela
          titulo="Fotos"
          valor={numero(total?.fotos)}
          detalhe={`${numero(total?.videos)} vídeos`}
          fonte={FONTE}
          href={hrefCom(base, b, { aba: "fotos" })}
          ativo={aba === "fotos"}
        />
      </Cartoes>

      <AbasDaTela
        rotulo="Partes da obra"
        ativa={aba}
        abas={(Object.keys(ABAS) as Aba[]).map((k) => ({
          chave: k,
          rotulo: ABAS[k],
          href: hrefCom(base, b, { aba: k }),
        }))}
      />

      {aba === "cronograma" ? (
        <Secao
          titulo="Cronograma"
          descricao={
            t
              ? `${formatarNumero(t.total)} tarefas: ${formatarNumero(t.concluida)} concluídas, ${formatarNumero(t.emAndamento)} em andamento e ${formatarNumero(t.naoIniciada)} não iniciadas. A API não traz datas previstas por tarefa.`
              : "Lista de tarefas do aplicativo."
          }
        >
          <Cronograma obraId={obra.id} lista={obra.cronograma} />
        </Secao>
      ) : (
        <AbaDoPeriodo aba={aba} obra={obra} busca={b} ctx={ctx} />
      )}
    </div>
  );
}

/** Abas que dependem do período: lê só o pedaço do relatório que a aba usa. */
async function AbaDoPeriodo({
  aba,
  obra,
  busca: b,
  ctx,
}: {
  aba: Exclude<Aba, "cronograma">;
  obra: Obra;
  busca: Busca;
  ctx: ContextoOp;
}) {
  const periodo = periodoDaBusca(um(b, "de"), um(b, "ate"), ctx.hoje);
  const tarefas = (obra.cronograma?.cronograma ?? []).flatMap((e) =>
    e.tarefas.map((t) => ({
      valor: t._id,
      rotulo: `${t.item ? `${t.item} ` : ""}${t.descricao}`,
    })),
  );
  const tarefa =
    aba === "fotos" && tarefas.some((t) => t.valor === um(b, "tarefa"))
      ? um(b, "tarefa")
      : "";
  const filtros = linhaDeFiltros([
    {
      rotulo: "Período",
      valor: `${formatarData(periodo.de)} a ${formatarData(periodo.ate)}`,
    },
    ...(tarefa
      ? [
          {
            rotulo: "Tarefa",
            valor: tarefas.find((t) => t.valor === tarefa)?.rotulo ?? "",
          },
        ]
      : []),
  ]);
  const barra = (
    <div className="flex flex-col gap-2">
      <FiltrosDiario
        periodo={{ de: periodo.de, ate: periodo.ate, max: ctx.hoje }}
        selecoes={
          aba === "fotos"
            ? [
                {
                  chave: "tarefa",
                  rotulo: "Tarefa",
                  todos: "Todas as tarefas",
                  valor: tarefa,
                  icone: <ListChecks className="size-4" />,
                  largura: "w-64",
                  opcoes: tarefas,
                },
              ]
            : []
        }
      />
      <p className="text-sm text-neutral-700">
        <span className="sr-only">Filtros em uso: </span>
        {filtros}
      </p>
    </div>
  );

  if (aba === "relatorios" || aba === "efetivo") {
    const lista = await relatoriosDoPeriodo({
      obra: obra.id,
      de: periodo.de,
      ate: periodo.ate,
    });
    if (aba === "relatorios")
      return (
        <>
          {barra}
          <Secao
            titulo="Relatórios desta obra"
            descricao="A lista de Relatórios, já filtrada pela obra."
          >
            <ListaDeRelatorios linhas={lista} comObra={false} />
          </Secao>
        </>
      );
    return (
      <>
        {barra}
        <Efetivo lista={lista} />
      </>
    );
  }

  if (aba === "ocorrencias") {
    const partes = await partesDosRelatorios(obra.id, ["ocorrencias"], periodo);
    const todas = partes.flatMap((r) =>
      r.ocorrencias.map((o) => ({
        relatorioId: r.id,
        numero: r.numero,
        data: r.data,
        ocorrencia: o,
      })),
    );
    const porTipo = ocorrenciasPorTipo(todas.map((o) => o.ocorrencia));
    return (
      <>
        {barra}
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <Secao
            titulo="Ocorrências"
            descricao="Todas as ocorrências dos relatórios do período, das mais novas às mais antigas, com os tipos marcados, a tarefa e as fotos."
          >
            <ListaDeOcorrencias itens={todas.reverse()} />
          </Secao>
          <Secao
            titulo="Ocorrências por tipo"
            descricao="Contagem dos tipos marcados (tags) no período."
          >
            <BarrasHorizontais
              itens={porTipo.map((x) => ({
                chave: x.chave,
                rotulo: x.chave,
                valor: x.n,
                texto: formatarNumero(x.n),
              }))}
              descricao="Ocorrências por tipo"
              vazio="Nenhum tipo marcado no período."
              rotuloLargo
            />
          </Secao>
        </div>
      </>
    );
  }

  if (aba === "equipamentos") {
    const partes = await partesDosRelatorios(
      obra.id,
      ["equipamentos", "material"],
      periodo,
    );
    const equipamentos = equipamentosTotais(
      partes.flatMap((p) => p.equipamentos),
    );
    const materiais = partes
      .filter(
        (p) =>
          (p.material?.recebido.length ?? 0) +
            (p.material?.utilizado.length ?? 0) >
          0,
      )
      .reverse();
    const texto = (
      itens: { descricao: string; quantidade?: string | null }[],
    ) =>
      itens.map((i) => `${i.descricao} ${i.quantidade ?? "—"}`).join(" · ") ||
      "—";
    const colunas: Coluna<(typeof materiais)[number]>[] = [
      {
        titulo: "Data",
        valor: (p) => `${formatarData(p.data)} · nº ${p.numero}`,
      },
      { titulo: "Recebido", valor: (p) => texto(p.material?.recebido ?? []) },
      { titulo: "Utilizado", valor: (p) => texto(p.material?.utilizado ?? []) },
    ];
    return (
      <>
        {barra}
        <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
          <Secao
            titulo="Equipamentos"
            descricao="Soma das quantidades por equipamento nos relatórios do período."
          >
            <BarrasHorizontais
              itens={equipamentos.map((e) => ({
                chave: e.descricao,
                rotulo: e.descricao,
                valor: e.quantidade,
                texto: formatarNumero(e.quantidade),
              }))}
              descricao="Equipamentos somados no período"
              vazio="Nenhum equipamento no período."
              rotuloLargo
            />
          </Secao>
          <Secao
            titulo="Materiais recebidos e utilizados"
            descricao="Por dia, com a quantidade como veio do aplicativo (texto livre, não somada)."
          >
            <Tabela
              colunas={colunas}
              linhas={materiais}
              chave={(p) => p.id}
              vazio="Nenhum material lançado no período."
              caber
            />
          </Secao>
        </div>
      </>
    );
  }

  // Fotos, vídeos e anexos.
  const partes = await partesDosRelatorios(
    obra.id,
    ["galeria", "videos", "anexos"],
    periodo,
  );
  const novos = [...partes].reverse();
  const fotos = novos.flatMap((p) =>
    p.galeria
      .filter((f) => !tarefa || f.tarefaId === tarefa)
      .map((f) => ({ ...f, data: p.data, numero: p.numero })),
  );
  const videos = novos.flatMap((p) =>
    p.videos.map((v) => ({ ...v, data: p.data })),
  );
  const anexos = novos.flatMap((p) =>
    p.anexos.map((a) => ({ ...a, data: p.data })),
  );
  const anexosObra = obra.ficha?.visaoGeral?.total?.anexosObra ?? 0;
  return (
    <>
      {barra}
      <Secao
        titulo="Galeria de fotos"
        descricao={`${formatarNumero(fotos.length)} fotos dos relatórios do período${tarefa ? ", da tarefa escolhida" : ""}. Abrem do aplicativo, numa aba nova.`}
      >
        <Galeria fotos={fotos} vazio="Nenhuma foto no período." />
      </Secao>
      <Secao titulo="Vídeos">
        <Videos videos={videos} vazio="Nenhum vídeo no período." />
      </Secao>
      <Secao
        titulo="Anexos"
        descricao={
          anexosObra > 0
            ? `Anexos dos relatórios do período. A obra tem ${formatarNumero(anexosObra)} anexos próprios no aplicativo, que a API não lista (abra no aplicativo).`
            : "Anexos dos relatórios do período."
        }
      >
        <Anexos anexos={anexos} vazio="Nenhum anexo no período." />
      </Secao>
    </>
  );
}

function Efetivo({
  lista,
}: {
  lista: Awaited<ReturnType<typeof relatoriosDoPeriodo>>;
}) {
  const porDia = new Map<string, { efetivo: number; impraticavel: boolean }>();
  for (const r of lista) {
    if (!r.resumo) continue;
    const d = porDia.get(r.data) ?? { efetivo: 0, impraticavel: false };
    d.efetivo += r.resumo.efetivo ?? 0;
    d.impraticavel ||= r.resumo.impraticavel;
    porDia.set(r.data, d);
  }
  const dias = [...porDia].sort(([a], [c]) => a.localeCompare(c));
  const impraticaveis = dias.filter(([, d]) => d.impraticavel).map(([d]) => d);
  const homemHora = lista.reduce((s, r) => s + (r.resumo?.homemHora ?? 0), 0);
  const temHoras = lista.some((r) => typeof r.resumo?.homemHora === "number");
  const mediaEfetivo = media(dias.map(([, d]) => d.efetivo));
  return (
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <Secao
        titulo="Efetivo por dia"
        descricao={`Média do período: ${mediaEfetivo === null ? "—" : formatarNumero(mediaEfetivo, 1)} pessoas por dia com relatório.`}
        calculo="Efetivo = soma das quantidades da mão de obra padrão, ou quantos têm presença na personalizada (conforme a opção do relatório)."
      >
        {dias.length === 0 ? (
          <p className="py-6 text-sm text-neutral-500">
            Nenhum relatório lido no período.
          </p>
        ) : (
          <div data-guia="op-diario-efetivo">
            <Colunas
              descricao="Efetivo por dia de relatório"
              itens={dias.map(([data, d]) => ({
                chave: data,
                rotulo: formatarData(data).slice(0, 5),
                titulo: formatarData(data),
                valor: d.efetivo,
                texto: `${formatarNumero(d.efetivo)} pessoas`,
                detalhe: d.impraticavel ? "Dia impraticável" : undefined,
              }))}
            />
          </div>
        )}
      </Secao>
      <Secao titulo="Horas e clima">
        <dl className="flex flex-col gap-3 text-sm">
          <div>
            <dt className="text-xs text-neutral-500">
              Horas trabalhadas (homem-hora)
            </dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {temHoras ? formatarHoras(homemHora) : "—"}
            </dd>
            <dd className="text-xs text-neutral-500">
              Só da mão de obra personalizada com presença.
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Dias impraticáveis</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {formatarNumero(impraticaveis.length)}
            </dd>
            <dd className="text-xs text-neutral-500">
              {impraticaveis.length
                ? impraticaveis.map(formatarData).join(", ")
                : "Nenhum: manhã e tarde praticáveis."}
            </dd>
          </div>
        </dl>
      </Secao>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-24" />
      <CartaoCarregando altura="h-40" />
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-96" />
    </TelaCarregando>
  );
}
