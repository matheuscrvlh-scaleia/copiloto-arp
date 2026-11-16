import { fileURLToPath } from "node:url";
import { garantirPapelDaApi, migrar } from "./infra/banco/migracoes";

// Comando das migrations (`npm run db:migrar`, ou `node dist/migrar.js` no
// contêiner `migrar`). Usa a conexão de administrador e termina.
//   --marcar-base   registra as migrations da base como aplicadas, sem
//                   rodar (banco clonado da produção, que já tem o schema)

const urlAdmin = process.env.DATABASE_ADMIN_URL;
const urlDaApi = process.env.DATABASE_URL;
if (!urlAdmin || !urlDaApi) {
  console.error("Defina DATABASE_ADMIN_URL e DATABASE_URL (apps/api/.env).");
  process.exit(1);
}

// src/migrar.ts e dist/migrar.js ficam os dois a um nível de db/.
const pasta = fileURLToPath(new URL("../db/migrations", import.meta.url));
const log = (m: string) => console.log(m);

try {
  const novas = await migrar({
    url: urlAdmin,
    pasta,
    marcarBase: process.argv.includes("--marcar-base"),
    log,
  });
  await garantirPapelDaApi(urlAdmin, urlDaApi, log);
  console.log(
    novas.length
      ? `${novas.length} migration(s) aplicada(s).`
      : "Banco em dia.",
  );
} catch (e) {
  // Só a mensagem: o erro do driver pode trazer trechos do SQL.
  const causa = e instanceof Error && e.cause instanceof Error ? e.cause : null;
  console.error(e instanceof Error ? e.message : "Falha nas migrations.");
  if (causa) console.error(causa.message);
  process.exit(1);
}
