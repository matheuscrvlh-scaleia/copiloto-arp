import { CalendarDays, CircleDot } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Situacao } from "@/components/admin/ui";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Simulador } from "@/components/comercial/eventos/simulador";
import {
  CartaoDaTela,
  CartoesComercial,
  FiltrosComercial,
  hrefDoCartao,
  TabelaLista,
  TopoComercial,
  Valor,
} from "@/components/comercial/tela";
import { Secao } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { diaEmBrasilia } from "@/lib/comercial/datas";
import {
  resumoDasPropostas,
  STATUS_PROPOSTA,
  type StatusProposta,
  TIPOS_DATA,
} from "@/lib/comercial/eventos";
import { linhaDeFiltros } from "@/lib/comercial/formato";
import { formatarData, formatarNumero } from "@/lib/formato";
import { faixasEvento, parametros } from "@/server/comercial/base";
import {
  faixasParaCalculo,
  propostasEvento,
  regrasDe,
} from "@/server/comercial/eventos";
import { type Busca, lerFiltros } from "@/server/comercial/filtros";

export const metadata: Metadata = { title: "Eventos" };

const BASE = "/comercial/eventos";
const FONTE = "Propostas de evento do sistema (não é receita)";
const TOM_STATUS = {
  rascunho: "neutro",
  enviada: "rodando",
  fechada: "ok",
  perdida: "erro",
} as const;

export default function Page({
  searchParams,
}: PageProps<"/comercial/eventos">) {
  return (
    <>
      <PageHeader
        title="Simulador e proposta de eventos"
        description="Calcula a locação de espaço para eventos pela tabela de preços e monta a proposta em PDF. O interesse continua chegando pelo RD; a receita realizada de eventos vem do ENET no Painel."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="comercial.eventos.ver">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

const periodoDe = (p: {
  data_evento: string | null;
  data_evento_fim: string | null;
}) =>
  p.data_evento
    ? p.data_evento_fim && p.data_evento_fim !== p.data_evento
      ? `${formatarData(p.data_evento)} a ${formatarData(p.data_evento_fim)}`
      : formatarData(p.data_evento)
    : "A definir";

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const f = await lerFiltros("eventos", await busca);
  const { ctx } = f;
  const [faixas, p, propostas] = await Promise.all([
    faixasEvento(),
    parametros(),
    propostasEvento(),
  ]);
  const anos = [
    ...new Set([
      ctx.hoje.slice(0, 4),
      ...propostas.map((x) => diaEmBrasilia(x.criado_em).slice(0, 4)),
    ]),
  ].sort((a, b) => b.localeCompare(a));
  const ano = anos.includes(f.um("ano")) ? f.um("ano") : "";
  const status =
    f.um("status") in STATUS_PROPOSTA ? (f.um("status") as StatusProposta) : "";
  const cartao = ["mes", "fechadas"].includes(f.um("cartao"))
    ? f.um("cartao")
    : "";
  const mes = `${ctx.hoje.slice(0, 7)}-01`;

  const base = propostas.filter(
    (x) =>
      (!ano || diaEmBrasilia(x.criado_em).startsWith(ano)) &&
      (!status || x.status === status),
  );
  const resumo = resumoDasPropostas(base, mes);
  const lista = base.filter((x) =>
    cartao === "mes"
      ? diaEmBrasilia(x.criado_em).slice(0, 7) === mes.slice(0, 7)
      : cartao === "fechadas"
        ? x.status === "fechada"
        : true,
  );
  const exemplo = propostas.some((x) => x.exemplo)
    ? "propostas de exemplo, até as primeiras de verdade"
    : undefined;

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Ano", valor: ano || "Todos" },
    { rotulo: "Status", valor: status ? STATUS_PROPOSTA[status] : "Todos" },
    ...(cartao
      ? [
          {
            rotulo: "Cartão",
            valor: cartao === "mes" ? "Propostas no mês" : "Fechadas",
          },
        ]
      : []),
  ]);
  const regras = regrasDe(p);
  const podeEditar = ctx.pode("comercial.eventos.editar");
  const podeParametros = ctx.pode("comercial.parametros.editar");
  const total = lista.reduce((s, x) => s + x.valor_final, 0);

  return (
    <div className="flex flex-col gap-6">
      <Secao
        titulo="Simulação"
        descricao={`Valores da tabela de preços dos parâmetros (reajuste do ano registrado: ${formatarNumero(Number(p.evento_reajuste_pct), 0)}%). Desconto padrão: ${formatarNumero(Number(p.evento_desconto_pct), 0)}% (condição LOC).`}
      >
        <Simulador
          faixas={faixasParaCalculo(faixas)}
          regras={regras}
          descontoPadrao={Number(p.evento_desconto_pct)}
          podeProposta={podeEditar}
        />
      </Secao>

      <Secao
        titulo="Tabela de preços vigente"
        descricao={`Por m² por dia; até a área da faixa fixa, o valor do dia.${podeParametros ? "" : " Muda em Configurações › Parâmetros."}`}
      >
        {podeParametros && (
          <div className="mb-3 flex justify-end">
            <Link
              href="/comercial/configuracoes/parametros?bloco=eventos"
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
            >
              Tabela de preços
            </Link>
          </div>
        )}
        <TabelaLista
          semBusca
          colunas={[
            { titulo: "Faixa" },
            { titulo: "De (m²)", numero: true },
            { titulo: "Até (m²)", numero: true },
            { titulo: TIPOS_DATA.comum, numero: true },
            { titulo: TIPOS_DATA.sazonal, numero: true },
          ]}
          linhas={faixasParaCalculo(faixas).map((x) => ({
            chave: String(x.ordem),
            busca: x.nome,
            ordem: [
              x.ordem,
              x.area_de,
              x.area_ate,
              x.valor_comum,
              x.valor_sazonal,
            ],
            celulas: [
              x.nome,
              formatarNumero(x.area_de),
              formatarNumero(x.area_ate),
              `${formatarNumero(x.valor_comum, 2)} ${x.fixo ? "por dia" : "por m²"}`,
              `${formatarNumero(x.valor_sazonal, 2)} ${x.fixo ? "por dia" : "por m²"}`,
            ],
          }))}
        />
      </Secao>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Propostas</h2>
        <FiltrosComercial
          tela="eventos"
          hoje={ctx.hoje}
          lembrado={f.lembrado}
          selecoes={[
            {
              chave: "ano",
              rotulo: "Ano",
              todos: "Todos os anos",
              valor: ano,
              icone: <CalendarDays className="size-4" />,
              opcoes: anos.map((a) => ({ valor: a, rotulo: a })),
            },
            {
              chave: "status",
              rotulo: "Status",
              todos: "Todos os status",
              valor: status,
              icone: <CircleDot className="size-4" />,
              opcoes: (Object.keys(STATUS_PROPOSTA) as StatusProposta[]).map(
                (s) => ({
                  valor: s,
                  rotulo: STATUS_PROPOSTA[s],
                }),
              ),
            },
          ]}
        />
        <TopoComercial
          dadosDe={ctx.dadosDe}
          filtros={linhaFiltros}
          exemplo={exemplo}
          acoes={
            <div className="flex flex-wrap items-center gap-2">
              {podeEditar && (
                <Link
                  href={`${BASE}/proposta/nova`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                >
                  Nova proposta
                </Link>
              )}
              {ctx.pode("comercial.exportar") && (
                <BotaoExportar
                  titulo="Propostas de evento"
                  filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
                  nomeArquivo="propostas-de-evento"
                  colunas={[
                    { titulo: "Data" },
                    { titulo: "Cliente" },
                    { titulo: "Data do evento" },
                    { titulo: "Área (m²)", numero: true, formato: "#,##0.00" },
                    {
                      titulo: "Valor final",
                      numero: true,
                      formato: "#,##0.00",
                    },
                    { titulo: "Status" },
                    { titulo: "Validade" },
                    { titulo: "Oportunidade no RD" },
                  ]}
                  linhas={lista.map((x) => [
                    formatarData(diaEmBrasilia(x.criado_em)),
                    x.cliente,
                    periodoDe(x),
                    x.area_m2,
                    x.valor_final,
                    STATUS_PROPOSTA[x.status as StatusProposta] ?? x.status,
                    x.validade ? formatarData(x.validade) : "",
                    x.oportunidade_rd ?? "",
                  ])}
                />
              )}
            </div>
          }
        />
        <CartoesComercial>
          <CartaoDaTela
            titulo="Propostas no mês"
            valor={formatarNumero(resumo.noMes)}
            detalhe="Criadas neste mês, nos filtros"
            fonte={FONTE}
            exemplo={exemplo}
            href={hrefDoCartao(BASE, f.busca, "mes")}
            ativo={cartao === "mes"}
          />
          <CartaoDaTela
            titulo="Fechadas"
            valor={formatarNumero(resumo.fechadas)}
            detalhe={ano ? `Em ${ano}` : "Todas"}
            fonte={FONTE}
            exemplo={exemplo}
            href={hrefDoCartao(BASE, f.busca, "fechadas")}
            ativo={cartao === "fechadas"}
          />
          <CartaoDaTela
            titulo="Valor fechado"
            valor={formatarNumero(resumo.valorFechado, 2)}
            detalhe="Soma do valor final das fechadas · não é receita (vem do ENET)"
            fonte={FONTE}
            exemplo={exemplo}
            href={hrefDoCartao(BASE, f.busca, "fechadas")}
            ativo={cartao === "fechadas"}
          />
        </CartoesComercial>
        <Secao titulo="Lista de propostas">
          <TabelaLista
            colunas={[
              { titulo: "Data" },
              { titulo: "Cliente", classe: "min-w-48" },
              { titulo: "Data do evento" },
              { titulo: "Área (m²)", numero: true },
              { titulo: "Valor final", numero: true },
              { titulo: "Status" },
              { titulo: "Validade" },
            ]}
            vazio="Nenhuma proposta nos filtros."
            placeholder="Buscar cliente…"
            ordemInicial={{ coluna: 0, desc: true }}
            rodape={[
              `${lista.length} ${lista.length === 1 ? "proposta" : "propostas"}`,
              "",
              "",
              "",
              <Valor key="t" valor={total} />,
              "",
              "",
            ]}
            linhas={lista.map((x) => ({
              chave: x.id,
              href: `${BASE}/proposta/${x.id}`,
              busca: `${x.cliente} ${x.oportunidade_rd ?? ""}`,
              ordem: [
                x.criado_em,
                x.cliente,
                x.data_evento,
                x.area_m2,
                x.valor_final,
                x.status,
                x.validade,
              ],
              celulas: [
                formatarData(diaEmBrasilia(x.criado_em)),
                <span key="c" className="font-medium">
                  {x.cliente}
                </span>,
                periodoDe(x),
                <Valor key="a" valor={x.area_m2} />,
                <Valor key="v" valor={x.valor_final} />,
                <Situacao
                  key="s"
                  tipo={TOM_STATUS[x.status as StatusProposta] ?? "neutro"}
                >
                  {STATUS_PROPOSTA[x.status as StatusProposta] ?? x.status}
                </Situacao>,
                x.validade ? formatarData(x.validade) : "—",
              ],
            }))}
          />
        </Secao>
      </div>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-72" />
      <CartaoCarregando altura="h-56" />
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-3"
        quantidade={3}
      />
      <CartaoCarregando altura="h-[24rem]" />
    </TelaCarregando>
  );
}
