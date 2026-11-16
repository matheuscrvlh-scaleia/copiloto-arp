import {
  Building2,
  CalendarDays,
  CircleCheck,
  Layers,
  Store,
  Tag,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { ColunasEmpilhadas } from "@/components/dashboard/graficos/colunas-empilhadas";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { ListaClube } from "@/components/sustentabilidade/clube/lista";
import { NovoParticipante } from "@/components/sustentabilidade/clube/novo-participante";
import {
  Atalho,
  CartaoDaTela,
  CartoesSu,
  FiltrosSu,
  hrefCom,
  hrefDoCartao,
  TopoDaTela,
} from "@/components/sustentabilidade/clube/tela";
import { formatarData, formatarMoeda, formatarNumero } from "@/lib/formato";
import { linhaDeFiltros } from "@/lib/marketing/periodo";
import {
  colunasDoClube,
  linhasParaExportar,
} from "@/lib/sustentabilidade/clube-exportar";
import {
  type AgruparPor,
  agruparLinhas,
  anosDoClube,
  ativosPorAno,
  CARTOES_CLUBE,
  type CartaoClube,
  dataDeReferencia,
  type FiltroLocatario,
  type FiltroSituacao,
  filtrarPorCartao,
  filtrarPorSituacao,
  linhasDoClube,
  passaNosFiltros,
  ROTULO_SITUACAO_CLUBE,
  resumoDosCartoes,
} from "@/lib/sustentabilidade/clube-lista";
import { formatarPercentual } from "@/lib/sustentabilidade/formatos";
import { filtrosLembrados } from "@/server/preferencias/filtros";
import { criarParticipante } from "@/server/sustentabilidade/acoes/clube";
import { contextoSu } from "@/server/sustentabilidade/base";
import {
  clientesParaParticipar,
  dadosDoClube,
} from "@/server/sustentabilidade/clube";

export const metadata: Metadata = { title: "Clube SustentArp" };

const BASE = "/sustentabilidade/clube";
const FONTE = "Clube SustentArp e contratos (ENET)";

const SITUACOES: Record<string, string> = {
  todas: "Todas as situações",
  ativo: ROTULO_SITUACAO_CLUBE.ativo,
  a_vencer: ROTULO_SITUACAO_CLUBE.a_vencer,
  vencido: ROTULO_SITUACAO_CLUBE.vencido,
  saiu: ROTULO_SITUACAO_CLUBE.saiu,
  interessado: ROTULO_SITUACAO_CLUBE.interessado,
};
const AGRUPAR: Record<string, string> = {
  forma: "Forma de participação",
  locatario: "Locatário ou não",
};
const NOMES_DO_CARTAO: Record<CartaoClube, string> = {
  ativos: "Participantes ativos",
  a_vencer: "Termos a vencer",
  participacao: "Participação (ativos locatários)",
  contribuiram: "Contribuíram no ano",
};

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: PageProps<"/sustentabilidade/clube">) {
  return (
    <>
      <PageHeader
        title="Clube SustentArp"
        description="Participantes por cliente (CPF ou CNPJ), termo anual, contribuições e ações. O clube não depende da loja: continua se a empresa mudar de LUC."
      />
      <Suspense fallback={<Esqueleto />}>
        <Tela busca={searchParams} />
      </Suspense>
    </>
  );
}

async function Tela({ busca: buscaUrl }: { busca: Promise<Busca> }) {
  const ctx = await contextoSu();
  if (
    !ctx.pode("sustentabilidade.clube.ver") &&
    !ctx.pode("sustentabilidade.clube.editar")
  )
    return <SemAcesso />;
  const { busca, lembrado } = await filtrosLembrados(
    "sustentabilidade",
    "clube",
    await buscaUrl,
  );
  const um = (k: string) => {
    const v = busca[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };

  const comValores = ctx.pode("sustentabilidade.valores");
  const editar = ctx.pode("sustentabilidade.clube.editar");
  const exportar = ctx.pode("sustentabilidade.exportar");
  const anoAtual = Number(ctx.hoje.slice(0, 4));
  const anoPedido = Number(um("ano"));
  const ano =
    Number.isInteger(anoPedido) && anoPedido >= 2000 && anoPedido <= anoAtual
      ? anoPedido
      : anoAtual;

  const [d, clientes] = await Promise.all([
    dadosDoClube(ano, comValores, ctx.hoje),
    editar ? clientesParaParticipar(ctx.hoje) : Promise.resolve([]),
  ]);

  const forma = d.formas.includes(um("forma")) ? um("forma") : "";
  const locatario: FiltroLocatario =
    um("locatario") === "sim" || um("locatario") === "nao"
      ? (um("locatario") as FiltroLocatario)
      : "";
  const bloco = d.blocos.includes(um("bloco")) ? um("bloco") : "";
  const texto = um("q").trim();
  const situacao: FiltroSituacao =
    um("situacao") in SITUACOES ? (um("situacao") as FiltroSituacao) : "ativos";
  const cartao = (CARTOES_CLUBE as readonly string[]).includes(um("cartao"))
    ? (um("cartao") as CartaoClube)
    : null;
  const agrupar: AgruparPor =
    um("agrupar") === "forma" || um("agrupar") === "locatario"
      ? (um("agrupar") as AgruparPor)
      : "";

  const filtrados = d.participantes.filter((p) =>
    passaNosFiltros(p, { forma, locatario, bloco, busca: texto }),
  );
  const todas = linhasDoClube({
    participantes: filtrados,
    ano,
    hoje: ctx.hoje,
    avisoDias: d.avisoDias,
    extras: d.extras,
    entrevistas: d.entrevistas,
    comValores,
  });
  const clientesPj = bloco
    ? d.clientesPj.filter((c) => c.blocos.includes(bloco)).length
    : d.clientesPj.length;
  const resumo = resumoDosCartoes(todas, clientesPj, comValores);
  const lista = cartao
    ? filtrarPorCartao(todas, cartao)
    : filtrarPorSituacao(todas, situacao);
  const grupos = agruparLinhas(lista, agrupar, d.formas);

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Ano", valor: String(ano) },
    {
      rotulo: "Situação",
      valor: cartao
        ? `cartão ${NOMES_DO_CARTAO[cartao]}`
        : situacao === "ativos"
          ? "Ativos (termo válido)"
          : (SITUACOES[situacao] ?? ""),
    },
    { rotulo: "Forma de participação", valor: forma || "Todas" },
    {
      rotulo: "Locatário",
      valor:
        locatario === "sim"
          ? "Só locatários"
          : locatario === "nao"
            ? "Só não locatários"
            : "Todos",
    },
    { rotulo: "Bloco", valor: bloco || "Todos" },
    ...(texto ? [{ rotulo: "Busca", valor: texto }] : []),
    ...(agrupar
      ? [{ rotulo: "Agrupado por", valor: AGRUPAR[agrupar] ?? "" }]
      : []),
  ]);

  // Gráfico: os mesmos filtros de forma, locatário, bloco e busca; o ano e a
  // situação não valem (o gráfico mostra todos os anos).
  const anos = anosDoClube(
    d.participantes.flatMap((p) => p.termos),
    anoAtual,
  );
  const porAno = ativosPorAno(filtrados, anos, ctx.hoje, d.avisoDias, d.formas);
  const chaves = [...new Set(porAno.flatMap((a) => Object.keys(a.porForma)))];
  const semAtivosNoGrafico = porAno.every((a) => a.total === 0);

  const referencia = dataDeReferencia(ano, ctx.hoje);
  const opcoesDeAno = d.anos.map((a) => ({
    valor: String(a),
    rotulo: String(a),
  }));
  const vazio = d.participantes.length
    ? "Nenhum participante nesse filtro. Troque a situação para Todas ou limpe os filtros."
    : "Ainda não há participantes. Use Novo participante para cadastrar o primeiro (cliente da lista de contratos ou cadastro manual).";

  return (
    <div className="flex flex-col gap-6">
      <FiltrosSu
        tela="clube"
        hoje={ctx.hoje}
        lembrado={lembrado}
        busca={{
          chave: "q",
          valor: texto,
          placeholder: "Buscar por nome ou CPF/CNPJ",
        }}
        selecoes={[
          {
            chave: "ano",
            rotulo: "Ano",
            todos: String(anoAtual),
            valor: ano === anoAtual ? "" : String(ano),
            icone: <CalendarDays className="size-4" />,
            largura: "w-28",
            opcoes: opcoesDeAno.filter((o) => o.valor !== String(anoAtual)),
          },
          {
            chave: "situacao",
            rotulo: "Situação",
            todos: "Ativos (termo válido)",
            valor: situacao === "ativos" ? "" : situacao,
            icone: <CircleCheck className="size-4" />,
            largura: "w-52",
            opcoes: Object.entries(SITUACOES).map(([valor, rotulo]) => ({
              valor,
              rotulo,
            })),
          },
          {
            chave: "forma",
            rotulo: "Forma de participação",
            todos: "Todas as formas",
            valor: forma,
            icone: <Tag className="size-4" />,
            largura: "w-52",
            opcoes: d.formas.map((f) => ({ valor: f, rotulo: f })),
          },
          {
            chave: "locatario",
            rotulo: "Locatário ou não",
            todos: "Locatários e não",
            valor: locatario,
            icone: <Store className="size-4" />,
            largura: "w-48",
            opcoes: [
              { valor: "sim", rotulo: "Só locatários" },
              { valor: "nao", rotulo: "Só não locatários" },
            ],
          },
          {
            chave: "bloco",
            rotulo: "Bloco",
            todos: "Todos os blocos",
            valor: bloco,
            icone: <Building2 className="size-4" />,
            opcoes: d.blocos.map((b) => ({ valor: b, rotulo: b })),
          },
          {
            chave: "agrupar",
            rotulo: "Agrupar por",
            todos: "Sem agrupar",
            valor: agrupar,
            icone: <Layers className="size-4" />,
            opcoes: Object.entries(AGRUPAR).map(([valor, rotulo]) => ({
              valor,
              rotulo: `Agrupar por ${rotulo.toLowerCase()}`,
            })),
          },
        ]}
      />

      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        acoes={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Atalho href={`${BASE}/contribuicoes`}>
              Contribuições do Clube
            </Atalho>
            {exportar && (
              <BotaoExportar
                titulo="Participantes do Clube"
                filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
                nomeArquivo="participantes-do-clube"
                colunas={colunasDoClube(comValores).map(
                  ({ titulo, numero, formato }) => ({
                    titulo,
                    numero,
                    formato,
                  }),
                )}
                linhas={linhasParaExportar(grupos, comValores)}
              />
            )}
            {editar && (
              <NovoParticipante
                acao={criarParticipante}
                clientes={clientes}
                formas={d.formas}
                podeContato={ctx.pode("sustentabilidade.contato")}
              />
            )}
          </div>
        }
      />

      <CartoesSu>
        <CartaoDaTela
          titulo="Participantes ativos"
          valor={formatarNumero(resumo.ativos)}
          detalhe={`Termo válido em ${formatarData(referencia)}`}
          fonte={FONTE}
          href={hrefDoCartao(BASE, busca, "ativos")}
          ativo={cartao === "ativos"}
        />
        <CartaoDaTela
          titulo="Participação"
          valor={formatarPercentual(resumo.participacao)}
          detalhe={`${formatarNumero(resumo.ativosLocatarios)} ativos locatários de ${formatarNumero(resumo.clientesPj)} clientes PJ com contrato`}
          fonte={FONTE}
          href={hrefDoCartao(BASE, busca, "participacao")}
          ativo={cartao === "participacao"}
        />
        <CartaoDaTela
          titulo="Termos a vencer"
          valor={formatarNumero(resumo.aVencer)}
          detalhe={`Vencem em até ${d.avisoDias} dias (Parâmetros)`}
          fonte={FONTE}
          href={hrefDoCartao(BASE, busca, "a_vencer")}
          ativo={cartao === "a_vencer"}
        />
        {resumo.contribuido !== null && (
          <CartaoDaTela
            titulo="Contribuído no ano"
            valor={formatarMoeda(resumo.contribuido)}
            detalhe={`${formatarNumero(resumo.contribuiram)} ${resumo.contribuiram === 1 ? "participante contribuiu" : "participantes contribuíram"} em ${ano}`}
            fonte="Clube SustentArp (competência no ano)"
            href={hrefDoCartao(BASE, busca, "contribuiram")}
            ativo={cartao === "contribuiram"}
          />
        )}
      </CartoesSu>

      <div data-guia="lista-clube">
        <Secao
          titulo="Participantes"
          descricao={`${formatarNumero(lista.length)} ${lista.length === 1 ? "participante" : "participantes"} · uma linha por cliente (CPF ou CNPJ)${comValores ? "" : " · valores em reais só para quem tem a permissão de valores"}`}
        >
          <ListaClube
            grupos={grupos}
            comValores={comValores}
            hrefDe={(id) => `${BASE}/${id}`}
            vazio={vazio}
          />
          <div className="mt-3 flex flex-col gap-1">
            <Nota>
              Situação: Ativo (termo válido), Termo a vencer, Termo vencido ou
              Saiu. Termo do ano, Contribuído, Combinado e Ações são do ano
              escolhido; no ano passado a situação é a do último dia do ano.
              Entrevista é a pior situação entre os contratos do cliente.
            </Nota>
            {d.interessados > 0 && (
              <Nota>
                {d.interessados}{" "}
                {d.interessados === 1
                  ? "cliente demonstrou interesse na entrevista e ainda não tem termo."
                  : "clientes demonstraram interesse na entrevista e ainda não têm termo."}{" "}
                <Link
                  href={hrefCom(BASE, busca, {
                    situacao: "interessado",
                    cartao: null,
                  })}
                  scroll={false}
                  className="font-medium text-neutral-700 underline underline-offset-4"
                >
                  Ver interessados
                </Link>
              </Nota>
            )}
            {d.temExemplo && (
              <Nota>
                Dados de exemplo (fictícios): os participantes, termos e
                contribuições de exemplo não são de clientes reais.
              </Nota>
            )}
          </div>
        </Secao>
      </div>

      <div data-guia="grafico-clube">
        <Secao
          titulo="Participantes ativos por ano"
          descricao="Termo válido no fim de cada ano (hoje, no ano corrente), separados por forma de participação. Quem tem duas formas aparece nas duas."
        >
          {semAtivosNoGrafico ? (
            <p className="py-4 text-sm text-neutral-500">
              Ainda não há participantes ativos nesse filtro. Registre o termo
              dos participantes para o gráfico aparecer.
            </p>
          ) : (
            <ColunasEmpilhadas
              descricao="Participantes ativos do clube por ano, empilhados por forma de participação"
              pontos={porAno.map((a) => ({
                chave: String(a.ano),
                rotulo: String(a.ano),
                titulo: `Participantes ativos em ${a.ano}: ${a.total}`,
              }))}
              series={chaves.map((c, i) => ({
                chave: c,
                rotulo: c,
                cor: i < 5 ? ((i + 1) as 1 | 2 | 3 | 4 | 5) : "neutro",
                valores: porAno.map((a) => a.porForma[c] ?? 0),
              }))}
            />
          )}
        </Secao>
      </div>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-4"
        quantidade={4}
      />
      <CartaoCarregando altura="h-[32rem]" />
      <CartaoCarregando altura="h-72" />
    </TelaCarregando>
  );
}
