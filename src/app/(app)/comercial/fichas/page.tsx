import { CalendarDays, CircleDot, Eye, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { SeloSituacao } from "@/components/comercial/fichas/blocos";
import {
  BOTAO_SECUNDARIO,
  GerarLink,
} from "@/components/comercial/fichas/gerar-link";
import {
  CartaoDaTela,
  CartoesComercial,
  FiltrosComercial,
  hrefCom,
  TabelaLista,
  TopoComercial,
} from "@/components/comercial/tela";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { somarDias } from "@/lib/comercial/datas";
import {
  ROTULO_ORIGEM,
  ROTULO_SITUACAO,
  ROTULO_TIPO_CURTO,
  SITUACOES_FICHA,
  type SituacaoFicha,
  TIPOS_FICHA,
  type TipoFicha,
} from "@/lib/comercial/ficha";
import { dadosDe, linhaDeFiltros } from "@/lib/comercial/formato";
import { formatarData, formatarNumero } from "@/lib/formato";
import {
  type FichaDaLista,
  listaDeFichas,
  lucsVagos,
  ROTA_FICHAS,
  rotaDaFicha,
  validadeDoLink,
} from "@/server/comercial/fichas";
import { type Busca, lerFiltros } from "@/server/comercial/filtros";

export const metadata: Metadata = { title: "Fichas cadastrais" };

const PERIODOS: Record<string, { rotulo: string; dias: number | null }> = {
  "": { rotulo: "Últimos 90 dias", dias: 90 },
  "30": { rotulo: "Últimos 30 dias", dias: 30 },
  "365": { rotulo: "Últimos 12 meses", dias: 365 },
  tudo: { rotulo: "Todo o período", dias: null },
};

const CARTOES: { situacao: SituacaoFicha; titulo: string; detalhe: string }[] =
  [
    {
      situacao: "recebida",
      titulo: "Recebidas",
      detalhe: "prontas para análise e contrato",
    },
    {
      situacao: "em_preenchimento",
      titulo: "Incompletas",
      detalhe: "link enviado, ainda sem envio",
    },
    {
      situacao: "usada",
      titulo: "Usadas em contrato",
      detalhe: "já escolhidas num contrato",
    },
  ];

export default function Page({ searchParams }: PageProps<"/comercial/fichas">) {
  return (
    <>
      <PageHeader
        title="Fichas cadastrais"
        description="A ficha que o interessado preenche pelo link (sem login), no lugar do Google Forms: gere o link, acompanhe quem já enviou e use a ficha na etapa Partes do contrato."
      />
      <Suspense fallback={<Esqueleto />}>
        <Tela busca={searchParams} />
      </Suspense>
    </>
  );
}

/** Situação com o estado do link (vencido, cancelado, vence em). */
function estadoDoLink(f: FichaDaLista, agora: number): string | undefined {
  if (f.situacao !== "em_preenchimento") return undefined;
  if (f.cancelada_em) return "link cancelado";
  if (f.expira_em && new Date(f.expira_em).getTime() <= agora)
    return "link vencido";
  return f.expira_em
    ? `vence ${formatarData(f.expira_em).slice(0, 5)}`
    : undefined;
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const f = await lerFiltros("fichas", await busca);
  const { ctx } = f;
  const ver = ctx.pode("comercial.formulario.ver");
  const gerar = ctx.pode("comercial.formulario.link");
  if (!ver && !gerar && !ctx.pode("comercial.contratos.editar"))
    return <SemAcesso />;

  const periodo = PERIODOS[f.um("dias")] ? f.um("dias") : "";
  const { dias, rotulo: rotuloPeriodo } = PERIODOS[periodo] ?? {
    dias: 90,
    rotulo: "",
  };
  const tipo = (TIPOS_FICHA as readonly string[]).includes(f.um("tipo"))
    ? (f.um("tipo") as TipoFicha)
    : null;
  const situacao = (SITUACOES_FICHA as readonly string[]).includes(
    f.um("situacao"),
  )
    ? (f.um("situacao") as SituacaoFicha)
    : null;
  const desde = dias ? somarDias(ctx.hoje, -(dias - 1)) : null;

  const [todas, lucs, validade] = await Promise.all([
    listaDeFichas(desde, tipo),
    gerar ? lucsVagos() : null,
    gerar ? validadeDoLink() : 0,
  ]);
  const lista = situacao ? todas.filter((x) => x.situacao === situacao) : todas;
  const agora = Date.now();
  const exemplo = todas.some((x) => x.exemplo);
  const doForms = todas.some((x) => x.origem === "google_forms");
  const lucInicial = f.um("luc");

  const linhaFiltros = linhaDeFiltros([
    {
      rotulo: "Situação",
      valor: situacao ? ROTULO_SITUACAO[situacao] : "Todas",
    },
    { rotulo: "Tipo", valor: tipo ? ROTULO_TIPO_CURTO[tipo] : "Todos" },
    { rotulo: "Período", valor: rotuloPeriodo },
  ]);
  const agoraTexto = dadosDe(new Date());
  const colunas = [
    { titulo: "Envio" },
    { titulo: "Nome" },
    { titulo: "Tipo" },
    { titulo: "Imóvel pretendido" },
    { titulo: "Origem" },
    { titulo: "Situação" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {gerar && lucs && (
          <GerarLink
            lucs={lucs.opcoes}
            validadeDias={validade}
            lucInicial={lucInicial || undefined}
            abrirAoCarregar={!!lucInicial}
          />
        )}
        <Link href={`${ROTA_FICHAS}/demonstracao`} className={BOTAO_SECUNDARIO}>
          <Eye className="size-4" aria-hidden />
          Ver ficha (link público)
        </Link>
      </div>

      <FiltrosComercial
        tela="fichas"
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "situacao",
            rotulo: "Situação",
            todos: "Todas as situações",
            valor: situacao ?? "",
            icone: <CircleDot className="size-4" />,
            opcoes: SITUACOES_FICHA.map((s) => ({
              valor: s,
              rotulo: ROTULO_SITUACAO[s],
            })),
          },
          {
            chave: "tipo",
            rotulo: "Tipo",
            todos: "Todos os tipos",
            valor: tipo ?? "",
            icone: <UserRound className="size-4" />,
            opcoes: TIPOS_FICHA.map((t) => ({
              valor: t,
              rotulo: ROTULO_TIPO_CURTO[t],
            })),
          },
          {
            chave: "dias",
            rotulo: "Período",
            todos: PERIODOS[""]?.rotulo ?? "",
            valor: periodo,
            icone: <CalendarDays className="size-4" />,
            opcoes: Object.entries(PERIODOS)
              .filter(([k]) => k)
              .map(([valor, p]) => ({ valor, rotulo: p.rotulo })),
          },
        ]}
      />

      <TopoComercial
        dadosDe={agoraTexto}
        filtros={linhaFiltros}
        exemplo={
          exemplo
            ? "fichas do mockup (Configurações › Remover dados de exemplo)"
            : undefined
        }
        acoes={
          ctx.pode("comercial.exportar") ? (
            <BotaoExportar
              titulo="Fichas cadastrais"
              filtros={`${linhaFiltros} · ${agoraTexto}`}
              nomeArquivo="fichas-cadastrais"
              colunas={colunas}
              linhas={lista.map((x) => [
                x.recebida_em ? formatarData(x.recebida_em) : "",
                x.nome ?? "",
                x.tipo ? ROTULO_TIPO_CURTO[x.tipo] : "",
                x.luc ?? "Ainda não sei",
                ROTULO_ORIGEM[x.origem] ?? x.origem,
                [ROTULO_SITUACAO[x.situacao], estadoDoLink(x, agora)]
                  .filter(Boolean)
                  .join(" · "),
              ])}
            />
          ) : undefined
        }
      />

      <CartoesComercial>
        {CARTOES.map((c) => (
          <CartaoDaTela
            key={c.situacao}
            titulo={c.titulo}
            valor={formatarNumero(
              todas.filter((x) => x.situacao === c.situacao).length,
            )}
            detalhe={c.detalhe}
            fonte="fichas do sistema e importadas do Google Forms"
            href={hrefCom(ROTA_FICHAS, f.busca, {
              situacao: situacao === c.situacao ? null : c.situacao,
            })}
            ativo={situacao === c.situacao}
          />
        ))}
      </CartoesComercial>

      <Secao
        titulo={situacao ? ROTULO_SITUACAO[situacao] : "Fichas"}
        descricao={`${rotuloPeriodo}, pela data em que o link foi gerado (ou do envio, nas do Forms).`}
      >
        <TabelaLista
          colunas={colunas}
          ordemInicial={{ coluna: 0, desc: true }}
          vazio="Nenhuma ficha nesse filtro."
          placeholder="Buscar por nome ou LUC…"
          rodape={[
            `${formatarNumero(lista.length)} ${lista.length === 1 ? "ficha" : "fichas"}`,
            ...colunas.slice(1).map(() => ""),
          ]}
          linhas={lista.map((x) => {
            const link = estadoDoLink(x, agora);
            return {
              chave: x.id,
              href: rotaDaFicha(x.id),
              tom: link === "link vencido" ? "atencao" : undefined,
              busca: `${x.nome ?? ""} ${x.luc ?? ""}`,
              ordem: [
                x.recebida_em ?? x.gerada_em,
                x.nome,
                x.tipo,
                x.luc,
                x.origem,
                x.situacao,
              ],
              celulas: [
                x.recebida_em ? (
                  formatarData(x.recebida_em)
                ) : (
                  <span key="envio" className="text-neutral-400">
                    —{" "}
                    <span className="text-xs">
                      (link de {formatarData(x.gerada_em).slice(0, 5)})
                    </span>
                  </span>
                ),
                x.nome ?? (
                  <span key="nome" className="text-neutral-400">
                    —
                  </span>
                ),
                x.tipo ? (
                  ROTULO_TIPO_CURTO[x.tipo]
                ) : (
                  <span key="tipo" className="text-neutral-400">
                    a escolher
                  </span>
                ),
                <span key="luc" className="font-mono text-xs">
                  {x.luc ?? "Ainda não sei"}
                </span>,
                ROTULO_ORIGEM[x.origem] ?? x.origem,
                <SeloSituacao key="s" situacao={x.situacao} detalhe={link} />,
              ],
            };
          })}
        />
        <div className="mt-3 flex flex-col gap-1">
          <Nota>
            {ver
              ? "Dados pessoais e de renda só aparecem para quem tem a permissão de fichas. Quem abre cada ficha fica registrado."
              : "Você vê a lista e os links. Dados pessoais e de renda só com a permissão de ver as fichas cadastrais."}
          </Nota>
          {doForms && (
            <Nota>
              As fichas com origem "Google Forms" vieram da importação do
              histórico.
            </Nota>
          )}
        </div>
      </Secao>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-3"
        quantidade={3}
      />
      <CartaoCarregando altura="h-96" />
    </TelaCarregando>
  );
}
