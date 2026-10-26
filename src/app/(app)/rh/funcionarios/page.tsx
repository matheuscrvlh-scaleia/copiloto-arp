import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import {
  type Coluna,
  Nota,
  paraBusca,
  Secao,
} from "@/components/dashboard/tabela";
import { TabelaBusca } from "@/components/dashboard/tabela-busca";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { SeloSituacao } from "@/components/rh/situacao";
import { formatarData, formatarNumero, isoLocal } from "@/lib/formato";
import { formatarTempoDeCasa, mesesDeCasa } from "@/lib/rh/calculos";
import { VINCULO } from "@/lib/rh/funcionarios";
import { emTitulo, ROTULO_CONTRATO } from "@/lib/rh/headcount";
import { type Funcionario, funcionarios } from "@/server/rh/funcionarios";

export const metadata: Metadata = { title: "Funcionários" };

export default function Page({ searchParams }: PageProps<"/rh/funcionarios">) {
  return (
    <>
      <PageHeader
        title="Funcionários"
        description="Todos os colaboradores do Copiloto RH. Abra um perfil para ver as batidas de cada dia, o ponto mês a mês e os afastamentos."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="rh.funcionarios">
          <Lista busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

/** Valores distintos, em ordem, como opções de um filtro. */
const opcoesDe = (valores: string[]) =>
  [...new Set(valores)]
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ valor: v, rotulo: v }));

/** O que cada cartão filtra na lista (?situacao=…). */
const SITUACOES = {
  ativos: "Ativos e afastados",
  afastados: "Afastados hoje",
  desligados: "Desligados",
} as const;
type FiltroSituacao = keyof typeof SITUACOES;

/** Opções do filtro em que a pessoa aparece: o afastado está nas duas. */
const situacoesDe = (f: Funcionario): FiltroSituacao[] =>
  f.situacao === "afastado" ? ["ativos", "afastados"] : [VINCULO[f.situacao]];

const periodo = (a: { inicio: string; fim: string }) =>
  a.inicio === a.fim
    ? formatarData(a.inicio)
    : `${formatarData(a.inicio)} a ${formatarData(a.fim)}`;

const contrato = (f: Funcionario) =>
  f.tipo_contrato
    ? (ROTULO_CONTRATO[f.tipo_contrato] ?? f.tipo_contrato)
    : "Sem contrato";

async function Lista({
  busca,
}: {
  busca: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [todos, params] = await Promise.all([funcionarios(), busca]);
  const pedida = params.situacao;
  const situacao: FiltroSituacao =
    typeof pedida === "string" && pedida in SITUACOES
      ? (pedida as FiltroSituacao)
      : "ativos";
  const hoje = isoLocal(new Date());
  const conta = (s: Funcionario["situacao"][]) =>
    todos.filter((f) => s.includes(f.situacao)).length;

  const colunas: Coluna<Funcionario>[] = [
    {
      titulo: "Colaborador",
      valor: (f) => (
        <Link
          href={`/rh/funcionarios/${f.id}`}
          className="font-medium underline-offset-2 hover:underline"
        >
          {f.nome}
        </Link>
      ),
    },
    { titulo: "Matrícula", valor: (f) => f.matricula ?? "—", numero: true },
    { titulo: "Departamento", valor: (f) => f.departamento },
    { titulo: "Cargo", valor: (f) => (f.cargo ? emTitulo(f.cargo) : "—") },
    { titulo: "Contrato", valor: contrato },
    {
      titulo: "Admissão",
      valor: (f) => formatarData(f.admissao),
      numero: true,
    },
    {
      titulo: "Tempo de casa",
      valor: (f) =>
        f.admissao && f.situacao !== "desligado"
          ? formatarTempoDeCasa(Math.max(mesesDeCasa(f.admissao, hoje), 0))
          : "—",
      numero: true,
    },
    {
      titulo: "Situação",
      valor: (f) => <SeloSituacao situacao={f.situacao} />,
    },
    // Só com o filtro dos afastados: por que e até quando.
    ...(situacao === "afastados"
      ? [
          {
            titulo: "Afastamento",
            valor: (f: Funcionario) =>
              f.afastamentoHoje ? (
                <span>
                  {f.afastamentoHoje.motivo ?? "Sem motivo no ponto"}
                  <span className="block text-xs text-neutral-500">
                    {periodo(f.afastamentoHoje)}
                  </span>
                </span>
              ) : f.situacao === "afastado" ? (
                <span className="text-neutral-500">
                  Afastado no Copiloto RH (sem período no ponto)
                </span>
              ) : (
                "—"
              ),
          },
        ]
      : []),
    {
      titulo: "",
      valor: (f) => (
        <Link
          href={`/rh/funcionarios/${f.id}`}
          aria-label={`Abrir o perfil de ${f.nome}`}
          className="grid size-7 place-items-center rounded-full text-neutral-400 transition hover:bg-white hover:text-neutral-900"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Numero
          destaque
          titulo="Ativos"
          valor={conta(["ativo", "afastado", "a_admitir"])}
          detalhe="no Copiloto RH, com os afastados"
          filtro="ativos"
          escolhido={situacao}
        />
        <Numero
          titulo="Afastados hoje"
          valor={conta(["afastado"])}
          detalhe="pelo Copiloto ou por afastamento no ponto"
          filtro="afastados"
          escolhido={situacao}
        />
        <Numero
          titulo="Desligados"
          valor={conta(["desligado"])}
          detalhe="mantidos para o histórico"
          filtro="desligados"
          escolhido={situacao}
        />
      </div>

      <Secao
        id="colaboradores"
        titulo="Colaboradores"
        descricao="Clique no nome para abrir o perfil"
        className="scroll-mt-6"
      >
        <TabelaBusca
          // Um cartão clicado troca o filtro: a tabela recomeça com ele.
          key={situacao}
          placeholder="Buscar pelo nome ou matrícula…"
          porPagina={15}
          filtros={[
            {
              chave: "vinculo",
              rotulo: "Situação",
              todos: "Todas as situações",
              inicial: situacao,
              opcoes: Object.entries(SITUACOES).map(([valor, rotulo]) => ({
                valor,
                rotulo,
              })),
            },
            {
              chave: "dep",
              rotulo: "Departamento",
              todos: "Todos os departamentos",
              opcoes: opcoesDe(todos.map((f) => f.departamento)),
            },
            {
              chave: "contrato",
              rotulo: "Contrato",
              todos: "Todos os contratos",
              opcoes: opcoesDe(todos.map(contrato)),
            },
          ]}
          {...paraBusca(
            colunas,
            todos,
            (f) => f.id,
            (f) => `${f.nome} ${f.matricula ?? ""}`,
            (f) => ({
              vinculo: situacoesDe(f),
              dep: f.departamento,
              contrato: contrato(f),
            }),
          )}
        />
      </Secao>

      <Nota>
        Fonte: Copiloto RH (nome, contrato, admissão e desligamento), Secullum
        (departamento, batidas e afastamentos) e folha (cargo). Salário e custo
        ficam em Custo de pessoal.
      </Nota>
    </div>
  );
}

/** Cartão que filtra a lista pela situação dele. */
function Numero({
  titulo,
  valor,
  detalhe,
  filtro,
  escolhido,
  destaque = false,
}: {
  titulo: string;
  valor: number;
  detalhe: string;
  filtro: FiltroSituacao;
  escolhido: FiltroSituacao;
  destaque?: boolean;
}) {
  const apagado = destaque
    ? "text-[rgb(255_255_255/0.60)]"
    : "text-neutral-500";
  const ativo = filtro === escolhido;
  return (
    <Link
      href={`?situacao=${filtro}#colaboradores`}
      aria-current={ativo ? "true" : undefined}
      title={`Mostrar na lista: ${SITUACOES[filtro].toLowerCase()}`}
      className={`${destaque ? "destaque" : "vidro"} block rounded-[1.75rem] p-6 transition hover:-translate-y-0.5 hover:shadow-lg ${ativo ? "ring-2 ring-neutral-900/70" : ""}`}
    >
      <p className={`text-sm ${apagado}`}>{titulo}</p>
      <p className="mt-2 text-5xl font-semibold tracking-tight">
        {formatarNumero(valor)}
      </p>
      <p className={`mt-1 text-xs ${apagado}`}>{detalhe}</p>
    </Link>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <IndicadoresCarregando quantidade={3} className="sm:grid-cols-3" />
      <CartaoCarregando altura="h-[40rem]" />
    </TelaCarregando>
  );
}
