import type { ResultadoTurnover } from "@arp/shared/rh/contratos/comum";
import { turnoverDaApi } from "@arp/shared/rh/turnover";
import type { CopilotoRhClient } from "@/connectors/copiloto-rh/client";
import { ConnectorError, mensagemSegura } from "@/connectors/http";
import {
  copilotoRh,
  IntegracaoNaoConfigurada,
} from "@/modules/sync/credenciais.service";
import type { Departamento } from "./dados";

// Turnover direto da API do Copiloto RH (GET /v1/turnover), para o período e
// o departamento do filtro. Nada é recalculado aqui. Chamado FORA do escopo
// do banco (é HTTP externo).

// Um cliente por processo: o token (1 hora) é reaproveitado entre
// requisições, porque o login do Copiloto aceita 10 por minuto. Em qualquer
// erro o cliente é descartado (credencial trocada, token revogado).
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

function explicar(erro: unknown): string {
  if (erro instanceof IntegracaoNaoConfigurada)
    return "Cadastre o Copiloto RH em Administração › Configurações › Integrações.";
  if (erro instanceof ConnectorError && erro.status === 403)
    return "A credencial do Copiloto RH não tem o escopo reports:read.";
  if (erro instanceof ConnectorError && erro.status === 429)
    return "O Copiloto RH pediu uma pausa (limite de requisições). Tente de novo em um minuto.";
  return `Copiloto RH indisponível: ${mensagemSegura(erro).replace(/^\[[a-z_]+\] /, "")}`;
}

/**
 * Busca de turnover de uma requisição: os departamentos do Copiloto são
 * pedidos uma vez só, por mais períodos que a tela peça.
 * `departamentos`: os do Centralizador (casam com os do Copiloto pelo nome,
 * os cadastros são diferentes).
 */
export function buscaDeTurnover(departamentos: Departamento[]) {
  let doCopiloto: Promise<{ id: string; name: string }[]> | null = null;
  const departamentosDoCopiloto = () => {
    doCopiloto ??= cliente().then((c) => c.departamentos());
    return doCopiloto;
  };

  return async function turnoverDoPeriodo(
    de: string,
    ate: string,
    departamento: string | null = null,
  ): Promise<ResultadoTurnover> {
    try {
      let departamentoId: string | undefined;
      if (departamento) {
        const nome = departamentos.find((d) => d.id === departamento)?.nome;
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
      doCopiloto = null;
      return { ok: false, motivo: explicar(erro) };
    }
  };
}
