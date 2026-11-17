import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Rotina } from "@/infra/agendador";
import { admin, retornoDoRdCrm } from "./admin";
import { arquivos, arquivosNoEnderecoAntigo } from "./arquivos";
import { auth } from "./auth";
import { calendario } from "./calendario";
import { cameras } from "./cameras";
import { casca } from "./casca";
import {
  censoPublico,
  comercial,
  fichaPublica,
  rotinasDoComercial,
} from "./comercial";
import { financeiro } from "./financeiro";
import { gestao } from "./gestao";
import { ia } from "./ia";
import { rotinasDaIa } from "./ia/jobs";
import {
  marketing,
  retornosDoMarketing,
  rotinasDoMarketing,
} from "./marketing";
import { operacoes } from "./operacoes";
import { os } from "./os";
import { rotinasDeOs } from "./os/jobs";
import { relatorios } from "./relatorios";
import { rh } from "./rh";
import { saudeNoEnderecoAntigo } from "./saude";
import { sustentabilidade } from "./sustentabilidade";
import { rotinasDeSustentabilidade } from "./sustentabilidade/jobs";
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
  { prefixo: "/ficha", plugin: fichaPublica },
  { prefixo: "/censo", plugin: censoPublico },
  { prefixo: "/relatorios", plugin: relatorios },
  { prefixo: "/rh", plugin: rh },
  { prefixo: "/financeiro", plugin: financeiro },
  { prefixo: "/operacoes", plugin: operacoes },
  { prefixo: "/os", plugin: os },
  { prefixo: "/sustentabilidade", plugin: sustentabilidade },
  { prefixo: "/ia", plugin: ia },
];

/**
 * Endereços fora de /api/v1, chamados por terceiros e que não podem mudar
 * (volta de OAuth, câmeras, links de arquivo já enviados, saúde). `prefixo`
 * é o caminho inteiro.
 */
export const EXTERNOS: readonly {
  prefixo: string;
  plugin: FastifyPluginAsyncZod;
}[] = [
  { prefixo: "/api/integracoes/rd-crm", plugin: retornoDoRdCrm },
  { prefixo: "/api/cameras", plugin: cameras },
  { prefixo: "/api/integracoes", plugin: retornosDoMarketing },
  { prefixo: "/api/arquivos", plugin: arquivosNoEnderecoAntigo },
  { prefixo: "/api/saude", plugin: saudeNoEnderecoAntigo },
];

export const ROTINAS: readonly Rotina[] = [
  ...rotinasDeSync,
  ...rotinasDoMarketing,
  ...rotinasDoComercial,
  ...rotinasDeOs,
  ...rotinasDeSustentabilidade,
  ...rotinasDaIa,
];
