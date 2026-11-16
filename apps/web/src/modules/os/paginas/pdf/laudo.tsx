import { useParametro, useParametrosDeBusca } from "@/lib/navegacao";
import { hrefDoLaudo } from "@/modules/os/api-vistorias";
import { IrParaOPdf } from "./ir-para-o-pdf";

// /os/vistorias/:id/laudo?entrada=1&baixar=1: laudo da vistoria em PDF.

export default function Pagina() {
  const busca = useParametrosDeBusca().toString();
  return (
    <IrParaOPdf
      destino={hrefDoLaudo(useParametro("id"), busca ? `?${busca}` : "")}
    />
  );
}
