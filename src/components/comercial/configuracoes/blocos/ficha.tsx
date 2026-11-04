import { Secao } from "@/components/dashboard/tabela";
import type { Lista, Parametros } from "@/server/comercial/base";
import { Campo, FormBloco, grade, Texto } from "../campos";
import { ListasDoBloco } from "./comum";

export function BlocoFicha({
  parametros: p,
  listas,
}: {
  parametros: Parametros;
  listas: Lista[];
}) {
  return (
    <>
      <Secao
        titulo="Ficha cadastral"
        descricao="Textos do formulário público e por quantos dias o link vale."
      >
        <FormBloco bloco="ficha">
          <Texto
            nome="ficha_boas_vindas"
            valor={p.ficha_boas_vindas}
            linhas={6}
          />
          <Texto
            nome="ficha_termo_lgpd"
            valor={p.ficha_termo_lgpd}
            linhas={4}
          />
          <div className={grade}>
            <Campo
              nome="ficha_validade_dias"
              valor={p.ficha_validade_dias}
              numero
            />
          </div>
        </FormBloco>
      </Secao>
      <ListasDoBloco bloco="ficha" listas={listas} />
    </>
  );
}
