import { CircleDot, Layers, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { CartaoDaTela, Cartoes, hrefCom } from "@/components/dashboard/tela";
import {
  AvisosDoDiario,
  BASE,
  dataHoraDoApp,
  FONTE,
  pct,
  pontos,
  quando,
  SemDados,
  TopoDiario,
} from "@/components/operacoes/diario/comum";
import { FiltrosDiario } from "@/components/operacoes/diario/filtros";
import {
  Alertas,
  AvancoPorPrazo,
  COLUNAS_EXPORTAR,
  linhasExportar,
  TabelaDoPainel,
} from "@/components/operacoes/diario/painel";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { linhaDeFiltros } from "@/lib/comercial/formato";
import { formatarData, formatarNumero } from "@/lib/formato";
import {
  aAprovar,
  alertasDoPainel,
  cartoesDoPainel,
  linhasDoPainel,
  OBRA_EM_ANDAMENTO,
  STATUS_OBRA,
} from "@/lib/operacoes/diario";
import { contextoOp, parametros } from "@/server/operacoes/base";
import {
  datasDosRelatorios,
  estadoDoDiario,
  obrasDoDiario,
} from "@/server/operacoes/diario";

export const metadata: Metadata = { title: "Diário de Obra" };

type Busca = Record<string, string | string[] | undefined>;
const um = (b: Busca, k: string) => {
  const v = b[k];
  return (Array.isArray(v) ? v[0] : v) ?? "";
};

const CARTOES = {
  andamento: "Obras em andamento",
  vencido: "Prazo vencido",
} as const;
type Cartao = keyof typeof CARTOES;

export default function Page({ searchParams }: PageProps<"/operacoes/diario">) {
  return (
    <>
      <PageHeader
        title="Diário de Obra"
        description="Obras, prazos, avanço físico e relatórios lançados no aplicativo Diário de Obra. Só consulta: tudo é lançado e aprovado no aplicativo."
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
  const [b, ctx, estado, obras, relatorios, p] = await Promise.all([
    busca,
    contextoOp(),
    estadoDoDiario(),
    obrasDoDiario(),
    datasDosRelatorios(),
    parametros(),
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

  const grupos = [
    ...new Set(obras.map((o) => o.grupo).filter((g): g is string => !!g)),
  ].sort((a, c) => a.localeCompare(c, "pt-BR"));
  const responsaveis = [
    ...new Set(obras.map((o) => o.responsavel).filter((r): r is string => !!r)),
  ].sort((a, c) => a.localeCompare(c, "pt-BR"));
  const status = Number(um(b, "status"));
  const statusValido = status in STATUS_OBRA ? status : 0;
  const grupo = grupos.includes(um(b, "grupo")) ? um(b, "grupo") : "";
  const responsavel = responsaveis.includes(um(b, "responsavel"))
    ? um(b, "responsavel")
    : "";
  const cartao = (um(b, "cartao") in CARTOES ? um(b, "cartao") : "") as
    | Cartao
    | "";

  const todas = linhasDoPainel(
    obras,
    relatorios,
    p.obras_dias_relatorio,
    ctx.hoje,
  );
  const base = todas.filter(
    (l) =>
      (!statusValido || l.obra.statusId === statusValido) &&
      (!grupo || l.obra.grupo === grupo) &&
      (!responsavel || l.obra.responsavel === responsavel),
  );
  const lista = base.filter((l) =>
    cartao === "andamento"
      ? l.obra.statusId === OBRA_EM_ANDAMENTO
      : cartao === "vencido"
        ? l.vencido
        : true,
  );
  const c = cartoesDoPainel(base);
  const limite = Number(p.obras_limite_desvio);
  const alertas = alertasDoPainel(base, limite, {
    pct,
    pontos,
    data: formatarData,
  });
  const idsDaLista = new Set(base.map((l) => l.obra.id));
  const aprovarDesde = relatorios
    .filter((r) => idsDaLista.has(r.obraId) && aAprovar(r.statusId))
    .reduce<string | null>((m, r) => (!m || r.data < m ? r.data : m), null);

  const filtros = linhaDeFiltros([
    {
      rotulo: "Status",
      valor: statusValido ? (STATUS_OBRA[statusValido]?.rotulo ?? "") : "Todos",
    },
    { rotulo: "Grupo", valor: grupo || "Todos" },
    { rotulo: "Responsável", valor: responsavel || "Todos" },
    ...(cartao ? [{ rotulo: "Cartão", valor: CARTOES[cartao] }] : []),
  ]);
  const hrefCartao = (k: Cartao) =>
    hrefCom(BASE, b, { cartao: cartao === k ? null : k });

  return (
    <div className="flex flex-col gap-6">
      <FiltrosDiario
        selecoes={[
          {
            chave: "status",
            rotulo: "Status da obra",
            todos: "Todos os status",
            valor: statusValido ? String(statusValido) : "",
            icone: <CircleDot className="size-4" />,
            opcoes: Object.entries(STATUS_OBRA).map(([valor, s]) => ({
              valor,
              rotulo: s.rotulo,
            })),
          },
          {
            chave: "grupo",
            rotulo: "Grupo",
            todos: "Todos os grupos",
            valor: grupo,
            icone: <Layers className="size-4" />,
            opcoes: grupos.map((g) => ({ valor: g, rotulo: g })),
          },
          {
            chave: "responsavel",
            rotulo: "Responsável",
            todos: "Todos os responsáveis",
            valor: responsavel,
            icone: <UserRound className="size-4" />,
            largura: "w-56",
            opcoes: responsaveis.map((r) => ({ valor: r, rotulo: r })),
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
              titulo="Diário de Obra — painel de obras"
              filtros={`${filtros} · ${estado.ultima ? `Dados do Diário de Obra de ${quando(estado.ultima.em)}` : ctx.dadosDe}`}
              nomeArquivo="diario-de-obra-obras"
              colunas={COLUNAS_EXPORTAR}
              linhas={linhasExportar(lista)}
            />
          ) : undefined
        }
      />
      <AvisosDoDiario estado={estado} />

      <Cartoes modulo="operacoes">
        <CartaoDaTela
          titulo={CARTOES.andamento}
          valor={formatarNumero(c.emAndamento)}
          detalhe="Status 3 (Em andamento) no aplicativo"
          fonte={FONTE}
          href={hrefCartao("andamento")}
          ativo={cartao === "andamento"}
        />
        <CartaoDaTela
          titulo={CARTOES.vencido}
          valor={formatarNumero(c.vencidas)}
          detalhe="Não concluída, com “a vencer” 0 ou fim antes de hoje"
          fonte={FONTE}
          href={hrefCartao("vencido")}
          ativo={cartao === "vencido"}
        />
        <CartaoDaTela
          titulo="Avanço físico médio"
          valor={pct(c.avancoMedio)}
          detalhe="Média do “realizado” das obras em andamento"
          fonte={`${FONTE}, lista de tarefas`}
          href={hrefCartao("andamento")}
          ativo={cartao === "andamento"}
        />
        <CartaoDaTela
          titulo="Relatórios a aprovar"
          valor={formatarNumero(c.aAprovar)}
          detalhe="Preenchendo ou Revisar (status 1 e 3)"
          fonte={FONTE}
          href={`${BASE}/relatorios?status=aprovar${aprovarDesde ? `&de=${aprovarDesde}&ate=${ctx.hoje}` : ""}`}
        />
      </Cartoes>

      <Secao
        titulo="Obras"
        descricao={`Uma linha por obra do aplicativo; clique para abrir. Dias sem relatório: ${diasQueContam(p.obras_dias_relatorio)} (Parâmetros), do início da obra até ontem, só obras em andamento.`}
        calculo="Prazo consumido = decorrido ÷ prazo contratual. Desvio = avanço físico − prazo consumido (pontos). Avanço físico = “realizado” da lista de tarefas do aplicativo."
      >
        <TabelaDoPainel linhas={lista} />
      </Secao>

      <div className="grid gap-6 xl:grid-cols-2">
        <Secao
          titulo="Avanço físico × prazo consumido"
          descricao="Por obra, na mesma escala. Avanço abaixo do prazo é atraso."
        >
          <AvancoPorPrazo linhas={lista} />
        </Secao>
        <Secao
          titulo="Alertas"
          descricao={`Prazo vencido, desvio abaixo de ${pontos(limite)} (Parâmetros), dia sem relatório e obra paralisada.`}
        >
          <Alertas alertas={alertas} />
        </Secao>
      </div>

      {estado.ultimoRelatorioNoApp && (
        <p className="text-xs text-neutral-500">
          Último relatório lançado no aplicativo:{" "}
          {dataHoraDoApp(estado.ultimoRelatorioNoApp)}.{" "}
          <Link
            href={`${BASE}/relatorios`}
            className="font-medium text-neutral-700 underline-offset-4 hover:underline"
          >
            Ver relatórios
          </Link>
        </p>
      )}
    </div>
  );
}

const NOMES_DIAS = ["", "seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
function diasQueContam(dias: number[]): string {
  const ordem = [...dias].sort((a, c) => a - c);
  return ordem.map((d) => NOMES_DIAS[d] ?? String(d)).join(", ") || "nenhum";
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-96" />
      <div className="grid gap-6 xl:grid-cols-2">
        <CartaoCarregando altura="h-64" />
        <CartaoCarregando altura="h-64" />
      </div>
    </TelaCarregando>
  );
}
