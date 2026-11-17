import {
  formatarDataHora,
  formatarNumero,
  formatarPct,
} from "@arp/shared/formato";
import { type Campo, recebeResposta } from "@arp/shared/formularios/campos";
import {
  DIAS_DA_SEMANA,
  ddmm,
  FAIXAS_DE_HORA,
  haQuanto,
  type MetricasDasRespostas,
} from "@arp/shared/formularios/metricas";
import { AreaLinha } from "@/components/dashboard/graficos/area-linha";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import type { ItemGrafico } from "@/components/dashboard/graficos/base";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { MapaDeCalor } from "@/components/dashboard/graficos/mapa-calor";
import {
  CartaoIndicador,
  type Variacao,
} from "@/components/dashboard/indicador";
import { Secao } from "@/components/dashboard/tabela";

// Métricas da tela de Respostas: cartões de resumo, ritmo por dia, total
// acumulado, quando as pessoas respondem e quanto cada pergunta é
// respondida. Os números vêm de metricasDasRespostas (shared).

const plural = (n: number, um: string, varios: string) =>
  `${formatarNumero(n)} ${n === 1 ? um : varios}`;

/** Rótulo do eixo só a cada 7 dias (contando de hoje para trás). */
const rotuloDoDia = (k: number, total: number, dia: string) =>
  (total - 1 - k) % 7 === 0 ? (k === total - 1 ? "hoje" : ddmm(dia)) : "";

function variacaoDaSemana(m: MetricasDasRespostas): Variacao {
  const d = m.semana - m.semanaAnterior;
  if (!m.semanaAnterior)
    return {
      texto: m.semana
        ? "nenhuma nos 7 dias antes"
        : "nenhuma nos 7 dias antes também",
      sentido: "neutro",
    };
  return {
    texto: `${d > 0 ? "+" : ""}${formatarNumero(d)} (${d > 0 ? "+" : ""}${formatarPct((d / m.semanaAnterior) * 100, 0)}) vs 7 dias antes`,
    sentido: d > 0 ? "bom" : d < 0 ? "ruim" : "neutro",
  };
}

export function CartoesDasRespostas({
  m,
  agora,
}: {
  m: MetricasDasRespostas;
  agora: Date;
}) {
  const media = m.diasComResposta ? m.total / m.diasComResposta : 0;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <CartaoIndicador
        titulo="Respostas"
        tom="escuro"
        valor={formatarNumero(m.total)}
        calculo="Todas as respostas enviadas pelo link, desde a primeira."
        detalhe={
          m.primeira
            ? `Desde ${formatarDataHora(m.primeira).slice(0, 10)} · ${plural(m.diasComResposta, "dia", "dias")} com resposta`
            : undefined
        }
        meta={`${formatarNumero(media, 1)} por dia com resposta · ${formatarNumero(m.hoje)} hoje`}
      />
      <CartaoIndicador
        titulo="Últimos 7 dias"
        valor={formatarNumero(m.semana)}
        calculo="Respostas de hoje e dos 6 dias antes, comparadas com os 7 dias anteriores. A curva mostra as últimas 8 semanas."
        variacao={variacaoDaSemana(m)}
        serie={m.porSemana.map((s) => ({
          chave: s.ate,
          rotulo: ddmm(s.ate),
          titulo: `${ddmm(s.de)} a ${ddmm(s.ate)}`,
          valor: s.n,
          texto: plural(s.n, "resposta", "respostas"),
        }))}
      />
      <CartaoIndicador
        titulo="Completude"
        valor={formatarPct(m.completude * 100, 0)}
        calculo="Média, por resposta, das perguntas que a pessoa viu e respondeu. Perguntas escondidas por condição não contam."
        detalhe={`${plural(m.completas, "resposta", "respostas")} com tudo respondido`}
        meta={
          m.total - m.completas
            ? `${plural(m.total - m.completas, "deixou", "deixaram")} alguma em branco`
            : "Ninguém deixou pergunta em branco"
        }
      />
      <CartaoIndicador
        titulo="Última resposta"
        valor={m.ultima ? haQuanto(m.ultima, agora) : "—"}
        calculo="Horário de Brasília."
        detalhe={m.ultima ? formatarDataHora(m.ultima) : undefined}
      />
    </div>
  );
}

export function RespostasPorDia({ m }: { m: MetricasDasRespostas }) {
  const dias = m.porDia.length;
  const noPeriodo = m.porDia.reduce((s, d) => s + d.n, 0);
  const pico = m.porDia.reduce((a, d) => (d.n > a.n ? d : a), {
    dia: "",
    n: 0,
  });
  const porDia: ItemGrafico[] = m.porDia.map((d, k) => ({
    chave: d.dia,
    rotulo: rotuloDoDia(k, dias, d.dia),
    titulo: ddmm(d.dia),
    valor: d.n,
    texto: plural(d.n, "resposta", "respostas"),
    destaque: d.dia === pico.dia && pico.n > 0,
  }));
  return (
    <Secao
      titulo="Respostas por dia"
      descricao={`${plural(noPeriodo, "resposta", "respostas")} nos últimos ${dias} dias${pico.n ? ` · pico em ${ddmm(pico.dia)}, com ${formatarNumero(pico.n)}` : ""}.`}
    >
      <Colunas
        itens={porDia}
        descricao={`Respostas por dia nos últimos ${dias} dias`}
      />
    </Secao>
  );
}

export function TotalAcumulado({ m }: { m: MetricasDasRespostas }) {
  const dias = m.porDia.length;
  const acumulado: ItemGrafico[] = m.porDia.map((d, k) => ({
    chave: d.dia,
    rotulo: rotuloDoDia(k, dias, d.dia),
    titulo: ddmm(d.dia),
    valor: d.acumulado,
    texto: plural(d.acumulado, "resposta", "respostas"),
  }));
  return (
    <Secao
      titulo="Total acumulado"
      descricao={`De ${formatarNumero(m.porDia[0]?.acumulado ?? 0)} para ${formatarNumero(m.total)} nos últimos ${dias} dias.`}
    >
      <AreaLinha
        itens={acumulado}
        descricao={`Total acumulado de respostas nos últimos ${dias} dias`}
      />
    </Secao>
  );
}

export function HorariosDasRespostas({ m }: { m: MetricasDasRespostas }) {
  let melhor = { dia: 0, faixa: 0, n: 0 };
  for (const [dia, linha] of m.horarios.entries())
    for (const [faixa, n] of linha.entries())
      if (n > melhor.n) melhor = { dia, faixa, n };
  return (
    <Secao
      titulo="Quando as pessoas respondem"
      descricao={
        melhor.n
          ? `Mais respostas ${DIAS_DA_SEMANA[melhor.dia]}, ${FAIXAS_DE_HORA[melhor.faixa]} (${formatarNumero(melhor.n)}). Horário de Brasília.`
          : "Horário de Brasília."
      }
    >
      <MapaDeCalor
        descricao="Respostas por dia da semana e faixa de horário"
        rotuloValor="respostas"
        cor={3}
        linhas={[...DIAS_DA_SEMANA]}
        colunas={FAIXAS_DE_HORA}
        valores={m.horarios.map((l) => l.map((n) => n || null))}
      />
    </Secao>
  );
}

export function TaxaPorPergunta({
  m,
  campos,
}: {
  m: MetricasDasRespostas;
  campos: Campo[];
}) {
  const perguntas = campos.filter(recebeResposta);
  const itens: ItemGrafico[] = perguntas.flatMap((c, i) => {
    const p = m.porPergunta[i];
    if (!p) return [];
    const pct = p.viram ? (p.responderam / p.viram) * 100 : 0;
    return [
      {
        chave: c.id,
        rotulo: `${i + 1}. ${c.titulo || "Sem título"}`,
        valor: pct,
        texto: formatarPct(pct, 0),
        detalhe: `${formatarNumero(p.responderam)} de ${formatarNumero(p.viram)} que viram a pergunta`,
      },
    ];
  });
  const puladas = itens.filter((i) => i.valor < 100).length;
  return (
    <Secao
      titulo="Taxa de resposta por pergunta"
      descricao={
        puladas
          ? `${plural(puladas, "pergunta ficou", "perguntas ficaram")} em branco em alguma resposta. Conta só quem viu a pergunta.`
          : "Todas as perguntas foram respondidas por quem as viu."
      }
    >
      <BarrasHorizontais
        itens={itens}
        rotuloLargo
        descricao="Porcentagem de quem respondeu cada pergunta"
        vazio="Sem perguntas."
      />
    </Secao>
  );
}
