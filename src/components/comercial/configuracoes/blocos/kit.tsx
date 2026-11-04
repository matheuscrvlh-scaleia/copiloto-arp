import { Secao } from "@/components/dashboard/tabela";
import type { Lista, Parametros } from "@/server/comercial/base";
import { Campo, FormBloco, grade } from "../campos";
import { ListasDoBloco } from "./comum";

export function BlocoKit({
  parametros: p,
  listas,
}: {
  parametros: Parametros;
  listas: Lista[];
}) {
  return (
    <>
      <Secao
        titulo="Kit de entrega"
        descricao="Quantos dias antes do vencimento de um documento o aviso aparece."
      >
        <FormBloco bloco="kit" className={grade}>
          <Campo nome="kit_aviso_dias" valor={p.kit_aviso_dias} numero />
        </FormBloco>
      </Secao>
      <ListasDoBloco bloco="kit" listas={listas} />
    </>
  );
}
