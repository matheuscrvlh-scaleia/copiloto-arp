// Verificação de saúde do contêiner (HEALTHCHECK do Docker). Não toca no
// banco: só diz que o servidor Next está de pé.
export function GET() {
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
