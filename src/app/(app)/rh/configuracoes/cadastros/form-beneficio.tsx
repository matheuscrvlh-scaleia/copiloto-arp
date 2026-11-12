import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Selecao } from "@/components/selecao";
import { formatarNumero } from "@/lib/formato";
import { salvarBeneficio } from "@/server/rh/acoes/cadastros";
import {
  type Beneficio,
  REGRAS_DEPENDENTE,
  TIPOS_BENEFICIO,
} from "@/server/rh/beneficios";
import { CamposRateio } from "./campos-rateio";

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const valorBr = (v: number | null) => (v === null ? "" : formatarNumero(v, 2));
const titulo = "text-sm font-medium text-neutral-900";

/**
 * Cadastro (sem `beneficio`) ou edição do benefício, em três partes: o que
 * é, de onde sai o valor e como o funcionário paga.
 */
export function FormBeneficio({
  beneficio: b,
  departamentos,
}: {
  beneficio?: Beneficio;
  /** Opções do "Dividir entre: um departamento" (só os ativos). */
  departamentos: { valor: string; rotulo: string }[];
}) {
  return (
    <FormAcao
      acao={salvarBeneficio}
      rotulo={b ? "Salvar benefício" : "Cadastrar e abrir"}
      className="flex flex-col gap-6"
    >
      {b && <input type="hidden" name="id" value={b.id} />}

      <fieldset className="flex flex-col gap-3">
        <legend className={titulo}>O benefício</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className={rotulo}>
            Nome
            <input
              name="nome"
              required
              defaultValue={b?.nome ?? ""}
              placeholder="Ex.: Unimed"
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Tipo
            <Selecao
              name="tipo"
              obrigatorio
              rotulo="Tipo do benefício"
              valorInicial={b?.tipo ?? ""}
              opcoes={Object.entries(TIPOS_BENEFICIO).map(([valor, r]) => ({
                valor,
                rotulo: r,
              }))}
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={b?.ativo ?? true}
              className="size-4 accent-neutral-900"
            />
            Ativo
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={titulo}>Forma de cálculo</legend>
        <CamposRateio
          forma={b?.forma_calculo ?? "por_funcionario"}
          dividirEntre={b?.dividir_entre ?? null}
          departamentoId={b?.dividir_departamento_id ?? null}
          departamentos={departamentos}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={titulo}>Valor</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <label className={rotulo}>
            Valor mensal (R$) · no rateado, o total do mês
            <input
              name="valor_padrao"
              inputMode="decimal"
              defaultValue={valorBr(b?.valor_padrao ?? null)}
              placeholder="vazio no plano e no odonto: sai da tabela de faixas"
              className={classeCampo}
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
            <input
              type="checkbox"
              name="valor_por_mes"
              defaultChecked={b?.valor_por_mes ?? false}
              className="size-4 accent-neutral-900"
            />
            Valor varia por mês (lançado mês a mês)
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={titulo}>Desconto na folha e dependentes</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={rotulo}>
            Rubricas do titular (desconto)
            <input
              name="rubricas_desconto"
              defaultValue={b?.rubricas_desconto.join(", ") ?? ""}
              placeholder="ex.: 307, 8111"
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Rubricas dos dependentes
            <input
              name="rubricas_desconto_dependente"
              defaultValue={b?.rubricas_desconto_dependente.join(", ") ?? ""}
              placeholder="ex.: 490"
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Empresa paga do dependente
            <Selecao
              name="dependente_regra"
              rotulo="Quanto a empresa paga do dependente"
              valorInicial={b?.dependente_regra ?? "nao_paga"}
              opcoes={Object.entries(REGRAS_DEPENDENTE).map(([valor, r]) => ({
                valor,
                rotulo: r,
              }))}
            />
          </label>
          <label className={rotulo}>
            % ou valor do dependente
            <input
              name="dependente_valor"
              inputMode="decimal"
              defaultValue={valorBr(b?.dependente_valor ?? null)}
              placeholder="se a empresa paga"
              className={classeCampo}
            />
          </label>
        </div>
      </fieldset>
    </FormAcao>
  );
}
