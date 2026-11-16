import { dadosDe } from "@arp/shared/comercial/formato";
import {
  filtroDoExtrato,
  mesesEntre,
} from "@arp/shared/operacoes/agua-extrato";
import { rotuloMes } from "@arp/shared/operacoes/agua-formato";
import { useQuery, useSuspenseQueries } from "@tanstack/react-query";
import { Building2, CalendarDays, CalendarRange, Printer } from "lucide-react";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { TopoDaTela } from "@/components/dashboard/tela";
import { BotaoExportar } from "@/components/exportar";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  consultaDoExtrato,
  consultaDosMesesDaAgua,
  consultaDosParametros,
  hrefDoExtratoPdf,
} from "../api";
import { BOTAO_SECUNDARIO } from "../components/agua/estilos";
import {
  exportarExtrato,
  FotosDoExtrato,
  GraficoDeConsumo,
  TabelaDoExtrato,
} from "../components/agua/extrato";
import { AbasDaAgua, EXEMPLO_AGUA, FiltrosAgua } from "../components/agua/tela";
import { useContextoOp } from "../contexto";
import { mapaDeLinks, useFiltrosOp } from "../filtros";

const ESQUELETO = (
  <TelaCarregando>
    <FiltrosCarregando />
    <CartaoCarregando altura="h-[36rem]" />
  </TelaCarregando>
);

export default function Page() {
  return (
    <>
      <PageHeader
        title="Água"
        description="Extrato de consumo de uma sala, de um cliente ou de um hidrômetro, mês a mês, para mostrar ao locatário ou resolver uma contestação."
      />
      <Suspense fallback={ESQUELETO}>
        <Protegido permissao="operacoes.agua.ver">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

function Tela() {
  const f = useFiltrosOp("agua_extrato");
  const ctx = useContextoOp();
  const [{ data: m }, { data: p }] = useSuspenseQueries({
    queries: [consultaDosMesesDaAgua, consultaDosParametros],
  });
  const meses = m.meses;
  const filtro = f
    ? filtroDoExtrato(
        f.busca,
        meses.map((x) => x.referencia),
      )
    : null;
  const temFiltro = Boolean(filtro && (filtro.texto || filtro.bloco));
  const pedido = filtro
    ? {
        ...(filtro.bloco ? { bloco: filtro.bloco } : {}),
        ...(filtro.texto ? { q: filtro.texto } : {}),
        de: filtro.de.slice(0, 7),
        ate: filtro.ate.slice(0, 7),
      }
    : {};
  const extrato = useQuery({
    ...consultaDoExtrato(pedido),
    enabled: temFiltro,
  });
  if (!f) return ESQUELETO;
  const abas = (
    <AbasDaAgua
      ativa="extrato"
      podeImportar={ctx.pode("operacoes.agua.importar")}
    />
  );
  if (!filtro)
    return (
      <div className="flex flex-col gap-6">
        {abas}
        <Cartao>
          <p className="text-sm text-neutral-600">
            O extrato aparece depois da primeira importação do faturamento da
            água.
          </p>
        </Cartao>
      </div>
    );
  if (temFiltro && extrato.isPending) return ESQUELETO;
  if (extrato.error) throw extrato.error;

  const opcoesMes = meses.map((x) => ({
    valor: x.referencia.slice(0, 7),
    rotulo: rotuloMes(x.referencia),
  }));
  const dados = temFiltro ? (extrato.data ?? null) : null;
  const links = mapaDeLinks(dados?.links ?? {});
  const comValores = ctx.pode("operacoes.agua.valores");
  const periodo = `${rotuloMes(filtro.de)} a ${rotuloMes(filtro.ate)}`;
  const descricao = [
    filtro.bloco ? `Bloco ${filtro.bloco}` : "",
    filtro.texto ? `“${filtro.texto}”` : "",
    periodo,
  ]
    .filter(Boolean)
    .join(" · ");
  const exportar = dados ? exportarExtrato(dados.leituras, comValores) : null;
  const exemplo = dados?.leituras.some((l) => l.exemplo) ?? false;

  return (
    <div className="flex flex-col gap-6">
      {abas}
      <FiltrosAgua
        tela="agua_extrato"
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "de",
            rotulo: "De",
            todos: "12 meses antes",
            valor: typeof f.busca.de === "string" ? f.busca.de : "",
            icone: <CalendarRange className="size-4" />,
            opcoes: opcoesMes,
          },
          {
            chave: "ate",
            rotulo: "Até",
            todos: "Último importado",
            valor: typeof f.busca.ate === "string" ? f.busca.ate : "",
            icone: <CalendarDays className="size-4" />,
            opcoes: opcoesMes,
          },
          {
            chave: "bloco",
            rotulo: "Bloco",
            todos: "Todos os blocos",
            valor: filtro.bloco,
            icone: <Building2 className="size-4" />,
            opcoes: p.parametros.agua_blocos.map((b) => ({
              valor: b,
              rotulo: `Bloco ${b}`,
            })),
          },
        ]}
        busca={{
          chave: "q",
          valor: filtro.texto,
          placeholder: "Sala, cliente ou nº do hidrômetro",
        }}
      />
      {!dados ? (
        <Cartao>
          <p className="text-sm text-neutral-600">
            Escolha o bloco e escreva a sala, o nome do cliente ou o nº do
            hidrômetro para ver o extrato.
          </p>
        </Cartao>
      ) : (
        <>
          <TopoDaTela
            dadosDe={dadosDe(new Date(extrato.dataUpdatedAt))}
            filtros={descricao}
            exemplo={exemplo ? EXEMPLO_AGUA : undefined}
            acoes={
              ctx.pode("operacoes.exportar") && exportar ? (
                <>
                  <a
                    href={hrefDoExtratoPdf(pedido)}
                    data-guia="op-agua-imprimir"
                    className={BOTAO_SECUNDARIO}
                  >
                    <Printer className="size-4" aria-hidden />
                    Imprimir extrato
                  </a>
                  <BotaoExportar
                    titulo="Extrato de consumo de água"
                    filtros={descricao}
                    nomeArquivo="agua-extrato"
                    colunas={exportar.colunas}
                    linhas={exportar.linhas}
                  />
                </>
              ) : undefined
            }
          />
          <Secao
            titulo="Extrato"
            descricao={`${dados.leituras.length} leitura(s) · ${[...new Set(dados.leituras.map((l) => l.hidrometro))].length} hidrômetro(s)${dados.locatarios === null ? "" : ` · locatário no ENET: ${dados.locatarios.join(" · ") || "sem contrato vigente"}`}. Troca de hidrômetro aparece como linhas de números diferentes.`}
            exemplo={exemplo && EXEMPLO_AGUA}
          >
            <div className="flex flex-col gap-6">
              <GraficoDeConsumo
                leituras={dados.leituras}
                meses={mesesEntre(filtro.de, filtro.ate)}
              />
              <TabelaDoExtrato
                leituras={dados.leituras}
                comValores={comValores}
                links={links}
                comHidrometro
              />
            </div>
          </Secao>
          <Secao titulo="Fotos do visor">
            <FotosDoExtrato leituras={dados.leituras} links={links} />
          </Secao>
        </>
      )}
    </div>
  );
}
