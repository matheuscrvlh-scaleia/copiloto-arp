import { useParametro } from "@/lib/navegacao";
import { hrefDoLaudoPublico } from "@/modules/os/api-vistorias";
import { IrParaOPdf } from "./ir-para-o-pdf";

// /vistoria/:token/laudo: o laudo pelo link do locatário (sem login).

export default function Pagina() {
  return <IrParaOPdf destino={hrefDoLaudoPublico(useParametro("token"))} />;
}
