import Link from "next/link";
import { CaixasDePermissao } from "@/components/admin/permissoes";
import { Secao } from "@/components/admin/ui";
import { classeCampo } from "@/components/estilos";
import { EnvioDaAcao, FormAcao } from "@/components/form-acao";
import type { Cargo } from "@/server/admin/dados";
import { salvarCargo } from "../actions";

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export function FormCargo({ cargo }: { cargo?: Cargo }) {
  return (
    <FormAcao
      acao={salvarCargo}
      rotulo={cargo ? "Salvar" : "Criar cargo"}
      rotuloEnviando={cargo ? "Salvando…" : "Criando…"}
      botaoNoFim={false}
      className="vidro rounded-[1.75rem] p-6 md:p-8"
    >
      <input type="hidden" name="id" value={cargo?.id ?? ""} />
      <Secao titulo="Dados" descricao="Como o cargo aparece na escolha.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,20rem)_1fr]">
          <label className={rotulo}>
            Nome
            <input
              name="nome"
              required
              defaultValue={cargo?.nome}
              placeholder="Ex.: Gestão de RH"
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
      </Secao>
      <Secao
        titulo="Permissões"
        descricao="O que quem tiver este cargo pode ver e fazer. Vale na hora para todos os usuários dele."
      >
        <CaixasDePermissao marcadas={cargo?.permissoes ?? []} />
      </Secao>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200/70 pt-6">
        <Link
          href="/admin/usuarios/cargos"
          className="rounded-full px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900"
        >
          Cancelar
        </Link>
        <EnvioDaAcao className="flex-row-reverse" />
      </div>
    </FormAcao>
  );
}
