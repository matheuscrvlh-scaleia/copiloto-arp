import { Building2, CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { TopoDaTela } from "@/components/dashboard/tela";
import { Foto } from "@/components/operacoes/agua/leituras";
import {
  AbasDaAgua,
  BASE_AGUA,
  EXEMPLO_AGUA,
  FiltrosAgua,
} from "@/components/operacoes/agua/tela";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { dadosDe, linhaDeFiltros } from "@/lib/comercial/formato";
import {
  formatarM3,
  formatarVisor,
  rotuloMes,
} from "@/lib/operacoes/agua-formato";
import {
  leiturasDoMes,
  linksDasFotos,
  mesesImportados,
} from "@/server/operacoes/agua";
import { contextoOp, parametros } from "@/server/operacoes/base";
import { filtrosLembrados } from "@/server/preferencias/filtros";

export const metadata: Metadata = { title: "Água · Galeria de fotos" };

export default function Page({
  searchParams,
}: PageProps<"/operacoes/agua/galeria">) {
  return (
    <>
      <PageHeader
        title="Água"
        description="Todas as fotos dos visores do mês, para auditar as leituras. Clique na foto para ampliar."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <FiltrosCarregando />
            <CartaoCarregando altura="h-[40rem]" />
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
    buscaUrl.then((b) => filtrosLembrados("operacoes", "agua_galeria", b)),
    mesesImportados(),
    parametros(),
  ]);
  const um = (k: string) => {
    const v = f.busca[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const abas = (
    <AbasDaAgua
      ativa="galeria"
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
            Nenhuma foto ainda: as fotos dos visores chegam com a importação do
            mês.
          </p>
        </Cartao>
      </div>
    );

  const leituras = await leiturasDoMes(mes.referencia);
  const blocos = [
    ...new Set([...p.agua_blocos, ...leituras.map((l) => l.bloco)]),
  ].sort();
  const bloco = blocos.includes(um("bloco")) ? um("bloco") : "";
  const doBloco = leituras.filter((l) => !bloco || l.bloco === bloco);
  const comFoto = doBloco.filter((l) => l.foto);
  const links = await linksDasFotos(comFoto);
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
