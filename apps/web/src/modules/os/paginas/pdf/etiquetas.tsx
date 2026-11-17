import { PonteDeArquivo } from "@/components/ponte-de-arquivo";
import { BASE_DA_API } from "@/lib/api";
import { useParametrosDeBusca } from "@/lib/navegacao";

// /os/ativos/etiquetas/pdf?id=…&inicio=…: etiquetas em PDF.

export default function Pagina() {
  const busca = useParametrosDeBusca().toString();
  return (
    <PonteDeArquivo
      destino={`${BASE_DA_API}/os/ativos/etiquetas/pdf${busca ? `?${busca}` : ""}`}
      voltar="/os/ativos/etiquetas"
    />
  );
}
