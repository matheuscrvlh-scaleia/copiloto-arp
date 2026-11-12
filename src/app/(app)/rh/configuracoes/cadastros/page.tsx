import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao, Tabela } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { SemAcesso } from "@/components/protegido";
import { Selecao } from "@/components/selecao";
import { competenciaDe, formatarMes, formatarMoeda } from "@/lib/formato";
import {
  GRUPOS_CLASSIFICAVEIS,
  GRUPOS_RUBRICA,
  type GrupoRubrica,
} from "@/lib/rh/rubricas";
import { pode } from "@/server/auth";
import {
  salvarDepartamento,
  salvarFinanceiro,
  trocarGrupoRubrica,
} from "@/server/rh/acoes/cadastros";
import { departamentosDoRh, rubricasDoRh } from "@/server/rh/configuracao";
import { dadosFinanceiros } from "@/server/rh/dados";
import { Beneficios } from "./beneficios";

export const metadata: Metadata = { title: "Cadastros do RH" };

// Cadastros manuais: o que não vem de integração nem de arquivo. Cada bloco
// aparece para quem tem a permissão dele.

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export default function Page() {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Cadastros />
    </Suspense>
  );
}

async function Cadastros() {
  const [beneficios, parametros] = await Promise.all([
    pode("rh.beneficios"),
    pode("rh.parametros"),
  ]);
  if (!beneficios && !parametros) return <SemAcesso />;
  const indice = [
    ...(beneficios ? [["beneficios", "Benefícios"]] : []),
    ...(parametros
      ? [
          ["financeiro", "Faturamento do mês"],
          ["departamentos", "Departamentos"],
          ["rubricas", "Rubricas"],
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ir para" className="flex flex-wrap gap-2">
        {indice.map(([id, nome]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-full bg-white/60 px-3 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-900/[0.06] transition hover:bg-neutral-900 hover:text-white"
          >
            {nome}
          </a>
        ))}
      </nav>
      {beneficios && <Beneficios />}
      {parametros && <Financeiro />}
      {parametros && <Estrutura />}
    </div>
  );
}

/** Faturamento e dados financeiros do mês, até a integração com o ENET. */
async function Financeiro() {
  const linhas = await dadosFinanceiros();
  const atual = competenciaDe(new Date());
  return (
    <Secao
      id="financeiro"
      titulo="Faturamento e dados financeiros do mês"
      descricao="Lançamento manual até a integração com o ENET. O faturamento bruto libera o % do custo de pessoal sobre a receita; os demais, os indicadores de retorno do capital humano. Lançar de novo o mesmo mês substitui."
    >
      <FormAcao
        acao={salvarFinanceiro}
        rotulo="Salvar mês"
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <label className={rotulo}>
            Mês
            <input
              type="month"
              name="competencia"
              required
              defaultValue={atual.slice(0, 7)}
              className={classeCampo}
            />
          </label>
          {(
            [
              ["faturamento_bruto", "Faturamento bruto"],
              ["custo_despesa_total", "Custo + despesa total"],
              ["custos_operacionais_sem_pessoal", "Custos sem pessoal"],
              ["lucro", "Lucro do mês"],
            ] as const
          ).map(([campo, nome]) => (
            <label key={campo} className={rotulo}>
              {nome} (R$)
              <input
                name={campo}
                inputMode="decimal"
                placeholder="opcional"
                className={classeCampo}
              />
            </label>
          ))}
        </div>
      </FormAcao>
      {linhas.length > 0 && (
        <div className="mt-6">
          <Tabela
            colunas={[
              { titulo: "Mês", valor: (l) => formatarMes(l.competencia) },
              {
                titulo: "Faturamento bruto",
                valor: (l) => formatarMoeda(l.faturamento_bruto, 0),
                numero: true,
              },
              {
                titulo: "Custo + despesa",
                valor: (l) => formatarMoeda(l.custo_despesa_total, 0),
                numero: true,
              },
              {
                titulo: "Sem pessoal",
                valor: (l) =>
                  formatarMoeda(l.custos_operacionais_sem_pessoal, 0),
                numero: true,
              },
              {
                titulo: "Lucro",
                valor: (l) => formatarMoeda(l.lucro, 0),
                numero: true,
              },
              {
                titulo: "Origem",
                valor: (l) => (l.origem === "enet" ? "ENET" : "Manual"),
              },
            ]}
            linhas={linhas}
            chave={(l) => l.competencia}
          />
        </div>
      )}
    </Secao>
  );
}

/** Departamentos e rubricas (vieram de Parâmetros), do cache do módulo. */
async function Estrutura() {
  const [departamentos, rubricas] = await Promise.all([
    departamentosDoRh(),
    rubricasDoRh(),
  ]);
  const dados = { departamentos, rubricas };
  return (
    <>
      <Secao
        id="departamentos"
        titulo="Departamentos"
        descricao="O código da folha liga o departamento do ponto ao do Extrato Mensal (códigos 2 a 6)."
      >
        <div className="flex flex-col divide-y divide-neutral-100">
          {dados.departamentos.map((d) => (
            <FormAcao
              key={d.id}
              acao={salvarDepartamento}
              className="grid items-end gap-3 py-4 first:pt-0 sm:grid-cols-[1fr_8rem_6rem_auto]"
            >
              <input type="hidden" name="id" value={d.id} />
              <label className={rotulo}>
                Nome
                <input
                  name="nome"
                  defaultValue={d.nome}
                  className={classeCampo}
                />
              </label>
              <label className={rotulo}>
                Código na folha
                <input
                  name="codigo_folha"
                  inputMode="numeric"
                  defaultValue={d.codigo_folha ?? ""}
                  placeholder="—"
                  className={classeCampo}
                />
              </label>
              <label className={rotulo}>
                Id no ponto
                <input
                  value={d.secullum_id ?? "—"}
                  disabled
                  className={classeCampo}
                />
              </label>
            </FormAcao>
          ))}
        </div>
      </Secao>
      <Secao
        id="rubricas"
        titulo="Rubricas da folha"
        descricao={`${dados.rubricas.length} rubricas. Rubrica nova é classificada em Importações, logo depois de enviar a folha. Nos grupos que entram no custo, provento soma e desconto subtrai.`}
      >
        <FormAcao
          acao={trocarGrupoRubrica}
          rotulo="Trocar grupo"
          rotuloEnviando="Recalculando…"
          className="mb-4 grid items-end gap-3 rounded-2xl bg-neutral-900/[0.03] p-3 sm:grid-cols-[1fr_20rem_auto]"
        >
          <label className={rotulo}>
            Rubrica
            <Selecao
              name="codigo"
              obrigatorio
              busca
              rotulo="Rubrica"
              placeholder="Buscar pelo código ou nome…"
              opcoes={dados.rubricas.map((r) => ({
                valor: String(r.codigo),
                rotulo: `${r.codigo} · ${r.descricao}`,
                descricao: GRUPOS_RUBRICA[r.grupo as GrupoRubrica] ?? r.grupo,
              }))}
            />
          </label>
          <label className={rotulo}>
            Novo grupo
            <Selecao
              name="grupo"
              obrigatorio
              rotulo="Novo grupo"
              placeholder="Escolha o grupo…"
              opcoes={GRUPOS_CLASSIFICAVEIS.map((g) => ({
                valor: g,
                rotulo: GRUPOS_RUBRICA[g],
              }))}
            />
          </label>
        </FormAcao>
        <p className="-mt-2 mb-4 text-xs text-neutral-500">
          A troca vale para todos os meses: as folhas já importadas e ainda não
          fechadas são recalculadas na hora. Folha fechada não muda.
        </p>
        <div className="flex flex-col gap-2">
          {Object.entries(GRUPOS_RUBRICA).map(([grupo, nome]) => {
            const doGrupo = dados.rubricas.filter((r) => r.grupo === grupo);
            if (doGrupo.length === 0) return null;
            return (
              <details
                key={grupo}
                className="rounded-2xl bg-neutral-50 px-4 py-3"
              >
                <summary className="cursor-pointer text-sm font-medium">
                  {nome}{" "}
                  <span className="font-normal text-neutral-500">
                    ({doGrupo.length})
                  </span>
                </summary>
                <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm text-neutral-600 sm:grid-cols-2 lg:grid-cols-3">
                  {doGrupo.map((r) => (
                    <li key={r.codigo}>
                      <span className="tabular-nums text-neutral-900">
                        {r.codigo}
                      </span>{" "}
                      · {r.descricao}
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      </Secao>
    </>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-56" />
      <CartaoCarregando />
      <CartaoCarregando />
    </TelaCarregando>
  );
}
