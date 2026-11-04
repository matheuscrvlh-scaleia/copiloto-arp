import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { Voltar } from "@/components/comercial/ocupacao/resumo";
import { ContatoNaPagina } from "@/components/comercial/relacionamento/form-contato";
import { Secao } from "@/components/dashboard/tabela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { registrarContato } from "@/server/comercial/acoes/contatos";
import { contextoCom } from "@/server/comercial/base";
import {
  configDoRelacionamento,
  opcoesDeLocatario,
} from "@/server/comercial/relacionamento";

export const metadata: Metadata = { title: "Registrar contato" };

const LISTA = "/comercial/relacionamento?aba=contatos";

export default function Page({
  searchParams,
}: PageProps<"/comercial/relacionamento/contatos/novo">) {
  return (
    <>
      <Voltar href={LISTA}>Contatos registrados</Voltar>
      <PageHeader
        title="Registrar contato"
        description="Contato ou feedback de locatário. Quem registrou e quando o sistema grava sozinho."
      />
      <Suspense fallback={<CartaoCarregando altura="h-96" />}>
        <Protegido permissao="comercial.relacionamento.registrar">
          <Formulario busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Formulario({
  busca,
}: {
  busca: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [b, ctx, config, locatarios] = await Promise.all([
    busca,
    contextoCom(),
    configDoRelacionamento(),
    opcoesDeLocatario(),
  ]);
  const pedido = Array.isArray(b.contrato) ? b.contrato[0] : b.contrato;
  const contrato = locatarios.some((l) => l.contrato === pedido)
    ? pedido
    : undefined;
  return (
    <Secao titulo="Registro">
      <ContatoNaPagina
        acao={registrarContato}
        locatarios={locatarios}
        tipos={config.tipos}
        canais={config.canais}
        hoje={ctx.hoje}
        abreChamado={ctx.pode("os.acessar")}
        contratoInicial={contrato}
        depois={LISTA}
      />
    </Secao>
  );
}
