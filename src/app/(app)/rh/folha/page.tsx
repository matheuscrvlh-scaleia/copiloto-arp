import type { Metadata } from "next";
import { Suspense } from "react";
import { Nota, Secao, Tabela } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Selecao } from "@/components/selecao";
import { formatarDataHora, formatarMes } from "@/lib/formato";
import { GRUPOS_CLASSIFICAVEIS, GRUPOS_RUBRICA } from "@/lib/rh/rubricas";
import { folhasImportadas, rubricasNaoClassificadas } from "@/server/rh/dados";
import { salarioFicticioAtivo } from "@/server/rh/folha";
import { classificarRubrica, confirmarFolha, lerFolha } from "./actions";
import { ImportarFolha } from "./importar-folha";

export const metadata: Metadata = { title: "Importar folha" };

const STATUS: Record<string, string> = {
  importada: "Importada",
  conferida: "Conferida",
  fechada: "Fechada",
};

export default function Page() {
  return (
    <>
      <PageHeader
        title="Importar folha"
        description="Envio mensal do Extrato Mensal da Sousa e Couto, com conferência dos totais antes de gravar."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="rh.folha">
          <Folha />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Folha() {
  const [folhas, pendentes] = await Promise.all([
    folhasImportadas(),
    rubricasNaoClassificadas(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Secao
        titulo="Enviar extrato"
        descricao="1. Envie o PDF · 2. Confira a prévia · 3. Confirme. Uma folha já importada só é substituída com a sua confirmação; folha fechada não é substituída."
      >
        <ImportarFolha ler={lerFolha} confirmar={confirmarFolha} />
      </Secao>

      {pendentes.length > 0 && (
        <Secao
          titulo={`Rubricas para classificar (${pendentes.length})`}
          descricao="Rubrica nova entra como não classificada. Diga como ela entra no custo: a classificação vale para todos os meses."
        >
          <div className="flex flex-col divide-y divide-neutral-100">
            {pendentes.map((r) => (
              <FormAcao
                key={r.codigo}
                acao={classificarRubrica}
                rotulo="Classificar"
                className="grid items-end gap-3 py-4 first:pt-0 sm:grid-cols-[1fr_20rem_auto]"
              >
                <input type="hidden" name="codigo" value={r.codigo} />
                <p className="text-sm">
                  <span className="tabular-nums font-medium">{r.codigo}</span> ·{" "}
                  {r.descricao}
                </p>
                <Selecao
                  name="grupo"
                  obrigatorio
                  rotulo={`Grupo da rubrica ${r.codigo}`}
                  placeholder="Escolha o grupo…"
                  opcoes={GRUPOS_CLASSIFICAVEIS.map((g) => ({
                    valor: g,
                    rotulo: GRUPOS_RUBRICA[g],
                  }))}
                />
              </FormAcao>
            ))}
          </div>
        </Secao>
      )}

      <Secao titulo="Folhas importadas">
        <Tabela
          colunas={[
            { titulo: "Competência", valor: (f) => formatarMes(f.competencia) },
            { titulo: "Pessoas", valor: (f) => f.pessoas, numero: true },
            { titulo: "Situação", valor: (f) => STATUS[f.status] ?? f.status },
            {
              titulo: "Salário",
              valor: (f) => (f.ficticia ? "Fictício (protótipo)" : "Real"),
            },
            { titulo: "Arquivo", valor: (f) => f.arquivo ?? "—" },
            {
              titulo: "Importada em",
              valor: (f) =>
                f.importadaEm ? formatarDataHora(f.importadaEm) : "—",
              numero: true,
            },
          ]}
          linhas={folhas}
          chave={(f) => f.id}
          vazio="Nenhuma folha importada ainda."
        />
      </Secao>

      <Nota>
        {salarioFicticioAtivo()
          ? "Modo protótipo ligado: todo salário é gravado como R$ 2.000,00. "
          : ""}
        O arquivo original fica guardado num repositório privado, com acesso só
        para quem importa a folha. CPF não é gravado. Por enquanto, a importação
        aceita o extrato em PDF; o formato Excel entra quando houver um arquivo
        de exemplo.
      </Nota>
    </div>
  );
}
