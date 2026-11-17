import type { Lista, Parametros } from "@arp/shared/comercial/contratos/base";
import { Secao } from "@/components/dashboard/tabela";
import { Selecao } from "@/components/selecao";
import { Campo, FormBloco, grade, rotulo } from "../campos";
import { ativosDa, ListasDoBloco, opcoes } from "./comum";

export function BlocoVencimentos({
  parametros: p,
  listas,
}: {
  parametros: Parametros;
  listas: Lista[];
}) {
  const canais = [
    ...new Set([
      p.relacionamento_canal_visita,
      ...ativosDa(listas, "canal_contato"),
    ]),
  ];
  return (
    <>
      <Secao
        titulo="Faixas e lembretes"
        descricao="Vencimentos em até a faixa 1, entre a faixa 1 e a 2, e acima da 2 (a faixa 2 precisa ser maior). O lembrete de aniversário aparece no sistema X dias antes. As visitas do Painel são os contatos registrados no canal escolhido."
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
          <label className={rotulo}>
            Canal que conta como visita
            <Selecao
              name="relacionamento_canal_visita"
              obrigatorio
              valorInicial={p.relacionamento_canal_visita}
              opcoes={opcoes(canais)}
            />
          </label>
          <Campo
            nome="relacionamento_asana_projeto"
            valor={p.relacionamento_asana_projeto}
            maxLength={200}
            classe="sm:col-span-2"
            dica="Nome do projeto de onde o Relacionamento puxa os registros do SAC (integração do Asana em Marketing)."
          />
        </FormBloco>
      </Secao>
      <ListasDoBloco bloco="vencimentos" listas={listas} />
    </>
  );
}
