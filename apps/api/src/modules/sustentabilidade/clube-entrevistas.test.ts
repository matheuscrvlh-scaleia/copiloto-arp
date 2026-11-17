import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, expect, it } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";

// Clube, entrevistas e chamados fixos de ponta a ponta na homologação: quem
// não tem acesso recebe 403; o administrador lê tudo e grava só em registros
// de exemplo (contribuição e ação num participante de exemplo, prazo e
// rascunho num contrato de exemplo, que não abre chamado), desfazendo no fim.

const SU = "/api/v1/sustentabilidade";
const MARCA = `teste-${randomUUID().slice(0, 8)}`;

descreverComBanco("sustentabilidade: clube e entrevistas", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  const rascunho = randomUUID();
  let participanteId: string | undefined;
  let contrato: { id: string; meses: number | null } | undefined;

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
    await banco.comoServico(async (tx) => {
      participanteId = (
        await tx
          .selectFrom("sustentabilidade.participantes")
          .select("id")
          .where("exemplo", "=", true)
          .where("saiu_em", "is", null)
          .limit(1)
          .executeTakeFirst()
      )?.id;
      const c = await tx
        .selectFrom("sustentabilidade.contratos")
        .select(["id", "validade_meses_especifica"])
        .where("exemplo", "=", true)
        .limit(1)
        .executeTakeFirst();
      if (c) contrato = { id: c.id, meses: c.validade_meses_especifica };
    });
  });

  afterAll(async () => {
    // Rede de segurança: só o que este teste criou ou mudou.
    await banco.comoServico(async (tx) => {
      await tx
        .deleteFrom("sustentabilidade.contribuicoes")
        .where("observacao", "=", MARCA)
        .execute();
      await tx
        .deleteFrom("sustentabilidade.acoes")
        .where("observacao", "=", MARCA)
        .execute();
      await tx
        .deleteFrom("sustentabilidade.entrevistas")
        .where("rascunho_chave", "=", rascunho)
        .where("situacao", "=", "rascunho")
        .execute();
      if (contrato)
        await tx
          .updateTable("sustentabilidade.contratos")
          .set({ validade_meses_especifica: contrato.meses })
          .where("id", "=", contrato.id)
          .where("exemplo", "=", true)
          .execute();
    });
    await app.close();
    await banco.encerrar();
  });

  it("sem acesso: 403 nas leituras e gravações", async () => {
    const id = randomUUID();
    const leituras = [
      `${SU}/clube`,
      `${SU}/clube/participantes/${id}`,
      `${SU}/clube/contribuicoes?de=2026-01-01&ate=2026-12-31`,
      `${SU}/clube/termos/${id}/link?qual=arquivo`,
      `${SU}/entrevistas/controle`,
      `${SU}/entrevistas/contratos/${id}`,
      `${SU}/entrevistas/salvas/${id}`,
      `${SU}/entrevistas/contratos/${id}/aplicar`,
      `${SU}/entrevistas/respostas`,
      `${SU}/chamados-fixos`,
      `${SU}/chamados-fixos/ronda/candidatos`,
    ];
    for (const url of leituras)
      expect((await semAcesso.pedir("GET", url)).statusCode, url).toBe(403);
    const gravacoes = [
      [
        `${SU}/clube/acoes`,
        { participante_id: id, data: "2026-11-16", tipo: "x", observacao: "" },
      ],
      [`${SU}/entrevistas/prazo`, { contrato_id: id, meses: "12" }],
      [`${SU}/entrevistas/interesse`, { contratoId: id }],
      [`${SU}/chamados-fixos`, { tipo: "ronda", responsavel: id }],
    ] as const;
    for (const [url, corpo] of gravacoes)
      expect((await semAcesso.pedir("POST", url, corpo)).statusCode, url).toBe(
        403,
      );
  });

  it("administrador lê o clube, as entrevistas e os chamados fixos", async () => {
    const clube = await admin.pedir("GET", `${SU}/clube`);
    expect(clube.statusCode).toBe(200);
    const ano = new Date().getFullYear();
    for (const url of [
      `${SU}/clube?ano=${ano - 1}`,
      `${SU}/clube/contribuicoes?de=${ano}-01-01&ate=${ano}-12-31`,
      `${SU}/entrevistas/respostas?de=${ano - 2}-01-01&ate=${ano}-12-31`,
      `${SU}/chamados-fixos`,
      `${SU}/chamados-fixos/ronda/candidatos`,
    ])
      expect((await admin.pedir("GET", url)).statusCode, url).toBe(200);
    const controle = await admin.pedir("GET", `${SU}/entrevistas/controle`);
    expect(controle.statusCode).toBe(200);
    const { contratos, entrevistas } = controle.json() as {
      contratos: { id: string }[];
      entrevistas: { id: string }[];
    };
    const c = contratos[0];
    if (c) {
      for (const url of [
        `${SU}/entrevistas/contratos/${c.id}`,
        `${SU}/entrevistas/contratos/${c.id}/aplicar`,
      ])
        expect((await admin.pedir("GET", url)).statusCode, url).toBe(200);
    }
    const e = entrevistas[0];
    if (e)
      expect(
        (await admin.pedir("GET", `${SU}/entrevistas/salvas/${e.id}`))
          .statusCode,
      ).toBe(200);
  });

  it("administrador registra e remove contribuição e ação num participante de exemplo", async () => {
    if (!participanteId) return;
    const url = `${SU}/clube/participantes/${participanteId}`;
    const antes = (await admin.pedir("GET", url)).json() as {
      formasDeContribuicao: string[];
      tiposDeAcao: string[];
    };
    const forma = antes.formasDeContribuicao[0];
    const tipo = antes.tiposDeAcao[0];
    if (!forma || !tipo) return;
    const base = { participante_id: participanteId, data: "2000-01-01" };
    expect(
      (
        await admin.pedir("POST", `${SU}/clube/contribuicoes`, {
          ...base,
          forma,
          valor: "0",
          competencia: "2000-01",
          observacao: MARCA,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await admin.pedir("POST", `${SU}/clube/acoes`, {
          ...base,
          tipo,
          observacao: MARCA,
        })
      ).statusCode,
    ).toBe(200);
    const depois = (await admin.pedir("GET", url)).json() as {
      contribuicoes: { id: string; observacao: string | null }[];
      acoes: { id: string; observacao: string | null }[];
    };
    const minha = depois.contribuicoes.find((x) => x.observacao === MARCA);
    const acao = depois.acoes.find((x) => x.observacao === MARCA);
    expect(minha && acao).toBeTruthy();
    expect(
      (await admin.pedir("DELETE", `${SU}/clube/contribuicoes/${minha?.id}`))
        .statusCode,
    ).toBe(200);
    expect(
      (await admin.pedir("DELETE", `${SU}/clube/acoes/${acao?.id}`)).statusCode,
    ).toBe(200);
  });

  it("administrador muda o prazo e grava rascunho num contrato de exemplo", async () => {
    if (!contrato) return;
    const prazo = await admin.pedir("POST", `${SU}/entrevistas/prazo`, {
      contrato_id: contrato.id,
      meses: "12",
    });
    expect(prazo.statusCode).toBe(200);
    const volta = await admin.pedir("POST", `${SU}/entrevistas/prazo`, {
      contrato_id: contrato.id,
      meses: contrato.meses === null ? "" : String(contrato.meses),
    });
    expect(volta.statusCode).toBe(200);
    const aplicar = await admin.pedir(
      "GET",
      `${SU}/entrevistas/contratos/${contrato.id}/aplicar`,
    );
    const a = aplicar.json() as { versao?: number; rascunho?: unknown };
    // Já há rascunho de outra pessoa ou o contrato não aceita: não grava.
    if (!a.versao || a.rascunho) return;
    const r = await admin.pedir("POST", `${SU}/entrevistas/rascunhos`, {
      chave: rascunho,
      contratoId: contrato.id,
      versao: a.versao,
      respostas: {},
    });
    expect(r.statusCode).toBe(200);
  });
});
