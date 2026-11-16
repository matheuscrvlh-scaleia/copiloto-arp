import { dadosDe, linhaDeFiltros } from "@arp/shared/comercial/formato";
import { normalizar } from "@arp/shared/operacoes/agua-extrato";
import { rotuloMes } from "@arp/shared/operacoes/agua-formato";
import type { MesImportado } from "@arp/shared/operacoes/contratos/agua";
import type { Parametros } from "@arp/shared/operacoes/contratos/base";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { Building2, CalendarDays } from "lucide-react";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { TopoDaTela } from "@/components/dashboard/tela";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  consultaDoMesDaAgua,
  consultaDosMesesDaAgua,
  consultaDosParametros,
} from "../api";
import { CartoesDeHidrometros } from "../components/agua/hidrometros";
import { AbasDaAgua, EXEMPLO_AGUA, FiltrosAgua } from "../components/agua/tela";
import { useContextoOp } from "../contexto";
import { type FiltrosOp, mapaDeLinks, useFiltrosOp } from "../filtros";

const ESQUELETO = (
  <TelaCarregando>
    <FiltrosCarregando />
    <CartaoCarregando altura="h-[40rem]" />
  </TelaCarregando>
);

export default function Page() {
  return (
    <>
      <PageHeader
        title="Água"
        description="Um cartão por hidrômetro, como os medidores virtuais: leitura do visor, consumo do mês e a foto. Clique para ver o histórico."
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
  const f = useFiltrosOp("agua_hidrometros");
  const ctx = useContextoOp();
  const [{ data: m }, { data: p }] = useSuspenseQueries({
    queries: [consultaDosMesesDaAgua, consultaDosParametros],
  });
  if (!f) return ESQUELETO;
  const meses = m.meses;
  const abas = (
    <AbasDaAgua
      ativa="hidrometros"
      podeImportar={ctx.pode("operacoes.agua.importar")}
    />
  );
  const escolhido = meses.find((x) => x.referencia.slice(0, 7) === f.um("mes"));
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
  return (
    <Hidrometros
      f={f}
      meses={meses}
      mes={mes}
      escolhido={!!escolhido}
      p={p.parametros}
      abas={abas}
    />
  );
}

function Hidrometros({
  f,
  meses,
  mes,
  escolhido,
  p,
  abas,
}: {
  f: FiltrosOp;
  meses: MesImportado[];
  mes: MesImportado;
  escolhido: boolean;
  p: Parametros;
  abas: React.ReactNode;
}) {
  const ctx = useContextoOp();
  const { data: dados } = useSuspenseQuery(consultaDoMesDaAgua(mes.referencia));
  const um = f.um;
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
  const links = mapaDeLinks(dados.links);
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
            opcoes: meses.map((x) => ({
              valor: x.referencia.slice(0, 7),
              rotulo: rotuloMes(x.referencia),
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
