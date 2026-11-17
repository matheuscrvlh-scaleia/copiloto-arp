import {
  formatarData,
  formatarMoeda,
  formatarNumero,
} from "@arp/shared/formato";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useDeferredValue, useMemo } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { FiltroPeriodo } from "@/components/dashboard/filtro-periodo";
import { CartaoIndicador } from "@/components/dashboard/indicador";
import { Nota, Secao } from "@/components/dashboard/tabela";
import {
  AbasDaTela,
  Cartoes,
  hrefCom,
  TopoDaTela,
  variacaoContra,
} from "@/components/dashboard/tela";
import { PageHeader } from "@/components/page-header";
import { useBusca } from "@/lib/navegacao";
import { consultaDoEstacionamento, periodoDaBusca } from "../api";
import {
  AbaBeneficios,
  AbaFluxo,
  AbaMensalistas,
  AbaOcorrencias,
  AbaReceita,
} from "../components/estacionamento";

const ENDERECO = "/financeiro/estacionamento";

const ABAS = [
  { chave: "receita", rotulo: "Receita" },
  { chave: "fluxo", rotulo: "Fluxo de veículos" },
  { chave: "beneficios", rotulo: "Benefícios" },
  { chave: "mensalistas", rotulo: "Mensalistas" },
  { chave: "ocorrencias", rotulo: "Ocorrências" },
] as const;

export default function Page() {
  return (
    <>
      <PageHeader
        title="Estacionamento"
        description="Receita, fluxo de veículos, benefícios, valet e mensalistas do estacionamento, lidos da WPS todo dia."
      />
      <Suspense fallback={<Esqueleto />}>
        <Estacionamento />
      </Suspense>
    </>
  );
}

function Estacionamento() {
  const busca = useBusca();
  // Adiado: ao trocar o período, a tela antiga fica até a nova chegar.
  const filtrosDaUrl = useDeferredValue(
    useMemo(() => periodoDaBusca(busca), [busca]),
  );
  const { data: d } = useSuspenseQuery(consultaDoEstacionamento(filtrosDaUrl));
  const { periodo, anterior, hoje } = d.filtros;
  const pedida = Array.isArray(busca.aba) ? busca.aba[0] : busca.aba;
  const aba = ABAS.find((a) => a.chave === pedida)?.chave ?? "receita";
  const rotuloAnt = `${formatarData(anterior.de)} a ${formatarData(anterior.ate)}`;

  const filtro = (
    <FiltroPeriodo
      de={periodo.de}
      ate={periodo.ate}
      atalho={periodo.atalho}
      hoje={hoje}
    />
  );

  if (!d.garagem) {
    return (
      <div className="flex flex-col gap-6">
        {filtro}
        <Secao titulo="Ainda sem dados da WPS">
          <p className="text-sm text-neutral-600">
            O estacionamento ainda não foi sincronizado. Em Administração ›
            Integrações, cadastre o endereço da API, o usuário, a senha e o id
            do estacionamento da WPS e use "Sincronizar agora". Depois disso, a
            leitura é automática todo dia às 07h00.
          </p>
        </Secao>
      </div>
    );
  }

  const r = d.receita;
  const f = d.fluxo;
  const m = d.mensalistas;
  const ticketMedio = r.pagamentos ? r.liquida / r.pagamentos : null;
  const beneficios = d.eventos
    .filter((e) =>
      ["desconto", "validacao", "selo_utilizado", "abono_utilizado"].includes(
        e.tipo,
      ),
    )
    .reduce((s, e) => s + e.ocorrencias, 0);

  return (
    <div className="flex flex-col gap-6">
      {filtro}
      <TopoDaTela
        dadosDe={`Dados até ${formatarData(d.garagem.dados_ate)}`}
        reais="WPS"
        filtros={`${d.garagem.nome ?? `Estacionamento ${d.garagem.id}`} · ${d.filtros.rotulo}`}
      />

      <Cartoes modulo="financeiro">
        <CartaoIndicador
          titulo="Receita do estacionamento"
          valor={formatarMoeda(r.liquida, 0)}
          variacao={variacaoContra(r.liquida, r.anterior.liquida, rotuloAnt)}
          detalhe={`${formatarNumero(r.pagamentos)} pagamentos · ticket médio ${formatarMoeda(ticketMedio)}`}
          calculo="Soma do valor pago (líquido) no período. O pagamento listado pela WPS em mais de uma forma conta uma vez só."
          serie={r.por_dia.map((p) => ({
            chave: p.data,
            rotulo: p.data.slice(8, 10),
            titulo: formatarData(p.data),
            valor: p.liquida,
            texto: formatarMoeda(p.liquida),
          }))}
        />
        <CartaoIndicador
          titulo="Entradas de veículos"
          valor={formatarNumero(f.entradas)}
          variacao={variacaoContra(f.entradas, f.anterior.entradas, rotuloAnt)}
          detalhe={`${formatarNumero(f.saidas)} saídas · ${formatarNumero(f.entradas / Math.max(f.dias, 1))} por dia`}
          calculo="Entradas registradas nas cancelas, de todos os tipos de veículo e de cliente."
        />
        <CartaoIndicador
          titulo="Descontos concedidos"
          valor={formatarMoeda(r.descontos, 0)}
          detalhe={`${r.bruta ? formatarNumero((r.descontos / r.bruta) * 100, 1) : "0"}% da tarifa cheia · ${formatarNumero(beneficios)} benefícios aplicados`}
          calculo="Diferença entre a tarifa cheia e o valor pago nos pagamentos do período (descontos, validações, selos e abonos)."
        />
        <CartaoIndicador
          titulo="Mensalidades em atraso"
          valor={formatarMoeda(m.em_atraso.valor, 0)}
          detalhe={`${formatarNumero(m.em_atraso.quantidade)} parcelas vencidas · hoje`}
          calculo="Mensalidades com vencimento antes de hoje que não estão baixadas, canceladas nem inativas, pelo valor em aberto."
        />
      </Cartoes>

      <AbasDaTela
        rotulo="Assuntos do estacionamento"
        ativa={aba}
        abas={ABAS.map((a) => ({
          ...a,
          href: hrefCom(ENDERECO, busca, {
            aba: a.chave === "receita" ? null : a.chave,
          }),
        }))}
      />

      {aba === "receita" && <AbaReceita d={d} />}
      {aba === "fluxo" && <AbaFluxo d={d} />}
      {aba === "beneficios" && <AbaBeneficios d={d} />}
      {aba === "mensalistas" && <AbaMensalistas d={d} />}
      {aba === "ocorrencias" && <AbaOcorrencias d={d} />}

      <Nota>
        Fonte: WPS (Parking Plus), garagem {d.garagem.id}. A leitura diária
        refaz os últimos 7 dias (pagamento estornado ou lançado depois entra na
        próxima leitura); o dia de hoje entra amanhã. Placas, documentos e nomes
        de operadores e de clientes pessoa física não são trazidos.
      </Nota>
    </div>
  );
}

/** Blocos no lugar da tela enquanto os dados chegam. */
function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando quantidade={4} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CartaoCarregando className="lg:col-span-2" altura="h-80" />
        <CartaoCarregando altura="h-80" />
      </div>
    </TelaCarregando>
  );
}
