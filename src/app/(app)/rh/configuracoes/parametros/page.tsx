import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao, Tabela } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Protegido } from "@/components/protegido";
import { Selecao } from "@/components/selecao";
import {
  competenciaDe,
  formatarDataHora,
  formatarHoras,
  formatarMes,
  formatarNumero,
} from "@/lib/formato";
import {
  INDICADORES_RH,
  type IndicadorRh,
  metaVigente,
} from "@/lib/indicadores";
import { metasDoRh } from "@/server/rh/dados";
import { dadosDosParametros, type NivelJornada } from "@/server/rh/parametros";
import {
  removerJornada,
  salvarEmpresa,
  salvarEncargos,
  salvarJornada,
  salvarMeta,
} from "./actions";

export const metadata: Metadata = { title: "Parâmetros do RH" };

// Valores que entram nas contas e no semáforo (cadastros ficam na aba
// Cadastros). Nada fica fixo no código; toda alteração fica registrada.

/** Atalhos no topo, na ordem das seções. */
const INDICE = [
  ["jornada", "Jornada"],
  ["empresa", "RAT e FAP"],
  ["banco-de-horas", "Banco de horas"],
  ["encargos", "Encargos e provisões"],
  ["metas", "Metas e semáforo"],
  ["historico", "Histórico"],
] as const;

const NIVEIS: Record<NivelJornada, string> = {
  empresa: "Empresa",
  departamento: "Departamento",
  cargo: "Cargo",
  colaborador: "Funcionário",
};

const CONTRATOS: Record<string, string> = {
  clt: "CLT",
  aprendiz: "Jovem aprendiz",
  estagiario: "Estagiário",
  pj: "PJ",
  pro_labore: "Pró-labore",
};

const TABELAS: Record<string, string> = {
  "rh.parametros_empresa": "Empresa (RAT, FAP, banco de horas)",
  "rh.encargos_por_contrato": "Encargos",
  "rh.departamentos": "Departamentos",
  "rh.motivos_desligamento": "Motivos de desligamento",
  "rh.rubricas": "Rubricas",
  "rh.jornadas": "Jornadas",
  "rh.beneficios": "Benefícios",
  "rh.colaborador_beneficios": "Benefício de funcionário",
  "rh.plano_tabelas": "Tabela do plano de saúde",
  "rh.dados_financeiros_mensais": "Faturamento e dados financeiros",
  "core.metas": "Metas",
};

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export default function Page() {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Protegido permissao="rh.parametros">
        <Parametros />
      </Protegido>
    </Suspense>
  );
}

async function Parametros() {
  const [dados, metas] = await Promise.all([dadosDosParametros(), metasDoRh()]);
  const mesAtual = competenciaDe(new Date());
  const e = dados.empresa;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ir para" className="flex flex-wrap gap-2">
        {INDICE.map(([id, nome]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-full bg-white/60 px-3 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-900/[0.06] transition hover:bg-neutral-900 hover:text-white"
          >
            {nome}
          </a>
        ))}
      </nav>

      <Secao
        id="jornada"
        titulo="Jornada"
        tom="escuro"
        descricao={`Horas por mês, usadas no custo por hora e no salário por hora. Vale a mais específica: funcionário, cargo, departamento e, por último, a empresa; sem nenhuma, a "Horas Mês" da folha. Alterações valem a partir de ${formatarMes(mesAtual)}.`}
      >
        <FormAcao
          acao={salvarJornada}
          className="grid items-end gap-3 sm:grid-cols-[1fr_9rem_auto]"
        >
          <label className={rotulo}>
            Para quem
            <Selecao
              name="alvo"
              obrigatorio
              placeholder="Empresa, departamento, cargo ou funcionário"
              opcoes={[
                {
                  valor: "empresa",
                  rotulo: "Empresa (todos)",
                  descricao: NIVEIS.empresa,
                },
                ...dados.departamentos.map((d) => ({
                  valor: `departamento:${d.id}`,
                  rotulo: d.nome,
                  descricao: NIVEIS.departamento,
                })),
                ...dados.cargos.map((c) => ({
                  valor: `cargo:${c.id}`,
                  rotulo: c.nome,
                  descricao: NIVEIS.cargo,
                })),
                ...dados.colaboradoresAtivos.map((c) => ({
                  valor: `colaborador:${c.id}`,
                  rotulo: c.nome,
                  descricao: NIVEIS.colaborador,
                })),
              ]}
            />
          </label>
          <label className={rotulo}>
            Horas por mês
            <input
              name="horas"
              inputMode="decimal"
              placeholder="ex.: 220"
              className={classeCampo}
            />
          </label>
        </FormAcao>
        <div className="mt-6 flex flex-col divide-y divide-neutral-100">
          {dados.jornadas.length === 0 && (
            <p className="py-2 text-sm text-neutral-500">
              Nenhuma jornada configurada: todos usam a "Horas Mês" da folha.
            </p>
          )}
          {dados.jornadas.map((j) => (
            <FormAcao
              key={j.alvo}
              acao={removerJornada}
              rotulo="Remover"
              rotuloEnviando="Removendo…"
              variante="perigo"
              confirmar={`Remover a jornada de ${j.nome}? Quem ela cobre passa a seguir o nível de cima.`}
              className="grid items-center gap-3 py-3 sm:grid-cols-[1fr_7rem_7rem_auto]"
            >
              <input type="hidden" name="alvo" value={j.alvo} />
              <div>
                <p className="text-sm font-medium">{j.nome}</p>
                <p className="text-xs text-neutral-500">{NIVEIS[j.nivel]}</p>
              </div>
              <p className="text-sm tabular-nums">
                {formatarHoras(j.horas_mes_min)}
              </p>
              <p className="text-xs text-neutral-500">
                desde {formatarMes(j.vigente_desde)}
              </p>
            </FormAcao>
          ))}
        </div>
      </Secao>

      <Secao
        id="empresa"
        titulo="RAT, FAP e banco de horas"
        descricao={`Valem a partir de ${formatarMes(mesAtual)}${e ? `; último registro desde ${formatarMes(e.vigente_desde)}` : "; ainda não configurado"}.`}
      >
        <FormAcao acao={salvarEmpresa} className="flex flex-col gap-4">
          <p className="text-sm font-medium">Encargos da empresa</p>
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
          </div>
          {e && (
            <p className="text-xs text-neutral-500">
              RAT ajustado (RAT × FAP):{" "}
              {formatarNumero(Number(e.rat_pct) * Number(e.fap), 2)}%
            </p>
          )}
          <p
            id="banco-de-horas"
            className="scroll-mt-6 border-t border-neutral-100 pt-4 text-sm font-medium"
          >
            Banco de horas
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </FormAcao>
      </Secao>

      <Secao
        id="encargos"
        titulo="Encargos e provisões por tipo de contrato"
        descricao={`Percentuais sobre a remuneração. Sobre as provisões incidem os mesmos encargos. Valores de referência da especificação: confirme antes do primeiro fechamento. Alterações valem a partir de ${formatarMes(mesAtual)}.`}
      >
        <div className="flex flex-col divide-y divide-neutral-100">
          {dados.encargos.length === 0 && (
            <p className="py-2 text-sm text-neutral-500">
              Nenhum tipo de contrato com encargos cadastrados.
            </p>
          )}
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
              <p className="text-xs font-medium text-neutral-500">Encargos</p>
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4">
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
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    name="aplica_rat"
                    defaultChecked={c.aplica_rat}
                    className="size-4 accent-neutral-900"
                  />
                  Aplica RAT × FAP
                </label>
              </div>
              <p className="text-xs font-medium text-neutral-500">Provisões</p>
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4">
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    name="provisiona_13"
                    defaultChecked={c.provisiona_13}
                    className="size-4 accent-neutral-900"
                  />
                  Provisiona 13º
                </label>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    name="provisiona_ferias"
                    defaultChecked={c.provisiona_ferias}
                    className="size-4 accent-neutral-900"
                  />
                  Provisiona férias + 1/3
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
            </FormAcao>
          ))}
        </div>
      </Secao>

      <Secao
        id="metas"
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
        id="historico"
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

/** Blocos no lugar dos cartões da tela enquanto os dados chegam. */
function Esqueleto() {
  return (
    <TelaCarregando>
      {Array.from({ length: 4 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocos fixos, a posição é a identidade
        <CartaoCarregando key={i} altura="h-56" />
      ))}
    </TelaCarregando>
  );
}
