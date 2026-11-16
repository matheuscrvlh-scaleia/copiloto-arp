import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Rotina } from "@/infra/agendador";
import { admin, retornoDoRdCrm } from "./admin";
import { arquivos } from "./arquivos";
import { auth } from "./auth";
import { calendario } from "./calendario";
import { cameras } from "./cameras";
import { casca } from "./casca";
import { comercial } from "./comercial";
import { gestao } from "./gestao";
import {
  marketing,
  retornosDoMarketing,
  rotinasDoMarketing,
} from "./marketing";
import { operacoes } from "./operacoes";
import { os } from "./os";
import { relatorios } from "./relatorios";
import { rh } from "./rh";
import { rotinasDeSync } from "./sync/jobs";

// Lista dos módulos da API. Para ligar um módulo novo: importe o plugin dele
// (modules/<modulo>/index.ts) e acrescente UMA linha em MODULOS; se ele tem
// rotinas agendadas (modules/<modulo>/jobs.ts), espalhe-as em ROTINAS.

/** `prefixo` entra depois de /api/v1. */
export const MODULOS: readonly {
  prefixo: string;
  plugin: FastifyPluginAsyncZod;
}[] = [
  { prefixo: "/auth", plugin: auth },
  { prefixo: "/admin", plugin: admin },
  { prefixo: "", plugin: casca },
  { prefixo: "/gestao", plugin: gestao },
  { prefixo: "/arquivos", plugin: arquivos },
  { prefixo: "/calendario", plugin: calendario },
  { prefixo: "/marketing", plugin: marketing },
  { prefixo: "/comercial", plugin: comercial },
  { prefixo: "/relatorios", plugin: relatorios },
  { prefixo: "/rh", plugin: rh },
  { prefixo: "/operacoes", plugin: operacoes },
  { prefixo: "/os", plugin: os },
];

/**
 * Endereços fora de /api/v1, chamados por terceiros e que não podem mudar
 * (volta de OAuth, câmeras). `prefixo` é o caminho inteiro.
 */
export const EXTERNOS: readonly {
  prefixo: string;
  plugin: FastifyPluginAsyncZod;
}[] = [
  { prefixo: "/api/integracoes/rd-crm", plugin: retornoDoRdCrm },
  { prefixo: "/api/cameras", plugin: cameras },
  { prefixo: "/api/integracoes", plugin: retornosDoMarketing },
];

export const ROTINAS: readonly Rotina[] = [
  ...rotinasDeSync,
  ...rotinasDoMarketing,
];
