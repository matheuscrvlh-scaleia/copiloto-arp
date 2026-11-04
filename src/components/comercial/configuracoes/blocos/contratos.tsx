import { Nota, Secao } from "@/components/dashboard/tabela";
import { Selecao } from "@/components/selecao";
import {
  CAMPOS_GARANTIA,
  GARANTIAS,
  INDICES,
} from "@/lib/comercial/parametros";
import type { Parametros } from "@/server/comercial/base";
import { Campo, FormBloco, grade, Marcar, rotulo } from "../campos";
import { separador } from "./comum";

const subtitulo = "text-sm font-semibold";

export function BlocoContratos({ parametros: p }: { parametros: Parametros }) {
  const obrigatorios = (p.obrigatorios_garantia ?? {}) as Record<
    string,
    string[]
  >;
  return (
    <Secao
      titulo="Contratos"
      descricao="Valores que o assistente de contrato e o distrato trazem preenchidos. O contrato guarda o valor usado; mudar aqui não altera contratos já gerados."
    >
      <FormBloco bloco="contratos" className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h3 className={subtitulo}>Empreendimento</h3>
          <div className={grade}>
            <Campo
              nome="empreendimento_nome"
              valor={p.empreendimento_nome}
              maxLength={120}
              classe="sm:col-span-2"
            />
            <Campo nome="endereco_cep" valor={p.endereco_cep} maxLength={9} />
            <Campo nome="endereco_uf" valor={p.endereco_uf} maxLength={2} />
            <Campo
              nome="endereco_logradouro"
              valor={p.endereco_logradouro}
              maxLength={160}
              classe="sm:col-span-2"
            />
            <Campo
              nome="endereco_numero"
              valor={p.endereco_numero}
              maxLength={20}
            />
            <Campo
              nome="endereco_complemento"
              valor={p.endereco_complemento}
              maxLength={80}
              obrigatorio={false}
            />
            <Campo
              nome="endereco_bairro"
              valor={p.endereco_bairro}
              maxLength={80}
            />
            <Campo
              nome="endereco_cidade"
              valor={p.endereco_cidade}
              maxLength={80}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className={subtitulo}>Valores e prazos</h3>
          <div className={grade}>
            <label className={rotulo}>
              Índice padrão
              <Selecao
                name="indice_padrao"
                obrigatorio
                valorInicial={p.indice_padrao}
                opcoes={Object.entries(INDICES).map(([valor, r]) => ({
                  valor,
                  rotulo: r,
                }))}
              />
            </label>
            <Campo
              nome="dia_vencimento_padrao"
              valor={p.dia_vencimento_padrao}
              numero
            />
            <Campo nome="caucao_alugueis" valor={p.caucao_alugueis} numero />
            <Campo
              nome="caucao_prazo_dias"
              valor={p.caucao_prazo_dias}
              numero
            />
            <Campo
              nome="capitalizacao_prazo_dias"
              valor={p.capitalizacao_prazo_dias}
              numero
            />
            <Campo nome="multa_alugueis" valor={p.multa_alugueis} numero />
            <Campo nome="nc004_versao" valor={p.nc004_versao} maxLength={30} />
            <Campo
              nome="vaga_promocional_padrao"
              valor={p.vaga_promocional_padrao}
              numero
            />
          </div>
          <Marcar
            nome="consumo_agua_padrao"
            marcado={p.consumo_agua_padrao}
            texto="Consumo de água incluso (padrão)"
          />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className={subtitulo}>Cláusula de obras e entrega</h3>
          <div className={grade}>
            <Campo
              nome="obras_tapume_dias"
              valor={p.obras_tapume_dias}
              numero
            />
            <Campo
              nome="obras_retirada_dias"
              valor={p.obras_retirada_dias}
              numero
            />
            <Campo
              nome="obras_projetos_dias"
              valor={p.obras_projetos_dias}
              numero
            />
            <Campo
              nome="entrega_prazo_implantacao_dias"
              valor={p.entrega_prazo_implantacao_dias}
              numero
            />
            <Campo
              nome="entrega_tipo_imovel"
              valor={p.entrega_tipo_imovel}
              maxLength={80}
            />
            <Campo
              nome="entrega_padrao"
              valor={p.entrega_padrao}
              maxLength={160}
              classe="sm:col-span-2 lg:col-span-3"
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className={subtitulo}>Obrigatórios por garantia</legend>
          <p className="text-xs text-neutral-500">
            Campos que a Revisão do contrato exige preenchidos para cada tipo de
            garantia.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GARANTIAS.filter(
              (g) => Object.keys(CAMPOS_GARANTIA[g].campos).length,
            ).map((g) => (
              <div key={g} className="flex flex-col">
                <p className="mb-1 text-xs font-medium text-neutral-600">
                  {CAMPOS_GARANTIA[g].rotulo}
                </p>
                {Object.entries(
                  CAMPOS_GARANTIA[g].campos as Record<string, string>,
                ).map(([c, r]) => (
                  <Marcar
                    key={c}
                    nome={`garantia.${g}`}
                    valor={c}
                    marcado={(obrigatorios[g] ?? []).includes(c)}
                    texto={r}
                  />
                ))}
              </div>
            ))}
          </div>
        </fieldset>
      </FormBloco>
      <div className={separador}>
        <Nota>
          Modelos de contrato e de distrato (Word e PDF com cláusulas
          condicionais): a partir da V2.
        </Nota>
      </div>
    </Secao>
  );
}
