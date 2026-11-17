import { PonteDeArquivo } from "@/components/ponte-de-arquivo";
import { useParametro, useParametrosDeBusca } from "@/lib/navegacao";
import { hrefDoTermo } from "../api";

// /operacoes/energia/termo/:id?formato=pdf|docx: endereço antigo de baixar
// o termo (era um route.ts). Passa para a API, que confere a permissão e
// manda para o link assinado.

export default function Pagina() {
  const id = useParametro("id");
  const formato =
    useParametrosDeBusca().get("formato") === "docx" ? "docx" : "pdf";
  const destino = hrefDoTermo(encodeURIComponent(id), formato);
  return <PonteDeArquivo destino={destino} voltar="/operacoes/energia/termo" />;
}
