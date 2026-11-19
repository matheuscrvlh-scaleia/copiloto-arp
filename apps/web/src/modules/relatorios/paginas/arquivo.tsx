import { PonteDeArquivo } from "@/components/ponte-de-arquivo";
import { useParametro, useParametrosDeBusca } from "@/lib/navegacao";
import { linkDoArquivo } from "../api";

// /formularios/:id/arquivo?caminho=…&nome=…: endereço antigo de baixar um
// arquivo de resposta (era um route.ts). Passa para a API, que confere a
// permissão e manda para o link assinado.

export default function Pagina() {
  const id = useParametro("id");
  const busca = useParametrosDeBusca();
  const destino = linkDoArquivo(
    id,
    busca.get("caminho") ?? "",
    busca.get("nome") ?? "",
  );
  return (
    <PonteDeArquivo
      destino={destino}
      voltar={`/formularios/${encodeURIComponent(id)}`}
    />
  );
}
