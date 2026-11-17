import { PonteDeArquivo } from "@/components/ponte-de-arquivo";
import { useParametro } from "@/lib/navegacao";
import { hrefDoLaudoPublico } from "@/modules/os/api-vistorias";

// /vistoria/:token/laudo: o laudo pelo link do locatário (sem login).

export default function Pagina() {
  const token = useParametro("token");
  return (
    <PonteDeArquivo
      publica
      destino={hrefDoLaudoPublico(token)}
      voltar={`/vistoria/${encodeURIComponent(token)}`}
    />
  );
}
