import {
  type ArquivoMarca,
  type BlocoMarca,
  LIMITE_HISTORICO_MARCA as LIMITE_HISTORICO,
  type VersaoMarca,
} from "@arp/shared/marketing/contratos/marca";
import {
  ABAS_MARCA,
  type AbaDeBlocos,
  type AbaMarca,
  termosDa,
  textoDoConteudo,
} from "@arp/shared/marketing/marca";
import { useSuspenseQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import {
  AbasDaTela,
  Fonte,
  hrefCom,
  TopoDaTela,
} from "@/components/dashboard/tela";
import { TOM } from "@/components/estilos";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { useBusca } from "@/lib/navegacao";
import {
  consultaDasVersoes,
  consultaDosArquivos,
  consultaDosBlocos,
  URL_PDF_MARCA,
} from "../api";
import { useContextoMkt } from "../base";
import { Arquivos, Referencias } from "../components/marca/arquivos";
import { BlocoEditavel } from "../components/marca/bloco-editavel";
import { ConteudoBloco } from "../components/marca/conteudo";
import { Historico } from "../components/marca/historico";
import { Revisor } from "../components/marca/revisor";

// app/(app)/marketing/marca/page.tsx

const BASE = "/marketing/marca";
type Busca = Record<string, string | string[] | undefined>;

export default function Page() {
  return (
    <>
      <PageHeader
        title="Marca"
        description="A base da marca ARP do rebranding 2025 como documento vivo: plataforma, tom de voz, público, identidade visual e arquivos, lida pelo time todo. É também a base que o Copiloto usa para escrever no tom da ARP."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="marketing.marca">
          <Tela />
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
  logo: { tom: "escuro" },
  grafismos: { tom: "verde" },
};

/** Na plataforma, os pares que dividem a linha (2 + 1) vêm na frente, sem buraco. */
const PRIMEIROS_NA_PLATAFORMA = [
  "proposito",
  "tagline",
  "atributos",
  "arquetipo",
];
const posicao = (chave: string) => {
  const i = PRIMEIROS_NA_PLATAFORMA.indexOf(chave);
  return i < 0 ? PRIMEIROS_NA_PLATAFORMA.length : i;
};

/** De onde vem o texto que falta, para o aviso de bloco vazio. */
const fonteDe = (b: BlocoMarca) =>
  b.chave.startsWith("cores_")
    ? "guia rápido ARP 2025"
    : "rebranding Espaço Arp 2025";

function Tela() {
  const b = useBusca();
  const abaPedida = um(b.aba) as AbaMarca;
  const aba: AbaMarca = abaPedida in ABAS_MARCA ? abaPedida : "plataforma";
  const ctx = useContextoMkt();
  const podeEditar = ctx.pode("marketing.marca.editar");
  return (
    <Suspense fallback={<Esqueleto />}>
      {aba === "historico" ? (
        <ComVersoes aba={aba} b={b} podeEditar={podeEditar} />
      ) : aba === "arquivos" || aba === "referencias" ? (
        <ComArquivos aba={aba} b={b} podeEditar={podeEditar} />
      ) : (
        <Conteudo aba={aba} b={b} podeEditar={podeEditar} />
      )}
    </Suspense>
  );
}

interface Props {
  aba: AbaMarca;
  b: Busca;
  podeEditar: boolean;
}

function ComVersoes(p: Props) {
  const { data } = useSuspenseQuery(consultaDasVersoes);
  return (
    <Conteudo
      {...p}
      versoes={data.versoes}
      nomes={new Map(Object.entries(data.nomes))}
    />
  );
}

function ComArquivos(p: Props) {
  const { data } = useSuspenseQuery(consultaDosArquivos);
  return (
    <Conteudo
      {...p}
      arquivos={data.arquivos}
      nomes={new Map(Object.entries(data.nomes))}
    />
  );
}

function Conteudo({
  aba,
  b,
  podeEditar,
  versoes = [],
  arquivos = [],
  nomes = new Map(),
}: Props & {
  versoes?: VersaoMarca[];
  arquivos?: ArquivoMarca[];
  nomes?: Map<string, string>;
}) {
  const {
    data: { blocos },
  } = useSuspenseQuery(consultaDosBlocos);
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
        // Palavras do revisor não têm significado: seguem no texto.
        itens={
          x.conteudo.tipo === "lista" && !x.chave.startsWith("palavras_")
            ? x.conteudo.itens
            : undefined
        }
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

  const daAba = (a: AbaDeBlocos) => {
    const lista = blocos.filter((x) => x.aba === a);
    // sort é estável: o resto mantém a ordem do banco.
    return a === "plataforma"
      ? lista.sort((x, y) => posicao(x.chave) - posicao(y.chave))
      : lista;
  };

  return (
    <div className="flex flex-col gap-6">
      <TopoDaTela
        acoes={
          <a
            href={URL_PDF_MARCA}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
            title="Plataforma, tom de voz e público numa folha, para fornecedores"
          >
            <FileDown className="size-4" aria-hidden />
            PDF one page
          </a>
        }
      />

      <AbasDaTela abas={abas} ativa={aba} rotulo="Partes da base da marca" />

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
          <Arquivos
            arquivos={arquivos.filter((a) => !a.referencia)}
            nomes={nomes}
            podeEditar={podeEditar}
          />
          <Fonte>
            arquivos enviados pelo Marketing (PDF, PNG, JPG, SVG ou ZIP, até 25
            MB). Uma versão nova não apaga a anterior.
          </Fonte>
        </div>
      )}

      {aba === "referencias" && (
        <div>
          <Referencias
            arquivos={arquivos.filter((a) => a.referencia)}
            nomes={nomes}
            podeEditar={podeEditar}
          />
          <Fonte>
            imagens enviadas pelo Marketing (PNG, JPG ou SVG, até 25 MB): o
            padrão ideal da marca, para o time e para o Copiloto ao criar peças.
            Trocar a imagem não apaga a anterior.
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
