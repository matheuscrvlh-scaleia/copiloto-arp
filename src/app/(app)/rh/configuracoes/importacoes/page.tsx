import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao, Tabela } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { SemAcesso } from "@/components/protegido";
import { Selecao } from "@/components/selecao";
import { CONFIGURACOES_RH } from "@/config/navigation";
import {
  competenciaDe,
  formatarDataHora,
  formatarMes,
  formatarMoeda,
  formatarPct,
} from "@/lib/formato";
import { GRUPOS_CLASSIFICAVEIS, GRUPOS_RUBRICA } from "@/lib/rh/rubricas";
import { pode } from "@/server/auth";
import { beneficiosCadastrados, tabelasDoPlano } from "@/server/rh/beneficios";
import { folhasImportadas, rubricasNaoClassificadas } from "@/server/rh/dados";
import { salarioFicticioAtivo } from "@/server/rh/folha";
import { classificarRubrica, confirmarFolha, lerFolha } from "./actions";
import { confirmarTabelaPlano, lerTabelaPlano } from "./actions-plano";
import { ImportarFolha } from "./importar-folha";
import { ImportarPlano } from "./importar-plano";

export const metadata: Metadata = { title: "Importações do RH" };

const STATUS: Record<string, string> = {
  importada: "Importada",
  conferida: "Conferida",
  fechada: "Fechada",
};

export default function Page() {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Importacoes />
    </Suspense>
  );
}

/** Cada importação aparece para quem tem a permissão dela. */
async function Importacoes() {
  const [folha, beneficios] = await Promise.all([
    pode("rh.folha"),
    pode("rh.beneficios"),
  ]);
  if (!folha && !beneficios) return <SemAcesso />;
  return (
    <div className="flex flex-col gap-6">
      {folha && <Folha />}
      {beneficios && <TabelaDoPlano />}
    </div>
  );
}

/** Planilha de faixas do plano (operadora), a cada reajuste. */
async function TabelaDoPlano() {
  const [beneficios, tabelas] = await Promise.all([
    beneficiosCadastrados(),
    tabelasDoPlano(),
  ]);
  const planos = beneficios.filter(
    (b) => b.ativo && (b.tipo === "plano_saude" || b.tipo === "odonto"),
  );
  return (
    <Secao
      id="plano"
      titulo="Tabela do plano de saúde"
      descricao="A cada reajuste da operadora: faixas etárias e coparticipação por tempo de casa. O valor do plano de cada pessoa sai da faixa pela idade (cadastro do ponto)."
    >
      {planos.length === 0 ? (
        <p className="text-sm text-neutral-600">
          Cadastre antes o benefício do plano em{" "}
          <Link
            href={`${CONFIGURACOES_RH.cadastros}#beneficios`}
            className="font-medium underline underline-offset-4"
          >
            Cadastros › Benefícios
          </Link>
          , com o tipo “Plano de saúde” e sem valor padrão.
        </p>
      ) : (
        <ImportarPlano
          beneficios={planos.map((b) => ({ id: b.id, nome: b.nome }))}
          mesSugerido={competenciaDe(new Date()).slice(0, 7)}
          ler={lerTabelaPlano}
          confirmar={confirmarTabelaPlano}
        />
      )}
      {tabelas.length > 0 && (
        <div className="mt-6">
          <Tabela
            colunas={[
              { titulo: "Benefício", valor: (t) => t.beneficio },
              {
                titulo: "Vigente desde",
                valor: (t) => formatarMes(t.vigente_desde),
              },
              { titulo: "Faixas", valor: (t) => t.faixas.length, numero: true },
              {
                titulo: "Mensalidade",
                valor: (t) =>
                  `${formatarMoeda(t.faixas[0]?.mensalidade ?? 0)} a ${formatarMoeda(t.faixas.at(-1)?.mensalidade ?? 0)}`,
                numero: true,
              },
              {
                titulo: "Coparticipação",
                valor: (t) => (t.regras ? `${t.regras} regras` : "—"),
                numero: true,
              },
              {
                titulo: "Reajuste",
                valor: (t) =>
                  t.reajuste_pct === null ? "—" : formatarPct(t.reajuste_pct),
                numero: true,
              },
            ]}
            linhas={tabelas}
            chave={(t) => t.id}
          />
        </div>
      )}
    </Secao>
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
        id="folha"
        titulo="Folha do mês: Extrato Mensal"
        tom="verde"
        descricao="1. Envie o PDF · 2. Confira a prévia · 3. Confirme. Uma folha já importada só é substituída com a sua confirmação; folha fechada não é substituída."
      >
        <ImportarFolha ler={lerFolha} confirmar={confirmarFolha} />
      </Secao>

      {pendentes.length > 0 && (
        <Secao
          id="rubricas-novas"
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

/** Blocos no lugar dos cartões da tela enquanto os dados chegam. */
function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando />
      <CartaoCarregando />
    </TelaCarregando>
  );
}
