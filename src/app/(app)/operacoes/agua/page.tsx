import {
  Bell,
  Building2,
  CalendarDays,
  Receipt,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import {
  CartaoDaTela,
  Cartoes,
  hrefCom,
  TopoDaTela,
} from "@/components/dashboard/tela";
import {
  exportarLeituras,
  ListaDeLeituras,
} from "@/components/operacoes/agua/leituras";
import {
  AbasDaAgua,
  BASE_AGUA,
  EXEMPLO_AGUA,
  FiltrosAgua,
} from "@/components/operacoes/agua/tela";
import { BotaoExportar } from "@/components/os/exportar";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { dadosDe, linhaDeFiltros } from "@/lib/comercial/formato";
import { formatarNumero } from "@/lib/formato";
import {
  ALERTAS,
  CODIGOS_ALERTA,
  type CodigoAlerta,
  mesesAntes,
} from "@/lib/operacoes/agua-alertas";
import {
  formatarM3,
  ROTULO_TIPO,
  rotuloMes,
  TIPOS_AGUA,
  type TipoAgua,
} from "@/lib/operacoes/agua-formato";
import {
  linksDasFotos,
  mesDaAgua,
  mesesImportados,
  nomesDe,
} from "@/server/operacoes/agua";
import { contextoOp, parametros } from "@/server/operacoes/base";
import { filtrosLembrados } from "@/server/preferencias/filtros";

export const metadata: Metadata = { title: "Água" };

export default function Page({ searchParams }: PageProps<"/operacoes/agua">) {
  return (
    <>
      <PageHeader
        title="Água"
        description="Leituras do mês, hidrômetros, extrato e fotos dos visores, a partir do faturamento individualizado do parceiro de gestão hídrica."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="operacoes.agua.ver">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

type Busca = Record<string, string | string[] | undefined>;

async function Tela({ busca: buscaUrl }: { busca: Promise<Busca> }) {
  const [ctx, f, meses, p] = await Promise.all([
    contextoOp(),
    buscaUrl.then((b) => filtrosLembrados("operacoes", "agua_leituras", b)),
    mesesImportados(),
    parametros(),
  ]);
  const um = (k: string) => {
    const v = f.busca[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const podeImportar = ctx.pode("operacoes.agua.importar");
  const abas = <AbasDaAgua ativa="leituras" podeImportar={podeImportar} />;
  if (!meses.length)
    return (
      <div className="flex flex-col gap-6">
        {abas}
        <Cartao>
          <p className="text-sm text-neutral-600">
            Nenhuma leitura importada. Importe a planilha mensal do parceiro em{" "}
            {podeImportar ? (
              <Link
                href={`${BASE_AGUA}/importar`}
                className="font-medium underline underline-offset-4"
              >
                Água › Importar faturamento do mês
              </Link>
            ) : (
              "Operações › Importações"
            )}
            .
          </p>
        </Cartao>
      </div>
    );

  const escolhido = meses.find((m) => m.referencia.slice(0, 7) === um("mes"));
  const mes = escolhido ?? meses[0];
  if (!mes) return null;
  const comValores = ctx.pode("operacoes.agua.valores");
  const [dados, nomes] = await Promise.all([
    mesDaAgua(mes.referencia),
    nomesDe([mes.confirmado_por]),
  ]);

  const blocos = [
    ...new Set([...p.agua_blocos, ...dados.leituras.map((l) => l.bloco)]),
  ].sort();
  const bloco = blocos.includes(um("bloco")) ? um("bloco") : "";
  const tipo = (TIPOS_AGUA as readonly string[]).includes(um("tipo"))
    ? (um("tipo") as TipoAgua)
    : "";
  const alerta =
    um("alerta") === "com" ||
    (CODIGOS_ALERTA as string[]).includes(um("alerta"))
      ? (um("alerta") as CodigoAlerta | "com")
      : "";
  const soAlerta = um("cartao") === "alertas";

  const base = dados.leituras.filter(
    (l) => (!bloco || l.bloco === bloco) && (!tipo || l.tipo === tipo),
  );
  const comAlerta = base.filter((l) => l.alertas.length > 0);
  const lista = base.filter((l) =>
    soAlerta || alerta === "com"
      ? l.alertas.length > 0
      : alerta
        ? l.alertas.some((a) => a.codigo === alerta)
        : true,
  );
  const sumidos = dados.sumidos.filter((s) => !bloco || s.bloco === bloco);
  const links = await linksDasFotos(lista);

  const consumo =
    base.reduce((s, l) => s + Math.round(l.consumo * 1000), 0) / 1000;
  const volume =
    base.reduce((s, l) => s + Math.round(l.volume * 1000), 0) / 1000;
  const valor =
    base.reduce((s, l) => s + Math.round((l.valor ?? 0) * 100), 0) / 100;
  const exemplo = dados.leituras.some((l) => l.exemplo);
  const rotulo = rotuloMes(mes.referencia);
  const fonte = `${p.agua_parceiro}, faturamento de ${rotulo}`;
  const filtros = linhaDeFiltros([
    {
      rotulo: "Mês",
      valor: `${rotulo}${mes.incompleta ? " (incompleto)" : ""}`,
    },
    { rotulo: "Bloco", valor: bloco ? `Bloco ${bloco}` : "Todos" },
    { rotulo: "Tipo", valor: tipo ? ROTULO_TIPO[tipo] : "Todos" },
    {
      rotulo: "Alerta",
      valor:
        soAlerta || alerta === "com"
          ? "Só com alerta"
          : alerta
            ? ALERTAS[alerta].rotulo
            : "Todos",
    },
  ]);
  const quem = mes.confirmado_por ? nomes.get(mes.confirmado_por) : null;
  const exportar = exportarLeituras(lista, comValores);

  return (
    <div className="flex flex-col gap-6">
      {abas}
      <FiltrosAgua
        tela="agua_leituras"
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "mes",
            rotulo: "Mês",
            todos: `Último importado (${rotuloMes(meses[0]?.referencia ?? mes.referencia)})`,
            valor: escolhido ? um("mes") : "",
            icone: <CalendarDays className="size-4" />,
            largura: "w-56",
            opcoes: meses.map((m) => ({
              valor: m.referencia.slice(0, 7),
              rotulo: `${rotuloMes(m.referencia)}${m.incompleta ? " · incompleto" : ""}`,
            })),
          },
          {
            chave: "bloco",
            rotulo: "Bloco",
            todos: "Todos os blocos",
            valor: bloco,
            icone: <Building2 className="size-4" />,
            opcoes: blocos.map((b) => ({ valor: b, rotulo: `Bloco ${b}` })),
          },
          {
            chave: "tipo",
            rotulo: "Tipo de faturamento",
            todos: "Todos os tipos",
            valor: tipo,
            icone: <Receipt className="size-4" />,
            opcoes: TIPOS_AGUA.map((t) => ({
              valor: t,
              rotulo: ROTULO_TIPO[t],
            })),
          },
          {
            chave: "alerta",
            rotulo: "Alerta",
            todos: "Com e sem alerta",
            valor: alerta,
            icone: <Bell className="size-4" />,
            largura: "w-52",
            opcoes: [
              { valor: "com", rotulo: "Só com alerta" },
              ...CODIGOS_ALERTA.map((c) => ({
                valor: c,
                rotulo: ALERTAS[c].rotulo,
              })),
            ],
          },
        ]}
      />
      <TopoDaTela
        dadosDe={`${dadosDe(mes.confirmado_em ?? new Date())}${quem ? ` · importado por ${quem}` : ""}`}
        filtros={`${filtros} · totais = soma das linhas`}
        exemplo={exemplo ? EXEMPLO_AGUA : undefined}
        acoes={
          ctx.pode("operacoes.exportar") ? (
            <BotaoExportar
              titulo={`Água · leituras de ${rotulo}`}
              filtros={`${filtros} · ${dadosDe(mes.confirmado_em ?? new Date())}`}
              nomeArquivo={`agua-leituras-${mes.referencia.slice(0, 7)}`}
              colunas={exportar.colunas}
              linhas={exportar.linhas}
            />
          ) : undefined
        }
      />

      {mes.incompleta && (
        <p
          data-guia="op-agua-incompleto"
          className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <b>Mês incompleto.</b> As linhas ou os totais de {rotulo} não
            bateram com o resumo do arquivo e o mês foi confirmado assim mesmo
            {quem ? ` por ${quem}` : ""}
            {mes.motivo ? `: “${mes.motivo}”` : ""}. Fica marcado até ser
            reimportado do arquivo original.{" "}
            {podeImportar && (
              <Link
                href={`${BASE_AGUA}/importar`}
                className="font-medium underline underline-offset-4"
              >
                Reimportar
              </Link>
            )}
          </span>
        </p>
      )}

      <Cartoes modulo="operacoes">
        <CartaoDaTela
          titulo="Hidrômetros lidos"
          valor={formatarNumero(base.length)}
          detalhe={`Leituras de ${rotulo}`}
          fonte={fonte}
          exemplo={exemplo && EXEMPLO_AGUA}
        />
        <CartaoDaTela
          titulo="Consumo do mês"
          valor={formatarM3(consumo)}
          detalhe={`Faturado: ${formatarM3(volume)}`}
          fonte={fonte}
          exemplo={exemplo && EXEMPLO_AGUA}
        />
        {comValores ? (
          <CartaoDaTela
            titulo="Valor faturado (R$)"
            valor={formatarNumero(valor, 2)}
            detalhe="Valor que vem pronto do arquivo"
            fonte={fonte}
            exemplo={exemplo && EXEMPLO_AGUA}
          />
        ) : (
          <CartaoDaTela
            titulo="Volume faturado"
            valor={formatarM3(volume)}
            detalhe="Valores em reais só com a permissão"
            fonte={fonte}
            exemplo={exemplo && EXEMPLO_AGUA}
          />
        )}
        <CartaoDaTela
          titulo="Alertas"
          valor={formatarNumero(comAlerta.length + sumidos.length)}
          detalhe={`${comAlerta.length} leitura(s) e ${sumidos.length} hidrômetro(s) que sumiram`}
          fonte="Calculado com os limites de Parâmetros"
          href={hrefCom(BASE_AGUA, f.busca, {
            cartao: soAlerta ? null : "alertas",
            alerta: null,
          })}
          ativo={soAlerta}
          exemplo={exemplo && EXEMPLO_AGUA}
        />
      </Cartoes>

      {sumidos.length > 0 && (
        <div
          data-guia="op-agua-sumidos"
          className="flex items-start gap-2 rounded-2xl bg-amber-400/15 px-4 py-3 text-sm text-amber-900"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            {sumidos.length} hidrômetro(s) tinham leitura em{" "}
            {rotuloMes(mesesAntes(mes.referencia, 1))} e não aparecem em{" "}
            {rotulo}:{" "}
            {sumidos.map((s, i) => (
              <span key={s.hidrometro}>
                {i > 0 && ", "}
                <Link
                  href={`${BASE_AGUA}/${encodeURIComponent(s.hidrometro)}`}
                  className="underline underline-offset-4"
                >
                  Bloco {s.bloco} · sala {s.sala || "—"} · {s.hidrometro}
                </Link>
              </span>
            ))}
          </p>
        </div>
      )}

      <Secao
        titulo="Leituras do mês"
        descricao={`Uma linha por hidrômetro, agrupável por bloco. Consumo acima de ${formatarM3(Number(p.agua_limite_m3))} em destaque; variação contra a média de ${p.agua_variacao_meses} mês(es) a partir de ${formatarNumero(Number(p.agua_variacao_pct))}% e ${formatarM3(Number(p.agua_variacao_min_m3))} (Parâmetros).${dados.enet ? "" : " Locatário do ENET indisponível: a comparação com o cliente fica de fora."}${comValores ? "" : " Valores em reais só para quem tem a permissão."}`}
        exemplo={exemplo && EXEMPLO_AGUA}
      >
        <ListaDeLeituras
          leituras={lista}
          comValores={comValores}
          links={links}
          limite={Number(p.agua_limite_m3)}
        />
      </Secao>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-4"
        quantidade={4}
      />
      <CartaoCarregando altura="h-[36rem]" />
    </TelaCarregando>
  );
}
