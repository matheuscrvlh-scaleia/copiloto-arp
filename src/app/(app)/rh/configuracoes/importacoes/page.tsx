import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao, Tabela } from "@/components/dashboard/tabela";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { SemAcesso } from "@/components/protegido";
import { Selecao } from "@/components/selecao";
import { CONFIGURACOES_RH } from "@/config/navigation";
import {
  competenciaDe,
  formatarDataHora,
  formatarMes,
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import { GRUPOS_CLASSIFICAVEIS, GRUPOS_RUBRICA } from "@/lib/rh/rubricas";
import { pode } from "@/server/auth";
import {
  classificarRubrica,
  confirmarFolha,
  excluirFolha,
  lerFolha,
} from "@/server/rh/acoes/importacoes";
import {
  confirmarTabelaPlano,
  lerTabelaPlano,
  salvarFaixasPlano,
} from "@/server/rh/acoes/importacoes-plano";
import {
  beneficiosCadastrados,
  type TabelaCadastrada,
  tabelasDoPlano,
} from "@/server/rh/beneficios";
import { folhasImportadas, rubricasNaoClassificadas } from "@/server/rh/dados";
import { salarioFicticioAtivo } from "@/server/rh/folha";
import { ImportarFolha } from "./importar-folha";
import { ImportarPlano } from "./importar-plano";
import { MenuFolha } from "./menu-folha";

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
      <Importados titulo="Tabelas importadas">
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
          vazio="Nenhuma tabela importada ainda."
        />
        {tabelas.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {tabelas.map((t) => (
              <EditarFaixas key={t.id} tabela={t} />
            ))}
          </div>
        )}
      </Importados>
    </Secao>
  );
}

/** Padrão dos cartões de importação: envio em cima, importados embaixo. */
function Importados({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 border-t border-neutral-900/[0.06] pt-5">
      <h3 className="mb-3 text-sm font-semibold">{titulo}</h3>
      {children}
    </div>
  );
}

const NOVAS_LINHAS = ["nova-1", "nova-2"];

/** Faixas de uma tabela gravada, editáveis: corrige sem enviar outra planilha. */
function EditarFaixas({ tabela: t }: { tabela: TabelaCadastrada }) {
  const linha = (
    chave: string,
    f: TabelaCadastrada["faixas"][number] | null,
  ) => (
    <div key={chave} className="grid grid-cols-3 gap-2">
      <input
        name="idade_min"
        inputMode="numeric"
        aria-label="Idade inicial"
        defaultValue={f?.idade_min ?? ""}
        className={classeCampo}
      />
      <input
        name="idade_max"
        inputMode="numeric"
        aria-label="Idade final"
        defaultValue={f?.idade_max ?? ""}
        placeholder={f ? "sem limite" : ""}
        className={classeCampo}
      />
      <input
        name="mensalidade"
        inputMode="decimal"
        aria-label="Mensalidade (R$)"
        defaultValue={f ? formatarNumero(f.mensalidade, 2) : ""}
        className={classeCampo}
      />
    </div>
  );
  return (
    <details className="rounded-2xl bg-white/50 px-4 py-3 ring-1 ring-neutral-900/[0.06]">
      <summary className="cursor-pointer text-sm font-medium">
        Ver e editar faixas: {t.beneficio}, vigente desde{" "}
        {formatarMes(t.vigente_desde)}
      </summary>
      <FormAcao
        acao={salvarFaixasPlano}
        rotulo="Salvar faixas"
        className="mt-4 flex max-w-xl flex-col gap-2"
      >
        <input type="hidden" name="tabela_id" value={t.id} />
        <p className="text-xs text-neutral-500">
          Idade final vazia é sem limite (ex.: 59 anos ou mais). Para tirar uma
          faixa, apague a linha; as linhas em branco no fim servem para incluir.
          Salvar recalcula o custo dos meses em aberto.
        </p>
        <div className="grid grid-cols-3 gap-2 text-xs font-medium text-neutral-600">
          <span>Idade inicial</span>
          <span>Idade final</span>
          <span>Mensalidade (R$)</span>
        </div>
        {t.faixas.map((f) => linha(`faixa-${f.idade_min}`, f))}
        {NOVAS_LINHAS.map((chave) => linha(chave, null))}
      </FormAcao>
    </details>
  );
}

async function Folha() {
  const [folhas, pendentes, individual] = await Promise.all([
    folhasImportadas(),
    rubricasNaoClassificadas(),
    pode("rh.custo_pessoal.individual"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Secao
        id="folha"
        titulo="Folha do mês: Extrato Mensal"
        descricao="1. Envie o PDF · 2. Confira a prévia · 3. Confirme. Subiu o arquivo errado? Envie o certo do mesmo mês e confirme a substituição, ou exclua a folha na lista abaixo. Folha fechada não é substituída nem excluída."
      >
        <ImportarFolha ler={lerFolha} confirmar={confirmarFolha} />
        <Importados titulo="Folhas importadas">
          <Tabela
            colunas={[
              {
                titulo: "Competência",
                valor: (f) => formatarMes(f.competencia),
              },
              { titulo: "Pessoas", valor: (f) => f.pessoas, numero: true },
              {
                titulo: "Situação",
                valor: (f) => STATUS[f.status] ?? f.status,
              },
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
              {
                titulo: "",
                valor: (f) => (
                  <MenuFolha
                    folhaId={f.id}
                    // Os valores de cada pessoa exigem a permissão individual.
                    ver={
                      individual
                        ? {
                            href: `${CONFIGURACOES_RH.importacoes}/folha/${f.id}`,
                            rotulo:
                              f.status === "fechada"
                                ? "Ver folha"
                                : "Ver e editar",
                          }
                        : undefined
                    }
                    excluir={f.status === "fechada" ? undefined : excluirFolha}
                    confirmar={`Excluir a folha de ${formatarMes(f.competencia)}? Saem as pessoas, as rubricas e o custo de pessoal do mês.`}
                  />
                ),
                numero: true,
              },
            ]}
            linhas={folhas}
            chave={(f) => f.id}
            vazio="Nenhuma folha importada ainda."
          />
        </Importados>
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
