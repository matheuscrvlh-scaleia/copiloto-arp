import "server-only";

/** Endereço absoluto do sistema (links do WhatsApp e dos arquivos). */
export function urlDoSistema(caminho: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}${caminho}`;
}
