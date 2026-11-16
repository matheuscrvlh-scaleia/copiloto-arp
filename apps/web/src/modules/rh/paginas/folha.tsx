import { formatarMes } from "@arp/shared/formato";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { SemAcesso } from "@/components/protegido";
import { CONFIGURACOES_RH } from "@/config/navigation";
import { Link, useParametro } from "@/lib/navegacao";
import { usePermissao } from "@/lib/sessao";
import { consultaDaFolha } from "../api";
import { EditorDaFolha } from "../components/importacoes/editor-folha";

export default function Page() {
  return (
    <>
      <Link
        href={`${CONFIGURACOES_RH.importacoes}#folha`}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Importações
      </Link>
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando />
          </TelaCarregando>
        }
      >
        <Folha />
      </Suspense>
    </>
  );
}

/** Conferir e corrigir a folha importada, pessoa a pessoa (valores individuais). */
function Folha() {
  const folha = usePermissao("rh.folha");
  const individual = usePermissao("rh.custo_pessoal.individual");
  if (!folha || !individual) return <SemAcesso />;
  return <Editor />;
}

/** Id inválido ou folha que não existe: a API responde 404 (tela de não encontrada). */
function Editor() {
  const { data: dados } = useSuspenseQuery(
    consultaDaFolha(useParametro("id")),
  );
  const { folha: f } = dados;
  const editavel = f.status !== "fechada";

  return (
    <Secao
      titulo={`Folha de ${formatarMes(f.competencia)}`}
      descricao={`${dados.pessoas.length} pessoas. Abra uma pessoa para corrigir departamento, cargo, contrato, horas e rubricas sem enviar outro PDF. Salvar recalcula o custo do mês.`}
    >
      {!editavel && (
        <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Esta folha está fechada: dá para conferir, mas não para editar.
        </p>
      )}
      {f.ficticia && (
        <p className="mb-4 text-xs text-neutral-500">
          Folha importada no protótipo, com o salário trocado por R$ 2.000,00.
          Importe o PDF de novo (substituindo) para trazer os valores reais.
        </p>
      )}
      <EditorDaFolha
        folhaId={f.id}
        editavel={editavel}
        pessoas={dados.pessoas}
        departamentos={dados.departamentos}
        cargos={dados.cargos}
        rubricas={dados.rubricas}
      />
    </Secao>
  );
}
