import { CircleDot, FileText, HardHat, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import { Secao } from "@/components/dashboard/tabela";
import { CartaoDaTela, Cartoes, hrefCom } from "@/components/dashboard/tela";
import {
  AvisosDoDiario,
  BASE,
  FONTE,
  OBRAS,
  quando,
  SemDados,
  TopoDiario,
  Voltar,
} from "@/components/operacoes/diario/comum";
import { FiltrosDiario } from "@/components/operacoes/diario/filtros";
import {
  COLUNAS_EXPORTAR_RELATORIOS,
  ListaDeRelatorios,
  linhasExportarRelatorios,
} from "@/components/operacoes/diario/relatorios";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { linhaDeFiltros } from "@/lib/comercial/formato";
import { formatarData, formatarNumero } from "@/lib/formato";
import {
  aAprovar,
  contar,
  periodoDaBusca,
  RELATORIO_APROVADO,
  RELATORIO_PREENCHENDO,
  RELATORIO_REVISAR,
  STATUS_RELATORIO,
} from "@/lib/operacoes/diario";
import { contextoOp } from "@/server/operacoes/base";
import {
  estadoDoDiario,
  obrasDoDiario,
  opcoesDosRelatorios,
  relatoriosDoPeriodo,
} from "@/server/operacoes/diario";

export const metadata: Metadata = { title: "Relatórios do Diário de Obra" };

type Busca = Record<string, string | string[] | undefined>;
const um = (b: Busca, k: string) => {
  const v = b[k];
  return (Array.isArray(v) ? v[0] : v) ?? "";
};

/** Filtro de status: um id ou "a aprovar" (1 e 3). */
const STATUS: Record<string, { rotulo: string; ids: number[] }> = {
  [RELATORIO_PREENCHENDO]: {
    rotulo: STATUS_RELATORIO[RELATORIO_PREENCHENDO]?.rotulo ?? "",
    ids: [RELATORIO_PREENCHENDO],
  },
  [RELATORIO_REVISAR]: {
    rotulo: STATUS_RELATORIO[RELATORIO_REVISAR]?.rotulo ?? "",
    ids: [RELATORIO_REVISAR],
  },
  [RELATORIO_APROVADO]: {
    rotulo: STATUS_RELATORIO[RELATORIO_APROVADO]?.rotulo ?? "",
    ids: [RELATORIO_APROVADO],
  },
  aprovar: {
    rotulo: "A aprovar (Preenchendo ou Revisar)",
    ids: [RELATORIO_PREENCHENDO, RELATORIO_REVISAR],
  },
};

export default function Page({
  searchParams,
}: PageProps<"/operacoes/obras/diario/relatorios">) {
  return (
    <>
      <PageHeader
        title="Relatórios do Diário de Obra"
        description="Os relatórios diários lançados no aplicativo, com os mesmos filtros da API. Clique no número para abrir o relatório completo."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="operacoes.obras.diario">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const [b, ctx, estado, obras, opcoes] = await Promise.all([
    busca,
    contextoOp(),
    estadoDoDiario(),
    obrasDoDiario(),
    opcoesDosRelatorios(),
  ]);
  const podeAtualizar = ctx.pode("operacoes.obras.atualizar");
  if (obras.length === 0)
    return (
      <div className="flex flex-col gap-6">
        <TopoDiario estado={estado} podeAtualizar={podeAtualizar} />
        <AvisosDoDiario estado={estado} />
        <SemDados estado={estado} />
      </div>
    );

  const periodo = periodoDaBusca(um(b, "de"), um(b, "ate"), ctx.hoje);
  const obra = obras.some((o) => o.id === um(b, "obra")) ? um(b, "obra") : "";
  const status = um(b, "status") in STATUS ? um(b, "status") : "";
  const modelo = opcoes.modelos.some((m) => m.valor === um(b, "modelo"))
    ? um(b, "modelo")
    : "";
  const autor = opcoes.autores.some((a) => a.valor === um(b, "autor"))
    ? um(b, "autor")
    : "";

  // Uma leitura sem o status: os cartões contam o período inteiro.
  const doPeriodo = await relatoriosDoPeriodo({
    de: periodo.de,
    ate: periodo.ate,
    obra: obra || undefined,
    modelo: modelo || undefined,
    autor: autor || undefined,
  });
  const ids = status ? STATUS[status]?.ids : undefined;
  const lista = ids
    ? doPeriodo.filter((r) => ids.includes(r.statusId))
    : doPeriodo;
  const conta = (id: number) =>
    doPeriodo.filter((r) => r.statusId === id).length;

  const nomeObra = obras.find((o) => o.id === obra)?.nome;
  const filtros = linhaDeFiltros([
    {
      rotulo: "Período",
      valor: `${formatarData(periodo.de)} a ${formatarData(periodo.ate)}`,
    },
    { rotulo: "Obra", valor: nomeObra ?? "Todas" },
    {
      rotulo: "Status",
      valor: status ? (STATUS[status]?.rotulo ?? "") : "Todos",
    },
    {
      rotulo: "Modelo",
      valor: opcoes.modelos.find((m) => m.valor === modelo)?.rotulo ?? "Todos",
    },
    {
      rotulo: "Autor",
      valor: opcoes.autores.find((a) => a.valor === autor)?.rotulo ?? "Todos",
    },
  ]);
  const hrefStatus = (s: string | null) =>
    hrefCom(`${BASE}/relatorios`, b, {
      status: s === status ? null : s,
      de: periodo.de,
      ate: periodo.ate,
    });
  const porObra = contar(lista.map((r) => r.obra));
  const porAutor = contar(lista.map((r) => r.autor ?? "Sem autor"));
  const item = (x: { chave: string; n: number }) => ({
    chave: x.chave,
    rotulo: x.chave,
    valor: x.n,
    texto: formatarNumero(x.n),
  });

  return (
    <div className="flex flex-col gap-6">
      <Voltar href={OBRAS}>Obras</Voltar>
      <FiltrosDiario
        periodo={{ de: periodo.de, ate: periodo.ate, max: ctx.hoje }}
        selecoes={[
          {
            chave: "obra",
            rotulo: "Obra",
            todos: "Todas as obras",
            valor: obra,
            icone: <HardHat className="size-4" />,
            largura: "w-56",
            opcoes: obras.map((o) => ({ valor: o.id, rotulo: o.nome })),
          },
          {
            chave: "status",
            rotulo: "Status",
            todos: "Todos os status",
            valor: status,
            icone: <CircleDot className="size-4" />,
            opcoes: Object.entries(STATUS).map(([valor, s]) => ({
              valor,
              rotulo: s.rotulo,
            })),
          },
          {
            chave: "modelo",
            rotulo: "Modelo de relatório",
            todos: "Todos os modelos",
            valor: modelo,
            icone: <FileText className="size-4" />,
            largura: "w-56",
            opcoes: opcoes.modelos,
          },
          {
            chave: "autor",
            rotulo: "Autor",
            todos: "Todos os autores",
            valor: autor,
            icone: <UserRound className="size-4" />,
            opcoes: opcoes.autores,
          },
        ]}
      />

      <TopoDiario
        estado={estado}
        filtros={filtros}
        podeAtualizar={podeAtualizar}
        exportar={
          ctx.pode("operacoes.exportar") ? (
            <BotaoExportar
              titulo="Diário de Obra — relatórios"
              filtros={`${filtros} · ${estado.ultima ? `Dados do Diário de Obra de ${quando(estado.ultima.em)}` : ctx.dadosDe}`}
              nomeArquivo="diario-de-obra-relatorios"
              colunas={COLUNAS_EXPORTAR_RELATORIOS}
              linhas={linhasExportarRelatorios(lista)}
            />
          ) : undefined
        }
      />
      <AvisosDoDiario estado={estado} />

      <Cartoes modulo="operacoes">
        <CartaoDaTela
          titulo="Relatórios no período"
          valor={formatarNumero(doPeriodo.length)}
          detalhe={`${formatarNumero(doPeriodo.filter((r) => aAprovar(r.statusId)).length)} a aprovar`}
          fonte={FONTE}
          href={hrefStatus(null)}
          ativo={!status}
        />
        <CartaoDaTela
          titulo="Preenchendo"
          valor={formatarNumero(conta(RELATORIO_PREENCHENDO))}
          detalhe="Status 1 no aplicativo"
          fonte={FONTE}
          href={hrefStatus(String(RELATORIO_PREENCHENDO))}
          ativo={status === String(RELATORIO_PREENCHENDO)}
        />
        <CartaoDaTela
          titulo="Revisar"
          valor={formatarNumero(conta(RELATORIO_REVISAR))}
          detalhe="Status 3: aguardando revisão"
          fonte={FONTE}
          href={hrefStatus(String(RELATORIO_REVISAR))}
          ativo={status === String(RELATORIO_REVISAR)}
        />
        <CartaoDaTela
          titulo="Aprovados"
          valor={formatarNumero(conta(RELATORIO_APROVADO))}
          detalhe="Status 4"
          fonte={FONTE}
          href={hrefStatus(String(RELATORIO_APROVADO))}
          ativo={status === String(RELATORIO_APROVADO)}
        />
      </Cartoes>

      <Secao
        titulo="Relatórios"
        descricao="Do mais novo para o mais antigo. Efetivo, clima, ocorrências e fotos vêm do relatório completo já guardado."
        calculo="Efetivo = soma das quantidades da mão de obra padrão, ou quantos têm presença na personalizada (conforme a opção do relatório). Ocorrências = tipos marcados."
      >
        <ListaDeRelatorios linhas={lista} />
      </Secao>

      <div className="grid gap-6 xl:grid-cols-2">
        <Secao titulo="Relatórios por obra" descricao="Na lista acima.">
          <BarrasHorizontais
            itens={porObra.map(item)}
            descricao="Quantidade de relatórios por obra"
            vazio="Nenhum relatório no período."
            rotuloLargo
          />
        </Secao>
        <Secao titulo="Relatórios por autor" descricao="Na lista acima.">
          <BarrasHorizontais
            itens={porAutor.map(item)}
            descricao="Quantidade de relatórios por autor"
            vazio="Nenhum relatório no período."
            rotuloLargo
          />
        </Secao>
      </div>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}
