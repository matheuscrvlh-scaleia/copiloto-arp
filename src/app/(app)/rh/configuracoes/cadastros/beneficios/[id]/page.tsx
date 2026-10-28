import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { Protegido } from "@/components/protegido";
import { CONFIGURACOES_RH, rotaDoBeneficio } from "@/config/navigation";
import { formatarData, formatarMes, formatarMoeda } from "@/lib/formato";
import { vigenteEm } from "@/lib/rh/custo";
import { faixaTexto } from "@/lib/rh/plano";
import {
  importarValoresDoMes,
  salvarValoresDoMes,
} from "@/server/rh/acoes/cadastros";
import { TIPOS_BENEFICIO } from "@/server/rh/beneficios";
import { dadosDosBeneficios, doBeneficio } from "../../dados-beneficio";
import {
  DependentesDoPlano,
  quemPagaODependente,
} from "../../dependentes-do-plano";
import { FormBeneficio } from "../../form-beneficio";
import { QuemRecebe } from "../../quem-recebe";
import { ValoresDoMes } from "../../valores-do-mes";

export const metadata: Metadata = { title: "Benefício" };

type Aba = "quem-recebe" | "valores" | "dependentes" | "configuracao";

export default function Page({
  params,
  searchParams,
}: PageProps<"/rh/configuracoes/cadastros/beneficios/[id]">) {
  return (
    <>
      <Link
        href={`${CONFIGURACOES_RH.cadastros}#beneficios`}
        className="mb-3 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Benefícios
      </Link>
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="rh.beneficios">
          <Detalhe params={params} searchParams={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Detalhe({
  params,
  searchParams,
}: Pick<
  PageProps<"/rh/configuracoes/cadastros/beneficios/[id]">,
  "params" | "searchParams"
>) {
  const [{ id }, busca, d] = await Promise.all([
    params,
    searchParams,
    dadosDosBeneficios(),
  ]);
  const b = d.beneficios.find((x) => x.id === id);
  if (!b) notFound();
  const info = doBeneficio(d, b);
  const mes = d.mesAtual;

  const abas: { id: Aba; rotulo: string; marca?: string; alerta?: boolean }[] =
    [
      {
        id: "quem-recebe",
        rotulo: "Quem recebe",
        marca: String(info.recebemNoMes),
      },
      ...(info.porMes
        ? [
            {
              id: "valores" as const,
              rotulo: "Valores do mês",
              marca: info.semValorNoMes
                ? `faltam ${info.semValorNoMes}`
                : undefined,
              alerta: info.semValorNoMes > 0,
            },
          ]
        : []),
      ...(info.temDependentes
        ? [
            {
              id: "dependentes" as const,
              rotulo: "Dependentes",
              marca: String(info.dependentes.length),
              alerta: info.dependentesSemTitular > 0,
            },
          ]
        : []),
      { id: "configuracao", rotulo: "Configuração" },
    ];
  const pedida = typeof busca.aba === "string" ? busca.aba : "";
  const aba: Aba = abas.some((a) => a.id === pedida)
    ? (pedida as Aba)
    : "quem-recebe";

  const lancadosNoMes = info.recebemNoMes - info.semValorNoMes;
  const resumo: { rotulo: string; valor: string; detalhe?: string }[] = [
    {
      rotulo: "Quem recebe",
      valor: String(info.recebemNoMes),
      detalhe: `em ${formatarMes(mes)}`,
    },
    ...(info.porMes
      ? [
          {
            rotulo: `Valores de ${formatarMes(mes)}`,
            valor: `${lancadosNoMes} de ${info.recebemNoMes}`,
            detalhe: info.semValorNoMes
              ? `faltam ${info.semValorNoMes}`
              : "todos lançados",
          },
        ]
      : []),
    ...(info.temDependentes
      ? [
          {
            rotulo: "Dependentes",
            valor: String(info.dependentes.length),
            detalhe:
              b.dependente_regra === "nao_paga"
                ? "pagos pelo funcionário"
                : "parte paga pela empresa",
          },
        ]
      : []),
    {
      rotulo: "Desconto na folha",
      valor: b.rubricas_desconto.length ? b.rubricas_desconto.join(", ") : "—",
      detalhe: b.rubricas_desconto_dependente.length
        ? `dependentes ${b.rubricas_desconto_dependente.join(", ")}`
        : "rubricas do titular",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="vidro flex flex-col gap-5 rounded-[1.75rem] p-5 md:p-6">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-marca-escuro uppercase">
            {TIPOS_BENEFICIO[b.tipo]}
            {!b.ativo && " · inativo"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            {b.nome}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {info.valor} · {info.quemRecebe}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {resumo.map((r) => (
            <div
              key={r.rotulo}
              className="rounded-2xl bg-neutral-900/[0.04] px-4 py-3"
            >
              <dt className="text-[11px] text-neutral-500">{r.rotulo}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                {r.valor}
              </dd>
              {r.detalhe && (
                <dd className="text-[11px] text-neutral-500">{r.detalhe}</dd>
              )}
            </div>
          ))}
        </dl>
      </header>

      <nav
        aria-label="Partes do benefício"
        className="vidro flex w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-fit"
      >
        {abas.map((a) => {
          const ativa = a.id === aba;
          return (
            <Link
              key={a.id}
              href={rotaDoBeneficio(b.id, a.id)}
              scroll={false}
              aria-current={ativa ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
                ativa
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-neutral-600 hover:bg-white/60 hover:text-neutral-900"
              }`}
            >
              {a.rotulo}
              {a.marca && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                    a.alerta
                      ? "bg-amber-100 text-amber-800"
                      : ativa
                        ? "bg-white/20"
                        : "bg-neutral-900/[0.06]"
                  }`}
                >
                  {a.marca}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {aba === "quem-recebe" && (
        <QuemRecebe beneficio={b} info={info} dados={d} />
      )}

      {aba === "valores" && (
        <Secao
          titulo="Valores do mês"
          descricao="Cada mês é um lançamento à parte: lançar ou alterar um mês não muda os anteriores. Sem lançamento, o custo repete o último valor lançado antes."
        >
          <ValoresDoMes
            beneficioId={b.id}
            beneficioNome={b.nome}
            pessoas={info.pessoas}
            lancados={info.lancados.map((l) => ({
              colaborador_id: l.colaborador_id,
              competencia: l.competencia,
              valor: l.valor,
            }))}
            mesInicial={mes.slice(0, 7)}
            salvar={salvarValoresDoMes}
            importar={importarValoresDoMes}
          />
        </Secao>
      )}

      {aba === "dependentes" && (
        <Secao
          titulo="Dependentes"
          descricao={`Marcados como dependentes de ${b.tipo === "odonto" ? "odonto" : "plano de saúde"} no Copiloto RH (vêm na sincronização). Valor de ${formatarMes(mes)} pela idade na tabela vigente; ${quemPagaODependente(b)}.`}
        >
          <DependentesDoPlano
            beneficio={b}
            dependentes={info.dependentes}
            vinculos={info.vinculos}
            contratos={info.contratos}
            faixas={info.faixas}
            mes={mes}
          />
        </Secao>
      )}

      {aba === "configuracao" && (
        <>
          <Secao
            titulo="Configuração"
            descricao="Mudar o valor, as rubricas ou a regra dos dependentes recalcula o custo das folhas em aberto."
          >
            <FormBeneficio beneficio={b} />
          </Secao>
          {info.temDependentes && <TabelaDeFaixas info={info} mes={mes} />}
        </>
      )}
    </div>
  );
}

/** Tabela de faixas vigente do plano ou odonto, para conferir. */
function TabelaDeFaixas({
  info,
  mes,
}: {
  info: ReturnType<typeof doBeneficio>;
  mes: string;
}) {
  const tabela = vigenteEm(info.tabelas, mes);
  return (
    <Secao
      titulo="Tabela de faixas"
      descricao={
        tabela
          ? `Vigente desde ${formatarData(tabela.vigente_desde)}${tabela.reajuste_pct !== null ? `, reajuste de ${tabela.reajuste_pct}%` : ""}. Uma tabela nova (reajuste) é enviada em Importações.`
          : "Nenhuma tabela vigente: o valor pela faixa fica pendente. Envie a planilha da operadora em Importações."
      }
    >
      {tabela && (
        <ul className="grid gap-x-6 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {tabela.faixas.map((f) => (
            <li
              key={f.idade_min}
              className="flex justify-between gap-3 border-b border-neutral-900/[0.06] py-2"
            >
              <span className="text-neutral-600">
                {faixaTexto(f.idade_min, f.idade_max)}
              </span>
              <span className="font-medium tabular-nums">
                {formatarMoeda(f.mensalidade)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`${CONFIGURACOES_RH.importacoes}#plano`}
        className="mt-3 inline-block text-xs font-medium underline underline-offset-4"
      >
        Ir para Importações
      </Link>
    </Secao>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-48" />
      <CartaoCarregando altura="h-11" />
      <CartaoCarregando altura="h-96" />
    </TelaCarregando>
  );
}
