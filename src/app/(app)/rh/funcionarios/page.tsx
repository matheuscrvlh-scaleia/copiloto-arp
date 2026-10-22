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

export default function Page() {
  return (
    <>
      <PageHeader
        title="Funcionários"
        description="Todos os colaboradores do Copiloto RH, do ponto e da folha. Abra um perfil para ver as batidas de cada dia, o ponto mês a mês e os afastamentos."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="rh.funcionarios">
          <Lista />
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

const contrato = (f: Funcionario) =>
  f.tipo_contrato
    ? (ROTULO_CONTRATO[f.tipo_contrato] ?? f.tipo_contrato)
    : "Sem contrato";

async function Lista() {
  const todos = await funcionarios();
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
        />
        <Numero
          titulo="Afastados hoje"
          valor={conta(["afastado"])}
          detalhe="pelo Copiloto ou por afastamento no ponto"
        />
        <Numero
          titulo="Desligados"
          valor={conta(["desligado"])}
          detalhe="mantidos para o histórico"
        />
      </div>

      <Secao
        titulo="Colaboradores"
        descricao="Clique no nome para abrir o perfil"
      >
        <TabelaBusca
          placeholder="Buscar pelo nome ou matrícula…"
          porPagina={15}
          filtros={[
            {
              chave: "vinculo",
              rotulo: "Situação",
              todos: "Todas as situações",
              inicial: "ativos",
              opcoes: [
                { valor: "ativos", rotulo: "Ativos e afastados" },
                { valor: "desligados", rotulo: "Desligados" },
              ],
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
              vinculo: VINCULO[f.situacao],
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

function Numero({
  titulo,
  valor,
  detalhe,
  destaque = false,
}: {
  titulo: string;
  valor: number;
  detalhe: string;
  destaque?: boolean;
}) {
  const apagado = destaque
    ? "text-[rgb(255_255_255/0.60)]"
    : "text-neutral-500";
  return (
    <div className={`${destaque ? "destaque" : "vidro"} rounded-[1.75rem] p-6`}>
      <p className={`text-sm ${apagado}`}>{titulo}</p>
      <p className="mt-2 text-5xl font-semibold tracking-tight">
        {formatarNumero(valor)}
      </p>
      <p className={`mt-1 text-xs ${apagado}`}>{detalhe}</p>
    </div>
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
