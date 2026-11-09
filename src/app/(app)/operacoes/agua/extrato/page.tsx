import { Building2, CalendarDays, CalendarRange, Printer } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { TopoDaTela } from "@/components/dashboard/tela";
import { BOTAO_SECUNDARIO } from "@/components/operacoes/agua/estilos";
import {
  exportarExtrato,
  FotosDoExtrato,
  GraficoDeConsumo,
  TabelaDoExtrato,
} from "@/components/operacoes/agua/extrato";
import {
  AbasDaAgua,
  BASE_AGUA,
  EXEMPLO_AGUA,
  FiltrosAgua,
} from "@/components/operacoes/agua/tela";
import { BotaoExportar } from "@/components/os/exportar";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { dadosDe } from "@/lib/comercial/formato";
import { filtroDoExtrato, mesesEntre } from "@/lib/operacoes/agua-extrato";
import { rotuloMes } from "@/lib/operacoes/agua-formato";
import {
  extratoDaAgua,
  linksDasFotos,
  mesesImportados,
} from "@/server/operacoes/agua";
import { contextoOp, parametros } from "@/server/operacoes/base";
import { filtrosLembrados } from "@/server/preferencias/filtros";

export const metadata: Metadata = { title: "Água · Extrato" };

export default function Page({
  searchParams,
}: PageProps<"/operacoes/agua/extrato">) {
  return (
    <>
      <PageHeader
        title="Água"
        description="Extrato de consumo de uma sala, de um cliente ou de um hidrômetro, mês a mês, para mostrar ao locatário ou resolver uma contestação."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <FiltrosCarregando />
            <CartaoCarregando altura="h-[36rem]" />
          </TelaCarregando>
        }
      >
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
    buscaUrl.then((b) => filtrosLembrados("operacoes", "agua_extrato", b)),
    mesesImportados(),
    parametros(),
  ]);
  const filtro = filtroDoExtrato(
    f.busca,
    meses.map((m) => m.referencia),
  );
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

  const opcoesMes = meses.map((m) => ({
    valor: m.referencia.slice(0, 7),
    rotulo: rotuloMes(m.referencia),
  }));
  const temFiltro = Boolean(filtro.texto || filtro.bloco);
  const dados = temFiltro ? await extratoDaAgua(filtro) : null;
  const links = dados ? await linksDasFotos(dados.leituras) : new Map();
  const comValores = ctx.pode("operacoes.agua.valores");
  const periodo = `${rotuloMes(filtro.de)} a ${rotuloMes(filtro.ate)}`;
  const descricao = [
    filtro.bloco ? `Bloco ${filtro.bloco}` : "",
    filtro.texto ? `“${filtro.texto}”` : "",
    periodo,
  ]
    .filter(Boolean)
    .join(" · ");
  const pdf = new URLSearchParams({
    ...(filtro.bloco ? { bloco: filtro.bloco } : {}),
    ...(filtro.texto ? { q: filtro.texto } : {}),
    de: filtro.de.slice(0, 7),
    ate: filtro.ate.slice(0, 7),
  });
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
            opcoes: p.agua_blocos.map((b) => ({
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
            dadosDe={dadosDe(new Date())}
            filtros={descricao}
            exemplo={exemplo ? EXEMPLO_AGUA : undefined}
            acoes={
              ctx.pode("operacoes.exportar") && exportar ? (
                <>
                  <a
                    href={`${BASE_AGUA}/extrato/pdf?${pdf}`}
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
