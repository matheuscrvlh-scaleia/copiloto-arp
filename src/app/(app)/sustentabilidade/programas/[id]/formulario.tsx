import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { EditorDeFormulario } from "@/components/sustentabilidade/editor";
import { FormulariosDoPrograma } from "@/components/sustentabilidade/programas/formularios";
import { formulariosDoPrograma } from "@/server/sustentabilidade/formularios";
import type { ContextoDaAba } from "./page";

// Aba Formulário (só "Programas – gerenciar"): a lista dos formulários do
// programa e, abaixo, o editor do questionário (4.13) com o formulário
// escolhido — não há um segundo editor para os programas.

export async function AbaFormulario({ c }: { c: ContextoDaAba }) {
  const formularios = await formulariosDoPrograma(c.programaId);
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
