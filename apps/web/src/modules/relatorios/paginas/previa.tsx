import { hexDaCor } from "@arp/shared/formularios/formulario";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { SemAcesso } from "@/components/protegido";
import { Link, useParametro } from "@/lib/navegacao";
import { usePermissao } from "@/lib/sessao";
import { consultaDoFormulario, rotaDoFormulario } from "../api";
import { FormularioPublico } from "../components/formulario-publico";

// Prévia: o formulário como quem recebe o link vê, inclusive em rascunho.
// Confere as respostas como o link, mas não grava nada.

export default function Pagina() {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-32" />
          <CartaoCarregando altura="h-48" />
        </TelaCarregando>
      }
    >
      <Tela />
    </Suspense>
  );
}

function Tela() {
  if (!usePermissao(["formularios.ver", "formularios.editar"]))
    return <SemAcesso />;
  return <Previa />;
}

function Previa() {
  const id = useParametro("id");
  const edita = usePermissao("formularios.editar");
  const { data: f } = useSuspenseQuery(consultaDoFormulario(id));
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link
        href={rotaDoFormulario(f.id, edita ? "editar" : "")}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar ao relatório
      </Link>
      <FormularioPublico
        titulo={f.titulo}
        descricao={f.descricao}
        campos={f.campos}
        mensagemFinal={f.mensagem_final}
        cor={hexDaCor(f.cor)}
        paginar={f.paginas}
        redirecionarPara={f.redirecionar_para}
        previa
      />
    </div>
  );
}
