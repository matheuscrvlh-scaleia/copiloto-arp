import { INTEGRACOES, separarSegredos } from "@arp/shared/integracoes";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, expect, it } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import {
  credencialEmUso,
  IntegracaoNaoConfigurada,
} from "@/modules/sync/credenciais.service";
import { descreverComBanco } from "@/testes/apoio";

// POST /api/cameras/contagem, como a câmera manda (x-www-form-urlencoded,
// sem Origin nem X-ARP). O acesso certo é lido do cartão Câmeras só em
// memória; o aparelho de teste e as contagens dele são apagados no fim.

const APARELHO = "TESTE-PORTE";

async function limpar() {
  await banco.comoServico(async (tx) => {
    await tx
      .deleteFrom("integracao.camera_contagens")
      .where("deviceid", "=", APARELHO)
      .execute();
    await tx
      .deleteFrom("integracao.cameras")
      .where("deviceid", "=", APARELHO)
      .execute();
  });
}

descreverComBanco("câmeras: recebimento da contagem", () => {
  let app: FastifyInstance;
  let acesso: { account: string; password: string } | null = null;

  const enviar = (campos: Record<string, string>) =>
    app.inject({
      method: "POST",
      url: "/api/cameras/contagem",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams(campos).toString(),
    });

  beforeAll(async () => {
    app = await criarApp();
    await limpar();
    try {
      const c = await credencialEmUso("cameras");
      const p = INTEGRACOES.cameras.parametros.parse(c.parametros);
      const senha = separarSegredos(INTEGRACOES.cameras, c.segredo).segredo;
      if (senha) acesso = { account: String(p.usuario), password: senha };
    } catch (erro) {
      if (!(erro instanceof IntegracaoNaoConfigurada)) throw erro;
    }
  });
  afterAll(async () => {
    await limpar();
    await app.close();
    await banco.encerrar();
  });

  it("usuário ou senha errados: 401 no formato da câmera", async () => {
    const r = await enviar({
      account: "ninguem",
      password: "errada",
      status: "0",
      data: JSON.stringify({ deviceid: APARELHO }),
    });
    expect(r.statusCode).toBe(401);
    expect(r.json()).toEqual({ result: "nao autorizado" });
  });

  it("com o acesso do cartão: heartbeat, contagem e formato errado", async (t) => {
    if (!acesso) return t.skip();
    const heartbeat = await enviar({
      ...acesso,
      status: "0",
      data: JSON.stringify({ deviceid: APARELHO }),
    });
    expect(heartbeat.statusCode).toBe(200);
    expect(heartbeat.json()).toEqual({ result: "ok" });

    const contagem = {
      ...acesso,
      status: "1",
      data: JSON.stringify({
        deviceid: APARELHO,
        dateTimeStart: "2026-11-10 15:00:00",
        dateTimeEnd: "2026-11-10 15:01:00",
        in: 6,
        out: 2,
      }),
    };
    expect((await enviar(contagem)).statusCode).toBe(200);
    // Reenvio do mesmo período regrava, não soma.
    expect((await enviar(contagem)).statusCode).toBe(200);
    const linhas = await banco.comoServico((tx) =>
      tx
        .selectFrom("integracao.camera_contagens")
        .select(["entradas", "saidas", "inicio"])
        .where("deviceid", "=", APARELHO)
        .execute(),
    );
    expect(linhas).toEqual([
      { entradas: 6, saidas: 2, inicio: "2026-11-10T18:00:00.000Z" },
    ]);

    const errado = await enviar({ ...acesso, status: "1", data: "{}" });
    expect(errado.statusCode).toBe(400);
    expect(errado.json()).toEqual({ result: "formato invalido" });
  });
});
