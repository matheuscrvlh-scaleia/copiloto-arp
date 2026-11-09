import "server-only";
import { criarDisco, type Disco } from "./disco";

// Os arquivos ficam só no disco: na VPS, ARQUIVOS_DIR=/dados/arquivos (o
// docker-compose.yml define); em desenvolvimento, ./dados/arquivos se a
// variável não estiver definida. O Supabase Storage não é mais consultado
// (a cópia antiga de lá ficou só como backup; docs/deploy-vps.md).

const PASTA_DE_DESENVOLVIMENTO = "./dados/arquivos";

let disco: Disco | undefined;

export function noDisco(): Disco {
  if (!disco) {
    const raiz = process.env.ARQUIVOS_DIR?.trim();
    if (!raiz && process.env.NODE_ENV === "production")
      throw new Error(
        "Arquivos não configurados: defina ARQUIVOS_DIR (pasta dos arquivos)",
      );
    disco = criarDisco(raiz || PASTA_DE_DESENVOLVIMENTO);
  }
  return disco;
}
