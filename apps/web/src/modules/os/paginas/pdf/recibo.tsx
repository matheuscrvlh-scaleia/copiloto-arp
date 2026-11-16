import { useParametro } from "@/lib/navegacao";
import { hrefDoRecibo } from "@/modules/os/api-ativos";
import { IrParaOPdf } from "./ir-para-o-pdf";

// /os/ativos/saidas/:id/recibo: recibo da saída em PDF.

export default function Pagina() {
  return <IrParaOPdf destino={hrefDoRecibo(useParametro("id"))} />;
}
