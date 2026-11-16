import { TopoDaTela } from "@/components/dashboard/tela";
import { SemAcesso } from "@/components/protegido";
import { contextoSu } from "@/server/sustentabilidade/base";
import {
  dadosDoEditor,
  formulario,
  permissaoDoFormulario,
} from "@/server/sustentabilidade/formularios";
import { EditorCliente } from "./editor";

/**
 * Editor dos formulários específicos (spec 4.13): o mesmo para o
 * questionário da entrevista (entrevistas.questionario) e para os
 * formulários dos programas (programas.gerenciar); excluir o que já foi
 * publicado exige formularios.excluir. Lê a sessão: use dentro de <Suspense>.
 */
export async function EditorDeFormulario({
  formularioId,
}: {
  formularioId: string;
}) {
  const [f, ctx] = await Promise.all([formulario(formularioId), contextoSu()]);
  if (!f) {
    return (
      <p className="vidro rounded-[1.75rem] p-6 text-sm text-neutral-600">
        Formulário não encontrado. Ele pode ter sido excluído; volte à lista e
        abra de novo.
      </p>
    );
  }
  if (!ctx.pode(permissaoDoFormulario(f.tipo))) return <SemAcesso />;
  const d = await dadosDoEditor(formularioId);
  if (!d) return <SemAcesso />;
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
