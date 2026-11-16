import { situacaoDoLink } from "@arp/shared/comercial/censo";
import { formatarData } from "@arp/shared/formato";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link, useParametro } from "@/lib/navegacao";
import { Questionario } from "@/modules/comercial/components/censo/questionario";
import { consultaPresencialCenso } from "../../api/censo";

// Aplicação presencial: quem aplica o Censo preenche no celular o mesmo
// questionário do link, em nome da empresa. A resposta fica marcada como
// presencial, com quem lançou.

export default function Page() {
  return (
    <>
      <PageHeader
        title="Lançar em nome da empresa"
        description="Aplicação presencial do Censo: o mesmo questionário do link, preenchido por quem aplica."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-[40rem]" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="comercial.censo.aplicar">
          <Conteudo />
        </Protegido>
      </Suspense>
    </>
  );
}

function Conteudo() {
  const convite = useParametro("convite");
  const { data: c } = useSuspenseQuery(consultaPresencialCenso(convite));
  const voltar = `/comercial/censo?aba=rodadas&rodada=${c.rodada.id}`;
  const aberta = situacaoDoLink(c.rodada, c.hoje) === "aberta";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Link
        href={voltar}
        className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar às rodadas
      </Link>
      <section className="destaque flex flex-col gap-1 rounded-[1.75rem] p-5">
        <p className="text-xs font-medium tracking-[0.14em] text-[rgb(255_255_255/0.6)] uppercase">
          {c.rodada.nome} · presencial
        </p>
        <h2 className="text-xl font-semibold">{c.convite.empresa_nome}</h2>
        <p className="text-sm">
          {c.convite.luc ? `LUC ${c.convite.luc}` : "Sem LUC"}
          {c.convite.bloco ? ` · Bloco ${c.convite.bloco}` : ""}
          {c.respondidaEm ? " · já respondeu: o envio corrige a resposta" : ""}
        </p>
      </section>
      {aberta ? (
        <section className="vidro rounded-[1.75rem] p-5">
          <Questionario
            modo="presencial"
            convite={c.convite.id}
            opcoes={c.opcoes}
            diasPadrao={c.diasPadrao}
            inicial={c.inicial}
            corrigindo={!!c.respondidaEm}
          />
        </section>
      ) : (
        <Cartao>
          <p className="text-sm text-neutral-600">
            A rodada {c.rodada.nome} não aceita respostas (de{" "}
            {formatarData(c.rodada.inicio)} a {formatarData(c.rodada.fim)}
            {c.rodada.situacao === "encerrada" ? ", encerrada" : ""}).
          </p>
        </Cartao>
      )}
    </div>
  );
}
