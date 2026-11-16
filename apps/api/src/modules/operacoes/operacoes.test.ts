import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, expect, it } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";
import { importacaoDoArquivo } from "./importacoes.repository";

// Operações (parte A: base, painel, água, energia, importações) de ponta a
// ponta na homologação: quem não tem acesso recebe 403; o administrador lê
// tudo e grava uma correção de vínculo, um quadro e uma caixa de teste (com
// troca de locatário e caixa liberada), apagados no fim.

const OP = "/api/v1/operacoes";
/** Muitas leituras no banco remoto da homologação. */
const LONGO = 180_000;

descreverComBanco("operações (/api/v1/operacoes)", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  const marca = randomUUID().slice(0, 8);
  const hidrometro = `TESTE-${marca}`.toUpperCase();
  const codigo = `zt-${marca.slice(0, 6)}`;
  const criados = { quadros: [] as string[], vinculos: [] as string[] };

  beforeAll(async () => {
    app = await criarApp();
    admin = new Navegador(app);
    semAcesso = new Navegador(app);
    for (const [n, email] of [
      [admin, TESTE.email],
      [semAcesso, TESTE.emailSemAcesso],
    ] as const) {
      const r = await n.pedir("POST", "/api/v1/auth/entrar", {
        email,
        senha: TESTE.senha,
      });
      expect(r.statusCode).toBe(200);
    }
  });

  afterAll(async () => {
    // Rede de segurança: só o que este teste criou.
    await banco.comoServico(async (tx) => {
      // Também as sobras de uma execução interrompida deste teste (mesmo
      // prefixo e motivo, nunca dado de verdade).
      await tx
        .deleteFrom("operacoes.agua_vinculos")
        .where("hidrometro", "like", "TESTE-%")
        .where("motivo", "=", "teste automatizado")
        .execute();
      const quadros = await tx
        .selectFrom("operacoes.quadros")
        .select("id")
        .where("codigo", "like", "zt-%")
        .where("nome", "like", "Quadro de teste%")
        .execute();
      const ids = [...criados.quadros, ...quadros.map((q) => q.id)];
      if (ids.length) {
        const caixas = await tx
          .selectFrom("operacoes.caixas")
          .select("id")
          .where("quadro_id", "in", ids)
          .execute();
        if (caixas.length) {
          await tx
            .deleteFrom("operacoes.caixa_ocupantes")
            .where(
              "caixa_id",
              "in",
              caixas.map((c) => c.id),
            )
            .execute();
          await tx
            .deleteFrom("operacoes.caixas")
            .where(
              "id",
              "in",
              caixas.map((c) => c.id),
            )
            .execute();
        }
        await tx
          .deleteFrom("operacoes.quadros")
          .where("id", "in", ids)
          .execute();
      }
    });
    await app.close();
    await banco.encerrar();
  }, LONGO);

  it(
    "sem acesso ao módulo: 403 em toda leitura e gravação",
    async () => {
      const id = randomUUID();
      const pedidos = [
        ["GET", `${OP}/parametros`],
        ["GET", `${OP}/parametros/historico`],
        ["GET", `${OP}/parametros/exemplos`],
        ["GET", `${OP}/parametros/unidades-energia`],
        ["GET", `${OP}/cadastros/hidrometros`],
        ["GET", `${OP}/cadastros/salas`],
        ["GET", `${OP}/painel`],
        ["GET", `${OP}/agua/meses`],
        ["GET", `${OP}/agua/meses/2026-10-01`],
        ["GET", `${OP}/agua/extrato`],
        ["GET", `${OP}/agua/extrato/pdf`],
        ["GET", `${OP}/agua/hidrometros/A1`],
        ["GET", `${OP}/agua/importacao/previa-aberta`],
        ["GET", `${OP}/agua/contas/previa-aberta`],
        ["GET", `${OP}/importacoes`],
        ["GET", `${OP}/importacoes/situacao`],
        ["GET", `${OP}/importacoes/${id}`],
        ["GET", `${OP}/energia/quadros`],
        ["GET", `${OP}/energia/caixas`],
        ["GET", `${OP}/energia/salas`],
        ["GET", `${OP}/energia/caixas/${id}`],
        ["GET", `${OP}/energia/quadros/${id}/fotos`],
        ["GET", `${OP}/energia/termos`],
        ["GET", `${OP}/energia/termos/${id}/arquivo`],
        ["GET", `${OP}/energia/unidades`],
        ["GET", `${OP}/energia/contas/meses`],
        ["GET", `${OP}/energia/contas/faturas?mes=2026-10-01`],
        ["GET", `${OP}/energia/contas/faturas/${id}`],
        ["GET", `${OP}/energia/contas/creditos?mes=2026-10-01`],
        ["GET", `${OP}/energia/contas/importacao/previas`],
        ["POST", `${OP}/importacoes/${id}/desfazer`],
        ["POST", `${OP}/energia/caixas/${id}/enet`],
        ["DELETE", `${OP}/agua/vinculos/${id}`],
        ["DELETE", `${OP}/agua/leituras/${id}`],
      ] as const;
      for (const [metodo, url] of pedidos)
        expect(
          (await semAcesso.pedir(metodo, url)).statusCode,
          `${metodo} ${url}`,
        ).toBe(403);
      const quadro = await semAcesso.pedir("POST", `${OP}/energia/quadros`, {
        codigo,
        nome: "Quadro de teste",
        bloco: "99",
      });
      expect(quadro.statusCode).toBe(403);
      const vinculo = await semAcesso.pedir("POST", `${OP}/agua/vinculos`, {
        hidrometro,
        desde: "2026-10",
        bloco: "99",
        sala: "Teste",
        motivo: "teste automatizado",
      });
      expect(vinculo.statusCode).toBe(403);
    },
    LONGO,
  );

  it(
    "administrador: lê a base, o painel, a água e as importações",
    async () => {
      for (const url of [
        `${OP}/parametros`,
        `${OP}/parametros/historico`,
        `${OP}/parametros/exemplos`,
        `${OP}/parametros/unidades-energia`,
        `${OP}/cadastros/hidrometros`,
        `${OP}/cadastros/salas`,
        `${OP}/painel`,
        `${OP}/agua/meses`,
        `${OP}/agua/extrato`,
        `${OP}/agua/importacao/previa-aberta`,
        `${OP}/agua/contas/previa-aberta`,
        `${OP}/importacoes`,
        `${OP}/importacoes/situacao`,
      ])
        expect((await admin.pedir("GET", url)).statusCode, url).toBe(200);

      const meses = (await admin.pedir("GET", `${OP}/agua/meses`)).json();
      const ref: string | undefined = meses.meses[0]?.referencia;
      if (ref) {
        const mes = await admin.pedir("GET", `${OP}/agua/meses/${ref}`);
        expect(mes.statusCode).toBe(200);
        const h: string | undefined = mes.json().leituras[0]?.hidrometro;
        if (h)
          expect(
            (
              await admin.pedir(
                "GET",
                `${OP}/agua/hidrometros/${encodeURIComponent(h)}`,
              )
            ).statusCode,
          ).toBe(200);
      }
      expect(
        (await admin.pedir("GET", `${OP}/agua/meses/2026-13-01`)).statusCode,
      ).toBe(404);

      const pagina = (await admin.pedir("GET", `${OP}/importacoes`)).json();
      const imp: string | undefined = pagina.linhas[0]?.id;
      if (imp)
        expect(
          (await admin.pedir("GET", `${OP}/importacoes/${imp}`)).statusCode,
        ).toBe(200);
    },
    LONGO,
  );

  it(
    "administrador: lê os quadros, as caixas, as contas e a solar",
    async () => {
      for (const url of [
        `${OP}/energia/quadros`,
        `${OP}/energia/caixas`,
        `${OP}/energia/salas`,
        `${OP}/energia/termos`,
        `${OP}/energia/unidades`,
        `${OP}/energia/contas/meses`,
        `${OP}/energia/contas/importacao/previas`,
      ])
        expect((await admin.pedir("GET", url)).statusCode, url).toBe(200);

      const { quadros } = (
        await admin.pedir("GET", `${OP}/energia/quadros`)
      ).json();
      if (quadros[0])
        expect(
          (
            await admin.pedir(
              "GET",
              `${OP}/energia/quadros/${quadros[0].id}/fotos`,
            )
          ).statusCode,
        ).toBe(200);
      const { caixas } = (
        await admin.pedir("GET", `${OP}/energia/caixas`)
      ).json();
      if (caixas[0])
        expect(
          (await admin.pedir("GET", `${OP}/energia/caixas/${caixas[0].id}`))
            .statusCode,
        ).toBe(200);

      const { meses } = (
        await admin.pedir("GET", `${OP}/energia/contas/meses`)
      ).json();
      if (meses[0]) {
        const r = await admin.pedir(
          "GET",
          `${OP}/energia/contas/faturas?mes=${meses[0]}`,
        );
        expect(r.statusCode).toBe(200);
        const f = r.json().faturas.at(-1);
        if (f)
          expect(
            (await admin.pedir("GET", `${OP}/energia/contas/faturas/${f.id}`))
              .statusCode,
          ).toBe(200);
        expect(
          (
            await admin.pedir(
              "GET",
              `${OP}/energia/contas/creditos?mes=${meses[0]}`,
            )
          ).statusCode,
        ).toBe(200);
      }
      expect(
        (await admin.pedir("GET", `${OP}/energia/caixas/${randomUUID()}`))
          .statusCode,
      ).toBe(404);
    },
    LONGO,
  );

  it(
    "importação repetida: o filtro do jsonb pelo sha256 roda no banco",
    async () => {
      const achadas = await banco.comoServico((tx) =>
        importacaoDoArquivo(tx, "energisa", `teste-${marca}`),
      );
      expect(achadas).toEqual([]);
    },
    LONGO,
  );

  it(
    "administrador: corrige o vínculo de um hidrômetro e desfaz",
    async () => {
      const r = await admin.pedir("POST", `${OP}/agua/vinculos`, {
        hidrometro,
        desde: "2026-10",
        bloco: "99",
        sala: "Sala de teste",
        motivo: "teste automatizado",
      });
      expect(r.statusCode).toBe(200);
      const [v] = await banco.comoServico((tx) =>
        tx
          .selectFrom("operacoes.agua_vinculos")
          .select("id")
          .where("hidrometro", "=", hidrometro)
          .execute(),
      );
      expect(v).toBeDefined();
      if (!v) return;
      const fora = await admin.pedir("DELETE", `${OP}/agua/vinculos/${v.id}`);
      expect(fora.statusCode).toBe(200);
    },
    LONGO,
  );

  it(
    "administrador: cadastra quadro e caixa, troca o locatário e libera",
    async () => {
      const invalido = await admin.pedir("POST", `${OP}/energia/quadros`, {
        codigo,
        nome: "",
        bloco: "99",
      });
      expect(invalido.statusCode).toBe(400);
      expect(invalido.json().erro.mensagem).toBe("Nome: informe o nome");

      const novo = await admin.pedir("POST", `${OP}/energia/quadros`, {
        codigo,
        nome: "Quadro de teste",
        bloco: "99",
        ordem: "999",
      });
      expect(novo.statusCode).toBe(200);
      expect(novo.json().codigo).toBe(codigo);
      const [q] = await banco.comoServico((tx) =>
        tx
          .selectFrom("operacoes.quadros")
          .select("id")
          .where("codigo", "=", codigo)
          .execute(),
      );
      expect(q).toBeDefined();
      if (!q) return;
      criados.quadros.push(q.id);

      const editado = await admin.pedir("POST", `${OP}/energia/quadros`, {
        id: q.id,
        nome: "Quadro de teste (editado)",
        bloco: "99",
        ordem: "999",
      });
      expect(editado.json().mensagem).toBe("Quadro atualizado.");

      const caixa = await admin.pedir("POST", `${OP}/energia/caixas`, {
        quadro_id: q.id,
        numero: "T1",
        lado: "esquerdo",
        coluna: "1",
        linha: "1",
        status: "livre",
      });
      expect(caixa.statusCode).toBe(200);
      const caixaId: string = caixa.json().id;
      const mesmaPosicao = await admin.pedir("POST", `${OP}/energia/caixas`, {
        quadro_id: q.id,
        numero: "T2",
        lado: "esquerdo",
        coluna: "1",
        linha: "1",
        status: "livre",
      });
      expect(mesmaPosicao.json().erro.mensagem).toBe(
        "Posição: a caixa T1 já está no lado esquerdo, coluna 1, linha 1.",
      );

      const troca = await admin.pedir(
        "POST",
        `${OP}/energia/caixas/${caixaId}/locatario`,
        { nome: "Locatário de teste", desde: "2026-11-01" },
      );
      expect(troca.statusCode).toBe(200);
      const ficha = (
        await admin.pedir("GET", `${OP}/energia/caixas/${caixaId}`)
      ).json();
      expect(ficha.caixa.ocupante).toBe("Locatário de teste");
      expect(ficha.caixa.quadro.codigo).toBe(codigo);

      const liberada = await admin.pedir(
        "POST",
        `${OP}/energia/caixas/${caixaId}/liberar`,
        { saida: "2026-11-15", status: "livre" },
      );
      expect(liberada.statusCode).toBe(200);
      const depois = (
        await admin.pedir("GET", `${OP}/energia/caixas/${caixaId}`)
      ).json();
      expect(depois.caixa.ocupante).toBeNull();
      expect(depois.historico?.length).toBe(1);
    },
    LONGO,
  );
});
