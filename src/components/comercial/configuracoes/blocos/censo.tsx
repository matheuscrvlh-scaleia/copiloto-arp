import { Secao } from "@/components/dashboard/tabela";
import type { Lista, Parametros } from "@/server/comercial/base";
import { Campo, FormBloco, grade } from "../campos";
import { ListasDoBloco } from "./comum";

export function BlocoCenso({
  parametros: p,
  listas,
}: {
  parametros: Parametros;
  listas: Lista[];
}) {
  return (
    <>
      <Secao
        titulo="Censo"
        descricao="Dias de uso no mês para estimar a mensalidade de quem informa o gasto por dia."
      >
        <FormBloco bloco="censo" className={grade}>
          <Campo
            nome="censo_dias_mensalidade"
            valor={p.censo_dias_mensalidade}
            numero
          />
        </FormBloco>
      </Secao>
      <ListasDoBloco bloco="censo" listas={listas} />
    </>
  );
}
