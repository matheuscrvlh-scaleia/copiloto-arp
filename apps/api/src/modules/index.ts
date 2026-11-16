import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Rotina } from "@/infra/agendador";
import { arquivos } from "./arquivos";
import { auth } from "./auth";

// Lista dos módulos da API. Para ligar um módulo novo: importe o plugin dele
// (modules/<modulo>/index.ts) e acrescente UMA linha em MODULOS; se ele tem
// rotinas agendadas (modules/<modulo>/jobs.ts), espalhe-as em ROTINAS.

/** `prefixo` entra depois de /api/v1. */
export const MODULOS: readonly {
  prefixo: string;
  plugin: FastifyPluginAsyncZod;
}[] = [
  { prefixo: "/auth", plugin: auth },
  { prefixo: "/arquivos", plugin: arquivos },
];

export const ROTINAS: readonly Rotina[] = [];
