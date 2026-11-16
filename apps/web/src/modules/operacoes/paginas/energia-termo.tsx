import { formatarData, formatarDataHora } from "@arp/shared/formato";
import { nomeDoArquivoDoTermo } from "@arp/shared/operacoes/termo";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao, Tabela } from "@/components/dashboard/tabela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link } from "@/lib/navegacao";
import {
  consultaDasCaixas,
  consultaDosParametros,
  consultaDosQuadros,
  consultaDosTermos,
  hrefDoTermo,
} from "../api";
import { SeletorDeUnidade } from "../components/energia/quadros/unidade";
import type { TermoRecente } from "../tipos";

// Gerador do termo de autorização de energia (spec 4.6): escolher a
// unidade cadastrada abre a caixa com o termo preenchido; abaixo, os
// últimos termos emitidos, para baixar ou reimprimir.

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

function Tela() {
  const [{ data: dq }, { data: dc }, { data: dt }, { data: dp }] =
    useSuspenseQueries({
      queries: [
        consultaDosQuadros,
        consultaDasCaixas(null),
        consultaDosTermos,
        consultaDosParametros,
      ],
    });
  const quadros = dq.quadros;
  const termos = dt.termos;
  const p = dp.parametros;
  const nomes = new Map(quadros.map((q) => [q.id, q.nome]));
  const ordem = new Map(quadros.map((q, i) => [q.id, i]));
  const opcoes = dc.caixas
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
                    href={hrefDoTermo(t.id, "pdf")}
                    className="underline underline-offset-4"
                  >
                    PDF
                  </a>
                  {t.temWord && (
                    <a
                      href={hrefDoTermo(t.id, "docx")}
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
