import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { consultaDosFormulariosDoPrograma } from "../../../api-programas";
import { EditorDeFormulario } from "../../../components/editor";
import { FormulariosDoPrograma } from "../../../components/programas/formularios";
import type { ContextoDaAba } from "../programa";

// Aba Formulário (só "Programas – gerenciar"): a lista dos formulários do
// programa e, abaixo, o editor do questionário (4.13) com o formulário
// escolhido — não há um segundo editor para os programas.

export function AbaFormulario({ c }: { c: ContextoDaAba }) {
  const { data: formularios } = useSuspenseQuery(
    consultaDosFormulariosDoPrograma(c.programaId),
  );
  const escolhido =
    formularios.find((f) => f.id === c.um("formulario"))?.id ??
    formularios.find((f) => f.ativo)?.id ??
    formularios[0]?.id ??
    null;
  return (
    <div className="flex flex-col gap-6">
      <Secao
        titulo="Formulários do programa"
        descricao="Um programa pode ter mais de um formulário (ex.: atrações, produtores e ecocopos). Campo usado por indicador ou com lançamentos não é excluído, só inativado."
      >
        <FormulariosDoPrograma
          programaId={c.programaId}
          formularios={formularios}
          selecionado={escolhido}
          base={`${c.base}?aba=formulario`}
        />
      </Secao>
      {escolhido && (
        <div data-guia="editor-formulario">
          <Suspense
            key={escolhido}
            fallback={<CartaoCarregando altura="h-[36rem]" />}
          >
            <EditorDeFormulario formularioId={escolhido} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
