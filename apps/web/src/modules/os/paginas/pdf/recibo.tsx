import { PonteDeArquivo } from "@/components/ponte-de-arquivo";
import { useParametro } from "@/lib/navegacao";
import { hrefDoRecibo } from "@/modules/os/api-ativos";

// /os/ativos/saidas/:id/recibo: recibo da saída em PDF.

export default function Pagina() {
  return (
    <PonteDeArquivo
      destino={hrefDoRecibo(useParametro("id"))}
      voltar="/os/ativos/saidas"
    />
  );
}
