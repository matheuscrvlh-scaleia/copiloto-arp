import { FormAcao } from "@/components/form-acao";
import { alternarIndicadorAtivo } from "../../api-programas";

/** Inativar ou reativar o indicador (o histórico não muda). */
export function SituacaoDoIndicador({
  id,
  ativo,
}: {
  id: string;
  ativo: boolean;
}) {
  return (
    <FormAcao
      acao={alternarIndicadorAtivo}
      rotulo={ativo ? "Inativar" : "Reativar"}
      rotuloEnviando="Um instante…"
      variante={ativo ? "perigo" : "secundario"}
      confirmar={
        ativo
          ? "Inativar o indicador? Ele sai do resumo, da lista e do painel; os lançamentos continuam e reativar volta tudo."
          : undefined
      }
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativo" value={ativo ? "false" : "true"} />
    </FormAcao>
  );
}
