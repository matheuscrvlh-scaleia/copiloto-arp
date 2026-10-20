import "server-only";
import type { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";

// Apoio às Server Actions: mensagens curtas e sem detalhe técnico.

export function primeiroErro(
  e: z.ZodError,
  rotulos: Record<string, string> = {},
): EstadoAcao {
  const issue = e.issues[0];
  const campo = String(issue?.path[0] ?? "");
  return {
    erro: `${rotulos[campo] ?? (campo || "Campo")}: ${issue?.message ?? "inválido"}`,
  };
}

export function erroDoBanco(error: {
  message: string;
  code?: string;
}): EstadoAcao {
  if (error.code === "23505")
    return { erro: "Já existe outro registro com esse valor." };
  if (error.code === "23514") return { erro: "Valor fora do permitido." };
  if (error.code === "42501")
    return { erro: "Você não tem permissão para esta alteração." };
  // Regras do banco (ex.: manter um administrador) já vêm em português.
  if (error.code === "P0001" || error.code === "22023") {
    const m = error.message;
    return { erro: `${m.charAt(0).toUpperCase()}${m.slice(1)}.` };
  }
  return { erro: "Não foi possível salvar. Tente de novo." };
}

/** Todos os valores de um campo repetido (checkboxes). */
export function valores(form: FormData, nome: string): string[] {
  return form.getAll(nome).map(String);
}
