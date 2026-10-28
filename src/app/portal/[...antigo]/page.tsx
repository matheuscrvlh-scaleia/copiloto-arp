import { redirect } from "next/navigation";
import { ROTA_PORTAL } from "@/lib/os/rotas";

// Links antigos, um por loja (/portal/<token>/...): vão para a entrada
// pelo CNPJ.
export default function Page() {
  redirect(ROTA_PORTAL);
}
