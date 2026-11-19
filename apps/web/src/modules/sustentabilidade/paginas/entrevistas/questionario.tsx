import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { EmConstrucao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { consultaDoQuestionario } from "../../api-editor";
import { EditorDeFormulario } from "../../components/editor";
import { CabecalhoDeEntrevistas } from "../../components/entrevistas/abas";

// /sustentabilidade/entrevistas/questionario (app/(app)/sustentabilidade/entrevistas/questionario/page.tsx).

export default function Page() {
  return (
    <>
      <CabecalhoDeEntrevistas descricao="Perguntas da entrevista de diagnóstico de resíduos: criar, editar, duplicar, mover, inativar e excluir perguntas, opções e seções, com rascunho, pré-visualização, publicação e versões." />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="sustentabilidade.entrevistas.questionario">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

function Tela() {
  const { data: id } = useSuspenseQuery(consultaDoQuestionario);
  return (
    <div className="flex flex-col gap-4">
      <p
        data-guia="nota-questionario"
        className="max-w-4xl text-sm text-neutral-600"
      >
        O questionário é específico deste módulo e é editado aqui (não usa o
        módulo Relatórios). Pergunta com respostas, fonte de indicador ou
        condição de outra pergunta não pode ser excluída, só inativada; os
        campos que vêm do ENET são travados. Toda mudança vai para um rascunho e
        só vale depois de publicada como nova versão: entrevistas já salvas
        continuam na versão em que foram respondidas.
      </p>
      {id ? (
        <EditorDeFormulario formularioId={id} />
      ) : (
        <EmConstrucao motivo="O questionário ainda não existe no banco. Ele é criado pela instalação do módulo (versão 1, com as perguntas do Forms); peça ao administrador para conferir a migração de Sustentabilidade." />
      )}
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-36" />
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}
