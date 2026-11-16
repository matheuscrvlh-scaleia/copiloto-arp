import type { RespostaParametros } from "@arp/shared/os/contratos/configuracoes";
import { TIPO_VENDA } from "@arp/shared/os/saidas";
import { Secao } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { salvarListasDeSaida } from "@/modules/os/api-configuracoes";
import { UltimasAlteracoes } from "@/modules/os/components/configuracoes/alteracoes";
import { ListaDeTextos } from "@/modules/os/components/configuracoes/lista-editavel";

// Saída do ativo (venda, doação, descarte…): os tipos de saída e as formas
// de recebimento que aparecem no "Registrar saída" da ficha do ativo.

export function BlocoSaidasDeAtivos({ d }: { d: RespostaParametros }) {
  const p = d.parametros;
  const alteracoes = d.alteracoes.saidas;
  return (
    <Secao
      id="saidas"
      titulo="Saída de ativos"
      descricao={`Tipos de saída e formas de recebimento do "Registrar saída". O tipo ${TIPO_VENDA} fica sempre: nele o valor é obrigatório e o relatório soma o total vendido.`}
    >
      <div className="flex flex-col gap-5">
        <FormAcao acao={salvarListasDeSaida} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-neutral-600">
                Tipos de saída
              </p>
              <ListaDeTextos
                name="ativos_saida_tipos"
                inicial={p.ativos_saida_tipos}
                rotuloItem="tipo"
                placeholder="Novo tipo (ex.: Leilão)"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-neutral-600">
                Formas de recebimento
              </p>
              <ListaDeTextos
                name="ativos_saida_formas"
                inicial={p.ativos_saida_formas}
                rotuloItem="forma"
                placeholder="Nova forma (ex.: Transferência)"
              />
            </div>
          </div>
        </FormAcao>
        <UltimasAlteracoes lista={alteracoes} />
      </div>
    </Secao>
  );
}
