import { ROTA_PORTAL } from "@arp/shared/os/rotas";
import { Redirecionar } from "@/lib/navegacao";

// Links antigos, um por loja (/portal/<token>/...): vão para a entrada
// pelo CNPJ.
export default function Pagina() {
  return <Redirecionar para={ROTA_PORTAL} />;
}
