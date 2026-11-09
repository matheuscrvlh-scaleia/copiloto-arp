/**
 * Envia o arquivo, do navegador, para o link preparado pelo servidor
 * (prepararEnvio em src/server/arquivos): PUT com o arquivo no corpo. Serve
 * para o disco da VPS e para o link de envio do Supabase. true se chegou.
 */
export async function enviarParaLink(
  url: string,
  arquivo: File,
): Promise<boolean> {
  const r = await fetch(url, {
    method: "PUT",
    body: arquivo,
    headers: {
      "content-type": arquivo.type || "application/octet-stream",
      "x-upsert": "false",
    },
  }).catch(() => null);
  return r?.ok === true;
}
