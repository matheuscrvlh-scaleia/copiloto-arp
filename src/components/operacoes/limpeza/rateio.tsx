"use client";

import { CircleAlert, Info } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Secao } from "@/components/dashboard/tabela";
import { CartaoDaTela, Cartoes } from "@/components/dashboard/tela";
import { ProvedorDetalhe } from "@/components/modal-detalhe";
import { notificar } from "@/components/notificacoes";
import { BotaoExportar } from "@/components/os/exportar";
import { formatarNumero } from "@/lib/formato";
import {
  type ChaveMemoria,
  calcularRateio,
  type RegraBl04,
  ROTULO_REGRA_BL04,
  reais,
} from "@/lib/operacoes/limpeza";
import {
  entradaDoLancamento,
  type Lancamento,
} from "@/lib/operacoes/limpeza-lancamento";
import {
  lancamentoDoMesAnterior,
  salvarRateio,
} from "@/server/operacoes/acoes/limpeza";
import { AcoesDoMes } from "./acoes";
import { ComposicaoDoContrato, EquipeDoMes } from "./contrato-equipe";
import { DadosDoMes, type ExtraPadrao } from "./dados-do-mes";
import { comChaves, type LancamentoTela, semChaves } from "./estado";
import { detalheDoPasso, ListaDaMemoria, type QuemDoMes } from "./memoria";
import { ResultadoPorLocal } from "./resultado";

// Tela do mês do rateio (spec 4.8): o lançamento (valor base, funcionários,
// extras, minutos, contrato e equipe), a conta refeita a cada tecla (a
// mesma de src/lib/operacoes/limpeza.ts, que o servidor usa no PDF e no
// Excel), a memória de cálculo e as ações do mês. Mês fechado é só
// leitura (o RLS também garante).

export interface DiferencaPlanilha {
  local: string;
  rotulo: string;
  planilha: number | null;
  conta: number | null;
}

export function RateioDoMes({
  lancamento,
  rotuloMes,
  blocos,
  regra,
  status,
  podeLancar,
  quem,
  extrasPadrao,
  hrefDemonstrativo,
  diferencasPlanilha,
  exportar,
  linhaDeFiltros,
}: {
  lancamento: Lancamento;
  rotuloMes: string;
  blocos: string[];
  regra: RegraBl04;
  status: "aberto" | "fechado";
  podeLancar: boolean;
  quem: QuemDoMes & { enviado: boolean };
  extrasPadrao: ExtraPadrao[];
  /** "/operacoes/limpeza/2026-09/demonstrativo" */
  hrefDemonstrativo: string;
  /** Mês importado cuja conta refeita difere da aba da planilha. */
  diferencasPlanilha: DiferencaPlanilha[];
  exportar: boolean;
  /** "Mês: set/2026 · Bloco 04 separado" (sai no Excel e no PDF). */
  linhaDeFiltros: string;
}) {
  const inicial = useMemo(() => JSON.stringify(lancamento), [lancamento]);
  const [l, setL] = useState<LancamentoTela>(() => comChaves(lancamento));
  const [salvando, iniciar] = useTransition();
  const editavel = podeLancar && status === "aberto";
  const sujo = editavel && JSON.stringify(semChaves(l)) !== inicial;

  const entrada = useMemo(
    () => entradaDoLancamento(semChaves(l), regra, blocos),
    [l, regra, blocos],
  );
  const r = useMemo(() => calcularRateio(entrada), [entrada]);
  const detalhe = (chave: ChaveMemoria) =>
    detalheDoPasso(chave, r, entrada, rotuloMes, quem);
  const href = (bloco?: string) =>
    bloco ? `${hrefDemonstrativo}?bloco=${bloco}` : hrefDemonstrativo;

  const salvar = () =>
    iniciar(async () => {
      const res = await salvarRateio(semChaves(l));
      if (res.erro) notificar("erro", res.erro);
      else if (res.ok) notificar("ok", res.ok);
    });

  const copiar = async () => {
    const res = await lancamentoDoMesAnterior(l.referencia);
    if (!res.ok) {
      notificar("erro", res.erro);
      return false;
    }
    setL(comChaves({ ...res.lancamento, apontamento: l.apontamento }));
    notificar(
      "info",
      "Valores do mês anterior copiados. Ajuste o que mudou e salve.",
    );
    return true;
  };

  const temDados =
    !!l.valorBase.trim() ||
    l.minutos.some((m) => Number(m.limpeza) > 0 || Number(m.manutencao) > 0);
  const c = r.conferencia;
  const rateados = entrada.funcRateados;

  return (
    <ProvedorDetalhe exportar={exportar}>
      <div className="flex flex-col gap-6">
        <div
          data-guia="op-limpeza-acoes"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <AcoesDoMes
            referencia={l.referencia}
            rotuloMes={rotuloMes}
            status={status}
            podeLancar={podeLancar}
            sujo={sujo}
            pendencias={r.pendencias}
            enviado={quem.enviado}
            salvando={salvando}
            aoSalvar={salvar}
            aoCopiar={copiar}
            temDados={temDados}
            hrefDemonstrativo={href()}
            exportar={
              exportar ? (
                <BotaoExportar
                  titulo={`Rateio da limpeza · ${rotuloMes}`}
                  filtros={linhaDeFiltros}
                  nomeArquivo={`rateio-limpeza-${l.referencia.slice(0, 7)}`}
                  colunas={[
                    { titulo: "Local" },
                    { titulo: "Limpeza (min/dia)", numero: true },
                    { titulo: "Manutenção (min/dia)", numero: true },
                    { titulo: "Total (min)", numero: true },
                    {
                      titulo: "Participação (%)",
                      numero: true,
                      formato: "0.00",
                    },
                    { titulo: "Valor (R$)", numero: true, formato: "#,##0.00" },
                  ]}
                  linhas={[
                    [
                      regra === "area_comum"
                        ? "Área comum + Bloco 04"
                        : "Área comum",
                      null,
                      null,
                      null,
                      null,
                      r.areaComumExibida === null
                        ? null
                        : r.areaComumExibida / 100,
                    ],
                    ...r.blocos.map((b) => [
                      `Bloco ${b.bloco}`,
                      b.limpeza,
                      b.manutencao,
                      b.minutos,
                      b.participacao === null
                        ? null
                        : Math.round(b.participacao * 10000) / 100,
                      b.valor === null ? null : b.valor / 100,
                    ]),
                    [
                      "Total",
                      r.blocos.reduce((s, b) => s + b.limpeza, 0),
                      r.blocos.reduce((s, b) => s + b.manutencao, 0),
                      r.minutosTotal,
                      r.minutosTotal > 0 ? 100 : null,
                      r.total === null ? null : r.total / 100,
                    ],
                  ]}
                />
              ) : undefined
            }
          />
          {sujo && (
            <output className="inline-flex items-center gap-1.5 text-xs text-amber-800">
              <CircleAlert className="size-3.5" aria-hidden /> Alterações não
              salvas
            </output>
          )}
        </div>

        <Cartoes modulo="operacoes-limpeza">
          <CartaoDaTela
            titulo="Total do rateio (R$)"
            valor={reais(r.total)}
            detalhe={
              r.total === null
                ? (r.pendencias[0] ?? "Conta incompleta")
                : `Área comum e ${r.blocos.length} blocos`
            }
            fonte="Lançamento do mês"
            origem={detalhe("total")}
          />
          <CartaoDaTela
            titulo="Área comum (R$)"
            valor={reais(r.areaComumExibida)}
            detalhe={`${entrada.funcAreaComum ?? "—"} × ${reais(r.valorPorFuncionario)} + extras ${reais(r.extras)}${regra === "area_comum" ? " + Bloco 04" : ""}`}
            fonte="Lançamento do mês"
            origem={detalhe("area_comum")}
          />
          <CartaoDaTela
            titulo="Blocos (R$)"
            valor={reais(
              regra === "area_comum" && r.somaBlocos !== null
                ? r.somaBlocos -
                    (r.blocos.find((b) => b.bloco === "04")?.valor ?? 0)
                : r.somaBlocos,
            )}
            detalhe={`${rateados ?? "—"} funcionários pelos minutos (${formatarNumero(r.minutosTotal)} min/dia)`}
            fonte="Apontamento de minutos"
            origem={detalhe("rateado")}
          />
          <CartaoDaTela
            titulo="Conferência com o contrato"
            valor={
              c.situacao === "bate"
                ? "✓ Bate"
                : c.situacao === "nao_bate"
                  ? "✗ Não bate"
                  : "Sem conferência"
            }
            detalhe={
              c.situacao === "sem_contrato"
                ? "Marque os itens de limpeza do contrato"
                : `Contrato (parte limpeza): ${reais(c.contrato)}${c.situacao === "nao_bate" && c.diferenca !== null ? ` · diferença ${reais(c.diferenca)}` : ""}`
            }
            fonte="Composição do contrato"
            origem={detalhe("conferencia")}
            tom={c.situacao === "bate" ? "verde" : undefined}
          />
        </Cartoes>

        {(r.pendencias.length > 0 ||
          diferencasPlanilha.length > 0 ||
          regra === "area_comum") && (
          <div className="flex flex-col gap-2">
            {r.pendencias.length > 0 && (
              <Aviso tom="alerta">
                Conta incompleta: {r.pendencias.join(" ")}
              </Aviso>
            )}
            {diferencasPlanilha.length > 0 && (
              <Aviso tom="alerta">
                A conta refeita difere da aba importada:{" "}
                {diferencasPlanilha
                  .map(
                    (d) =>
                      `${d.rotulo} aba ${reais(d.planilha)}, conta ${reais(d.conta)}`,
                  )
                  .join("; ")}
                .
              </Aviso>
            )}
            {regra === "area_comum" && (
              <Aviso tom="info">
                {ROTULO_REGRA_BL04.area_comum}: até nov/2025 a planilha somava o
                Bloco 04 à área comum e o tirava do total. O total é o mesmo da
                regra atual.
              </Aviso>
            )}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[2fr_3fr]">
          <Secao
            titulo="Dados do mês"
            descricao={
              editavel
                ? "Valor base do contrato, funcionários e extras da área comum."
                : "Mês fechado: só leitura."
            }
          >
            <DadosDoMes
              l={l}
              mudar={setL}
              editavel={editavel}
              r={r}
              extrasPadrao={extrasPadrao}
              detalhe={detalhe}
            />
          </Secao>
          <Secao
            titulo="Resultado por local"
            descricao="Clique num valor para ver a memória de cálculo."
          >
            <ResultadoPorLocal
              l={l}
              mudar={setL}
              editavel={editavel}
              r={r}
              regra={regra}
              funcAreaComum={l.funcAreaComum}
              funcRateados={l.funcRateados}
              hrefDemonstrativo={href}
              detalhe={detalhe}
            />
          </Secao>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Secao
            titulo="Composição do contrato"
            descricao="Só referência; os itens marcados (parte de limpeza) conferem o total do rateio."
          >
            <ComposicaoDoContrato l={l} mudar={setL} editavel={editavel} />
          </Secao>
          <Secao
            titulo="Funcionários designados"
            descricao="Quem trabalha onde. Os minutos por dia de quem limpa os blocos devem somar o apontamento."
          >
            <EquipeDoMes l={l} mudar={setL} editavel={editavel} />
          </Secao>
        </div>

        <Secao
          titulo="Memória de cálculo"
          descricao="Cada passo da conta, com a fórmula e os números do mês. É o que vai no demonstrativo."
        >
          <ListaDaMemoria memoria={r.memoria} detalheDe={detalhe} />
        </Secao>
      </div>
    </ProvedorDetalhe>
  );
}

function Aviso({
  tom,
  children,
}: {
  tom: "alerta" | "info";
  children: React.ReactNode;
}) {
  const Icone = tom === "alerta" ? CircleAlert : Info;
  return (
    <p
      className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${tom === "alerta" ? "bg-amber-400/15 text-amber-900" : "bg-neutral-900/[0.04] text-neutral-700"}`}
    >
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
