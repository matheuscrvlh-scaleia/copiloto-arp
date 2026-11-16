import type { FastifyRequest } from "fastify";
import { contextoDe } from "@/http/permissao";
import { dadosAsana } from "./asana.service";
import * as fontes from "./fontes.service";

// HTTP das fontes do Marketing: só repassa ao service.

export const anuncios = (r: FastifyRequest) =>
  fontes.dadosAnuncios(contextoDe(r));
export const rd = (r: FastifyRequest) => fontes.dadosRd(contextoDe(r));
export const rdAnuncios = (r: FastifyRequest) =>
  fontes.dadosRdDosAnuncios(contextoDe(r));
export const site = (r: FastifyRequest) => fontes.dadosSite(contextoDe(r));
export const redes = (r: FastifyRequest) => fontes.dadosRedes(contextoDe(r));
export const asana = (r: FastifyRequest) => dadosAsana(contextoDe(r));
export const reputacao = (r: FastifyRequest) =>
  fontes.dadosReputacao(contextoDe(r));
