import type { Permissao } from "@arp/shared/permissions";
import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { Contexto, Origem } from "@/contexto";
import {
  ErroDePermissao,
  ErroDeSenhaProvisoria,
  ErroNaoAutenticado,
} from "@/erros";
import { autenticar } from "@/modules/auth/auth.service";
import { COOKIE_ACESSO } from "./sessao";

// Toda rota declara, em `config`, quem pode chamar:
//   { acesso: "publico" }          sem sessão (o service confere o que for)
//   { acesso: "autenticado" }      qualquer pessoa logada
//   { permissao: "os.acessar" }    logada e com esta permissão
// Rota sem declaração é negada (e o teste rotas.test.ts falha). A permissão
// fina (dono do registro, etapa, valor) continua no service e no RLS.

declare module "fastify" {
  interface FastifyContextConfig {
    acesso?: "publico" | "autenticado";
    permissao?: Permissao;
    /** Responde mesmo a quem ainda está com a senha provisória. */
    comSenhaProvisoria?: boolean;
    /**
     * Gravação que não exige `X-ARP` nem `Origin`: só para rota que vale por
     * um token próprio no endereço (envio de arquivo por link assinado).
     */
    semCsrf?: boolean;
    /**
     * Como a IA ARP enxerga esta leitura (GET). Toda rota GET autenticada
     * com schema de resposta entra sozinha no catálogo da IA; aqui dá para
     * descrever melhor o que ela devolve, ou `false` para deixar de fora.
     */
    ia?: string | false;
  }
  interface FastifyRequest {
    contexto: Contexto | null;
  }
  interface FastifyInstance {
    /** As rotas registradas, para o teste de declaração de acesso. */
    rotas: RotaRegistrada[];
  }
}

export interface RotaRegistrada {
  metodo: string;
  url: string;
  acesso: "publico" | "autenticado" | undefined;
  permissao: Permissao | undefined;
  /** Schemas da rota (Zod), para o catálogo da IA. */
  schemas: {
    params: unknown;
    querystring: unknown;
    resposta: unknown;
  };
  ia: string | false | undefined;
}

/** O que se sabe de qualquer pedido (rota pública inclusive). */
export function origemDe(request: FastifyRequest): Origem {
  const agente = request.headers["user-agent"];
  return {
    ip: request.ip,
    agente: agente ? agente.slice(0, 300) : null,
    requisicaoId: request.id,
  };
}

/** O contexto de quem está logado; o controller repassa ao service. */
export function contextoDe(request: FastifyRequest): Contexto {
  if (!request.contexto) throw new ErroNaoAutenticado();
  return request.contexto;
}

export const permissao = fp(async (app: FastifyInstance) => {
  app.decorate("rotas", []);
  app.decorateRequest("contexto", null);

  app.addHook("onRoute", (rota) => {
    const resposta: unknown = rota.schema?.response;
    for (const metodo of [rota.method].flat())
      app.rotas.push({
        metodo,
        url: rota.url,
        acesso: rota.config?.acesso,
        permissao: rota.config?.permissao,
        schemas: {
          params: rota.schema?.params,
          querystring: rota.schema?.querystring,
          resposta:
            typeof resposta === "object" && resposta !== null
              ? Object.entries(resposta).find(([s]) => s === "200")?.[1]
              : undefined,
        },
        ia: rota.config?.ia,
      });
  });

  app.addHook("onRequest", async (request) => {
    if (request.is404) return;
    const { acesso, permissao, comSenhaProvisoria } =
      request.routeOptions.config;
    if (acesso === "publico") return;
    // Negado por padrão: rota que esqueceu de declarar não responde.
    if (acesso !== "autenticado" && !permissao) throw new ErroDePermissao();

    const ctx = await autenticar(
      request.cookies[COOKIE_ACESSO],
      origemDe(request),
    );
    request.contexto = ctx;
    if (ctx.senhaProvisoria && !comSenhaProvisoria)
      throw new ErroDeSenhaProvisoria();
    if (permissao && !ctx.permissoes.has(permissao))
      throw new ErroDePermissao();
  });
});
