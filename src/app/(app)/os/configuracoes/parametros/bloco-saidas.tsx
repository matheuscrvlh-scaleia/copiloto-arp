import { Secao } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { UltimasAlteracoes } from "@/components/os/configuracoes/alteracoes";
import { ListaDeTextos } from "@/components/os/configuracoes/lista-editavel";
import { TIPO_VENDA } from "@/lib/os/saidas";
import { salvarListasDeSaida } from "@/server/os/acoes/saidas";
import { parametros } from "@/server/os/base";
import { ultimasAlteracoes } from "@/server/os/configuracoes";

// Saída do ativo (venda, doação, descarte…): os tipos de saída e as formas
// de recebimento que aparecem no "Registrar saída" da ficha do ativo.

export async function BlocoSaidasDeAtivos() {
  const [p, alteracoes] = await Promise.all([
    parametros(),
    ultimasAlteracoes(["os.parametros"], {
      campos: ["ativos_saida_tipos", "ativos_saida_formas"],
    }),
  ]);
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
