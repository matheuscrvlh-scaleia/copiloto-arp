import type { Lista, Parametros } from "@arp/shared/comercial/contratos/base";
import { Secao } from "@/components/dashboard/tabela";
import { Campo, FormBloco, grade, Texto } from "../campos";
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
        descricao="Dias de uso no mês para estimar a mensalidade de quem informa o gasto por dia, e o texto que acompanha o link quando ele é enviado pelo WhatsApp (vale para os formulários do Censo e da ficha cadastral; {formulario} vira o nome do formulário)."
      >
        <FormBloco bloco="censo" className={grade}>
          <Campo
            nome="censo_dias_mensalidade"
            valor={p.censo_dias_mensalidade}
            numero
          />
          <Texto
            nome="formulario_texto_convite"
            valor={p.formulario_texto_convite}
            linhas={4}
            maxLength={1000}
            classe="sm:col-span-full"
            dica="O link vai numa linha logo abaixo do texto."
          />
        </FormBloco>
      </Secao>
      <ListasDoBloco bloco="censo" listas={listas} />
    </>
  );
}
