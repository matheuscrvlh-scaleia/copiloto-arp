import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao, Tabela } from "@/components/dashboard/tabela";
import { SeletorDeUnidade } from "@/components/operacoes/energia/quadros/unidade";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { nomeDoArquivoDoTermo } from "@/lib/operacoes/termo";
import { parametros } from "@/server/operacoes/base";
import {
  caixasDoQuadro,
  listaDeQuadros,
  type TermoRecente,
  termosRecentes,
} from "@/server/operacoes/quadros";

// Gerador do termo de autorização de energia (spec 4.6): escolher a
// unidade cadastrada abre a caixa com o termo preenchido; abaixo, os
// últimos termos emitidos, para baixar ou reimprimir.

export const metadata: Metadata = { title: "Termo de autorização de energia" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Termo de autorização de energia"
        description="Autoriza o locatário a pedir à Energisa a instalação e ligação do medidor da sala. Sai em PDF e Word, no papel timbrado, e cada emissão fica guardada na caixa."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-40" />
            <CartaoCarregando altura="h-96" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="operacoes.energia.termo">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela() {
  const [quadros, caixas, termos, p] = await Promise.all([
    listaDeQuadros(),
    caixasDoQuadro(null),
    termosRecentes(),
    parametros(),
  ]);
  const nomes = new Map(quadros.map((q) => [q.id, q.nome]));
  const ordem = new Map(quadros.map((q, i) => [q.id, i]));
  const opcoes = caixas
    .filter((c) => c.sala)
    .sort(
      (a, b) =>
        (ordem.get(a.quadro_id) ?? 0) - (ordem.get(b.quadro_id) ?? 0) ||
        (a.sala ?? "").localeCompare(b.sala ?? "", "pt-BR", { numeric: true }),
    )
    .map((c) => ({
      valor: c.id,
      rotulo: `${nomes.get(c.quadro_id) ?? ""} · ${c.sala} · caixa ${c.numero}`,
      descricao: c.ocupante ?? "Sem ocupante",
    }));
  return (
    <div className="flex flex-col gap-6">
      <Secao
        titulo="Unidade"
        descricao="Escolha a sala (ou abra o termo pela caixa, no desenho do quadro)."
      >
        {opcoes.length ? (
          <SeletorDeUnidade opcoes={opcoes} />
        ) : (
          <p className="text-sm text-neutral-500">
            Nenhuma caixa com sala ligada. Cadastre os quadros em{" "}
            <Link href="/operacoes/energia" className="underline">
              Energia › Quadros
            </Link>
            .
          </p>
        )}
      </Secao>
      <Secao
        titulo="Últimos termos emitidos"
        descricao="Reemitir cria uma nova versão; as anteriores continuam aqui e na caixa."
      >
        <Tabela<TermoRecente>
          chave={(t) => t.id}
          vazio="Nenhum termo emitido ainda."
          linhas={termos}
          colunas={[
            {
              titulo: "Arquivo",
              valor: (t) => (
                <Link
                  href={`/operacoes/energia/caixa/${t.caixa_id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {nomeDoArquivoDoTermo(p.termo_nome_arquivo, t)}
                </Link>
              ),
            },
            { titulo: "Versão", numero: true, valor: (t) => t.versao },
            {
              titulo: "Data do termo",
              valor: (t) => formatarData(t.data_emissao),
            },
            {
              titulo: "Registrado em",
              valor: (t) => formatarDataHora(t.emitido_em),
            },
            {
              titulo: "Baixar",
              valor: (t) => (
                <span className="flex gap-2">
                  <a
                    href={`/operacoes/energia/termo/${t.id}?formato=pdf`}
                    className="underline underline-offset-4"
                  >
                    PDF
                  </a>
                  {t.temWord && (
                    <a
                      href={`/operacoes/energia/termo/${t.id}?formato=docx`}
                      className="underline underline-offset-4"
                    >
                      Word
                    </a>
                  )}
                </span>
              ),
            },
          ]}
        />
      </Secao>
    </div>
  );
}
