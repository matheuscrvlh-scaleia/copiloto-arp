import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { BarrasHorizontais } from "@/components/dashboard/graficos";
import { SeloStatus } from "@/components/dashboard/indicador";
import { type Coluna, Secao, Tabela } from "@/components/dashboard/tabela";
import {
  CartaoDaTela,
  Cartoes,
  variacaoContra,
} from "@/components/dashboard/tela";
import {
  formatarData,
  formatarMes,
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import type { Status } from "@/lib/indicadores";
import {
  ALERTAS_AGUA,
  type AlertaAgua,
  mesAnterior,
  ROTULO_RATEIO,
  type SituacaoRateio,
  STATUS_OBRA_DIARIO,
} from "@/lib/operacoes/painel";
import type {
  DadosDoPainel,
  ObraNoPainel,
  PainelAgua,
  PainelContas,
  PainelDiario,
  PainelEnergia,
  PainelLimpeza,
  PainelObras,
} from "@/server/operacoes/painel";

// Painel de Operações (spec 4.10 e mockup): até quatro cartões no topo e um
// quadro por área, cada um com o link para a tela de origem. Reais só para
// quem tem a permissão de valores; área sem dados diz do que depende.

export const ROTAS = {
  agua: "/operacoes/agua",
  energia: "/operacoes/energia",
  contas: "/operacoes/energia/contas",
  solar: "/operacoes/energia/solar",
  limpeza: "/operacoes/limpeza",
  obras: "/operacoes/obras",
  diario: "/operacoes/diario",
  importacoes: "/operacoes/importacoes",
} as const;

const reais = (c: number) => formatarMoeda(c / 100);
const m3 = (v: number) => `${formatarNumero(v, 0)} m³`;
const kwh = (v: number) => `${formatarNumero(v, 0)} kWh`;

const STATUS_RATEIO: Record<SituacaoRateio, Status> = {
  enviado: "ok",
  fechado: "atencao",
  aberto: "atencao",
  incompleto: "fora",
  atrasado: "fora",
};

function AbrirTela({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <Link
      href={href}
      className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
    >
      {rotulo}
      <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-neutral-500">{children}</p>;
}

function Numero({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  detalhe?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-neutral-500">{rotulo}</span>
      <span className="text-xl font-semibold tabular-nums">{valor}</span>
      {detalhe && <span className="text-xs text-neutral-500">{detalhe}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartões do topo
// ---------------------------------------------------------------------------

export function CartoesDoPainel({ d }: { d: DadosDoPainel }) {
  const cartoes: React.ReactElement[] = [];
  const { agua, energia, limpeza, contas, diario, obras } = d;
  if (agua)
    cartoes.push(
      <CartaoDaTela
        key="agua"
        titulo={
          agua.referencia
            ? `Água · consumo de ${formatarMes(agua.referencia)}`
            : "Água · consumo do mês"
        }
        valor={agua.referencia ? m3(agua.consumo) : "—"}
        detalhe={
          !agua.referencia
            ? "Nenhuma leitura importada"
            : agua.valorCentavos !== null
              ? `Valor faturado ${reais(agua.valorCentavos)}`
              : `${formatarNumero(agua.leituras)} hidrômetros lidos`
        }
        variacao={
          agua.consumoAnterior !== null
            ? variacaoContra(
                agua.consumo,
                agua.consumoAnterior,
                formatarMes(mesAnterior(agua.referencia ?? "")),
                "neutro",
              )
            : undefined
        }
        fonte="Importação do faturamento da água"
        href={ROTAS.agua}
      />,
      <CartaoDaTela
        key="alertas"
        titulo="Água · leituras com alerta"
        valor={agua.referencia ? formatarNumero(agua.alertas.total) : "—"}
        detalhe={
          agua.incompletos
            ? `${agua.incompletos} ${agua.incompletos === 1 ? "mês incompleto" : "meses incompletos"}`
            : "Meta: zero"
        }
        status={
          !agua.referencia
            ? "sem_dado"
            : agua.alertas.total || agua.incompletos
              ? "fora"
              : "ok"
        }
        fonte="Limites em Parâmetros"
        href={ROTAS.agua}
      />,
    );
  if (energia)
    cartoes.push(
      <CartaoDaTela
        key="energia"
        titulo="Energia · locatários sem termo"
        valor={energia.caixas ? formatarNumero(energia.semTermo) : "—"}
        detalhe={
          energia.caixas
            ? `Ocupação das caixas ${formatarPct((energia.ocupadas / energia.caixas) * 100, 0)} (${formatarNumero(energia.ocupadas)} de ${formatarNumero(energia.caixas)})`
            : "Nenhum quadro cadastrado"
        }
        status={
          !energia.caixas ? "sem_dado" : energia.semTermo ? "atencao" : "ok"
        }
        fonte="Quadros de medidores"
        href={ROTAS.energia}
      />,
    );
  if (limpeza)
    cartoes.push(
      <CartaoDaTela
        key="limpeza"
        titulo={
          limpeza.referencia
            ? `Rateio limpeza · ${formatarMes(limpeza.referencia)}`
            : "Rateio da limpeza"
        }
        valor={
          limpeza.totalCentavos === null ? "—" : reais(limpeza.totalCentavos)
        }
        detalhe={
          !limpeza.referencia
            ? "Nenhum mês lançado"
            : limpeza.conferencia === "bate"
              ? "✓ Bate com o contrato"
              : limpeza.conferencia === "nao_bate"
                ? "✗ Não bate com o contrato"
                : limpeza.situacao
                  ? ROTULO_RATEIO[limpeza.situacao]
                  : "Sem total"
        }
        status={
          !limpeza.referencia
            ? "sem_dado"
            : limpeza.conferencia === "nao_bate" ||
                limpeza.situacao === "atrasado"
              ? "fora"
              : limpeza.conferencia === "bate"
                ? "ok"
                : "atencao"
        }
        fonte={`Rateio do mês · ${limpeza.empresa}`}
        href={ROTAS.limpeza}
      />,
    );
  if (contas && cartoes.length < 4)
    cartoes.push(
      <CartaoDaTela
        key="contas"
        titulo={
          contas.referencia
            ? `Energia · contas de ${formatarMes(contas.referencia)}`
            : "Energia · contas da área comum"
        }
        valor={contas.referencia ? reais(contas.totalCentavos) : "—"}
        detalhe={
          contas.referencia
            ? `Compensado ${reais(contas.compensadoCentavos)}`
            : "Nenhuma fatura importada"
        }
        fonte="Faturas da Energisa"
        href={ROTAS.contas}
      />,
    );
  if (diario && cartoes.length < 4)
    cartoes.push(
      <CartaoDaTela
        key="diario"
        titulo="Obras · prazo vencido"
        valor={diario.obras.length ? formatarNumero(diario.vencidas) : "—"}
        detalhe={`${formatarNumero(diario.aAprovar)} relatórios a aprovar`}
        status={
          !diario.obras.length ? "sem_dado" : diario.vencidas ? "fora" : "ok"
        }
        fonte="Diário de Obra"
        href={ROTAS.diario}
      />,
    );
  if (obras && cartoes.length < 4) {
    const fora = obras.obras.filter((o) => o.alerta).length;
    cartoes.push(
      <CartaoDaTela
        key="obras"
        titulo="Obras · desvio do orçamento"
        valor={obras.obras.length ? formatarNumero(fora) : "—"}
        detalhe={`obras fora do limite de ${formatarPct(obras.limitePct, 0)}`}
        status={!obras.obras.length ? "sem_dado" : fora ? "fora" : "ok"}
        fonte="Previsto e realizado"
        href={ROTAS.obras}
      />,
    );
  }
  if (!cartoes.length) return null;
  return <Cartoes modulo="operacoes">{cartoes.slice(0, 4)}</Cartoes>;
}

// ---------------------------------------------------------------------------
// Quadros por área
// ---------------------------------------------------------------------------

export function QuadroAgua({ a }: { a: PainelAgua }) {
  return (
    <Secao
      titulo="Água · consumo por bloco (m³)"
      descricao={
        a.referencia
          ? `${formatarMes(a.referencia)}, com o mês anterior na dica · soma das linhas importadas`
          : undefined
      }
      exemplo={a.exemplo && "leituras de água"}
    >
      {a.referencia ? (
        <>
          <BarrasHorizontais
            descricao="Consumo do mês por bloco"
            itens={a.blocos.map((b) => ({
              chave: b.bloco,
              rotulo: `Bloco ${b.bloco}`,
              valor: b.atual,
              texto: m3(b.atual),
              detalhe: `Mês anterior: ${m3(b.anterior)}`,
            }))}
          />
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Alertas">
            {(Object.keys(ALERTAS_AGUA) as AlertaAgua[]).map((k) => (
              <li key={k}>
                <SeloStatus
                  status={a.alertas.porTipo[k] ? "fora" : "ok"}
                  rotulo={`${ALERTAS_AGUA[k]}: ${a.alertas.porTipo[k]}`}
                />
              </li>
            ))}
            {a.incompletos > 0 && (
              <li>
                <SeloStatus
                  status="fora"
                  rotulo={`Meses incompletos: ${a.incompletos}`}
                />
              </li>
            )}
          </ul>
          <p className="mt-2 text-xs text-neutral-500">
            Limite do alerta: {m3(a.limite)} (Parâmetros).
          </p>
        </>
      ) : (
        <Vazio>
          Nenhuma leitura importada. Importe o faturamento do mês em Operações ›
          Importações.
        </Vazio>
      )}
      <AbrirTela href={ROTAS.agua} rotulo="Abrir Água" />
    </Secao>
  );
}

export function QuadroEnergia({ e }: { e: PainelEnergia }) {
  return (
    <Secao
      titulo="Energia · ocupação das caixas"
      descricao="Ocupadas ÷ total de caixas, por bloco"
      exemplo={e.exemplo && "quadros de medidores"}
    >
      {e.caixas ? (
        <>
          <BarrasHorizontais
            descricao="Ocupação das caixas por bloco"
            itens={e.blocos.map((b) => ({
              chave: b.bloco,
              rotulo: `Bloco ${b.bloco}`,
              valor: b.ocupacaoPct ?? 0,
              texto: formatarPct(b.ocupacaoPct, 0),
              detalhe: `${b.ocupadas} ocupadas, ${b.reservadas} reservadas, ${b.livres} livres · ${b.semTermo} sem termo`,
            }))}
          />
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Numero rotulo="Caixas" valor={formatarNumero(e.caixas)} />
            <Numero rotulo="Ocupadas" valor={formatarNumero(e.ocupadas)} />
            <Numero rotulo="Livres" valor={formatarNumero(e.livres)} />
            <Numero rotulo="Sem termo" valor={formatarNumero(e.semTermo)} />
          </div>
        </>
      ) : (
        <Vazio>
          Nenhum quadro cadastrado. Os quadros e as caixas entram pela carga
          inicial ou em Quadros de energia.
        </Vazio>
      )}
      <AbrirTela href={ROTAS.energia} rotulo="Abrir Quadros de energia" />
    </Secao>
  );
}

export function QuadroContas({
  c,
  comTotal,
  comSolar,
}: {
  c: PainelContas;
  comTotal: boolean;
  comSolar: boolean;
}) {
  return (
    <Secao
      titulo="Energia · contas da área comum"
      descricao={c.referencia ? formatarMes(c.referencia) : undefined}
      exemplo={c.exemplo && "faturas da Energisa"}
    >
      {c.referencia ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {comTotal && (
            <Numero
              rotulo="Total das faturas"
              valor={reais(c.totalCentavos)}
              detalhe={
                c.totalAnteriorCentavos !== null
                  ? `Mês anterior: ${reais(c.totalAnteriorCentavos)}`
                  : `${c.faturas} ${c.faturas === 1 ? "fatura" : "faturas"}`
              }
            />
          )}
          <Numero
            rotulo="Compensado pela geração solar"
            valor={reais(c.compensadoCentavos)}
            detalhe={kwh(c.compensadoKwh)}
          />
          {comSolar && (
            <>
              <Numero rotulo="Saldo de créditos" valor={kwh(c.saldoKwh)} />
              <Numero
                rotulo="A expirar no próximo ciclo"
                valor={kwh(c.expirarKwh)}
                detalhe={
                  <SeloStatus
                    status={c.expirarKwh > 0 ? "fora" : "ok"}
                    rotulo={
                      c.expirarKwh > 0 ? "Crédito a expirar" : "Meta: zero"
                    }
                  />
                }
              />
            </>
          )}
        </div>
      ) : (
        <Vazio>
          Nenhuma fatura importada. Importe as faturas da Energisa em Operações
          › Importações.
        </Vazio>
      )}
      <AbrirTela
        href={comTotal ? ROTAS.contas : ROTAS.solar}
        rotulo={comTotal ? "Abrir Contas de energia" : "Abrir Energia solar"}
      />
    </Secao>
  );
}

export function QuadroLimpeza({ l }: { l: PainelLimpeza }) {
  return (
    <Secao
      titulo="Rateio da limpeza"
      descricao={
        l.referencia
          ? `${formatarMes(l.referencia)} · total, conferência com o contrato e envio ao Financeiro`
          : undefined
      }
      exemplo={l.exemplo && "rateio da limpeza"}
    >
      {l.referencia ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Numero
            rotulo="Total do rateio"
            valor={l.totalCentavos === null ? "—" : reais(l.totalCentavos)}
            detalhe={
              l.contratoCentavos !== null
                ? `Contrato: ${reais(l.contratoCentavos)}`
                : "Sem a composição do contrato"
            }
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-neutral-500">Conferência</span>
            <SeloStatus
              status={
                l.conferencia === "bate"
                  ? "ok"
                  : l.conferencia === "nao_bate"
                    ? "fora"
                    : "sem_dado"
              }
              rotulo={
                l.conferencia === "bate"
                  ? "Bate com o contrato"
                  : l.conferencia === "nao_bate"
                    ? "Não bate com o contrato"
                    : l.conferencia === "sem_contrato"
                      ? "Sem contrato para conferir"
                      : "Falta valor base ou funcionários"
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-neutral-500">Situação</span>
            {l.situacao && (
              <SeloStatus
                status={STATUS_RATEIO[l.situacao]}
                rotulo={ROTULO_RATEIO[l.situacao]}
              />
            )}
          </div>
          <Numero
            rotulo={l.enviadoEm ? "Enviado em" : "Prazo do envio"}
            valor={formatarData(l.enviadoEm ?? l.prazo)}
            detalhe={
              l.enviadoEm
                ? `Prazo: ${formatarData(l.prazo)}`
                : "Dia útil limite em Parâmetros"
            }
          />
        </div>
      ) : (
        <Vazio>
          Nenhum mês do rateio. Lance o mês em Rateio da limpeza ou importe o
          histórico da planilha em Operações › Importações.
        </Vazio>
      )}
      <AbrirTela href={ROTAS.limpeza} rotulo="Abrir Rateio da limpeza" />
    </Secao>
  );
}

const COLUNAS_OBRAS: Coluna<ObraNoPainel>[] = [
  {
    titulo: "Obra",
    valor: (o) => (
      <span className="font-medium">
        {o.nome}
        {o.revisao && (
          <span className="ml-1 text-xs text-neutral-500">{o.revisao}</span>
        )}
      </span>
    ),
  },
  {
    titulo: "Orçamento",
    numero: true,
    valor: (o) => reais(o.orcamentoCentavos),
  },
  {
    titulo: "Previsto até o mês",
    numero: true,
    valor: (o) => reais(o.previstoAteCentavos),
  },
  {
    titulo: "Realizado",
    numero: true,
    valor: (o) => reais(o.realizadoCentavos),
  },
  { titulo: "Saldo", numero: true, valor: (o) => reais(o.saldoCentavos) },
  {
    titulo: "Desvio",
    valor: (o) =>
      o.desvioPct === null ? (
        <SeloStatus status="sem_dado" rotulo="Sem previsto" />
      ) : (
        <SeloStatus
          status={o.alerta ? "fora" : "ok"}
          rotulo={`${o.desvioPct > 0 ? "+" : ""}${formatarPct(o.desvioPct, 1)}`}
        />
      ),
  },
];

export function QuadroObras({ o }: { o: PainelObras }) {
  return (
    <Secao
      titulo="Obras · previsto × realizado"
      descricao={`Desembolso até o mês atual · desvio fora de ±${formatarPct(o.limitePct, 0)} (Parâmetros) é alerta`}
      exemplo={o.exemplo && "obras e orçamento"}
    >
      <Tabela
        colunas={COLUNAS_OBRAS}
        linhas={o.obras}
        chave={(x) => x.id}
        vazio="Nenhuma obra com orçamento. Importe a planilha de orçamento em Operações › Importações."
      />
      <AbrirTela href={ROTAS.obras} rotulo="Abrir Obras" />
    </Secao>
  );
}

export function QuadroDiario({ d }: { d: PainelDiario }) {
  const ativas = d.obras.filter((o) => o.statusId !== 4);
  return (
    <Secao
      titulo="Obras · avanço físico"
      descricao={`Diário de Obra${d.atualizadoEm ? ` · dados de ${formatarData(d.atualizadoEm)}` : ""} · desvio abaixo de ${formatarNumero(d.limiteDesvio)} pontos é alerta`}
      exemplo={d.exemplo && "obras do Diário de Obra"}
    >
      {d.obras.length ? (
        <>
          <BarrasHorizontais
            descricao="Avanço físico por obra"
            rotuloLargo
            itens={ativas.map((o) => ({
              chave: o.id,
              rotulo: o.nome,
              valor: o.avancoPct ?? 0,
              texto: formatarPct(o.avancoPct, 0),
              detalhe: [
                STATUS_OBRA_DIARIO[o.statusId] ?? `Status ${o.statusId}`,
                o.prazoPct !== null
                  ? `prazo consumido ${formatarPct(o.prazoPct, 0)}`
                  : null,
                o.desvio !== null
                  ? `desvio ${o.desvio > 0 ? "+" : ""}${formatarNumero(o.desvio, 1)} pontos`
                  : null,
                o.vencido ? "prazo vencido" : null,
              ]
                .filter(Boolean)
                .join(" · "),
            }))}
            vazio="Todas as obras do Diário de Obra estão concluídas."
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <SeloStatus
              status={d.vencidas ? "fora" : "ok"}
              rotulo={`Prazo vencido: ${d.vencidas}`}
            />
            <SeloStatus
              status={d.comAlerta ? "fora" : "ok"}
              rotulo={`Com alerta: ${d.comAlerta}`}
            />
            <SeloStatus
              status={d.aAprovar ? "atencao" : "ok"}
              rotulo={`Relatórios a aprovar: ${d.aAprovar}`}
            />
          </div>
        </>
      ) : (
        <Vazio>
          Nenhuma obra do Diário de Obra. A consulta começa quando o token do
          aplicativo for cadastrado em Administração › Integrações.
        </Vazio>
      )}
      <AbrirTela href={ROTAS.diario} rotulo="Abrir Diário de Obra" />
    </Secao>
  );
}

/** As áreas que têm dado de exemplo (selo do topo). */
export function exemplosDoPainel(d: DadosDoPainel): string | undefined {
  const lista = [
    d.agua?.exemplo && "água",
    d.energia?.exemplo && "quadros de energia",
    d.contas?.exemplo && "contas de energia",
    d.limpeza?.exemplo && "rateio da limpeza",
    d.obras?.exemplo && "obras",
    d.diario?.exemplo && "Diário de Obra",
  ].filter((x): x is string => !!x);
  return lista.length ? lista.join(", ") : undefined;
}
