import { PonteDeArquivo } from "@/components/ponte-de-arquivo";
import { useParametro, useParametrosDeBusca } from "@/lib/navegacao";
import { hrefDoLaudo } from "@/modules/os/api-vistorias";

// /os/vistorias/:id/laudo?entrada=1&baixar=1: laudo da vistoria em PDF.

export default function Pagina() {
  const id = useParametro("id");
  const busca = useParametrosDeBusca().toString();
  return (
    <PonteDeArquivo
      destino={hrefDoLaudo(id, busca ? `?${busca}` : "")}
      voltar={`/os/vistorias/${encodeURIComponent(id)}`}
    />
  );
}
