import { Trash2 } from "lucide-react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { Secao } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import {
  removerFaixaEvento,
  salvarFaixaEvento,
} from "@/server/comercial/acoes/parametros";
import type { FaixaEvento, Lista, Parametros } from "@/server/comercial/base";
import {
  Campo,
  digitado,
  FormBloco,
  grade,
  Marcar,
  rotulo,
  Texto,
} from "../campos";
import { ListasDoBloco, lista, separador } from "./comum";

const gradeFaixa =
  "grid flex-1 grid-cols-2 items-end gap-3 sm:grid-cols-[6rem_6rem_6rem_7rem_7rem_auto_auto]";

function CamposFaixa({ f }: { f?: FaixaEvento }) {
  const campo = (
    nome: string,
    r: string,
    v: number | string | undefined,
    numero = true,
  ) => (
    <label className={rotulo}>
      {r}
      <input
        name={nome}
        required
        inputMode={numero ? "decimal" : undefined}
        maxLength={numero ? undefined : 40}
        defaultValue={numero ? digitado(v ?? "") : (v ?? "")}
        className={`${classeCampo} ${numero ? "tabular-nums" : ""}`}
      />
    </label>
  );
  return (
    <>
      {campo("nome", "Faixa", f?.nome, false)}
      {campo("area_de", "De (m²)", f?.area_de)}
      {campo("area_ate", "Até (m²)", f?.area_ate)}
      {campo("valor_comum", "Dias comuns", f?.valor_comum)}
      {campo("valor_sazonal", "Datas sazonais", f?.valor_sazonal)}
      <Marcar nome="fixo" marcado={f?.fixo ?? false} texto="Fixo por dia" />
    </>
  );
}

export function BlocoEventos({
  parametros: p,
  faixas,
  listas,
}: {
  parametros: Parametros;
  faixas: FaixaEvento[];
  listas: Lista[];
}) {
  return (
    <>
      <Secao
        titulo="Tabela de preço"
        descricao="Valor por m² por dia, em reais, já com o reajuste do ano. A faixa marcada como fixa cobra o valor por dia (áreas pequenas). Faixas por m² não podem se sobrepor."
      >
        <div className={lista}>
          {faixas.map((f) => (
            <div key={f.id} className="flex flex-wrap items-end gap-3 py-3">
              <FormAcao acao={salvarFaixaEvento} className={gradeFaixa}>
                <input type="hidden" name="id" value={f.id} />
                <CamposFaixa f={f} />
              </FormAcao>
              <div className="pb-2">
                <AcaoRapida
                  acao={removerFaixaEvento}
                  campos={{ id: f.id }}
                  rotulo={`Remover a faixa ${f.nome}`}
                  icone={<Trash2 className="size-4" aria-hidden />}
                  confirmar={`Remover a faixa ${f.nome}? Simulações novas deixam de usar esse preço; propostas já geradas não mudam.`}
                  perigo
                />
              </div>
            </div>
          ))}
        </div>
        <FormAcao
          acao={salvarFaixaEvento}
          rotulo="Incluir faixa"
          rotuloEnviando="Incluindo…"
          className={`${separador} ${gradeFaixa}`}
        >
          <CamposFaixa />
        </FormAcao>
      </Secao>

      <Secao
        titulo="Cálculo e textos da proposta"
        descricao="Reajuste, desconto, dimensionamento de segurança e limpeza, e os textos que a proposta traz preenchidos."
      >
        <FormBloco bloco="eventos" className="flex flex-col gap-4">
          <div className={grade}>
            <Campo
              nome="evento_reajuste_pct"
              valor={p.evento_reajuste_pct}
              numero
            />
            <Campo
              nome="evento_desconto_pct"
              valor={p.evento_desconto_pct}
              numero
            />
            <Campo
              nome="evento_pessoas_por_seguranca"
              valor={p.evento_pessoas_por_seguranca}
              numero
            />
            <Campo
              nome="evento_m2_por_agente"
              valor={p.evento_m2_por_agente}
              numero
            />
            <Campo
              nome="evento_fechamento_dias_uteis"
              valor={p.evento_fechamento_dias_uteis}
              numero
            />
            <Campo
              nome="evento_validade_dias"
              valor={p.evento_validade_dias}
              numero
            />
            <Campo
              nome="evento_horario"
              valor={p.evento_horario}
              maxLength={80}
              classe="sm:col-span-2"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo
              nome="evento_condicao_pagamento"
              valor={p.evento_condicao_pagamento}
              maxLength={200}
            />
            <Campo
              nome="evento_area_texto"
              valor={p.evento_area_texto}
              maxLength={200}
            />
            <Campo
              nome="evento_montagem"
              valor={p.evento_montagem}
              maxLength={200}
            />
            <Campo
              nome="evento_desmontagem"
              valor={p.evento_desmontagem}
              maxLength={200}
            />
          </div>
          <Texto
            nome="evento_notas"
            valor={(p.evento_notas ?? []).join("\n")}
            linhas={4}
            dica="Uma nota por linha, na ordem da proposta."
          />
        </FormBloco>
      </Secao>

      <ListasDoBloco bloco="eventos" listas={listas} />
    </>
  );
}
