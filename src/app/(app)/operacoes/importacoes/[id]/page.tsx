import { ArrowUpRight, CircleAlert, Info, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { type Coluna, Secao, Tabela } from "@/components/dashboard/tabela";
import { Comprovantes } from "@/components/operacoes/importacoes/comprovantes";
import { ContaImportadaVista } from "@/components/operacoes/importacoes/conta";
import {
  BotaoDesfazer,
  ContagemDeAvisos,
  Resultado,
  ROTA_IMPORTACOES,
  rotaDaImportacao,
} from "@/components/operacoes/importacoes/historico";
import { LeiturasImportadas } from "@/components/operacoes/importacoes/leituras";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import {
  formatarData,
  formatarDataHora,
  formatarMes,
  formatarMoeda,
  formatarNumero,
} from "@/lib/formato";
import {
  type AvisoImportacao,
  podeDesfazer,
  type StatusImportacao,
  TIPOS_IMPORTACAO,
  type TipoImportacao,
  textoDaReferencia,
  tiposQuePode,
} from "@/lib/operacoes/importacoes";
import { contextoOp } from "@/server/operacoes/base";
import { importacao } from "@/server/operacoes/importacoes";
import {
  contaDaImportacao,
  faturasDaImportacao,
  leiturasDaImportacao,
  mesesDaImportacao,
  revisaoDaImportacao,
} from "@/server/operacoes/importacoes-dados";

export const metadata: Metadata = { title: "Importação" };

export default function Page({
  params,
}: PageProps<"/operacoes/importacoes/[id]">) {
  return (
    <>
      <Link
        href={ROTA_IMPORTACOES}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Importações
      </Link>
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-48" />
            <CartaoCarregando altura="h-96" />
          </TelaCarregando>
        }
      >
        <Detalhe params={params} />
      </Suspense>
    </>
  );
}

const NIVEL = {
  erro: { Icone: CircleAlert, cor: "text-red-700", rotulo: "Erro" },
  aviso: { Icone: TriangleAlert, cor: "text-amber-700", rotulo: "Aviso" },
  info: { Icone: Info, cor: "text-neutral-600", rotulo: "Informação" },
} as const;

const COLUNAS_AVISOS: Coluna<AvisoImportacao & { n: number }>[] = [
  {
    titulo: "Nível",
    valor: (a) => {
      const { Icone, cor, rotulo } = NIVEL[a.nivel];
      return (
        <span className={`inline-flex items-center gap-1.5 ${cor}`}>
          <Icone className="size-4" aria-hidden />
          {rotulo}
        </span>
      );
    },
  },
  { titulo: "Bloco", valor: (a) => (a.bloco === undefined ? "—" : a.bloco) },
  {
    titulo: "Linha",
    numero: true,
    valor: (a) => (a.linha === undefined ? "—" : a.linha),
  },
  { titulo: "Mensagem", valor: (a) => a.mensagem },
];

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-neutral-500">{rotulo}</dt>
      <dd className="text-sm break-words">{valor}</dd>
    </div>
  );
}

async function Detalhe({
  params,
}: {
  params: PageProps<"/operacoes/importacoes/[id]">["params"];
}) {
  const [ctx, { id }] = await Promise.all([contextoOp(), params]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const podeTipo = tiposQuePode(ctx.pode);
  const vê =
    podeTipo.length > 0 ||
    ctx.pode("operacoes.agua.ver") ||
    ctx.pode("operacoes.obras.ver") ||
    ctx.pode("operacoes.limpeza.ver");
  if (!vê) return <SemAcesso />;
  const i = await importacao(id, ctx.pode("operacoes.agua.valores"));
  if (!i) notFound();
  const tipo = TIPOS_IMPORTACAO[i.tipo];
  const avisos = i.listaDeAvisos.map((a, n) => ({ ...a, n }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${tipo.curto} · ${textoDaReferencia(i.referencia)}`}
        description={tipo.rotulo}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Resultado i={i} />
        <ContagemDeAvisos avisos={i.avisos} />
        {podeTipo.includes(i.tipo) && podeDesfazer(i.status) && (
          <BotaoDesfazer i={i} comTexto />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Secao titulo="Quem e quando">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo
              rotulo="Enviada"
              valor={`${formatarDataHora(i.criadoEm)} por ${i.criadoPor ?? "—"}`}
            />
            <Campo
              rotulo="Confirmada"
              valor={
                i.confirmadoEm
                  ? `${formatarDataHora(i.confirmadoEm)} por ${i.confirmadoPor ?? "—"}`
                  : "—"
              }
            />
            {i.desfeitoEm && (
              <Campo
                rotulo={i.status === "cancelada" ? "Descartada" : "Desfeita"}
                valor={`${formatarDataHora(i.desfeitoEm)} por ${i.desfeitoPor ?? "—"}`}
              />
            )}
            {i.motivo && (
              <Campo rotulo="Motivo (confirmada sem bater)" valor={i.motivo} />
            )}
            {i.substitui && (
              <Campo
                rotulo="Substituiu"
                valor={
                  <Link
                    href={rotaDaImportacao(i.substitui)}
                    className="underline underline-offset-2"
                  >
                    a importação anterior do mês
                  </Link>
                }
              />
            )}
            {i.substituidaPor && (
              <Campo
                rotulo="Substituída por"
                valor={
                  <Link
                    href={rotaDaImportacao(i.substituidaPor)}
                    className="underline underline-offset-2"
                  >
                    a importação seguinte
                  </Link>
                }
              />
            )}
            {i.exemplo && (
              <Campo rotulo="Dados" valor="De exemplo (fictícios)" />
            )}
          </dl>
        </Secao>

        <Secao
          titulo="Comprovante"
          descricao="Os arquivos como foram recebidos. Os links valem por 10 minutos (recarregue a tela para gerar outros)."
        >
          <Comprovantes arquivos={i.arquivosComLink} />
        </Secao>
      </div>

      <DadosImportados
        id={i.id}
        tipo={i.tipo}
        status={i.status}
        podeEditar={podeTipo.includes(i.tipo)}
        comValores={ctx.pode("operacoes.agua.valores")}
      />

      <Secao
        titulo="O que foi lido"
        descricao="Resumo gravado na prévia: linhas, totais e o resumo do próprio arquivo."
      >
        {i.resumo.length ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {i.resumo.map((r) => (
              <Campo key={r.rotulo} rotulo={r.rotulo} valor={r.valor} />
            ))}
          </dl>
        ) : (
          <p className="text-sm text-neutral-500">Sem resumo gravado.</p>
        )}
      </Secao>

      {i.valores && (
        <Secao
          titulo="Conciliação em reais"
          descricao="Soma das linhas lidas contra o resumo do arquivo, por bloco."
        >
          <Tabela
            colunas={[
              { titulo: "Bloco", valor: (b) => b.bloco },
              {
                titulo: "Valor do resumo",
                numero: true,
                valor: (b) => formatarMoeda(b.arquivo),
              },
              {
                titulo: "Valor das linhas",
                numero: true,
                valor: (b) => formatarMoeda(b.lido),
              },
              {
                titulo: "Diferença",
                numero: true,
                valor: (b) =>
                  b.arquivo === null || b.lido === null
                    ? "—"
                    : formatarMoeda(b.lido - b.arquivo),
              },
            ]}
            linhas={i.valores.porBloco}
            chave={(b) => b.bloco}
            vazio="Sem detalhe por bloco."
            rodape={[
              "Total",
              formatarMoeda(i.valores.arquivo),
              formatarMoeda(i.valores.lido),
              i.valores.arquivo === null || i.valores.lido === null
                ? "—"
                : formatarMoeda(i.valores.lido - i.valores.arquivo),
            ]}
          />
        </Secao>
      )}

      <Secao
        titulo="Avisos das conferências"
        descricao="Erros impedem confirmar sem motivo; avisos e informações só pedem conferência."
      >
        <Tabela
          colunas={COLUNAS_AVISOS}
          linhas={avisos}
          chave={(a) => String(a.n)}
          vazio="Nenhum aviso: tudo bateu."
        />
      </Secao>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dados importados: o que a importação gravou, convertido em dado
// ---------------------------------------------------------------------------

const LINK =
  "inline-flex items-center gap-1 font-medium text-neutral-800 underline-offset-2 hover:underline";

async function DadosImportados({
  id,
  tipo,
  status,
  podeEditar,
  comValores,
}: {
  id: string;
  tipo: TipoImportacao;
  status: StatusImportacao;
  podeEditar: boolean;
  comValores: boolean;
}) {
  if (status === "desfeita" || status === "cancelada")
    return (
      <Secao titulo="Dados importados">
        <p className="text-sm text-neutral-500">
          {status === "cancelada"
            ? "A prévia foi descartada: nada entrou nos dados."
            : "A importação foi desfeita: os dados que ela trouxe foram apagados. O comprovante continua acima."}
        </p>
      </Secao>
    );

  if (tipo === "agua") {
    const leituras = await leiturasDaImportacao(id, comValores);
    return (
      <Secao
        titulo="Dados importados · leituras da água"
        descricao={
          status === "confirmada"
            ? podeEditar
              ? "Cada leitura que entrou, com a foto do visor. Corrija um campo, troque a foto ou exclua a leitura: tudo fica no histórico."
              : "Cada leitura que entrou, com a foto do visor."
            : status === "previa"
              ? "Prévia: ainda não vale. Confirme ou descarte na tela de importação."
              : "Esta versão do mês foi substituída por outra importação: só consulta."
        }
      >
        <LeiturasImportadas
          leituras={leituras}
          podeEditar={podeEditar && status === "confirmada"}
          comValores={comValores}
        />
      </Secao>
    );
  }

  if (tipo === "agua_conta") {
    const conta = await contaDaImportacao(id);
    return (
      <Secao
        titulo="Dados importados · conta da concessionária"
        descricao="Os campos da conta, guardados como dado junto do comprovante."
      >
        {conta ? (
          <ContaImportadaVista
            importacao={id}
            conta={conta}
            podeEditar={podeEditar && status === "confirmada"}
          />
        ) : status === "previa" && podeEditar ? (
          <p className="text-sm text-neutral-600">
            A conta ainda não foi conferida.{" "}
            <Link
              href={`${ROTA_IMPORTACOES}/nova?tipo=agua_conta`}
              className={LINK}
            >
              Continuar a conferência
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </p>
        ) : (
          <p className="text-sm text-neutral-500">
            Os valores da conta aparecem para quem vê os reais da água.
          </p>
        )}
      </Secao>
    );
  }

  if (tipo === "energisa") {
    const faturas = await faturasDaImportacao(id);
    return (
      <Secao
        titulo="Dados importados · fatura da Energisa"
        descricao="A fatura lida do PDF, com os itens. Para corrigir, desfaça e importe o PDF de novo."
      >
        <Tabela
          colunas={[
            { titulo: "Matrícula", valor: (f) => f.matricula },
            { titulo: "Mês", valor: (f) => formatarMes(f.referencia) },
            {
              titulo: "Vencimento",
              valor: (f) => (f.vencimento ? formatarData(f.vencimento) : "—"),
            },
            {
              titulo: "Consumo",
              numero: true,
              valor: (f) =>
                f.consumoKwh === null
                  ? "—"
                  : `${formatarNumero(f.consumoKwh)} kWh`,
            },
            {
              titulo: "Total",
              numero: true,
              valor: (f) => (f.total === null ? "—" : formatarMoeda(f.total)),
            },
            {
              titulo: "Fatura",
              valor: (f) =>
                f.vigente ? (
                  <Link
                    href={`/operacoes/energia/contas/${f.id}`}
                    className={LINK}
                  >
                    Abrir
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                ) : (
                  "ainda não vale"
                ),
            },
          ]}
          linhas={faturas}
          chave={(f) => f.id}
          vazio={
            status === "previa"
              ? "A fatura ainda não foi gravada (matrícula sem cadastro na prévia)."
              : "Sem fatura."
          }
        />
      </Secao>
    );
  }

  if (tipo === "limpeza") {
    const meses = await mesesDaImportacao(id);
    return (
      <Secao
        titulo="Dados importados · meses do rateio"
        descricao="Cada aba da planilha virou um mês do rateio. Corrija minutos, extras e valores na tela do mês."
      >
        <Tabela
          colunas={[
            { titulo: "Mês", valor: (m) => formatarMes(m.referencia) },
            {
              titulo: "Situação",
              valor: (m) => (m.status === "fechado" ? "Fechado" : "Aberto"),
            },
            {
              titulo: "Valor base",
              numero: true,
              valor: (m) =>
                m.valorBase === null ? "—" : formatarMoeda(m.valorBase),
            },
            {
              titulo: "Tela do mês",
              valor: (m) => (
                <Link
                  href={`/operacoes/limpeza?mes=${m.referencia.slice(0, 7)}`}
                  className={LINK}
                >
                  {podeEditar ? "Abrir e corrigir" : "Abrir"}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              ),
            },
          ]}
          linhas={meses}
          chave={(m) => m.referencia}
          vazio="Nenhum mês gravado."
        />
      </Secao>
    );
  }

  const revisao = await revisaoDaImportacao(id);
  return (
    <Secao
      titulo="Dados importados · revisão do orçamento"
      descricao="As etapas e o previsto por mês da planilha. O realizado é lançado na tela da obra."
    >
      {revisao ? (
        <p className="text-sm">
          {revisao.obra} · revisão {revisao.codigo} · {revisao.etapas}{" "}
          {revisao.etapas === 1 ? "etapa" : "etapas"}
          {revisao.vigente ? " · vigente" : ""}.{" "}
          <Link href={`/operacoes/obras/${revisao.obraId}`} className={LINK}>
            Abrir a obra
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </p>
      ) : (
        <p className="text-sm text-neutral-500">Nenhuma revisão gravada.</p>
      )}
    </Secao>
  );
}
