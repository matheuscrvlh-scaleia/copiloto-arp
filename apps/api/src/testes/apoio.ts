import { randomInt } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { describe, inject } from "vitest";
import { env } from "@/config/env";

// Apoio dos testes de integração (banco de homologação + app.inject).

/** `describe` que é pulado quando o banco não está acessível. */
export const descreverComBanco = describe.skipIf(!inject("bancoDisponivel"));

function exigida(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} em apps/api/.env.teste`);
  return valor;
}

/** Usuários só da homologação (.env.teste). Lidos na hora do uso. */
export const TESTE = {
  /** Administrador: tem cargo com permissões. */
  get email() {
    return exigida("TESTE_EMAIL");
  },
  /** Ativo, sem cargo e sem permissão alguma. */
  get emailSemAcesso() {
    return exigida("TESTE_EMAIL_SEM_ACESSO");
  },
  get senha() {
    return exigida("TESTE_SENHA");
  },
};

/** Um IP da faixa reservada a testes (RFC 2544): cada um é um "lugar" novo. */
export const ipDeTeste = () =>
  `198.18.${randomInt(0, 256)}.${randomInt(1, 255)}`;

type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Um navegador de mentira: guarda os cookies que a API manda e os devolve
 * respeitando o Path, e põe `Origin` e `X-ARP` nas gravações como a tela.
 */
export class Navegador {
  private cookies = new Map<string, { valor: string; path: string }>();

  constructor(
    private app: FastifyInstance,
    readonly ip = ipDeTeste(),
  ) {}

  cookie(nome: string): string | undefined {
    return this.cookies.get(nome)?.valor;
  }

  definirCookie(nome: string, valor: string, path = "/"): void {
    this.cookies.set(nome, { valor, path });
  }

  async pedir(
    metodo: Metodo,
    url: string,
    corpo?: Record<string, unknown>,
    cabecalhos: Record<string, string> = {},
  ) {
    const cookie = [...this.cookies]
      .filter(([, c]) => url.startsWith(c.path))
      .map(([nome, c]) => `${nome}=${c.valor}`)
      .join("; ");
    const resposta = await this.app.inject({
      method: metodo,
      url,
      // A API confia no proxy local (127.0.0.1) e lê daqui o IP de quem pede.
      headers: {
        "x-forwarded-for": this.ip,
        ...(cookie ? { cookie } : {}),
        // Como a tela: toda gravação diz que é JSON, mesmo sem corpo.
        ...(metodo === "GET"
          ? {}
          : {
              origin: env.SITE_URL,
              "x-arp": "1",
              "content-type": "application/json",
            }),
        ...cabecalhos,
      },
      ...(corpo ? { payload: corpo } : {}),
    });
    for (const c of resposta.cookies) {
      if (c.value === "" || c.maxAge === 0) this.cookies.delete(c.name);
      else this.cookies.set(c.name, { valor: c.value, path: c.path ?? "/" });
    }
    return resposta;
  }
}
