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
import type { Tom } from "@/components/estilos";
import {
  type Formato,
  INDICADORES_PAINEL,
  type IndicadorPainel,
  type LinhaPainel,
  MESES_CURTOS,
} from "@/lib/comercial/painel";
import { formatarMoeda, formatarNumero, formatarPct } from "@/lib/formato";
import { status } from "@/lib/indicadores";

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
  { indicador: "faturamento", tom: "escuro" },
  { indicador: "aumento_receita" },
  { indicador: "ocupacao" },
  { indicador: "leads" },
  { indicador: "churn" },
  { indicador: "clientes" },
];

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
        {CARTOES.map(({ indicador, tom }) => {
          const l = de(indicador);
          if (!l) return null;
          const def = INDICADORES_PAINEL[indicador];
          const a = l.acumulado;
          return (
            <CartaoIndicador
              key={indicador}
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
            />
          );
        })}
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
