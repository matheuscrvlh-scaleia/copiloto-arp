import { responderEnvio, responderLeitura } from "@/server/arquivos/servir";

// Arquivos guardados no disco da VPS: GET entrega, PUT recebe o envio do
// navegador. Quem pode o quê vem no token assinado (src/server/arquivos).

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/arquivos/[token]">,
) {
  const { token } = await ctx.params;
  return responderLeitura(token, request);
}

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/arquivos/[token]">,
) {
  const { token } = await ctx.params;
  return responderEnvio(token, request);
}
