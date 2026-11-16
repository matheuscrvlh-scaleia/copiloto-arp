import { useSuspenseQueries } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { useBusca } from "@/lib/navegacao";
import { Voltar } from "@/modules/comercial/components/ocupacao/resumo";
import { ContatoNaPagina } from "@/modules/comercial/components/relacionamento/form-contato";
import {
  consultaConfigRelacionamento,
  consultaLocatarios,
  registrarContato,
} from "../api/relacionamento";
import { useContextoCom } from "../base";

// /comercial/relacionamento/contatos/novo
// (app/(app)/comercial/relacionamento/contatos/novo/page.tsx).

const LISTA = "/comercial/relacionamento?aba=contatos";

export default function Page() {
  return (
    <>
      <Voltar href={LISTA}>Contatos registrados</Voltar>
      <PageHeader
        title="Registrar contato"
        description="Contato ou feedback de locatário. Quem registrou e quando o sistema grava sozinho."
      />
      <Suspense fallback={<CartaoCarregando altura="h-96" />}>
        <Protegido permissao="comercial.relacionamento.registrar">
          <Formulario />
        </Protegido>
      </Suspense>
    </>
  );
}

function Formulario() {
  const b = useBusca();
  const [{ data: config }, { data: locs }] = useSuspenseQueries({
    queries: [consultaConfigRelacionamento, consultaLocatarios],
  });
  const ctx = { ...useContextoCom(), hoje: config.hoje };
  const locatarios = locs.locatarios;
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
