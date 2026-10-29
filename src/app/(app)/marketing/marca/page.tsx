import { FileDown } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { TOM } from "@/components/estilos";
import { Arquivos } from "@/components/marketing/marca/arquivos";
import { BlocoEditavel } from "@/components/marketing/marca/bloco-editavel";
import { ConteudoBloco } from "@/components/marketing/marca/conteudo";
import { Historico } from "@/components/marketing/marca/historico";
import { Revisor } from "@/components/marketing/marca/revisor";
import {
  AbasMkt,
  Fonte,
  hrefCom,
  TopoDaTela,
} from "@/components/marketing/tela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  ABAS_MARCA,
  type AbaDeBlocos,
  type AbaMarca,
  resumoMarca,
  termosDa,
  textoDoConteudo,
} from "@/lib/marketing/marca";
import { contextoMkt } from "@/server/marketing/base";
import {
  arquivosDaMarca,
  type BlocoMarca,
  blocosDaMarca,
  LIMITE_HISTORICO,
  nomesDe,
  textoDaVersao,
  versoesDaMarca,
} from "@/server/marketing/marca";

export const metadata: Metadata = { title: "Marca" };

const BASE = "/marketing/marca";
type Busca = Record<string, string | string[] | undefined>;

export default function Page({ searchParams }: PageProps<"/marketing/marca">) {
  return (
    <>
      <PageHeader
        title="Marca"
        description="A base da marca ARP do rebranding 2025 como documento vivo: plataforma, tom de voz, público, identidade visual e arquivos, lida pelo time todo. É também a base que o Copiloto usa para escrever no tom da ARP."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="marketing.marca">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/** Largura no grid de 3 colunas e tom de cada bloco (o resto: linha inteira). */
const LAYOUT: Record<string, { span?: string; tom?: keyof typeof TOM }> = {
  proposito: { span: "lg:col-span-2", tom: "verde" },
  tagline: { span: "lg:col-span-1", tom: "escuro" },
  arquetipo: { span: "lg:col-span-1" },
  atributos: { span: "lg:col-span-2" },
  // Tom de voz (grid de 2): as duas listas de palavras lado a lado.
  tons: { span: "lg:col-span-2" },
  palavras_proprietarias: { span: "lg:col-span-1" },
  palavras_proibidas: { span: "lg:col-span-1" },
  frases_de_apoio: { span: "lg:col-span-2" },
  direcionadores: { tom: "escuro" },
};

/** De onde vem o texto que falta, para o aviso de bloco vazio. */
const fonteDe = (b: BlocoMarca) =>
  b.chave.startsWith("cores_")
    ? "guia rápido ARP 2025"
    : "rebranding Espaço Arp 2025";

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const b = await busca;
  const abaPedida = um(b.aba) as AbaMarca;
  const aba: AbaMarca = abaPedida in ABAS_MARCA ? abaPedida : "plataforma";
  const ctx = await contextoMkt();
  const podeEditar = ctx.pode("marketing.marca.editar");

  const [blocos, versao, versoes, arquivos] = await Promise.all([
    blocosDaMarca(),
    textoDaVersao(),
    aba === "historico" ? versoesDaMarca() : Promise.resolve([]),
    aba === "arquivos" ? arquivosDaMarca() : Promise.resolve([]),
  ]);
  const nomes = await nomesDe([
    ...versoes.map((v) => v.por),
    ...arquivos.map((a) => a.enviado_por),
  ]);
  const resumo = resumoMarca(blocos);
  const bloco = (chave: string) => blocos.find((x) => x.chave === chave);

  const abas = (Object.keys(ABAS_MARCA) as AbaMarca[]).map((chave) => ({
    chave,
    rotulo: ABAS_MARCA[chave],
    href: hrefCom(BASE, {}, { aba: chave === "plataforma" ? null : chave }),
  }));

  const cartao = (x: BlocoMarca) => {
    const l = LAYOUT[x.chave];
    return (
      <BlocoEditavel
        key={x.chave}
        chave={x.chave}
        titulo={x.titulo}
        descricao={x.descricao}
        tipo={x.tipo}
        versao={x.versao}
        texto={textoDoConteudo(x.conteudo)}
        podeEditar={podeEditar}
        palavras={x.chave.startsWith("palavras_")}
        classeTom={TOM[l?.tom ?? "claro"]}
        className={l?.span ?? "lg:col-span-3"}
      >
        <ConteudoBloco
          chave={x.chave}
          conteudo={x.conteudo}
          fonte={fonteDe(x)}
        />
      </BlocoEditavel>
    );
  };

  const daAba = (a: AbaDeBlocos) => blocos.filter((x) => x.aba === a);

  return (
    <div className="flex flex-col gap-6">
      <TopoDaTela
        dadosDe={versao}
        exemplo={false}
        filtros={
          resumo.vazios.length || resumo.itensSemExplicacao
            ? `${resumo.preenchidos} de ${resumo.blocos} blocos preenchidos${resumo.itensSemExplicacao ? ` · ${resumo.itensSemExplicacao} itens ainda sem explicação` : ""}`
            : `Todos os ${resumo.blocos} blocos preenchidos`
        }
        acoes={
          <a
            href={`${BASE}/pdf`}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
            title="Plataforma, tom de voz e público numa folha, para fornecedores"
          >
            <FileDown className="size-4" aria-hidden />
            PDF one page
          </a>
        }
      />

      <AbasMkt abas={abas} ativa={aba} rotulo="Partes da base da marca" />

      {(aba === "plataforma" || aba === "publico" || aba === "identidade") && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {daAba(aba).map((x) => cartao(x))}
        </div>
      )}

      {aba === "tom_de_voz" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {daAba("tom_de_voz")
            .filter((x) => !x.chave.startsWith("palavras_"))
            .slice(0, 1)
            .map((x) => cartao(x))}
          {/* "É / não é": as duas listas que o revisor usa, lado a lado. */}
          {["palavras_proprietarias", "palavras_proibidas"].map((c) => {
            const x = bloco(c);
            return x ? cartao(x) : null;
          })}
          {daAba("tom_de_voz")
            .filter((x) => !x.chave.startsWith("palavras_"))
            .slice(1)
            .map((x) => cartao(x))}
        </div>
      )}

      {aba === "arquivos" && (
        <div>
          <Arquivos arquivos={arquivos} nomes={nomes} podeEditar={podeEditar} />
          <Fonte>
            arquivos enviados pelo Marketing (PDF, PNG, JPG, SVG ou ZIP, até 25
            MB). Uma versão nova não apaga a anterior.
          </Fonte>
        </div>
      )}

      {aba === "revisor" && (
        <Revisor
          proibidas={termosDa(bloco("palavras_proibidas")?.conteudo)}
          proprietarias={termosDa(bloco("palavras_proprietarias")?.conteudo)}
        />
      )}

      {aba === "historico" && (
        <Historico
          versoes={versoes}
          blocos={blocos}
          nomes={nomes}
          podeEditar={podeEditar}
          filtro={um(b.bloco)}
          hrefFiltro={(chave) =>
            hrefCom(BASE, { aba: "historico" }, { bloco: chave })
          }
          limitado={versoes.length >= LIMITE_HISTORICO}
        />
      )}
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-12" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CartaoCarregando altura="h-48" className="lg:col-span-2" />
        <CartaoCarregando altura="h-48" />
      </div>
      <CartaoCarregando altura="h-40" />
      <CartaoCarregando altura="h-40" />
    </TelaCarregando>
  );
}
