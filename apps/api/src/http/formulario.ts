import type { FastifyRequest } from "fastify";

// Formulário com arquivo (multipart/form-data). O plugin de segurança
// registra o @fastify/multipart com limites conservadores; o controller que
// espera arquivo chama `lerFormulario` e valida os campos com o schema Zod
// do contrato (aqui o Fastify não valida o corpo sozinho).
//
// Para arquivo grande (foto de celular, vídeo, planilha pesada), prefira o
// envio direto por link assinado: `prepararEnvio` de infra/arquivos.

export interface ArquivoRecebido {
  /** Nome do campo do formulário. */
  campo: string;
  /** Nome que veio do navegador: nunca use como caminho sem limpar. */
  nome: string;
  /** Tipo declarado pelo navegador: confira pelo conteúdo antes de confiar. */
  tipo: string;
  bytes: Buffer;
}

export interface Formulario {
  /** Campo repetido vira lista, como `formParaObjeto` da tela. */
  campos: Record<string, string | string[]>;
  arquivos: ArquivoRecebido[];
}

/**
 * Lê o formulário inteiro para a memória. `arquivos` e `bytesPorArquivo`
 * são o máximo que ESTA rota aceita (passou disso: 413).
 */
export async function lerFormulario(
  request: FastifyRequest,
  limites: { arquivos: number; bytesPorArquivo: number },
): Promise<Formulario> {
  const campos: Formulario["campos"] = {};
  const arquivos: ArquivoRecebido[] = [];
  const partes = request.parts({
    limits: { files: limites.arquivos, fileSize: limites.bytesPorArquivo },
  });
  for await (const parte of partes) {
    if (parte.type === "file") {
      // Campo de arquivo vazio chega sem nome: não é um arquivo.
      const bytes = await parte.toBuffer();
      if (parte.filename)
        arquivos.push({
          campo: parte.fieldname,
          nome: parte.filename,
          tipo: parte.mimetype,
          bytes,
        });
      continue;
    }
    if (typeof parte.value !== "string") continue;
    const anterior = campos[parte.fieldname];
    campos[parte.fieldname] =
      anterior === undefined
        ? parte.value
        : [...[anterior].flat(), parte.value];
  }
  return { campos, arquivos };
}
