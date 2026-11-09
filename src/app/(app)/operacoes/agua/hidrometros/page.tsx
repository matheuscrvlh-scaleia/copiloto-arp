import { Building2, CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { TopoDaTela } from "@/components/dashboard/tela";
import { CartoesDeHidrometros } from "@/components/operacoes/agua/hidrometros";
import {
  AbasDaAgua,
  EXEMPLO_AGUA,
  FiltrosAgua,
} from "@/components/operacoes/agua/tela";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { dadosDe, linhaDeFiltros } from "@/lib/comercial/formato";
import { normalizar } from "@/lib/operacoes/agua-extrato";
import { rotuloMes } from "@/lib/operacoes/agua-formato";
import {
  linksDasFotos,
  mesDaAgua,
  mesesImportados,
} from "@/server/operacoes/agua";
import { contextoOp, parametros } from "@/server/operacoes/base";
import { filtrosLembrados } from "@/server/preferencias/filtros";

export const metadata: Metadata = { title: "Água · Hidrômetros" };

export default function Page({
  searchParams,
}: PageProps<"/operacoes/agua/hidrometros">) {
  return (
    <>
      <PageHeader
        title="Água"
        description="Um cartão por hidrômetro, como os medidores virtuais: leitura do visor, consumo do mês e a foto. Clique para ver o histórico."
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
    buscaUrl.then((b) => filtrosLembrados("operacoes", "agua_hidrometros", b)),
    mesesImportados(),
    parametros(),
  ]);
  const um = (k: string) => {
    const v = f.busca[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const abas = (
    <AbasDaAgua
      ativa="hidrometros"
      podeImportar={ctx.pode("operacoes.agua.importar")}
    />
  );
  const escolhido = meses.find((m) => m.referencia.slice(0, 7) === um("mes"));
  const mes = escolhido ?? meses[0];
  if (!mes)
    return (
      <div className="flex flex-col gap-6">
        {abas}
        <Cartao>
          <p className="text-sm text-neutral-600">
            Nenhum hidrômetro ainda: os cartões aparecem depois da primeira
            importação do faturamento da água.
          </p>
        </Cartao>
      </div>
    );

  const dados = await mesDaAgua(mes.referencia);
  const blocos = [
    ...new Set([...p.agua_blocos, ...dados.leituras.map((l) => l.bloco)]),
  ].sort();
  const bloco = blocos.includes(um("bloco")) ? um("bloco") : "";
  const q = um("q").trim();
  const termo = normalizar(q);
  const lista = dados.leituras.filter(
    (l) =>
      (!bloco || l.bloco === bloco) &&
      (!termo ||
        normalizar(
          `${l.sala} ${l.cliente} ${l.hidrometro} ${(l.locatarios ?? []).join(" ")}`,
        ).includes(termo)),
  );
  const links = await linksDasFotos(lista);
  const rotulo = rotuloMes(mes.referencia);

  return (
    <div className="flex flex-col gap-6">
      {abas}
      <FiltrosAgua
        tela="agua_hidrometros"
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
              rotulo: rotuloMes(m.referencia),
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
        ]}
        busca={{
          chave: "q",
          valor: q,
          placeholder: "Buscar sala, cliente ou nº do hidrômetro",
        }}
      />
      <TopoDaTela
        dadosDe={dadosDe(mes.confirmado_em ?? new Date())}
        filtros={linhaDeFiltros([
          { rotulo: "Mês", valor: rotulo },
          { rotulo: "Bloco", valor: bloco ? `Bloco ${bloco}` : "Todos" },
          ...(q ? [{ rotulo: "Busca", valor: q }] : []),
        ])}
        exemplo={
          dados.leituras.some((l) => l.exemplo) ? EXEMPLO_AGUA : undefined
        }
      />
      <CartoesDeHidrometros
        leituras={lista}
        links={links}
        limite={Number(p.agua_limite_m3)}
        vazio={
          dados.leituras.length
            ? "Nenhum hidrômetro com estes filtros."
            : `Nenhuma leitura em ${rotulo}.`
        }
      />
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <CartaoCarregando altura="h-[40rem]" />
    </TelaCarregando>
  );
}
