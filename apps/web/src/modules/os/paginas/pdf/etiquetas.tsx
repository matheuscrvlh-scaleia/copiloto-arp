import { BASE_DA_API } from "@/lib/api";
import { useParametrosDeBusca } from "@/lib/navegacao";
import { IrParaOPdf } from "./ir-para-o-pdf";

// /os/ativos/etiquetas/pdf?id=…&inicio=…: etiquetas em PDF.

export default function Pagina() {
  const busca = useParametrosDeBusca().toString();
  return (
    <IrParaOPdf
      destino={`${BASE_DA_API}/os/ativos/etiquetas/pdf${busca ? `?${busca}` : ""}`}
    />
  );
}
