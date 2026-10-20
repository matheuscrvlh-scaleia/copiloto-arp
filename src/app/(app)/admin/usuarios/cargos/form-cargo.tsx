import { CaixasDePermissao } from "@/components/admin/permissoes";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import type { Cargo } from "@/server/admin/dados";
import { salvarCargo } from "../actions";

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export function FormCargo({ cargo }: { cargo?: Cargo }) {
  return (
    <FormAcao
      acao={salvarCargo}
      rotulo={cargo ? "Salvar" : "Criar cargo"}
      rotuloEnviando={cargo ? "Salvando…" : "Criando…"}
      className="vidro flex flex-col gap-6 rounded-[1.75rem] p-6"
    >
      <input type="hidden" name="id" value={cargo?.id ?? ""} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,20rem)_1fr]">
        <label className={rotulo}>
          Nome
          <input
            name="nome"
            required
            defaultValue={cargo?.nome}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Descrição
          <input
            name="descricao"
            maxLength={200}
            defaultValue={cargo?.descricao ?? ""}
            placeholder="Para quem é este cargo"
            className={classeCampo}
          />
        </label>
      </div>
      <CaixasDePermissao marcadas={cargo?.permissoes ?? []} />
    </FormAcao>
  );
}
