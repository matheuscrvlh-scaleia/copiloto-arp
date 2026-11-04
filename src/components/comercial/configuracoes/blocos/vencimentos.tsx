import { Secao } from "@/components/dashboard/tabela";
import type { Lista, Parametros } from "@/server/comercial/base";
import { Campo, FormBloco, grade } from "../campos";
import { ListasDoBloco } from "./comum";

export function BlocoVencimentos({
  parametros: p,
  listas,
}: {
  parametros: Parametros;
  listas: Lista[];
}) {
  return (
    <>
      <Secao
        titulo="Faixas e lembretes"
        descricao="Vencimentos em até a faixa 1, entre a faixa 1 e a 2, e acima da 2 (a faixa 2 precisa ser maior). O lembrete de aniversário aparece no sistema X dias antes."
      >
        <FormBloco bloco="vencimentos" className={grade}>
          <Campo
            nome="vencimento_faixa1_dias"
            valor={p.vencimento_faixa1_dias}
            numero
          />
          <Campo
            nome="vencimento_faixa2_dias"
            valor={p.vencimento_faixa2_dias}
            numero
          />
          <Campo
            nome="lembrete_aniversario_dias"
            valor={p.lembrete_aniversario_dias}
            numero
          />
          <Campo
            nome="reajuste_previsto_dias"
            valor={p.reajuste_previsto_dias}
            numero
          />
        </FormBloco>
      </Secao>
      <ListasDoBloco bloco="vencimentos" listas={listas} />
    </>
  );
}
