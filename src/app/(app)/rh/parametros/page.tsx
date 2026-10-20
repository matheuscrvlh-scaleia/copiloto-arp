import type { Metadata } from "next";
import { Suspense } from "react";
import { Nota, Secao, Tabela } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Selecao } from "@/components/selecao";
import {
  competenciaDe,
  formatarDataHora,
  formatarMes,
  formatarNumero,
} from "@/lib/formato";
import {
  INDICADORES_RH,
  type IndicadorRh,
  metaVigente,
} from "@/lib/indicadores";
import { ROTULO_TURNOVER, TIPOS_TURNOVER } from "@/lib/rh/turnover";
import { metasDoRh } from "@/server/rh/dados";
import { dadosDosParametros } from "@/server/rh/parametros";
import {
  salvarDepartamento,
  salvarEmpresa,
  salvarEncargos,
  salvarMeta,
  salvarMotivo,
} from "./actions";

export const metadata: Metadata = { title: "Parâmetros do RH" };

const CONTRATOS: Record<string, string> = {
  clt: "CLT",
  aprendiz: "Jovem aprendiz",
  estagiario: "Estagiário",
  pj: "PJ",
  pro_labore: "Pró-labore",
};

const GRUPOS: Record<string, string> = {
  salario: "Salário",
  pro_labore: "Pró-labore",
  adicional: "Adicionais",
  hora_extra: "Horas extras",
  adiantamento: "Adiantamento (não entra)",
  afastamento: "Afastamento (não entra)",
  rescisao: "Rescisão (custo)",
  pagamento_provisionado: "Férias e 13º pagos (consomem a provisão)",
  beneficio_desconto: "Desconto de benefício (reduz o custo)",
  desconto_terceiros: "Descontos de terceiros (não entra)",
  imposto_funcionario: "Impostos do funcionário (não entra)",
  arredondamento: "Arredondamentos (não entra)",
  reembolso_inss: "Reembolso do INSS (abate do custo)",
  nao_classificada: "Não classificada",
};

const TABELAS: Record<string, string> = {
  "rh.parametros_empresa": "Empresa (RAT, FAP, banco de horas)",
  "rh.encargos_por_contrato": "Encargos",
  "rh.departamentos": "Departamentos",
  "rh.motivos_desligamento": "Motivos de desligamento",
  "rh.rubricas": "Rubricas",
  "rh.jornadas": "Jornadas",
  "rh.beneficios": "Benefícios",
  "core.metas": "Metas",
};

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Parâmetros do RH"
        description="Nada fica fixo no código: estes valores alimentam os cálculos e o semáforo. Toda alteração fica registrada."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="rh.parametros">
          <Parametros />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Parametros() {
  const [dados, metas] = await Promise.all([dadosDosParametros(), metasDoRh()]);
  const mesAtual = competenciaDe(new Date());
  const e = dados.empresa;

  return (
    <div className="flex flex-col gap-6">
      <Secao
        titulo="Empresa"
        descricao={`RAT, FAP e ciclo do banco de horas. Valem a partir de ${formatarMes(mesAtual)}${e ? `; último registro desde ${formatarMes(e.vigente_desde)}` : "; ainda não configurado"}.`}
      >
        <FormAcao acao={salvarEmpresa} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className={rotulo}>
              RAT (%)
              <input
                name="rat_pct"
                inputMode="decimal"
                defaultValue={e?.rat_pct ?? ""}
                placeholder="1, 2 ou 3"
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              FAP
              <input
                name="fap"
                inputMode="decimal"
                defaultValue={e?.fap ?? ""}
                placeholder="entre 0,5 e 2,0"
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              Regime tributário
              <input
                name="regime_tributario"
                defaultValue={e?.regime_tributario ?? ""}
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              Início do ciclo do banco de horas
              <input
                type="date"
                name="banco_horas_inicio"
                defaultValue={e?.banco_horas_inicio ?? ""}
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              Fim do ciclo
              <input
                type="date"
                name="banco_horas_fim"
                defaultValue={e?.banco_horas_fim ?? ""}
                className={classeCampo}
              />
            </label>
            <label className={rotulo}>
              Adicional se o banco vencer (%)
              <input
                name="banco_horas_adicional_pct"
                inputMode="decimal"
                defaultValue={e?.banco_horas_adicional_pct ?? 50}
                className={classeCampo}
              />
            </label>
          </div>
          {e && (
            <p className="text-xs text-neutral-500">
              RAT ajustado (RAT × FAP):{" "}
              {formatarNumero(Number(e.rat_pct) * Number(e.fap), 2)}%
            </p>
          )}
        </FormAcao>
      </Secao>

      <Secao
        titulo="Metas e semáforo"
        descricao={`Até a meta: Ok. Até a faixa de atenção: Atenção. Depois dela: fora da meta. Valem a partir de ${formatarMes(mesAtual)}.`}
      >
        <div className="flex flex-col divide-y divide-neutral-100">
          {(Object.keys(INDICADORES_RH) as IndicadorRh[]).map((indicador) => {
            const def = INDICADORES_RH[indicador];
            const atual = metaVigente(metas, indicador, mesAtual);
            return (
              <FormAcao
                key={indicador}
                acao={salvarMeta}
                className="grid items-end gap-3 py-4 first:pt-0 sm:grid-cols-[1fr_8rem_8rem_auto]"
              >
                <input type="hidden" name="indicador" value={indicador} />
                <div>
                  <p className="text-sm font-medium">{def.nome}</p>
                  <p className="text-xs text-neutral-500">
                    {def.direcao === "menor_melhor"
                      ? "Menor é melhor"
                      : "Maior é melhor"}{" "}
                    · em {def.unidade}
                  </p>
                </div>
                <label className={rotulo}>
                  Meta
                  <input
                    name="meta"
                    inputMode="decimal"
                    defaultValue={atual?.meta ?? ""}
                    className={classeCampo}
                  />
                </label>
                <label className={rotulo}>
                  Atenção até
                  <input
                    name="limite_atencao"
                    inputMode="decimal"
                    defaultValue={atual?.limite_atencao ?? ""}
                    placeholder="opcional"
                    className={classeCampo}
                  />
                </label>
              </FormAcao>
            );
          })}
        </div>
      </Secao>

      <Secao
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
        titulo="Motivos de desligamento"
        descricao="Vêm do Secullum. A classificação decide como cada saída entra no turnover."
      >
        <div className="flex flex-col divide-y divide-neutral-100">
          {dados.motivos.map((m) => (
            <FormAcao
              key={m.id}
              acao={salvarMotivo}
              className="grid items-end gap-3 py-4 first:pt-0 sm:grid-cols-[1fr_16rem_auto]"
            >
              <input type="hidden" name="id" value={m.id} />
              <p className="text-sm">{m.descricao}</p>
              <label className={rotulo}>
                Tipo de turnover
                <Selecao
                  name="tipo_turnover"
                  valorInicial={m.tipo_turnover ?? ""}
                  opcoes={[
                    { valor: "", rotulo: "Sem classificação" },
                    ...TIPOS_TURNOVER.map((t) => ({
                      valor: t,
                      rotulo: ROTULO_TURNOVER[t] ?? t,
                    })),
                  ]}
                />
              </label>
            </FormAcao>
          ))}
        </div>
      </Secao>

      <Secao
        titulo="Encargos por tipo de contrato"
        descricao={`Percentuais sobre a remuneração. Sobre as provisões incidem os mesmos encargos. Valores de referência da especificação: confirme antes do primeiro fechamento. Alterações valem a partir de ${formatarMes(mesAtual)}.`}
      >
        <div className="flex flex-col divide-y divide-neutral-100">
          {dados.encargos.map((c) => (
            <FormAcao
              key={c.tipo_contrato}
              acao={salvarEncargos}
              className="flex flex-col gap-3 py-4 first:pt-0"
            >
              <input
                type="hidden"
                name="tipo_contrato"
                value={c.tipo_contrato}
              />
              <p className="text-sm font-medium">
                {CONTRATOS[c.tipo_contrato]}{" "}
                <span className="font-normal text-neutral-500">
                  · desde {formatarMes(c.vigente_desde)}
                </span>
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <label className={rotulo}>
                  INSS patronal (%)
                  <input
                    name="inss_patronal_pct"
                    inputMode="decimal"
                    defaultValue={c.inss_patronal_pct}
                    className={classeCampo}
                  />
                </label>
                <label className={rotulo}>
                  Terceiros (%)
                  <input
                    name="terceiros_pct"
                    inputMode="decimal"
                    defaultValue={c.terceiros_pct}
                    className={classeCampo}
                  />
                </label>
                <label className={rotulo}>
                  FGTS (%)
                  <input
                    name="fgts_pct"
                    inputMode="decimal"
                    defaultValue={c.fgts_pct}
                    className={classeCampo}
                  />
                </label>
                <label className={rotulo}>
                  Multa rescisória (% do FGTS)
                  <input
                    name="multa_rescisoria_pct"
                    inputMode="decimal"
                    defaultValue={c.multa_rescisoria_pct}
                    className={classeCampo}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="aplica_rat"
                    defaultChecked={c.aplica_rat}
                    className="size-4 accent-neutral-900"
                  />
                  Aplica RAT × FAP
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="provisiona_13"
                    defaultChecked={c.provisiona_13}
                    className="size-4 accent-neutral-900"
                  />
                  Provisiona 13º
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="provisiona_ferias"
                    defaultChecked={c.provisiona_ferias}
                    className="size-4 accent-neutral-900"
                  />
                  Provisiona férias
                </label>
              </div>
            </FormAcao>
          ))}
        </div>
      </Secao>

      <Secao
        titulo="Rubricas da folha"
        descricao={`${dados.rubricas.length} rubricas classificadas a partir da folha de 07/2026. A classificação de rubricas novas é feita na importação da folha.`}
      >
        <div className="flex flex-col gap-2">
          {Object.entries(GRUPOS).map(([grupo, nome]) => {
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

      <Secao
        titulo="Histórico de alterações"
        descricao="As 30 alterações mais recentes nos parâmetros."
      >
        <Tabela
          colunas={[
            {
              titulo: "Quando",
              valor: (a) => formatarDataHora(a.em),
              numero: true,
            },
            { titulo: "O quê", valor: (a) => TABELAS[a.tabela] ?? a.tabela },
            {
              titulo: "Ação",
              valor: (a) =>
                ({ insert: "Criou", update: "Alterou", delete: "Removeu" })[
                  a.acao
                ] ?? a.acao,
            },
            { titulo: "Por", valor: (a) => a.autor },
          ]}
          linhas={dados.auditoria}
          chave={(a) => String(a.id)}
          vazio="Nenhuma alteração registrada."
        />
      </Secao>

      <Nota>
        Os parâmetros com vigência guardam o valor de cada mês: recalcular um
        mês antigo usa o valor da época.
      </Nota>
    </div>
  );
}
