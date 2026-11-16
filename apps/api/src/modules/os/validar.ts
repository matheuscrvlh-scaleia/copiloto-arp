import type { z } from "zod";
import { ErroDeValidacao } from "@/erros";

// Formulários de Ativos e Vistorias: o primeiro erro, com o rótulo do campo
// na frente ("Título: informe o título"), como o `primeiroErro` de antes.

export function validar<S extends z.ZodType>(
  schema: S,
  dados: unknown,
  rotulos: Record<string, string>,
): z.infer<S> {
  const d = schema.safeParse(dados);
  if (d.success) return d.data;
  const issue = d.error.issues[0];
  const campo = String(issue?.path[0] ?? "");
  throw new ErroDeValidacao(
    `${rotulos[campo] ?? (campo || "Campo")}: ${issue?.message ?? "inválido"}`,
  );
}
