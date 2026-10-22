import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/admin/ui";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import type { ItemGrafico } from "@/components/dashboard/graficos";
import { CartaoIndicador } from "@/components/dashboard/indicador";
import {
  type Coluna,
  Nota,
  Secao,
  Tabela,
} from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { Protegido } from "@/components/protegido";
import { SeloSituacao } from "@/components/rh/situacao";
import {
  fimDoMes,
  formatarData,
  formatarHoras,
  formatarMes,
  formatarMoeda,
  formatarPct,
} from "@/lib/formato";
import { competenciasDoPeriodo } from "@/lib/periodo";
import {
  absenteismo,
  extrasDe,
  formatarTempoDeCasa,
  mesesDeCasa,
} from "@/lib/rh/calculos";
import { idadeEm, valorDasExtras, valorDoBanco } from "@/lib/rh/custo";
import {
  diaDaSemana,
  fimDeSemana,
  paresDeBatidas,
  rotuloOcorrencia,
} from "@/lib/rh/funcionarios";
import { emTitulo } from "@/lib/rh/headcount";
import { avisoDoPonto } from "@/lib/rh/ponto-periodo";
import {
  GRUPOS_RUBRICA,
  type GrupoRubrica,
  ROTULO_CONTRATO,
  ROTULO_SITUACAO,
} from "@/lib/rh/rubricas";
import { pode } from "@/server/auth";
import { TIPOS_BENEFICIO, type TipoBeneficio } from "@/server/rh/beneficios";
import { adicionalDoBanco } from "@/server/rh/dados";
import { lerFiltrosDoPeriodo } from "@/server/rh/filtros";
import {
  type Afastamento,
  afastamentosDe,
  beneficiosDe,
  type CustoDoMes,
  custosDe,
  type DiaDoPonto,
  type FolhaDoFuncionario,
  folhasDe,
  funcionario,
  type Perfil as PerfilDoFuncionario,
  type PontoDoMes,
  pontoDoPeriodoDe,
  pontoMensalDe,
  type RubricaDoFuncionario,
  rubricasDe,
} from "@/server/rh/funcionarios";
import { marcarForaDoPonto } from "./actions";

export const metadata: Metadata = { title: "Funcionário" };

export default function Page({
  params,
  searchParams,
}: PageProps<"/rh/funcionarios/[id]">) {
  return (
    <>
      <Link
        href="/rh/funcionarios"
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Funcionários
      </Link>
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="rh.funcionarios">
          <Perfil params={params} searchParams={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

/** Minutos → "8h00"; zero fica apagado para o que importa aparecer. */
function Horas({ minutos }: { minutos: number }) {
  if (!minutos) return <span className="text-neutral-300">—</span>;
  return <>{formatarHoras(minutos)}</>;
}

/** Saldo com sinal: "+0h28", "-3h37". */
const comSinal = (minutos: number) =>
  `${minutos > 0 ? "+" : ""}${formatarHoras(minutos)}`;

/** Banco e extras do período em R$, para o texto dos cartões. */
function horasEmReais(
  t: (Parameters<typeof extrasDe>[0] & { banco_saldo_min: number }) | null,
  salarioHora: number | null,
  adicional: number | null,
): { banco: string; extras: string } {
  if (!t) return { banco: "", extras: "" };
  const ex = extrasDe(t);
  if (salarioHora === null)
    return {
      banco: t.banco_saldo_min ? "R$ depende da folha" : "",
      extras: ex.total ? "R$ depende da folha" : "",
    };
  const banco = valorDoBanco(t.banco_saldo_min, salarioHora, adicional);
  const extras = valorDasExtras(ex.porTipo, salarioHora);
  return {
    banco: !t.banco_saldo_min
      ? ""
      : banco === null
        ? "R$: configure o adicional do banco em Parâmetros"
        : banco > 0
          ? `≈ ${formatarMoeda(banco)} a receber`
          : `≈ ${formatarMoeda(-banco)} devendo`,
    extras: ex.total
      ? `≈ ${formatarMoeda(extras.valor)}${extras.foraMin ? ` (fora ${formatarHoras(extras.foraMin)} sem %)` : ""}`
      : "",
  };
}

const contrato = (tipo: string | null) =>
  tipo ? (ROTULO_CONTRATO[tipo] ?? tipo) : "—";

async function Perfil({
  params,
  searchParams,
}: Pick<PageProps<"/rh/funcionarios/[id]">, "params" | "searchParams">) {
  const [{ id }, busca] = await Promise.all([params, searchParams]);
  const f = await funcionario(id);
  if (!f) notFound();

  const { periodo, rotulo, mes, hoje } = await lerFiltrosDoPeriodo(busca);
  const [ponto, mensal, afastamentos, verBeneficios, verSalario, editar] =
    await Promise.all([
      pontoDoPeriodoDe(f, periodo.de, periodo.ate),
      pontoMensalDe(id),
      afastamentosDe(id),
      pode("rh.beneficios"),
      pode("rh.custo_pessoal.individual"),
      pode("rh.parametros"),
    ]);
  const [beneficios, folhas, custos, adicional] = await Promise.all([
    verBeneficios ? beneficiosDe(id) : Promise.resolve(null),
    verSalario ? folhasDe(id) : Promise.resolve(null),
    verSalario ? custosDe(id) : Promise.resolve(null),
    verSalario ? adicionalDoBanco(mes) : Promise.resolve(null),
  ]);
  // Folha do mês do fim do período; sem ela, a última antes (ou a última).
  const folha =
    folhas?.find((x) => x.competencia <= mes) ?? folhas?.[0] ?? null;
  const rubricas = folha ? await rubricasDe(id, folha.folha_id) : [];
  const custo = folha
    ? (custos?.find((c) => c.competencia === folha.competencia) ?? null)
    : null;

  const desligado = f.situacao === "desligado";
  const aviso = avisoDoPonto(ponto);
  const t = ponto.total;
  // Horas em R$ pelo salário/hora da mesma folha (só com o custo individual).
  const emReais = verSalario
    ? horasEmReais(t, custo?.salario_hora ?? null, adicional)
    : { banco: "", extras: "" };
  const doPeriodo = new Set(competenciasDoPeriodo(periodo));

  // Últimos 12 meses do ponto, do mais antigo para o mais novo.
  const historico = mensal.slice(0, 12).reverse();
  const serie = (valor: (m: PontoDoMes) => number): ItemGrafico[] =>
    historico.map((m) => ({
      chave: m.competencia,
      rotulo: formatarMes(m.competencia).slice(0, 3),
      titulo: formatarMes(m.competencia),
      valor: valor(m),
      texto: formatarHoras(valor(m)),
      destaque: doPeriodo.has(m.competencia),
    }));

  const colunasMes: Coluna<PontoDoMes>[] = [
    {
      titulo: "Mês",
      valor: (m) => (
        <Link
          href={`/rh/funcionarios/${id}?de=${m.competencia}&ate=${fimDoMes(m.competencia)}`}
          scroll={false}
          className="underline-offset-2 hover:underline"
        >
          {formatarMes(m.competencia)}
        </Link>
      ),
    },
    {
      titulo: "Previstas",
      valor: (m) => formatarHoras(m.previstas_min),
      numero: true,
    },
    {
      titulo: "Trabalhadas",
      valor: (m) => formatarHoras(m.normais_min),
      numero: true,
    },
    {
      titulo: "Faltas e atrasos",
      valor: (m) => <Horas minutos={m.faltas_min + m.atrasos_min} />,
      numero: true,
    },
    {
      titulo: "Absenteísmo",
      valor: (m) => formatarPct(absenteismo(m)),
      numero: true,
    },
    {
      titulo: "Extras",
      valor: (m) => <Horas minutos={extrasDe(m).total} />,
      numero: true,
    },
    {
      titulo: "Saldo do banco",
      valor: (m) => formatarHoras(m.banco_saldo_min),
      numero: true,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <Avatar nome={f.nome} apagado={desligado} />
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            {f.nome}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {[
              f.matricula !== null && `Matrícula ${f.matricula}`,
              f.departamento,
              f.cargo && emTitulo(f.cargo),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <SeloSituacao situacao={f.situacao} />
      </header>

      <Dados f={f} folha={folha} hoje={hoje} />

      <FiltroPeriodo
        de={periodo.de}
        ate={periodo.ate}
        atalho={periodo.atalho}
        hoje={hoje}
      />

      {!f.noPonto ? (
        <Secao titulo="Ponto">
          <p className="text-sm text-neutral-500">
            Esta pessoa não está no ponto (Secullum): não há batidas nem horas.
          </p>
        </Secao>
      ) : f.foraDoPonto ? (
        <Secao titulo="Ponto">
          <p className="text-sm text-neutral-500">
            Fora do ponto: está no Secullum, mas não conta no absenteísmo, banco
            de horas e extras do Painel, Jornada e Gestão, e a sincronização não
            calcula o ponto dela.
          </p>
          {editar && (
            <ForaDoPonto
              id={f.id}
              fora={false}
              rotulo="Voltar a contar no ponto"
            />
          )}
        </Secao>
      ) : aviso.semDado || !t ? (
        <Secao titulo={`Ponto de ${rotulo}`}>
          <p className="text-sm text-neutral-500">
            {aviso.semDado ?? "Sem ponto desta pessoa no período."}
          </p>
        </Secao>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CartaoIndicador
              titulo="Horas trabalhadas"
              tom="escuro"
              valor={formatarHoras(ponto.normais_min)}
              detalhe={`de ${formatarHoras(t.previstas_min)} previstas · ${rotulo}`}
              serie={serie((m) => m.normais_min)}
            />
            <CartaoIndicador
              titulo="Faltas e atrasos"
              valor={formatarHoras(t.faltas_min + t.atrasos_min)}
              detalhe={`Absenteísmo ${formatarPct(absenteismo(t))} · faltas ${formatarHoras(t.faltas_min)}, atrasos ${formatarHoras(t.atrasos_min)}`}
              serie={serie((m) => m.faltas_min + m.atrasos_min)}
            />
            <CartaoIndicador
              titulo="Horas extras"
              valor={formatarHoras(extrasDe(t).total)}
              detalhe={
                [
                  emReais.extras,
                  ...Object.entries(extrasDe(t).porTipo).map(
                    ([tipo, min]) => `${tipo} ${formatarHoras(min)}`,
                  ),
                ]
                  .filter(Boolean)
                  .join(" · ") || "Nenhuma no período"
              }
              serie={serie((m) => extrasDe(m).total)}
            />
            <CartaoIndicador
              titulo="Banco de horas"
              tom="verde"
              valor={formatarHoras(t.banco_saldo_min)}
              detalhe={[
                emReais.banco,
                `Saldo no fim do período · créditos ${formatarHoras(t.banco_creditos_min)}, débitos ${formatarHoras(t.banco_debitos_min)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
              serie={serie((m) => m.banco_saldo_min)}
            />
          </div>
          {aviso.parcial && <Nota>{aviso.parcial}.</Nota>}

          <BatidasDoPeriodo dias={ponto.dias} rotulo={rotulo} />
        </>
      )}

      {verSalario ? (
        <FolhaECusto
          folha={folha}
          rubricas={rubricas}
          custo={custo}
          custos={custos ?? []}
          mes={mes}
        />
      ) : (
        <Secao titulo="Salário e custo">
          <p className="text-sm text-neutral-500">
            Salário, rubricas da folha e custo individual exigem a permissão
            “Ver salário e custo individual”. Peça ao administrador.
          </p>
        </Secao>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {f.noPonto && !f.foraDoPonto && mensal.length > 0 && (
          <Secao
            titulo="Ponto mês a mês"
            descricao="Totais do Secullum; clique no mês para filtrar"
            className="xl:col-span-3"
          >
            <Tabela
              colunas={colunasMes}
              linhas={mensal}
              chave={(m) => m.competencia}
              classeDaLinha={(m) =>
                doPeriodo.has(m.competencia) ? "bg-white/60 font-medium" : ""
              }
            />
          </Secao>
        )}
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Secao titulo="Afastamentos" descricao="Do ponto (Secullum)">
            <Tabela
              colunas={COLUNAS_AFASTAMENTO}
              linhas={afastamentos}
              chave={(a) => `${a.inicio}:${a.justificativa ?? a.motivo}`}
              vazio="Nenhum afastamento registrado."
            />
          </Secao>
          {beneficios ? (
            <Beneficios {...beneficios} hoje={hoje} />
          ) : (
            <Secao titulo="Benefícios e dependentes">
              <p className="text-sm text-neutral-500">
                Exige a permissão de benefícios.
              </p>
            </Secao>
          )}
        </div>
      </div>

      <Nota>
        Fonte: Secullum Ponto Web (batidas, horas, banco e afastamentos),
        sincronizado todo dia; o dia de hoje entra amanhã. Cadastro pelo
        Copiloto RH; cargo, salário e rubricas pela folha importada; custo
        calculado pelo sistema.
      </Nota>

      {editar && f.noPonto && !f.foraDoPonto && (
        <ForaDoPonto
          id={f.id}
          fora
          rotulo="Tirar do ponto"
          confirmar={`Tirar ${f.nome} do ponto? Deixa de contar no absenteísmo, banco de horas e extras, e a sincronização para de calcular o ponto dela. Dá para voltar aqui mesmo.`}
        />
      )}
    </div>
  );
}

/** Tira do ponto ou volta a contar (rh.parametros). */
function ForaDoPonto({
  id,
  fora,
  rotulo,
  confirmar,
}: {
  id: string;
  fora: boolean;
  rotulo: string;
  confirmar?: string;
}) {
  return (
    <FormAcao
      acao={marcarForaDoPonto}
      rotulo={rotulo}
      rotuloEnviando="Salvando…"
      variante="secundario"
      confirmar={confirmar}
      className="mt-3"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="fora" value={fora ? "sim" : "nao"} />
    </FormAcao>
  );
}

function Dados({
  f,
  folha,
  hoje,
}: {
  f: PerfilDoFuncionario;
  folha: FolhaDoFuncionario | null;
  hoje: string;
}) {
  const dados: [string, React.ReactNode][] = [
    ["Matrícula", f.matricula ?? "—"],
    ["Departamento", f.departamento],
    ["Cargo", f.cargo ? emTitulo(f.cargo) : "—"],
    ["Contrato", contrato(f.tipo_contrato)],
    ["Admissão", formatarData(f.admissao)],
    [
      "Tempo de casa",
      f.admissao
        ? formatarTempoDeCasa(
            Math.max(mesesDeCasa(f.admissao, f.desligamento ?? hoje), 0),
          )
        : "—",
    ],
    ["Idade", f.nascimento ? `${idadeEm(f.nascimento, hoje)} anos` : "—"],
    [
      "Jornada (folha)",
      folha?.horas_mes_min ? `${formatarHoras(folha.horas_mes_min)}/mês` : "—",
    ],
    [
      "Fontes",
      ["Copiloto RH", f.noPonto && "Ponto", f.tipo_contrato && "Folha"]
        .filter(Boolean)
        .join(" · ") || "—",
    ],
  ];
  if (f.desligamento) {
    dados.push(
      ["Desligamento", formatarData(f.desligamento)],
      ["Motivo", f.motivoDesligamento ?? "—"],
    );
  }
  return (
    <section
      aria-label="Dados do colaborador"
      className="vidro rounded-[1.75rem] p-5 md:p-6"
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
        {dados.map(([rotulo, valor]) => (
          <div key={rotulo} className="min-w-0">
            <dt className="text-xs text-neutral-500">{rotulo}</dt>
            <dd className="mt-1 break-words text-sm font-medium">{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const COLUNAS_DIA: Coluna<DiaDoPonto>[] = [
  {
    titulo: "Dia",
    valor: (d) => (
      <span className="whitespace-nowrap tabular-nums">
        {formatarData(d.data).slice(0, 5)}{" "}
        <span className="text-neutral-400">{diaDaSemana(d.data)}</span>
      </span>
    ),
  },
  { titulo: "Batidas", valor: (d) => <Batidas dia={d} /> },
  {
    titulo: "Previstas",
    valor: (d) => <Horas minutos={d.previstas_min} />,
    numero: true,
  },
  {
    titulo: "Trabalhadas",
    valor: (d) => <Horas minutos={d.normais_min} />,
    numero: true,
  },
  {
    titulo: "Extras",
    valor: (d) => <Horas minutos={extrasDe(d).total} />,
    numero: true,
  },
  {
    titulo: "Faltas",
    valor: (d) => <Horas minutos={d.faltas_min} />,
    numero: true,
  },
  {
    titulo: "Atrasos",
    valor: (d) => <Horas minutos={d.atrasos_min} />,
    numero: true,
  },
  {
    titulo: "Banco no dia",
    valor: (d) => {
      const mov = d.banco_creditos_min - d.banco_debitos_min;
      return mov ? comSinal(mov) : <Horas minutos={0} />;
    },
    numero: true,
  },
  {
    titulo: "Saldo do banco",
    valor: (d) => formatarHoras(d.banco_saldo_min),
    numero: true,
  },
];

function BatidasDoPeriodo({
  dias,
  rotulo,
}: {
  dias: DiaDoPonto[];
  rotulo: string;
}) {
  const soma = (v: (d: DiaDoPonto) => number) =>
    formatarHoras(dias.reduce((s, d) => s + v(d), 0));
  return (
    <Secao
      titulo={`Batidas · ${rotulo}`}
      descricao="Entrada e saída de cada período do dia; --:-- é batida que faltou"
      className={dias.length > 16 ? "flex h-[44rem] flex-col" : ""}
    >
      <Tabela
        rolar={dias.length > 16}
        colunas={COLUNAS_DIA}
        linhas={dias}
        chave={(d) => d.data}
        rodape={
          dias.length
            ? [
                `${dias.length} ${dias.length === 1 ? "dia" : "dias"}`,
                "",
                soma((d) => d.previstas_min),
                soma((d) => d.normais_min),
                soma((d) => extrasDe(d).total),
                soma((d) => d.faltas_min),
                soma((d) => d.atrasos_min),
                comSinal(
                  dias.reduce(
                    (s, d) => s + d.banco_creditos_min - d.banco_debitos_min,
                    0,
                  ),
                ),
                formatarHoras(dias.at(-1)?.banco_saldo_min ?? 0),
              ]
            : undefined
        }
        vazio="Sem batidas guardadas no período: o dia a dia existe desde set/2026. Os totais acima vêm do total de cada mês."
        classeDaLinha={(d) =>
          d.faltas_min > 0
            ? "bg-red-500/[0.06]"
            : fimDeSemana(d.data) || (d.ocorrencia && d.previstas_min === 0)
              ? "text-neutral-400"
              : ""
        }
      />
    </Secao>
  );
}

/** Pares de entrada → saída do dia, ou a justificativa (folga, feriado…). */
function Batidas({ dia }: { dia: DiaDoPonto }) {
  const pares = paresDeBatidas(dia.batidas);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {dia.ocorrencia && (
        <span className="rounded-full bg-neutral-900/[0.06] px-2 py-0.5 text-xs font-medium text-neutral-600">
          {rotuloOcorrencia(dia.ocorrencia)}
        </span>
      )}
      {pares.map((p, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a posição do par (1º, 2º período) é a identidade
          key={i}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white/70 px-2 py-0.5 text-xs tabular-nums ring-1 ring-neutral-900/10"
        >
          <Hora valor={p.entrada} />
          <span aria-hidden className="text-neutral-400">
            →
          </span>
          <span className="sr-only">até</span>
          <Hora valor={p.saida} />
        </span>
      ))}
      {!dia.ocorrencia && pares.length === 0 && (
        <span className="text-xs text-neutral-400">Sem batidas</span>
      )}
    </span>
  );
}

function Hora({ valor }: { valor: string | null }) {
  if (valor) return <span>{valor}</span>;
  return (
    <span className="font-semibold text-amber-700">
      --:--<span className="sr-only"> (batida faltando)</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Folha e custo (rh.custo_pessoal.individual)
// ---------------------------------------------------------------------------

const ORDEM_NATUREZA = { provento: 0, desconto: 1, informativa: 2 };

const COLUNAS_RUBRICA: Coluna<RubricaDoFuncionario>[] = [
  { titulo: "Cód.", valor: (r) => r.codigo, numero: true },
  {
    titulo: "Rubrica",
    valor: (r) => (
      <span>
        {r.descricao}
        <span className="block text-xs text-neutral-500">
          {GRUPOS_RUBRICA[r.grupo as GrupoRubrica] ?? r.grupo}
        </span>
      </span>
    ),
  },
  {
    titulo: "Ref.",
    valor: (r) =>
      r.referencia === null
        ? ""
        : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(
            r.referencia,
          ),
    numero: true,
  },
  {
    titulo: "Provento",
    valor: (r) => (r.natureza === "provento" ? formatarMoeda(r.valor) : ""),
    numero: true,
  },
  {
    titulo: "Desconto",
    valor: (r) => (r.natureza === "desconto" ? formatarMoeda(r.valor) : ""),
    numero: true,
  },
  {
    titulo: "Informativa",
    valor: (r) =>
      r.natureza === "informativa" ? (
        <span className="text-neutral-500">{formatarMoeda(r.valor)}</span>
      ) : (
        ""
      ),
    numero: true,
  },
];

const COLUNAS_CUSTO: Coluna<CustoDoMes>[] = [
  { titulo: "Mês", valor: (c) => formatarMes(c.competencia) },
  {
    titulo: "Remuneração",
    valor: (c) => formatarMoeda(c.remuneracao),
    numero: true,
  },
  { titulo: "Encargos", valor: (c) => formatarMoeda(c.encargos), numero: true },
  {
    titulo: "Provisões",
    valor: (c) => formatarMoeda(c.provisoes),
    numero: true,
  },
  {
    titulo: "Benefícios",
    valor: (c) => formatarMoeda(c.beneficios),
    numero: true,
  },
  {
    titulo: "Custo total",
    valor: (c) => <strong>{formatarMoeda(c.custo_total)}</strong>,
    numero: true,
  },
  {
    titulo: "Custo/hora",
    valor: (c) => formatarMoeda(c.custo_hora),
    numero: true,
  },
];

function FolhaECusto({
  folha,
  rubricas,
  custo,
  custos,
  mes,
}: {
  folha: FolhaDoFuncionario | null;
  rubricas: RubricaDoFuncionario[];
  custo: CustoDoMes | null;
  custos: CustoDoMes[];
  mes: string;
}) {
  if (!folha) {
    return (
      <Secao titulo="Salário e custo">
        <p className="text-sm text-neutral-500">
          Esta pessoa não está em nenhuma folha importada.
        </p>
      </Secao>
    );
  }
  const total = (n: RubricaDoFuncionario["natureza"]) =>
    rubricas.filter((r) => r.natureza === n).reduce((s, r) => s + r.valor, 0);
  const outroMes = folha.competencia.slice(0, 7) !== mes.slice(0, 7);
  const descricao = [
    outroMes &&
      `Sem folha de ${formatarMes(mes)}: mostrando a última antes do período`,
    folha.ficticia &&
      "Folha do protótipo: o salário real foi trocado por R$ 2.000,00 e o resto reescalado",
  ]
    .filter(Boolean)
    .join(". ");

  const resumo: [string, string][] = [
    ["Salário", formatarMoeda(folha.salario)],
    ["Situação na folha", ROTULO_SITUACAO[folha.situacao] ?? folha.situacao],
    ["Contrato", contrato(folha.tipo_contrato)],
    ["Cargo na folha", folha.cargo ? emTitulo(folha.cargo) : "—"],
    ["Base INSS", formatarMoeda(folha.base_inss)],
    ["Base FGTS", formatarMoeda(folha.base_fgts)],
    ["FGTS do mês", formatarMoeda(folha.valor_fgts)],
    ["Líquido", formatarMoeda(folha.liquido)],
  ];

  return (
    <>
      <Secao
        titulo={`Folha de ${formatarMes(folha.competencia)}`}
        tom="verde"
        descricao={descricao || undefined}
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 2xl:grid-cols-8">
          {resumo.map(([rotulo, valor]) => (
            <div key={rotulo} className="min-w-0">
              <dt className="text-xs text-neutral-500">{rotulo}</dt>
              <dd className="mt-1 text-sm font-medium tabular-nums">{valor}</dd>
            </div>
          ))}
        </dl>
      </Secao>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Secao
          titulo="Rubricas"
          descricao="Como veio no Extrato Mensal, com o grupo que define como entra no custo"
        >
          <Tabela
            colunas={COLUNAS_RUBRICA}
            linhas={[...rubricas].sort(
              (a, b) =>
                ORDEM_NATUREZA[a.natureza] - ORDEM_NATUREZA[b.natureza] ||
                a.codigo - b.codigo,
            )}
            chave={(r) => `${r.codigo}:${r.natureza}:${r.valor}`}
            vazio="Nenhuma rubrica nesta folha."
            rodape={[
              "",
              "Totais",
              "",
              formatarMoeda(total("provento")),
              formatarMoeda(total("desconto")),
              "",
            ]}
          />
        </Secao>

        <Secao
          titulo={`Custo de ${formatarMes(folha.competencia)}`}
          tom="escuro"
          descricao={
            custo
              ? `${formatarMoeda(custo.custo_total)} no mês · ${formatarMoeda(custo.custo_hora)} por hora · salário/hora ${formatarMoeda(custo.salario_hora)}`
              : "Custo ainda não calculado para esta folha"
          }
        >
          {custo && (
            <div className="flex flex-col gap-4">
              <Tabela
                colunas={[
                  { titulo: "Linha da conta", valor: (l) => l.rotulo },
                  {
                    titulo: "Valor",
                    valor: (l) => formatarMoeda(l.valor),
                    numero: true,
                  },
                  {
                    titulo: "Regra",
                    valor: (l) => (
                      <span className="text-xs text-neutral-500">
                        {l.regra}
                      </span>
                    ),
                  },
                ]}
                linhas={custo.memoria.linhas.map((l, i) => ({ ...l, i }))}
                chave={(l) => String(l.i)}
                rodape={["Custo total", formatarMoeda(custo.custo_total), ""]}
              />
              {custo.memoria.pendencias.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-amber-700">
                  {custo.memoria.pendencias.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Secao>
      </div>

      {custos.length > 1 && (
        <Secao titulo="Custo mês a mês">
          <Tabela
            colunas={COLUNAS_CUSTO}
            linhas={custos}
            chave={(c) => c.competencia}
          />
        </Secao>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Afastamentos e benefícios
// ---------------------------------------------------------------------------

const COLUNAS_AFASTAMENTO: Coluna<Afastamento>[] = [
  {
    titulo: "Período",
    valor: (a) =>
      a.inicio === a.fim
        ? formatarData(a.inicio)
        : `${formatarData(a.inicio)} a ${formatarData(a.fim)}`,
  },
  {
    titulo: "Dias",
    valor: (a) =>
      Math.round((Date.parse(a.fim) - Date.parse(a.inicio)) / 86_400_000 + 1),
    numero: true,
  },
  {
    titulo: "Motivo",
    valor: (a) => a.justificativa ?? a.motivo ?? "—",
  },
];

function Beneficios({
  beneficios,
  dependentes,
  hoje,
}: NonNullable<Awaited<ReturnType<typeof beneficiosDe>>> & { hoje: string }) {
  return (
    <Secao titulo="Benefícios e dependentes">
      {beneficios.length === 0 && dependentes.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nenhum benefício ou dependente cadastrado para esta pessoa. O vínculo
          é feito em RH › Configurações › Cadastros.
        </p>
      ) : (
        <ul className="flex flex-col gap-3 text-sm">
          {beneficios.map((b) => (
            <li
              key={`${b.nome}:${b.desde}`}
              className="flex justify-between gap-3"
            >
              <span>
                <span className="font-medium">{b.nome}</span>
                <span className="block text-xs text-neutral-500">
                  {TIPOS_BENEFICIO[b.tipo as TipoBeneficio] ?? b.tipo} ·{" "}
                  {b.ate
                    ? `${formatarData(b.desde)} a ${formatarData(b.ate)}`
                    : `desde ${formatarData(b.desde)}`}
                </span>
              </span>
              <span className="text-right tabular-nums">
                {b.valor === null ? "pela faixa" : formatarMoeda(b.valor)}
                {b.manual && (
                  <span className="block text-xs text-neutral-500">
                    valor da pessoa
                  </span>
                )}
              </span>
            </li>
          ))}
          {dependentes.map((d) => (
            <li key={`dep:${d.nome}`} className="flex justify-between gap-3">
              <span>
                {d.nome}{" "}
                <span className="text-xs text-neutral-500">
                  (dependente
                  {d.nascimento ? `, ${idadeEm(d.nascimento, hoje)} anos` : ""})
                </span>
              </span>
              <span className="text-xs text-neutral-500">
                {[d.tem_plano && "Plano", d.tem_odonto && "Odonto"]
                  .filter(Boolean)
                  .join(" · ") || "Sem plano"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-28" />
      <CartaoCarregando altura="h-24" />
      <FiltrosCarregando />
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-[44rem]" />
      <CartaoCarregando altura="h-48" />
    </TelaCarregando>
  );
}
