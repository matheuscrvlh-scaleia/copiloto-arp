import { useSuspenseQuery } from "@tanstack/react-query";
import { TopoDaTela } from "@/components/dashboard/tela";
import { SemAcesso } from "@/components/protegido";
import { consultaDoEditor } from "../../api-editor";
import { useContextoSu } from "../../contexto-su";
import { EditorCliente } from "./editor";

/**
 * Editor dos formulários específicos (spec 4.13): o mesmo para o
 * questionário da entrevista (entrevistas.questionario) e para os
 * formulários dos programas (programas.gerenciar); excluir o que já foi
 * publicado exige formularios.excluir. Consulta a API: use dentro de
 * <Suspense>.
 */
export function EditorDeFormulario({ formularioId }: { formularioId: string }) {
  const { data, dataUpdatedAt } = useSuspenseQuery(
    consultaDoEditor(formularioId),
  );
  const ctx = useContextoSu(dataUpdatedAt);
  if (data.semAcesso) return <SemAcesso />;
  const d = data.editor;
  if (!d) {
    return (
      <p className="vidro rounded-[1.75rem] p-6 text-sm text-neutral-600">
        Formulário não encontrado. Ele pode ter sido excluído; volte à lista e
        abra de novo.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <TopoDaTela
        dadosDe={ctx.dadosDe}
        exemplo={
          d.exemplo
            ? `as contagens de ${d.tipo === "programa" ? "lançamentos" : "respostas"} vêm dos dados de exemplo`
            : undefined
        }
      />
      <EditorCliente d={d} />
    </div>
  );
}
