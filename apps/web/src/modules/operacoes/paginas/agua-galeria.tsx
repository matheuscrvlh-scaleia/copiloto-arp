import { dadosDe, linhaDeFiltros } from "@arp/shared/comercial/formato";
import {
  formatarM3,
  formatarVisor,
  rotuloMes,
} from "@arp/shared/operacoes/agua-formato";
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
import { Secao } from "@/components/dashboard/tabela";
import { TopoDaTela } from "@/components/dashboard/tela";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link } from "@/lib/navegacao";
import {
  consultaDoMesDaAgua,
  consultaDosMesesDaAgua,
  consultaDosParametros,
} from "../api";
import { Foto } from "../components/agua/leituras";
import {
  AbasDaAgua,
  BASE_AGUA,
  EXEMPLO_AGUA,
  FiltrosAgua,
} from "../components/agua/tela";
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
        description="Todas as fotos dos visores do mês, para auditar as leituras. Clique na foto para ampliar."
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
  const f = useFiltrosOp("agua_galeria");
  const ctx = useContextoOp();
  const [{ data: m }, { data: p }] = useSuspenseQueries({
    queries: [consultaDosMesesDaAgua, consultaDosParametros],
  });
  if (!f) return ESQUELETO;
  const meses = m.meses;
  const abas = (
    <AbasDaAgua
      ativa="galeria"
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
            Nenhuma foto ainda: as fotos dos visores chegam com a importação do
            mês.
          </p>
        </Cartao>
      </div>
    );
  return (
    <Galeria
      f={f}
      meses={meses}
      mes={mes}
      escolhido={!!escolhido}
      p={p.parametros}
      abas={abas}
    />
  );
}

function Galeria({
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
  const { data } = useSuspenseQuery(consultaDoMesDaAgua(mes.referencia));
  const leituras = data.leituras;
  const blocos = [
    ...new Set([...p.agua_blocos, ...leituras.map((l) => l.bloco)]),
  ].sort();
  const bloco = blocos.includes(f.um("bloco")) ? f.um("bloco") : "";
  const doBloco = leituras.filter((l) => !bloco || l.bloco === bloco);
  const comFoto = doBloco.filter((l) => l.foto);
  const links = mapaDeLinks(data.links);
  const rotulo = rotuloMes(mes.referencia);
  const exemplo = comFoto.some((l) => l.exemplo);

  return (
    <div className="flex flex-col gap-6">
      {abas}
      <FiltrosAgua
        tela="agua_galeria"
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "mes",
            rotulo: "Mês",
            todos: `Último importado (${rotuloMes(meses[0]?.referencia ?? mes.referencia)})`,
            valor: escolhido ? f.um("mes") : "",
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
      />
      <TopoDaTela
        dadosDe={dadosDe(mes.confirmado_em ?? new Date())}
        filtros={linhaDeFiltros([
          { rotulo: "Mês", valor: rotulo },
          { rotulo: "Bloco", valor: bloco ? `Bloco ${bloco}` : "Todos" },
        ])}
        exemplo={exemplo ? EXEMPLO_AGUA : undefined}
      />
      <Secao
        titulo="Fotos dos visores"
        descricao={`${comFoto.length} foto(s) de ${doBloco.length} leitura(s) em ${rotulo}${doBloco.length > comFoto.length ? ` · ${doBloco.length - comFoto.length} leitura(s) sem foto (alerta "Sem foto" nas Leituras do mês)` : ""}.`}
        exemplo={exemplo && EXEMPLO_AGUA}
      >
        {comFoto.length ? (
          <ul
            data-guia="op-agua-galeria"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
          >
            {comFoto.map((l) => (
              <li key={l.id}>
                <figure className="flex flex-col gap-1.5">
                  <Foto l={l} links={links} className="aspect-[4/3] w-full" />
                  <figcaption className="text-xs leading-snug text-neutral-600">
                    <Link
                      href={`${BASE_AGUA}/${encodeURIComponent(l.hidrometro)}`}
                      className="font-semibold text-neutral-900 underline-offset-4 hover:underline"
                    >
                      {l.hidrometro}
                    </Link>
                    <br />
                    Bloco {l.bloco} · sala {l.sala || "—"} · {rotulo}
                    <br />
                    Leitura {formatarVisor(l.leituraAtual)} · consumo{" "}
                    {formatarM3(l.consumo)}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">
            Nenhuma foto de visor em {rotulo}
            {bloco ? ` no Bloco ${bloco}` : ""}. As fotos entram com a
            importação do mês (ou depois, importando só as fotos).
          </p>
        )}
      </Secao>
    </div>
  );
}
