import {
  type CategoriaDeEvento,
  type FatiaEstacionamento,
  type ParcelaEmAtraso,
  type RespostaEstacionamento,
  ROTULO_CLIENTE,
  ROTULO_EVENTO,
  ROTULO_FORMA,
  ROTULO_VEICULO,
  rotuloDe,
  type TipoDeEvento,
} from "@arp/shared/financeiro/estacionamento";
import {
  formatarData,
  formatarMes,
  formatarMoeda,
  formatarNumero,
} from "@arp/shared/formato";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import type { ItemGrafico } from "@/components/dashboard/graficos/base";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { Linhas } from "@/components/dashboard/graficos/linhas";
import { Nota, Secao, Tabela } from "@/components/dashboard/tabela";
import { Fonte } from "@/components/dashboard/tela";

// Blocos das abas da tela Financeiro › Estacionamento. Os números vêm
// somados da API; aqui só se formata.

type Dados = RespostaEstacionamento;

const SEM_DADOS = "Sem dados no período.";
const FONTE = "WPS (Parking Plus), sincronizada todo dia às 07h00";

/** "2026-11-03" → "03/11". */
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Fatias em barras: em R$ (com a quantidade na dica) ou em quantidade. */
function barras(
  lista: FatiaEstacionamento[],
  rotulos: Record<string, string>,
  medida: "valor" | "quantidade",
  unidadeDaQuantidade = "pagamentos",
): ItemGrafico[] {
  return lista.map((f) => ({
    chave: f.chave || "nao_informado",
    rotulo: rotuloDe(rotulos, f.chave),
    valor: f[medida],
    texto:
      medida === "valor"
        ? formatarMoeda(f.valor)
        : formatarNumero(f.quantidade),
    detalhe:
      medida === "valor"
        ? `${formatarNumero(f.quantidade)} ${unidadeDaQuantidade}`
        : undefined,
  }));
}

const dosTipos = (categorias: CategoriaDeEvento[], tipos: TipoDeEvento[]) =>
  categorias.filter((c) => tipos.includes(c.tipo));

/** Linha de resumo de um tipo de evento (zero quando não houve). */
function resumo(d: Dados, tipo: TipoDeEvento) {
  const e = d.eventos.find((x) => x.tipo === tipo);
  return {
    tipo,
    ocorrencias: e?.ocorrencias ?? 0,
    quantidade: e?.quantidade ?? 0,
    valor: e?.valor ?? 0,
  };
}

function TabelaDeEventos({
  d,
  tipos,
  comValor = true,
  vazio,
}: {
  d: Dados;
  tipos: TipoDeEvento[];
  comValor?: boolean;
  vazio?: string;
}) {
  const linhas = tipos.map((t) => resumo(d, t));
  return (
    <Tabela
      caber
      chave={(l) => l.tipo}
      linhas={linhas}
      vazio={vazio}
      colunas={[
        { titulo: "O quê", valor: (l) => ROTULO_EVENTO[l.tipo] },
        {
          titulo: "Ocorrências",
          numero: true,
          valor: (l) =>
            l.tipo === "manutencao_patio" && l.ocorrencias > 0
              ? `${formatarNumero(l.ocorrencias)} (${formatarNumero(l.quantidade)} veículos)`
              : formatarNumero(l.ocorrencias),
        },
        ...(comValor
          ? [
              {
                titulo: "Valor",
                numero: true,
                valor: (l: (typeof linhas)[number]) =>
                  l.valor ? formatarMoeda(l.valor) : "—",
              },
            ]
          : []),
      ]}
    />
  );
}

function TabelaDeCategorias({
  linhas,
  vazio,
}: {
  linhas: CategoriaDeEvento[];
  vazio: string;
}) {
  return (
    <Tabela
      caber
      chave={(c) => `${c.tipo}|${c.categoria}|${c.situacao ?? ""}`}
      linhas={linhas}
      vazio={vazio}
      colunas={[
        { titulo: "Tipo", valor: (c) => ROTULO_EVENTO[c.tipo] },
        {
          titulo: "Categoria",
          valor: (c) =>
            [rotuloDe({}, c.categoria), c.situacao && rotuloDe({}, c.situacao)]
              .filter(Boolean)
              .join(" · "),
        },
        {
          titulo: "Ocorrências",
          numero: true,
          valor: (c) => formatarNumero(c.ocorrencias),
        },
        {
          titulo: "Valor",
          numero: true,
          valor: (c) => (c.valor ? formatarMoeda(c.valor) : "—"),
        },
      ]}
    />
  );
}

// --- Abas --------------------------------------------------------------------

export function AbaReceita({ d }: { d: Dados }) {
  const r = d.receita;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Secao
          titulo="Receita por dia"
          descricao={`${d.filtros.rotulo} · valor pago (líquido)`}
          className="lg:col-span-2"
          calculo="Soma do valor pago em cada dia. O pagamento que a WPS lista em mais de uma forma (ex.: cartão e desconto) conta uma vez só."
        >
          {r.por_dia.length ? (
            <Colunas
              descricao="Receita líquida do estacionamento por dia"
              itens={r.por_dia.map((p) => ({
                chave: p.data,
                rotulo: diaMes(p.data),
                titulo: formatarData(p.data),
                valor: p.liquida,
                texto: formatarMoeda(p.liquida),
                detalhe: `${formatarNumero(p.pagamentos)} pagamentos`,
              }))}
            />
          ) : (
            <Nota>{SEM_DADOS}</Nota>
          )}
          <Fonte>{FONTE}</Fonte>
        </Secao>
        <Secao
          titulo="Por forma de pagamento"
          descricao="Como foi pago"
          calculo="Grupo da forma de pagamento na WPS. Pagamento com desconto conta na forma em que foi pago."
        >
          <BarrasHorizontais
            descricao="Receita por forma de pagamento"
            itens={barras(r.por_forma, ROTULO_FORMA, "valor")}
          />
        </Secao>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Secao titulo="Por tipo de cliente" descricao="Quem pagou">
          <BarrasHorizontais
            descricao="Receita por tipo de cliente"
            itens={barras(r.por_tipo_cliente, ROTULO_CLIENTE, "valor")}
          />
        </Secao>
        <Secao
          titulo="Tarifas que mais renderam"
          descricao="As 10 maiores do período"
        >
          <Tabela
            caber
            chave={(t) => t.chave || "nao_informado"}
            linhas={r.por_tarifa}
            vazio={SEM_DADOS}
            colunas={[
              { titulo: "Tarifa", valor: (t) => t.chave || "Não informada" },
              {
                titulo: "Pagamentos",
                numero: true,
                valor: (t) => formatarNumero(t.quantidade),
              },
              {
                titulo: "Receita",
                numero: true,
                valor: (t) => formatarMoeda(t.valor),
              },
            ]}
          />
        </Secao>
      </div>
    </div>
  );
}

export function AbaFluxo({ d }: { d: Dados }) {
  const f = d.fluxo;
  const dias = Math.max(f.dias, 1);
  const manobras = dosTipos(d.categorias, ["manobra"]);
  return (
    <div className="flex flex-col gap-4">
      <Secao
        titulo="Entradas e saídas por dia"
        descricao={`${d.filtros.rotulo} · veículos de todos os tipos`}
      >
        {f.por_dia.length ? (
          <Linhas
            descricao="Entradas e saídas de veículos por dia"
            pontos={f.por_dia.map((p) => ({
              chave: p.data,
              rotulo: diaMes(p.data),
              titulo: formatarData(p.data),
            }))}
            series={[
              {
                chave: "entradas",
                rotulo: "Entradas",
                cor: 1,
                valores: f.por_dia.map((p) => p.entradas),
              },
              {
                chave: "saidas",
                rotulo: "Saídas",
                cor: 2,
                valores: f.por_dia.map((p) => p.saidas),
              },
            ]}
          />
        ) : (
          <Nota>{SEM_DADOS}</Nota>
        )}
        <Fonte>{FONTE}</Fonte>
      </Secao>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Secao
          titulo="Entradas por hora"
          descricao={`Média por dia (${formatarNumero(f.dias)} dias com movimento)`}
          className="lg:col-span-2"
          calculo="Entradas de cada hora somadas no período ÷ dias com movimento. Mostra o pico do dia."
        >
          <Colunas
            descricao="Média de entradas de veículos por hora do dia"
            itens={f.por_hora.map((h) => ({
              chave: String(h.hora),
              rotulo: `${h.hora}h`,
              titulo: `Das ${h.hora}h às ${h.hora + 1}h`,
              valor: h.entradas / dias,
              texto: formatarNumero(h.entradas / dias, 1),
              detalhe: `Saídas: ${formatarNumero(h.saidas / dias, 1)} por dia`,
            }))}
          />
        </Secao>
        <Secao titulo="Por tipo de cliente" descricao="Entradas no período">
          <BarrasHorizontais
            descricao="Entradas por tipo de cliente"
            itens={barras(f.por_tipo_cliente, ROTULO_CLIENTE, "quantidade")}
          />
        </Secao>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Secao titulo="Por tipo de veículo" descricao="Entradas no período">
          <BarrasHorizontais
            descricao="Entradas por tipo de veículo"
            itens={barras(f.por_veiculo, ROTULO_VEICULO, "quantidade")}
          />
        </Secao>
        <Secao
          titulo="Por serviço"
          descricao="Comum, valet e tags (Sem Parar, ConectCar…)"
        >
          <BarrasHorizontais
            descricao="Entradas por tipo de serviço"
            itens={barras(f.por_servico, {}, "quantidade")}
          />
        </Secao>
        <Secao
          titulo="Manobras (valet)"
          descricao="Eventos do valet no período"
        >
          <BarrasHorizontais
            descricao="Eventos de manobra do valet"
            vazio="Nenhuma manobra no período."
            itens={manobras.map((m) => ({
              chave: m.categoria || "nao_informado",
              rotulo: rotuloDe({}, m.categoria),
              valor: m.ocorrencias,
              texto: formatarNumero(m.ocorrencias),
            }))}
          />
        </Secao>
      </div>
      <Nota>
        {f.tickets_cancelados > 0 &&
          `${formatarNumero(f.tickets_cancelados)} tickets cancelados na entrada (já contados nas entradas). `}
        {d.garagem?.vagas
          ? `Capacidade cadastrada na WPS: ${formatarNumero(d.garagem.vagas)} vagas${d.garagem.vagas_mensalistas ? ` (${formatarNumero(d.garagem.vagas_mensalistas)} de mensalistas)` : ""}.`
          : ""}
      </Nota>
    </div>
  );
}

export function AbaBeneficios({ d }: { d: Dados }) {
  const descontos = dosTipos(d.categorias, ["desconto"]);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Secao
          titulo="Benefícios concedidos"
          descricao={d.filtros.rotulo}
          calculo="Descontos, validações (hipermercado e convênio por CPF), selos e abonos aplicados nos tickets. O valor é o que deixou de ser cobrado."
        >
          <TabelaDeEventos
            d={d}
            tipos={[
              "desconto",
              "validacao",
              "selo_utilizado",
              "abono_utilizado",
            ]}
          />
          <Fonte>{FONTE}</Fonte>
        </Secao>
        <Secao titulo="Descontos por convênio" descricao="Valor descontado">
          <BarrasHorizontais
            descricao="Valor descontado por convênio"
            rotuloLargo
            vazio="Nenhum desconto no período."
            itens={descontos.map((c) => ({
              chave: c.categoria || "nao_informado",
              rotulo: rotuloDe({}, c.categoria),
              valor: c.valor,
              texto: formatarMoeda(c.valor),
              detalhe: `${formatarNumero(c.ocorrencias)} tickets`,
            }))}
          />
        </Secao>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Secao
          titulo="Validações, selos e abonos"
          descricao="Por tipo e situação"
        >
          <TabelaDeCategorias
            vazio="Nenhuma validação, selo ou abono no período."
            linhas={dosTipos(d.categorias, [
              "validacao",
              "selo_utilizado",
              "abono_utilizado",
            ])}
          />
        </Secao>
        <Secao
          titulo="Selos e cartões de abono gerados"
          descricao="Vendidos ou criados no período, por tipo e situação"
          calculo="Selos: o valor é o desconto que cada selo dá. Cartões de abono: o valor é o preço do cartão."
        >
          <TabelaDeCategorias
            vazio="Nenhum selo ou cartão de abono gerado no período."
            linhas={dosTipos(d.categorias, ["selo_gerado", "abono_gerado"])}
          />
        </Secao>
      </div>
    </div>
  );
}

export function AbaMensalistas({ d }: { d: Dados }) {
  const m = d.mensalistas;
  const g = d.garagem;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Secao
          titulo="Mensalidades por mês"
          descricao="Por mês de vencimento: previsto e recebido (12 meses e os 3 próximos)"
          className="lg:col-span-2"
          calculo="Previsto: valor das mensalidades que vencem no mês, sem as canceladas. Recebido: o que foi pago dessas mensalidades."
        >
          {m.por_mes.length ? (
            <Linhas
              descricao="Mensalidades previstas e recebidas por mês"
              unidade="moeda0"
              pontos={m.por_mes.map((p) => ({
                chave: p.mes,
                rotulo: formatarMes(p.mes).slice(0, 3),
                titulo: formatarMes(p.mes),
              }))}
              series={[
                {
                  chave: "previsto",
                  rotulo: "Previsto",
                  cor: "neutro",
                  valores: m.por_mes.map((p) => p.previsto),
                },
                {
                  chave: "recebido",
                  rotulo: "Recebido",
                  cor: 1,
                  valores: m.por_mes.map((p) => p.recebido),
                },
              ]}
            />
          ) : (
            <Nota>Nenhuma mensalidade sincronizada.</Nota>
          )}
          <Fonte>{FONTE}</Fonte>
        </Secao>
        <Secao titulo="Clientes com vaga" descricao="Situação de hoje na WPS">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-neutral-500">Mensalistas</dt>
              <dd className="text-2xl font-semibold">
                {g?.clientes_mensalistas === null || !g
                  ? "—"
                  : formatarNumero(g.clientes_mensalistas)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Credenciados</dt>
              <dd className="text-2xl font-semibold">
                {g?.clientes_credenciados === null || !g
                  ? "—"
                  : formatarNumero(g.clientes_credenciados)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Recebido no período</dt>
              <dd className="text-lg font-semibold">
                {formatarMoeda(m.recebido)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Vence no período</dt>
              <dd className="text-lg font-semibold">
                {formatarMoeda(m.previsto)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-neutral-500">
            Contratos pela última mensalidade:{" "}
            {m.contratos.length
              ? m.contratos
                  .map(
                    (c) =>
                      `${formatarNumero(c.quantidade)} ${rotuloDe({}, c.chave).toLowerCase()}`,
                  )
                  .join(" · ")
              : "nenhum"}
          </p>
        </Secao>
      </div>
      <Secao
        titulo="Parcelas em atraso"
        descricao={`${formatarNumero(m.em_atraso.quantidade)} parcelas vencidas até ontem, ${formatarMoeda(m.em_atraso.valor)} em aberto (as 50 mais antigas)`}
        calculo="Mensalidades com vencimento antes de hoje que não estão baixadas, canceladas nem inativas. O nome aparece só quando o cliente é empresa."
      >
        <Tabela
          caber
          chave={(p: ParcelaEmAtraso) => `${p.contrato}|${p.vencimento}`}
          linhas={m.atrasadas}
          vazio="Nenhuma parcela em atraso."
          colunas={[
            { titulo: "Contrato", valor: (p) => String(p.contrato) },
            { titulo: "Cliente", valor: (p) => p.cliente ?? "—" },
            { titulo: "Vencimento", valor: (p) => formatarData(p.vencimento) },
            {
              titulo: "Situação",
              valor: (p) => rotuloDe({}, p.status),
            },
            {
              titulo: "Em aberto",
              numero: true,
              valor: (p) => formatarMoeda(p.valor),
            },
          ]}
        />
      </Secao>
    </div>
  );
}

export function AbaOcorrencias({ d }: { d: Dados }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Secao
        titulo="Ocorrências da operação"
        descricao={d.filtros.rotulo}
        calculo="Pagamentos cancelados, aberturas manuais de cancela, devoluções de troco e limpezas de pátio (veículos tirados do sistema sem saída registrada)."
      >
        <TabelaDeEventos
          d={d}
          tipos={[
            "pagamento_cancelado",
            "cancela_manual_entrada",
            "cancela_manual_saida",
            "devolucao_troco",
            "manutencao_patio",
          ]}
        />
        <Fonte>{FONTE}</Fonte>
      </Secao>
      <Secao
        titulo="Cancelamentos e troco por tipo"
        descricao="Forma do pagamento cancelado e motivo da devolução"
      >
        <TabelaDeCategorias
          vazio="Nenhum cancelamento ou devolução de troco no período."
          linhas={dosTipos(d.categorias, [
            "pagamento_cancelado",
            "devolucao_troco",
          ])}
        />
      </Secao>
    </div>
  );
}
