import Link from "next/link";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { FormAcao } from "@/components/form-acao";
import {
  type CategoriaDoForm,
  FormCategoria,
} from "@/components/os/configuracoes/form-categoria";
import { SeloIcone } from "@/components/os/configuracoes/icones";
import { CONFIGURACOES_OS } from "@/config/navigation";
import {
  excluirCategoria,
  salvarCategoria,
} from "@/server/os/acoes/config-catalogo";
import { categorias, pessoas, setores } from "@/server/os/base";
import { agendas } from "@/server/os/configuracoes";

// Tela da categoria (nova ou existente): carrega as listas do formulário.

export function EsqueletoCategoria() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-[60rem]" />
    </TelaCarregando>
  );
}

/** Categoria nova: o padrão do banco, no setor escolhido. */
export function categoriaNova(setorId: string): CategoriaDoForm {
  return {
    id: null,
    setor_id: setorId,
    pai_id: null,
    nome: "",
    icone: "tag",
    cor: null,
    ativo: true,
    tipo_padrao: "solicitacao",
    responsavel_padrao_id: null,
    prioridade_padrao: "media",
    prazo_valor: null,
    prazo_unidade: "dias_uteis",
    resposta_horas: null,
    precisa_confirmacao: true,
    registrar_tempo: false,
    vincular_ativo: false,
    vincular_loja: false,
    agenda_id: null,
    preventiva: false,
    prazo_terceirizado_dias: null,
    campos: [],
    checklist: [],
    no_portal: false,
    orientacao_portal: null,
  };
}

export async function EdicaoDeCategoria({
  categoria,
}: {
  categoria: CategoriaDoForm;
}) {
  const [todosSetores, todas, listaPessoas, listaAgendas] = await Promise.all([
    setores(),
    categorias(),
    pessoas(),
    agendas(),
  ]);
  const setor = todosSetores.find((s) => s.id === categoria.setor_id);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`${CONFIGURACOES_OS.catalogo}?setor=${categoria.setor_id}`}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Catálogo{setor ? ` de ${setor.nome}` : ""}
        </Link>
        {categoria.id && (
          <FormAcao
            acao={excluirCategoria}
            variante="perigo"
            rotulo="Excluir categoria"
            rotuloEnviando="Excluindo…"
            confirmar={`Excluir a categoria ${categoria.nome}? Só dá para excluir a que nunca foi usada; a usada se desativa.`}
            className="ml-auto"
          >
            <input type="hidden" name="id" value={categoria.id} />
          </FormAcao>
        )}
      </div>
      <h2 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
        <SeloIcone
          nome={categoria.icone}
          cor={categoria.cor ?? setor?.cor ?? null}
        />
        {categoria.id ? categoria.nome : "Nova categoria"}
      </h2>
      <FormCategoria
        acao={salvarCategoria}
        categoria={categoria}
        setores={todosSetores
          .filter((s) => s.ativo || s.id === categoria.setor_id)
          .map((s) => ({ id: s.id, nome: s.nome, cor: s.cor }))}
        raizes={todas
          .filter((c) => !c.pai_id && c.id !== categoria.id)
          .map((c) => ({ id: c.id, nome: c.nome, setor_id: c.setor_id }))}
        temFilhas={
          !!categoria.id && todas.some((c) => c.pai_id === categoria.id)
        }
        pessoas={listaPessoas}
        agendas={listaAgendas}
      />
    </div>
  );
}
