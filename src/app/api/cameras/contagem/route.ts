import { receberEnvioCamera } from "@/server/cameras/recebimento";

// Envio automático das câmeras Intelbras (heartbeat e contagem de pessoas).
// Configurar em cada câmera: Contagem de Pessoas › Enviar para servidor, com
// este endereço e o usuário e a senha de Administração › Integrações › Câmeras.

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ result: "erro" }, { status: 400 });
  }
  try {
    const r = await receberEnvioCamera(form);
    if (r === "nao_autorizado")
      return Response.json({ result: "nao autorizado" }, { status: 401 });
    if (r === "formato")
      return Response.json({ result: "formato invalido" }, { status: 400 });
    // Com {"result":"ok"} a câmera ainda reenvia às vezes; o upsert absorve.
    return Response.json({ result: "ok" });
  } catch (erro) {
    console.error("câmeras: falha ao gravar", erro);
    return Response.json({ result: "erro" }, { status: 500 });
  }
}
