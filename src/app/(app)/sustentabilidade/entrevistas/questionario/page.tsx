import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { EmConstrucao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { EditorDeFormulario } from "@/components/sustentabilidade/editor";
import { idDoQuestionario } from "@/server/sustentabilidade/formularios";

export const metadata: Metadata = { title: "Editar questionário" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Editar questionário"
        description="Perguntas da entrevista de diagnóstico de resíduos: criar, editar, duplicar, mover, inativar e excluir perguntas, opções e seções, com rascunho, pré-visualização, publicação e versões."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="sustentabilidade.entrevistas.questionario">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela() {
  const id = await idDoQuestionario();
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
