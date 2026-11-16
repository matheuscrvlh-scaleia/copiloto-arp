import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { SemAcesso } from "@/components/protegido";
import { useParametro } from "@/lib/navegacao";
import { usePermissao } from "@/lib/sessao";
import { consultaDoFormulario } from "../api";
import { CabecalhoDoFormulario } from "../components/cabecalho";
import { EditorDoFormulario } from "../components/editor";

// /relatorios/:id/editar: as perguntas (só quem edita).

export default function Pagina() {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-28" />
          <CartaoCarregando altura="h-40" />
          <CartaoCarregando altura="h-56" />
        </TelaCarregando>
      }
    >
      <Tela />
    </Suspense>
  );
}

function Tela() {
  if (!usePermissao("formularios.editar")) return <SemAcesso />;
  return <Editor />;
}

function Editor() {
  const id = useParametro("id");
  const { data: f } = useSuspenseQuery(consultaDoFormulario(id));
  return (
    <>
      <CabecalhoDoFormulario f={f} aba="perguntas" edita />
      <EditorDoFormulario
        // Depois de salvar, a consulta traz o relatório novo: o editor
        // recomeça dele (a chave muda com a data de atualização).
        key={f.atualizado_em}
        id={f.id}
        inicial={{ titulo: f.titulo, descricao: f.descricao, campos: f.campos }}
        respostas={f.total_respostas}
      />
    </>
  );
}
