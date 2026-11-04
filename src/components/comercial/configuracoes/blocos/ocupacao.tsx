import { Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import {
  incluirTipoLuc,
  salvarTiposLuc,
} from "@/server/comercial/acoes/parametros";
import type { Parametros, TipoLuc } from "@/server/comercial/base";
import { Campo, FormBloco, grade, Marcar, rotulo } from "../campos";
import { separador } from "./comum";

export function BlocoOcupacao({
  parametros: p,
  tipos,
  tiposDoEnet,
}: {
  parametros: Parametros;
  tipos: TipoLuc[];
  /** Tipos de LUC que aparecem no ENET. */
  tiposDoEnet: string[];
}) {
  const cadastrados = new Set(tipos.map((t) => t.tipo));
  const novos = tiposDoEnet.filter((t) => !cadastrados.has(t));
  return (
    <>
      <Secao
        titulo="Ocupação e curva da carteira"
        descricao="A faixa B precisa ser maior que a faixa A. Transferência: saída e entrada do mesmo locatário dentro desse número de dias não contam como churn."
      >
        <FormBloco bloco="ocupacao" className={grade}>
          <Campo
            nome="transferencia_dias"
            valor={p.transferencia_dias}
            numero
          />
          <Campo nome="curva_a_pct" valor={p.curva_a_pct} numero />
          <Campo nome="curva_b_pct" valor={p.curva_b_pct} numero />
        </FormBloco>
      </Secao>

      <Secao
        titulo="Tipos de LUC que contam na ocupação"
        descricao="Desmarcados (ex.: áreas publicitárias e vagas) ficam fora da ocupação e do estoque."
      >
        {novos.length > 0 && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-amber-400/15 px-3 py-2 text-sm text-amber-800"
          >
            Tipos do ENET ainda não cadastrados: {novos.join(", ")}. Inclua
            abaixo para decidir se contam.
          </p>
        )}
        <FormAcao acao={salvarTiposLuc} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {tipos.map((t) => (
              <div key={t.tipo}>
                <input type="hidden" name="tipos" value={t.tipo} />
                <Marcar
                  nome={`conta.${t.tipo}`}
                  marcado={t.conta_ocupacao}
                  texto={t.tipo}
                />
              </div>
            ))}
          </div>
        </FormAcao>
        <FormAcao
          acao={incluirTipoLuc}
          rotulo="Incluir tipo"
          rotuloEnviando="Incluindo…"
          className={`${separador} grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,20rem)_auto_auto]`}
        >
          <label className={rotulo}>
            Tipo de LUC (como no ENET)
            <input
              name="tipo"
              required
              maxLength={80}
              list="tipos-enet-novos"
              className={classeCampo}
            />
            <datalist id="tipos-enet-novos">
              {novos.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <Marcar nome="conta_ocupacao" marcado texto="Conta na ocupação" />
        </FormAcao>
      </Secao>
    </>
  );
}
