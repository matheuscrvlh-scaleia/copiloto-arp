import "server-only";
import { cache } from "react";
import type { CopilotoRhClient } from "@/connectors/copiloto-rh/client";
import { ConnectorError, mensagemSegura } from "@/connectors/http";
import { type TurnoverDoPeriodo, turnoverDaApi } from "@/lib/rh/turnover";
import { copilotoRh, IntegracaoNaoConfigurada } from "../integracoes";
import { departamentos } from "./dados";

// Turnover direto da API do Copiloto RH (GET /v1/turnover), para o período e
// o departamento do filtro. Nada é recalculado aqui.

export type ResultadoTurnover =
  | { ok: true; dados: TurnoverDoPeriodo }
  | { ok: false; motivo: string };

// Um cliente por instância do servidor: o token (1 hora) é reaproveitado
// entre requisições, porque o login do Copiloto aceita 10 por minuto. Em
// qualquer erro o cliente é descartado (credencial trocada, token revogado).
const VALIDADE_MS = 50 * 60_000;
let guardado: { cliente: Promise<CopilotoRhClient>; ate: number } | null = null;

function cliente(): Promise<CopilotoRhClient> {
  if (!guardado || guardado.ate < Date.now())
    guardado = { cliente: copilotoRh(), ate: Date.now() + VALIDADE_MS };
  return guardado.cliente;
}

const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Departamentos do Copiloto, uma vez por requisição. */
const departamentosDoCopiloto = cache(async () =>
  (await cliente()).departamentos(),
);

function explicar(erro: unknown): string {
  if (erro instanceof IntegracaoNaoConfigurada)
    return "Cadastre o Copiloto RH em Administração › Integrações.";
  if (erro instanceof ConnectorError && erro.status === 403)
    return "A credencial do Copiloto RH não tem o escopo reports:read.";
  if (erro instanceof ConnectorError && erro.status === 429)
    return "O Copiloto RH pediu uma pausa (limite de requisições). Tente de novo em um minuto.";
  return `Copiloto RH indisponível: ${mensagemSegura(erro).replace(/^\[[a-z_]+\] /, "")}`;
}

/**
 * Turnover do período. `departamento` é o id do Centralizador: casa com o
 * departamento do Copiloto pelo nome (os cadastros são diferentes).
 */
export const turnoverDoPeriodo = cache(
  async (
    de: string,
    ate: string,
    departamento: string | null = null,
  ): Promise<ResultadoTurnover> => {
    try {
      let departamentoId: string | undefined;
      if (departamento) {
        const nome = (await departamentos()).find(
          (d) => d.id === departamento,
        )?.nome;
        const par = nome
          ? (await departamentosDoCopiloto()).find(
              (d) => semAcento(d.name) === semAcento(nome),
            )
          : undefined;
        if (!par)
          return {
            ok: false,
            motivo: `O departamento ${nome ?? "escolhido"} não existe no Copiloto RH: o turnover dele não tem como vir de lá.`,
          };
        departamentoId = par.id;
      }
      const api = await cliente();
      return {
        ok: true,
        dados: turnoverDaApi(await api.turnover({ de, ate, departamentoId })),
      };
    } catch (erro) {
      guardado = null;
      return { ok: false, motivo: explicar(erro) };
    }
  },
);
