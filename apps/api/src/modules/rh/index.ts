import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rotasDoBancoDeHoras } from "./banco-horas.routes";
import { rotasDosBeneficios } from "./beneficios.routes";
import { rotasDosCadastros } from "./cadastros.routes";
import { rotasDoCustoDePessoal } from "./custo-de-pessoal.routes";
import { rotasDeFuncionarios } from "./funcionarios.routes";
import { rotasDasImportacoes } from "./importacoes.routes";
import { rotasDoOrcamento } from "./orcamento.routes";
import { rotasDasTelas } from "./telas.routes";

// Módulo RH (prefixo /api/v1/rh). Base comum (para todos os recursos do
// módulo): dados.repository.ts (consultas), dados.ts (ponto, quadro, custo,
// banco em R$), filtros.ts (filtros da URL) e turnover.ts (Copiloto RH).
// Parte B: custo de pessoal (e o recálculo, custo.service.ts), planejamento
// orçamentário, cadastros e parâmetros, benefícios e importações.

export const rh: FastifyPluginAsyncZod = async (app) => {
  await app.register(rotasDasTelas);
  await app.register(rotasDeFuncionarios);
  await app.register(rotasDoBancoDeHoras);
  await app.register(rotasDoCustoDePessoal);
  await app.register(rotasDoOrcamento);
  await app.register(rotasDosCadastros);
  await app.register(rotasDosBeneficios);
  await app.register(rotasDasImportacoes);
};
