import pg from "pg";
import type { TestProject } from "vitest/node";
import { carregarAmbiente } from "./ambiente";

// Roda uma vez antes de tudo: confere se o banco de homologação responde
// (apps/api/.env; túnel SSH aberto). Sem banco, os testes de integração são
// PULADOS, com aviso; os de unidade rodam sempre.

declare module "vitest" {
  interface ProvidedContext {
    bancoDisponivel: boolean;
  }
}

async function responde(url: string | undefined): Promise<boolean> {
  if (!url) return false;
  const c = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 3000,
  });
  try {
    await c.connect();
    await c.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await c.end().catch(() => {});
  }
}

export default async function prepararBanco(project: TestProject) {
  carregarAmbiente();
  const ok =
    (await responde(process.env.DATABASE_URL)) &&
    Boolean(process.env.TESTE_EMAIL) &&
    Boolean(process.env.TESTE_EMAIL_SEM_ACESSO) &&
    Boolean(process.env.TESTE_SENHA);
  if (!ok)
    console.warn(
      "\n⚠ BANCO DE HOMOLOGAÇÃO INACESSÍVEL: os testes de integração foram PULADOS.\n" +
        "  Confira o túnel SSH e apps/api/.env (DATABASE_URL) e .env.teste\n" +
        "  (TESTE_EMAIL, TESTE_EMAIL_SEM_ACESSO, TESTE_SENHA).\n",
    );
  project.provide("bancoDisponivel", ok);
}
