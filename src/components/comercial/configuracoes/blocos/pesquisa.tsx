import { Secao } from "@/components/dashboard/tabela";
import type { Lista, Parametros } from "@/server/comercial/base";
import { Campo, digitado, FormBloco } from "../campos";
import { ListasDoBloco } from "./comum";

export function BlocoPesquisa({
  parametros: p,
  listas,
}: {
  parametros: Parametros;
  listas: Lista[];
}) {
  return (
    <>
      <Secao
        titulo="Faixas de tamanho"
        descricao="Limites em m², crescentes, separados por ponto e vírgula. Ex.: 30; 50; 80; 100 vira até 30, 30 a 50, 50 a 80, 80 a 100 e acima de 100."
      >
        <FormBloco
          bloco="pesquisa"
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,24rem)_auto]"
        >
          <Campo
            nome="pesquisa_faixas_m2"
            valor={(p.pesquisa_faixas_m2 ?? []).map(digitado).join("; ")}
          />
        </FormBloco>
      </Secao>
      <ListasDoBloco bloco="pesquisa" listas={listas} />
    </>
  );
}
