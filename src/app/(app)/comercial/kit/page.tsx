import { CalendarClock, FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Situacao } from "@/components/admin/ui";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import {
  BaixarKitDoLuc,
  SubirDocumento,
} from "@/components/comercial/kit/formularios";
import {
  CartaoDaTela,
  CartoesComercial,
  FiltrosComercial,
  hrefCom,
  hrefDoCartao,
  TabelaLista,
  TopoComercial,
} from "@/components/comercial/tela";
import { Secao } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { linhaDeFiltros } from "@/lib/comercial/formato";
import {
  blocoDoLuc,
  rotuloSituacao,
  type SituacaoKit,
  situacaoDaValidade,
} from "@/lib/comercial/kit";
import { formatarData, formatarNumero } from "@/lib/formato";
import { parametros, valoresDaLista } from "@/server/comercial/base";
import { type Busca, lerFiltros } from "@/server/comercial/filtros";
import { dadosEnet } from "@/server/comercial/fontes";
import { documentosDoKit } from "@/server/comercial/kit";

export const metadata: Metadata = { title: "Kit de entrega" };

const BASE = "/comercial/kit";
const FONTE = "Kit de entrega (documentos enviados no sistema)";
const INATIVOS = "inativos";
const TOM_SITUACAO = {
  vencido: "erro",
  vence: "rodando",
  valido: "ok",
  sem_validade: "neutro",
} as const;

export default function Page({ searchParams }: PageProps<"/comercial/kit">) {
  return (
    <>
      <PageHeader
        title="Kit de entrega"
        description="A versão vigente de cada documento entregue com o contrato (regimento, normas, documentos do imóvel, segurança contra incêndio e mapas de fachada). Avisa antes de vencer e guarda as versões antigas."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="comercial.kit.ver">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

const blocosDe = (d: { blocos: string[]; todo_contrato: boolean }) =>
  d.todo_contrato
    ? "Todo contrato"
    : d.blocos.length
      ? d.blocos.join(", ")
      : "Sob pedido";

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const f = await lerFiltros("kit", await busca);
  const { ctx } = f;
  const [docs, p, categorias, enet] = await Promise.all([
    documentosDoKit(),
    parametros(),
    valoresDaLista("kit_categoria"),
    dadosEnet(),
  ]);
  const aviso = p.kit_aviso_dias;
  const situacoes: Record<SituacaoKit, string> = {
    valido: rotuloSituacao("valido", aviso),
    vence: rotuloSituacao("vence", aviso),
    vencido: rotuloSituacao("vencido", aviso),
    sem_validade: rotuloSituacao("sem_validade", aviso),
  };
  const categoria = categorias.includes(f.um("categoria"))
    ? f.um("categoria")
    : "";
  const validade =
    f.um("validade") in situacoes || f.um("validade") === INATIVOS
      ? f.um("validade")
      : "";
  const cartao = ["vence", "vencido"].includes(f.um("cartao"))
    ? (f.um("cartao") as SituacaoKit)
    : "";

  const comSituacao = docs.map((d) => ({
    ...d,
    situacao: situacaoDaValidade(d.atual?.validade ?? null, ctx.hoje, aviso),
  }));
  const ativos = comSituacao.filter((d) => d.ativo);
  const daCategoria = (
    validade === INATIVOS ? comSituacao.filter((d) => !d.ativo) : ativos
  ).filter((d) => !categoria || d.categoria === categoria);
  const lista = daCategoria.filter(
    (d) =>
      (!validade || validade === INATIVOS || d.situacao === validade) &&
      (!cartao || d.situacao === cartao),
  );
  const conta = (s: SituacaoKit) =>
    ativos.filter((d) => d.situacao === s).length;
  const mapas = ativos.filter((d) => d.blocos.length > 0).length;

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Categoria", valor: categoria || "Todas" },
    {
      rotulo: "Validade",
      valor:
        validade === INATIVOS
          ? "Inativos"
          : validade
            ? situacoes[validade as SituacaoKit]
            : "Todas",
    },
    ...(cartao ? [{ rotulo: "Cartão", valor: situacoes[cartao] }] : []),
  ]);

  const exportar = lista.map((d) => [
    d.nome,
    d.categoria,
    d.atual?.versao ?? "",
    blocosDe(d),
    d.atual?.validade ? formatarData(d.atual.validade) : "",
    situacoes[d.situacao],
    d.atual?.temArquivo ? "Sim" : "Não",
  ]);

  return (
    <div className="flex flex-col gap-6">
      <FiltrosComercial
        tela="kit"
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "categoria",
            rotulo: "Categoria",
            todos: "Todas as categorias",
            valor: categoria,
            icone: <FolderOpen className="size-4" />,
            largura: "w-60",
            opcoes: categorias.map((c) => ({ valor: c, rotulo: c })),
          },
          {
            chave: "validade",
            rotulo: "Validade",
            todos: "Todas as validades",
            valor: validade,
            icone: <CalendarClock className="size-4" />,
            largura: "w-52",
            opcoes: [
              ...(Object.keys(situacoes) as SituacaoKit[]).map((s) => ({
                valor: s,
                rotulo: situacoes[s],
              })),
              { valor: INATIVOS, rotulo: "Inativos (fora do kit)" },
            ],
          },
        ]}
      />

      <TopoComercial
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <BaixarKitDoLuc
              lucs={enet.lucs.map((l) => ({
                numero: l.numero,
                local: l.local,
                bloco: blocoDoLuc(l),
              }))}
              documentos={docs.map((d) => ({
                id: d.id,
                nome: d.nome,
                ativo: d.ativo,
                todo_contrato: d.todo_contrato,
                blocos: d.blocos,
                ordem: d.ordem,
                versao: d.atual?.versao ?? null,
                validade: d.atual?.validade ?? null,
                temArquivo: d.atual?.temArquivo ?? false,
              }))}
              hoje={ctx.hoje}
              avisoDias={aviso}
            />
            {ctx.pode("comercial.kit.editar") && (
              <SubirDocumento categorias={categorias} />
            )}
            {ctx.pode("comercial.exportar") && (
              <BotaoExportar
                titulo="Kit de entrega"
                filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
                nomeArquivo="kit-de-entrega"
                colunas={[
                  { titulo: "Documento" },
                  { titulo: "Categoria" },
                  { titulo: "Versão" },
                  { titulo: "Blocos" },
                  { titulo: "Validade" },
                  { titulo: "Situação" },
                  { titulo: "Arquivo" },
                ]}
                linhas={exportar}
              />
            )}
          </div>
        }
      />

      <CartoesComercial>
        <CartaoDaTela
          titulo="Documentos ativos"
          valor={formatarNumero(ativos.length)}
          detalhe={`${ativos.length - mapas} documentos e ${mapas} mapas`}
          fonte={FONTE}
          href={hrefCom(BASE, f.busca, { cartao: null })}
          ativo={!cartao}
        />
        <CartaoDaTela
          titulo={`Vencem em ${aviso} dias`}
          valor={formatarNumero(conta("vence"))}
          detalhe="Aviso no sistema (antecedência nos parâmetros)"
          fonte={FONTE}
          href={hrefDoCartao(BASE, f.busca, "vence")}
          ativo={cartao === "vence"}
        />
        <CartaoDaTela
          titulo="Vencidos"
          valor={formatarNumero(conta("vencido"))}
          detalhe="Trocar antes do próximo contrato"
          fonte={FONTE}
          href={hrefDoCartao(BASE, f.busca, "vencido")}
          ativo={cartao === "vencido"}
        />
      </CartoesComercial>

      <Secao
        titulo="Documentos"
        descricao="Nova versão substitui a anterior no kit; a anterior fica no histórico. O contrato guarda a versão entregue."
      >
        <TabelaLista
          colunas={[
            { titulo: "Documento", classe: "min-w-64" },
            { titulo: "Categoria" },
            { titulo: "Versão" },
            { titulo: "Blocos" },
            { titulo: "Validade" },
            { titulo: "Situação" },
          ]}
          vazio="Nenhum documento nos filtros."
          placeholder="Buscar documento…"
          rodape={[
            `${lista.length} ${lista.length === 1 ? "documento" : "documentos"}`,
            "",
            "",
            "",
            "",
            "",
          ]}
          linhas={lista.map((d) => ({
            chave: d.id,
            href: `${BASE}/${d.id}`,
            busca: `${d.nome} ${d.categoria} ${d.blocos.join(" ")}`,
            tom: d.situacao === "vencido" ? "alerta" : undefined,
            ordem: [
              d.ordem,
              d.categoria,
              d.atual?.versao ?? null,
              blocosDe(d),
              d.atual?.validade ?? null,
              d.situacao,
            ],
            celulas: [
              <span key="n" className="flex flex-col">
                <span className="font-medium">{d.nome}</span>
                {!d.atual?.temArquivo && (
                  <span className="text-xs text-red-700">sem arquivo</span>
                )}
              </span>,
              d.categoria,
              d.atual?.versao ?? "—",
              blocosDe(d),
              d.atual?.validade ? (
                <span
                  key="v"
                  className={d.situacao === "vencido" ? "text-red-700" : ""}
                >
                  {formatarData(d.atual.validade)}
                </span>
              ) : (
                "—"
              ),
              d.ativo ? (
                <Situacao key="s" tipo={TOM_SITUACAO[d.situacao]}>
                  {situacoes[d.situacao]}
                </Situacao>
              ) : (
                <Situacao key="s" tipo="neutro">
                  Inativo
                </Situacao>
              ),
            ],
          }))}
        />
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
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}
