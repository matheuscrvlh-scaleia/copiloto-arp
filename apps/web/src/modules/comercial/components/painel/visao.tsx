import {
  type Formato,
  INDICADORES_PAINEL,
  type IndicadorPainel,
  type LinhaPainel,
  MESES_CURTOS,
} from "@arp/shared/comercial/painel";
import {
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@arp/shared/formato";
import { status } from "@arp/shared/indicadores";
import { useState } from "react";
import {
  BarrasHorizontais,
  Colunas,
  type CorSerie,
  type ItemGrafico,
  Linhas,
  type PontoEixo,
  type Unidade,
} from "@/components/dashboard/graficos";
import { CartaoIndicador } from "@/components/dashboard/indicador";
import { Secao } from "@/components/dashboard/tabela";
import { TOM, type Tom } from "@/components/estilos";

// Visão gráfica do Painel: cartões do ano e os gráficos mês a mês, montados
// das mesmas linhas da grade (Plan, Real e % atingido).

const UNIDADE: Record<Formato, Unidade> = {
  moeda: "moeda0",
  numero: "numero",
  pct: "pct",
};

function texto(v: number | null, f: Formato): string {
  if (v === null) return "—";
  if (f === "moeda") return formatarMoeda(v, 0);
  if (f === "pct") return formatarPct(v);
  return formatarNumero(v);
}

const ACUMULO = {
  soma: "Acumulado do ano",
  media: "Média dos meses",
  ultimo: "Último mês",
} as const;

const CARTOES: { indicador: IndicadorPainel; tom?: Tom }[] = [
  { indicador: "aumento_receita" },
  { indicador: "ocupacao" },
  { indicador: "saidas" },
];

/** Um indicador como cartão: acumulado do ano, meta e a série dos meses. */
function Cartao({
  l,
  tom,
  exemplo,
  children,
}: {
  l: LinhaPainel;
  tom?: Tom;
  exemplo?: string;
  children?: React.ReactNode;
}) {
  const def = INDICADORES_PAINEL[l.indicador];
  const a = l.acumulado;
  return (
    <CartaoIndicador
      titulo={def.nome}
      tom={tom}
      valor={texto(a.real, def.formato)}
      calculo={def.calculo}
      exemplo={exemplo}
      direcao={def.direcao}
      status={
        a.plan === null
          ? undefined
          : status(a.atingido, {
              meta: 100,
              limiteAtencao: null,
              direcao: def.direcao,
            })
      }
      detalhe={ACUMULO[def.acumulo]}
      meta={
        a.plan === null
          ? "Sem meta cadastrada"
          : `Plan ${texto(a.plan, def.formato)} · ${formatarPct(a.atingido)} atingido`
      }
      serie={l.real.flatMap((v, i) =>
        v === null
          ? []
          : [
              {
                chave: String(i),
                rotulo: MESES_CURTOS[i] as string,
                valor: v,
                texto: texto(v, def.formato),
              },
            ],
      )}
    >
      {children}
    </CartaoIndicador>
  );
}

/** Faturamento com a opção de ver, no mesmo cartão, o R$/m² médio. */
function CartaoFaturamento({
  faturamento,
  valorM2,
  exemplo,
}: {
  faturamento: LinhaPainel;
  valorM2: LinhaPainel | undefined;
  exemplo?: string;
}) {
  const [verM2, setVerM2] = useState(false);
  const l = verM2 && valorM2 ? valorM2 : faturamento;
  const botao = (ativo: boolean) =>
    `rounded-full px-2.5 py-1 text-xs font-medium transition ${ativo ? "bg-white text-neutral-900" : "text-white/70 hover:text-white"}`;
  return (
    <Cartao l={l} tom="escuro" exemplo={exemplo}>
      {valorM2 && (
        <fieldset className="flex w-fit gap-1 rounded-full bg-white/10 p-1">
          <legend className="sr-only">O que o cartão mostra</legend>
          <button
            type="button"
            aria-pressed={!verM2}
            className={botao(!verM2)}
            onClick={() => setVerM2(false)}
          >
            Acumulado
          </button>
          <button
            type="button"
            aria-pressed={verM2}
            className={botao(verM2)}
            onClick={() => setVerM2(true)}
          >
            R$/m² médio
          </button>
        </fieldset>
      )}
    </Cartao>
  );
}

/** Vários números do ano num quadro só (ex.: leads, contratos e clientes). */
function Quadro({
  titulo,
  itens,
  exemplo,
}: {
  titulo: string;
  itens: (LinhaPainel | undefined)[];
  exemplo?: string;
}) {
  const presentes = itens.filter((l): l is LinhaPainel => !!l);
  if (!presentes.length) return null;
  return (
    <div
      data-guia="cartao"
      data-guia-titulo={titulo}
      className={`${TOM.claro} flutua relative flex h-full flex-col gap-3 rounded-[1.75rem] p-5 hover:z-10`}
    >
      <p className="text-sm font-medium text-neutral-600">
        {titulo}
        {exemplo && (
          <span className="ml-2 text-xs font-normal text-amber-700">
            ({exemplo})
          </span>
        )}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {presentes.map((l) => {
          const def = INDICADORES_PAINEL[l.indicador];
          return (
            <div key={l.indicador} className="min-w-0">
              <dt className="text-xs text-neutral-500" title={def.calculo}>
                {def.nome}
              </dt>
              <dd className="text-2xl font-semibold tracking-tight tabular-nums">
                {texto(l.acumulado.real, def.formato)}
              </dd>
              <dd className="text-[11px] text-neutral-400">
                {ACUMULO[def.acumulo]}
                {l.acumulado.plan !== null &&
                  ` · Plan ${texto(l.acumulado.plan, def.formato)}`}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function VisaoPainel({
  ano,
  linhas,
  exemplo,
}: {
  ano: number;
  linhas: LinhaPainel[];
  exemplo?: string;
}) {
  const de = (i: IndicadorPainel) => linhas.find((l) => l.indicador === i);
  const yy = String(ano).slice(2);
  const pontos: PontoEixo[] = MESES_CURTOS.map((m) => ({
    chave: m,
    rotulo: m,
    titulo: `${m}/${yy}`,
  }));

  const planReal = (i: IndicadorPainel, cor: CorSerie = 1) => {
    const l = de(i);
    if (!l) return null;
    const def = INDICADORES_PAINEL[i];
    return (
      <Linhas
        pontos={pontos}
        unidade={UNIDADE[def.formato]}
        zero={def.formato !== "pct"}
        descricao={`${def.nome}: Plan e Real por mês de ${ano}`}
        series={[
          { chave: "real", rotulo: "Real", cor, valores: l.real },
          { chave: "plan", rotulo: "Plan", cor: "neutro", valores: l.plan },
        ]}
      />
    );
  };

  const leads = de("leads");
  const faturamento = de("faturamento");
  const midia = de("receita_midia");
  const eventos = de("receita_eventos");
  const fechados = de("contratos_fechados");
  const rescindidos = de("contratos_rescindidos");

  const atingimento: ItemGrafico[] = linhas
    .filter(
      (l) =>
        l.acumulado.atingido !== null &&
        INDICADORES_PAINEL[l.indicador].direcao === "maior_melhor",
    )
    .map((l) => ({
      chave: l.indicador,
      rotulo: INDICADORES_PAINEL[l.indicador].nome,
      valor: l.acumulado.atingido as number,
      texto: formatarPct(l.acumulado.atingido),
      detalhe: `Real ${texto(l.acumulado.real, INDICADORES_PAINEL[l.indicador].formato)} · Plan ${texto(l.acumulado.plan, INDICADORES_PAINEL[l.indicador].formato)}`,
    }));

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {faturamento && (
          <CartaoFaturamento
            faturamento={faturamento}
            valorM2={de("valor_m2")}
            exemplo={exemplo}
          />
        )}
        {CARTOES.map(({ indicador, tom }) => {
          const l = de(indicador);
          return l ? (
            <Cartao key={indicador} l={l} tom={tom} exemplo={exemplo} />
          ) : null;
        })}
        <Quadro
          titulo="Leads, contratos e clientes"
          exemplo={exemplo}
          itens={[
            leads,
            de("leads_midia"),
            de("contratos_ativos"),
            de("clientes"),
          ]}
        />
        <Quadro
          titulo="Relacionamento: visitas e NPS"
          itens={[de("visitas"), de("nps")]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {de("faturamento") && (
          <Secao titulo="Faturamento: Plan × Real" exemplo={exemplo}>
            {planReal("faturamento")}
          </Secao>
        )}
        {fechados && rescindidos && (
          <Secao titulo="Contratos fechados × rescindidos" exemplo={exemplo}>
            <Linhas
              pontos={pontos}
              unidade="moeda0"
              descricao={`Contratos fechados e rescindidos em reais, por mês de ${ano}`}
              series={[
                {
                  chave: "fechados",
                  rotulo: "Fechados",
                  cor: 1,
                  valores: fechados.real,
                },
                {
                  chave: "rescindidos",
                  rotulo: "Rescindidos",
                  cor: 4,
                  valores: rescindidos.real,
                },
              ]}
            />
          </Secao>
        )}
        {de("ocupacao") && (
          <Secao titulo="% Ocupação: Plan × Real" exemplo={exemplo}>
            {planReal("ocupacao", 2)}
          </Secao>
        )}
        {leads && (
          <Secao titulo="Leads por mês" exemplo={exemplo}>
            <Colunas
              descricao={`Oportunidades abertas no RD por mês de ${ano}`}
              itens={leads.real.flatMap((v, i) =>
                v === null
                  ? []
                  : [
                      {
                        chave: String(i),
                        rotulo: MESES_CURTOS[i] as string,
                        titulo: `${MESES_CURTOS[i]}/${yy}`,
                        valor: v,
                        texto: formatarNumero(v),
                        detalhe:
                          leads.plan[i] === null
                            ? undefined
                            : `Plan ${formatarNumero(leads.plan[i] as number)}`,
                      },
                    ],
              )}
            />
          </Secao>
        )}
        {midia && eventos && (
          <Secao
            titulo="Receita com mídia e eventos"
            exemplo={exemplo}
            className={atingimento.length ? "" : "xl:col-span-2"}
          >
            <Linhas
              pontos={pontos}
              unidade="moeda0"
              descricao={`Receita com mídia e com eventos por mês de ${ano}`}
              series={[
                {
                  chave: "midia",
                  rotulo: "Mídia",
                  cor: 3,
                  valores: midia.real,
                },
                {
                  chave: "eventos",
                  rotulo: "Eventos",
                  cor: 5,
                  valores: eventos.real,
                },
              ]}
            />
          </Secao>
        )}
        {atingimento.length > 0 && (
          <Secao
            titulo="% atingido no ano"
            descricao="Real ÷ Plan no acumulado, nos indicadores em que maior é melhor."
            exemplo={exemplo}
          >
            <BarrasHorizontais
              rotuloLargo
              itens={atingimento}
              meta={{ valor: 100, texto: "Meta 100%" }}
              descricao="% atingido no acumulado do ano por indicador"
            />
          </Secao>
        )}
      </div>
    </>
  );
}
