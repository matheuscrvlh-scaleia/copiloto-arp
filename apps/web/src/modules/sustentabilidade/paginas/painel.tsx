import { linhaDeFiltros } from "@arp/shared/comercial/formato";
import {
  ateMesPadrao,
  mesesQueFaltam,
  NOMES_DOS_MESES,
  periodoEscrito,
} from "@arp/shared/sustentabilidade/painel-indicadores";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarRange, GitCompareArrows } from "lucide-react";
import { Suspense, useDeferredValue } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { TopoDaTela } from "@/components/dashboard/tela";
import { BotaoExportar } from "@/components/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { usePermissao } from "@/lib/sessao";
import { consultaDoPainel } from "../api-painel";
import { CartoesDoPainel } from "../components/painel/cartoes";
import { ConsolidadosAnuais } from "../components/painel/consolidados";
import { FecharAno } from "../components/painel/fechar-ano";
import { GraficosDoPainel } from "../components/painel/graficos";
import { BotaoRelatorioDoMes } from "../components/painel/relatorio";
import { type FiltrosSu, useFiltrosSu } from "../contexto-su";

export default function Painel() {
  return (
    <>
      <PageHeader
        title="Painel de Sustentabilidade"
        description="Os indicadores da planilha que a área apresenta ao Pedro, calculados sozinhos a partir das telas do módulo e do Módulo Operações. Cada número abre a tela de onde veio."
      />
      <Protegido permissao="sustentabilidade.painel">
        <Suspense fallback={<Esqueleto />}>
          <ComFiltros />
        </Suspense>
      </Protegido>
    </>
  );
}

/** Espera os filtros lembrados antes de pedir o painel (como no servidor antigo). */
function ComFiltros() {
  const filtros = useFiltrosSu("painel");
  if (!filtros) return <Esqueleto />;
  return <Tela filtros={filtros} />;
}

function Tela({ filtros }: { filtros: FiltrosSu }) {
  const { um } = filtros;
  const pedido = useDeferredValue({
    ano: um("ano"),
    ate: um("ate"),
    comparar: um("comparar"),
  });
  const { data: d } = useSuspenseQuery(consultaDoPainel(pedido));
  const exportar = usePermissao("sustentabilidade.exportar");
  const podeFechar = usePermissao("sustentabilidade.parametros");
  const f = d.filtros;

  const anoAtual = Number(d.hoje.slice(0, 4));
  const padraoAte = ateMesPadrao(f.ano, d.hoje);
  const nomeDoMes = NOMES_DOS_MESES[f.ateMes - 1] ?? "";
  const mesDoRelatorio = `${f.ano}-${String(f.ateMes).padStart(2, "0")}`;

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Ano", valor: String(f.ano) },
    { rotulo: "Até o mês", valor: `${nomeDoMes} (${periodoEscrito(f)})` },
    {
      rotulo: "Comparar com o ano anterior",
      valor: f.comparar ? `Sim (${f.ano - 1})` : "Não",
    },
  ]);
  const comExemplo = d.exemplo.join(", ");

  return (
    <div className="flex flex-col gap-6">
      <BarraDeFiltros
        modulo="sustentabilidade"
        tela="painel"
        hoje={d.hoje}
        lembrado={filtros.lembrado}
        selecoes={[
          {
            chave: "ano",
            rotulo: "Ano",
            todos: `Ano atual (${anoAtual})`,
            valor: f.ano === anoAtual ? "" : String(f.ano),
            icone: <CalendarDays className="size-4" />,
            largura: "w-44",
            opcoes: d.anos
              .filter((a) => a !== anoAtual)
              .map((a) => ({ valor: String(a), rotulo: String(a) })),
          },
          {
            chave: "ate",
            rotulo: "Até o mês",
            todos: `Até ${NOMES_DOS_MESES[padraoAte - 1]}`,
            valor: f.ateMes === padraoAte ? "" : String(f.ateMes),
            icone: <CalendarRange className="size-4" />,
            largura: "w-48",
            opcoes: NOMES_DOS_MESES.map((m, i) => ({
              valor: String(i + 1),
              rotulo: m.charAt(0).toUpperCase() + m.slice(1),
            })),
          },
          {
            chave: "comparar",
            rotulo: "Comparar com o ano anterior",
            todos: "Não comparar",
            valor: f.comparar ? "sim" : "",
            icone: <GitCompareArrows className="size-4" />,
            largura: "w-56",
            opcoes: [{ valor: "sim", rotulo: `Comparar com ${f.ano - 1}` }],
          },
        ]}
      />

      <TopoDaTela
        dadosDe={d.dadosDe}
        filtros={linhaFiltros}
        exemplo={comExemplo || undefined}
        acoes={
          <>
            <BotaoRelatorioDoMes mes={mesDoRelatorio} />
            {podeFechar && d.anoDoFiltro !== "fechado" && f.ano <= anoAtual && (
              <FecharAno ano={f.ano} faltam={mesesQueFaltam(f.ano, d.hoje)} />
            )}
            {exportar && (
              <BotaoExportar
                titulo="Painel de Sustentabilidade"
                filtros={`${linhaFiltros} · ${d.dadosDe}`}
                nomeArquivo="painel-de-sustentabilidade"
                colunas={[
                  { titulo: "Indicador" },
                  { titulo: "Valor" },
                  { titulo: "Detalhe" },
                  { titulo: "Meta" },
                ]}
                linhas={d.painel.cartoes.map((c) => [
                  c.titulo,
                  c.valor,
                  [c.detalhe, c.aviso].filter(Boolean).join(" · "),
                  c.meta ?? "",
                ])}
              />
            )}
          </>
        }
      />

      {d.avisoDoAno && (
        <output
          data-guia="painel-aviso-consolidado"
          className="block rounded-2xl border border-amber-400/40 bg-amber-400/15 px-4 py-3 text-sm text-amber-950"
        >
          O ano {f.ano} está fechado, mas lançamentos dele mudaram depois do
          fechamento. O consolidado não mudou; veja as diferenças em
          “Consolidados anuais” abaixo e reabra o ano, com o motivo, para
          atualizar.
        </output>
      )}
      {d.operacoesIndisponivel && (
        <output className="block rounded-2xl border border-amber-400/40 bg-amber-400/15 px-4 py-3 text-sm text-amber-950">
          Não foi possível ler a energia e a água de Operações agora. Esses
          números aparecem como “sem dado”. Atualize a página em alguns minutos.
        </output>
      )}

      <CartoesDoPainel cartoes={d.painel.cartoes} />

      {d.painel.equivalencias.length > 0 && (
        <Secao
          titulo="Equivalências do volume reciclado"
          descricao="Toneladas recicladas no ano × fator confirmado com a área (Parâmetros › Painel)."
        >
          <ul
            data-guia="painel-equivalencias"
            className="flex flex-wrap gap-2 text-sm"
          >
            {d.painel.equivalencias.map((e) => (
              <li
                key={e.nome}
                className="rounded-full bg-neutral-900/[0.06] px-3 py-1"
              >
                {e.nome}: {e.texto}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <GraficosDoPainel graficos={d.painel.graficos} />

      <ConsolidadosAnuais
        linhas={d.consolidados}
        comValores={d.comValores}
        podeFechar={podeFechar}
        hoje={d.hoje}
      />

      <Nota>
        Energia e água vêm do Módulo Operações (só leitura); este módulo não
        consulta o Growatt. Valores em reais só aparecem com a permissão de ver
        valores. Mês sem dado aparece como “sem dado”, nunca como zero.
        {comExemplo ? ` Dados de exemplo (fictícios) em: ${comExemplo}.` : ""}
      </Nota>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-4"
        quantidade={12}
      />
      <CartaoCarregando altura="h-80" />
    </TelaCarregando>
  );
}
