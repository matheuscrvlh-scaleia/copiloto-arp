import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, expect, it } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";

// Base, Painel, relatório do mês e configurações do Sustentabilidade de ponta
// a ponta na homologação: quem não tem acesso recebe 403; o administrador lê
// tudo; as gravações usam só registros criados aqui (um coletor inativo, um
// programa com um formulário, um envio de planilha preparado e descartado) e
// são desfeitas no fim. Nada aqui remove exemplos, fecha ano ou confirma
// importação; o relatório é de um mês antigo (não conclui chamado).

const SU = "/api/v1/sustentabilidade";
const MARCA = `teste-${randomUUID().slice(0, 8)}`;
// Cada pedido abre uma transação na homologação (túnel): os testes com
// muitos pedidos passam do limite padrão.
const DEMORADO = 300_000;

descreverComBanco("sustentabilidade: base, painel e configurações", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  let programaId: string | undefined;

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
      await tx
        .deleteFrom("sustentabilidade.coletores")
        .where("local", "=", MARCA)
        .execute();
      if (programaId) {
        await tx
          .deleteFrom("sustentabilidade.formularios")
          .where("programa_id", "=", programaId)
          .execute();
        await tx
          .deleteFrom("sustentabilidade.programas")
          .where("id", "=", programaId)
          .where("nome", "=", MARCA)
          .execute();
      }
    });
    await app.close();
    await banco.encerrar();
  });

  it(
    "sem acesso: 403 nas leituras e gravações",
    async () => {
      const id = randomUUID();
      // O contexto responde a qualquer pessoa logada, com a lista de programas vazia.
      const contexto = await semAcesso.pedir("GET", `${SU}/contexto`);
      expect(contexto.statusCode).toBe(200);
      expect(contexto.json().programas).toEqual([]);

      const leituras = [
        `${SU}/parametros`,
        `${SU}/coletores`,
        `${SU}/parametros/tela`,
        `${SU}/painel`,
        `${SU}/importacoes`,
        `${SU}/importacoes/${id}`,
        `${SU}/formularios/questionario`,
        `${SU}/formularios?programa=${id}`,
      ];
      for (const url of leituras)
        expect((await semAcesso.pedir("GET", url)).statusCode, url).toBe(403);

      const gravacoes = [
        ["POST", `${SU}/relatorio/2001-01`, undefined],
        ["POST", `${SU}/painel/anos/fechar`, { ano: "2001" }],
        ["POST", `${SU}/painel/anos/reabrir`, { ano: "2001", motivo: "x" }],
        ["PATCH", `${SU}/parametros`, { grupo: "clube" }],
        ["PUT", `${SU}/parametros/setores`, {}],
        ["PUT", `${SU}/parametros/marcos`, {}],
        ["PUT", `${SU}/parametros/equivalencias`, {}],
        ["PUT", `${SU}/parametros/metas`, {}],
        ["POST", `${SU}/parametros/rcc-vigencias`, {}],
        ["POST", `${SU}/parametros/exemplos/remover`, undefined],
        ["POST", `${SU}/coletores`, { local: "x", cor: "azul" }],
        ["DELETE", `${SU}/coletores/${id}`, undefined],
        [
          "POST",
          `${SU}/importacoes/envio`,
          { tipo: "entrevistas", nome: "a.csv", tamanho: 10 },
        ],
        ["POST", `${SU}/importacoes/${id}/confirmar`, undefined],
        ["POST", `${SU}/importacoes/${id}/desfazer`, undefined],
      ] as const;
      for (const [metodo, url, corpo] of gravacoes)
        expect(
          (await semAcesso.pedir(metodo, url, corpo)).statusCode,
          `${metodo} ${url}`,
        ).toBe(403);
    },
    DEMORADO,
  );

  it(
    "sem acesso: o editor e as ações de formulário recusam sem gravar",
    async () => {
      const q = await admin.pedir("GET", `${SU}/formularios/questionario`);
      expect(q.statusCode).toBe(200);
      const id: string | null = q.json().id;
      if (!id) return;
      // Quem não entra no módulo recebe 403; quem entra mas não edita este
      // formulário recebe 200 com `semAcesso` ou `erro`. Nunca `ok`.
      const pedidos = [
        ["GET", `${SU}/formularios/${id}/editor`, undefined],
        [
          "POST",
          `${SU}/formularios/${id}/publicar`,
          { atualizadoEm: "2001-01-01T00:00:00.000000Z", resumo: MARCA },
        ],
        [
          "POST",
          `${SU}/formularios/${id}/rascunho/descartar`,
          { atualizadoEm: "2001-01-01T00:00:00.000000Z" },
        ],
        [
          "POST",
          `${SU}/formularios`,
          { programaId: randomUUID(), nome: MARCA },
        ],
        ["DELETE", `${SU}/formularios/${id}`, undefined],
      ] as const;
      for (const [metodo, url, corpo] of pedidos) {
        const r = await semAcesso.pedir(metodo, url, corpo);
        const rotulo = `${metodo} ${url}`;
        expect([200, 403], rotulo).toContain(r.statusCode);
        if (r.statusCode !== 200) continue;
        expect(r.json().ok, rotulo).toBeUndefined();
        expect(r.json().editor ?? null, rotulo).toBeNull();
        expect(r.json().erro ?? r.json().semAcesso, rotulo).toBeTruthy();
      }
    },
    DEMORADO,
  );

  it(
    "administrador lê a base, o painel, os parâmetros e as importações",
    async () => {
      const contexto = await admin.pedir("GET", `${SU}/contexto`);
      expect(contexto.statusCode).toBe(200);
      expect(contexto.json().hoje).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const parametros = await admin.pedir("GET", `${SU}/parametros`);
      expect(parametros.statusCode).toBe(200);
      expect(parametros.json().parametros.id).toBe(true);

      for (const aba of [
        "entrevistas",
        "clube",
        "coletores",
        "rcc",
        "programas",
        "painel",
        "historico",
      ]) {
        const r = await admin.pedir("GET", `${SU}/parametros/tela?aba=${aba}`);
        expect(r.statusCode, aba).toBe(200);
      }

      const painel = await admin.pedir(
        "GET",
        `${SU}/painel?ano=2001&ate=12&comparar=sim`,
      );
      expect(painel.statusCode, painel.body).toBe(200);
      expect(Array.isArray(painel.json().painel.cartoes)).toBe(true);

      const importacoes = await admin.pedir("GET", `${SU}/importacoes`);
      expect(importacoes.statusCode).toBe(200);
      expect(
        (await admin.pedir("GET", `${SU}/importacoes/${randomUUID()}`))
          .statusCode,
      ).toBe(404);
    },
    DEMORADO,
  );

  it(
    "relatório do mês: PDF por POST; mês inválido é recusado",
    async () => {
      const pdf = await admin.pedir("POST", `${SU}/relatorio/2001-01`);
      expect(pdf.statusCode, pdf.body.slice(0, 200)).toBe(200);
      expect(pdf.headers["content-type"]).toContain("application/pdf");
      expect(pdf.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
      expect(
        (await admin.pedir("POST", `${SU}/relatorio/2001-13`)).statusCode,
      ).toBe(400);
      // Ler não gera: a rota só existe como POST.
      expect(
        (await admin.pedir("GET", `${SU}/relatorio/2001-01`)).statusCode,
      ).toBe(404);
    },
    DEMORADO,
  );

  it(
    "coletor: valida, cadastra inativo e exclui",
    async () => {
      const invalido = await admin.pedir("POST", `${SU}/coletores`, {
        local: "",
        cor: "azul",
        conteineres: "1",
      });
      expect(invalido.statusCode).toBeGreaterThanOrEqual(400);

      const criado = await admin.pedir("POST", `${SU}/coletores`, {
        local: MARCA,
        cor: "azul",
        conteineres: "1",
        capacidade: "",
        ordem: "999",
      });
      expect(criado.statusCode, criado.body).toBe(200);
      const lista = await admin.pedir("GET", `${SU}/coletores`);
      const meu = (
        lista.json().coletores as {
          id: string;
          local: string;
          ativo: boolean;
        }[]
      ).find((c) => c.local === MARCA);
      expect(meu).toBeDefined();
      expect(meu?.ativo).toBe(false);
      if (!meu) return;
      const excluido = await admin.pedir("DELETE", `${SU}/coletores/${meu.id}`);
      expect(excluido.statusCode, excluido.body).toBe(200);
    },
    DEMORADO,
  );

  it(
    "parâmetros: entrada inválida é recusada sem gravar",
    async () => {
      const r = await admin.pedir("PATCH", `${SU}/parametros`, {
        grupo: "nao-existe",
      });
      expect(r.statusCode).toBeGreaterThanOrEqual(400);
      expect(r.statusCode).toBeLessThan(500);
      const fechar = await admin.pedir("POST", `${SU}/painel/anos/fechar`, {
        ano: "abc",
      });
      expect(fechar.statusCode).toBeGreaterThanOrEqual(400);
      expect(fechar.statusCode).toBeLessThan(500);
    },
    DEMORADO,
  );

  it(
    "formulário de programa: cria, renomeia, abre o editor e exclui",
    async () => {
      const programa = await admin.pedir("POST", `${SU}/programas`, {
        nome: MARCA,
        descricao: "",
        area: "",
        parceiro_nome: "",
        parceiro_doc: "",
        inicio: "",
        fim: "",
        frequencia: "evento",
      });
      expect(programa.statusCode, programa.body).toBe(201);
      const pid: string = programa.json().id;
      programaId = pid;

      const criado = await admin.pedir("POST", `${SU}/formularios`, {
        programaId: pid,
        nome: `${MARCA} formulário`,
      });
      expect(criado.statusCode).toBe(200);
      expect(criado.json().ok, criado.body).toBe(true);

      const lista = await admin.pedir(
        "GET",
        `${SU}/formularios?programa=${pid}`,
      );
      expect(lista.statusCode).toBe(200);
      const formularios: { id: string; nome: string }[] =
        lista.json().formularios;
      expect(formularios).toHaveLength(1);
      const fid = formularios[0]?.id ?? "";

      const renomeado = await admin.pedir("PATCH", `${SU}/formularios/${fid}`, {
        nome: `${MARCA} renomeado`,
      });
      expect(renomeado.json().ok, renomeado.body).toBe(true);

      const editor = await admin.pedir(
        "GET",
        `${SU}/formularios/${fid}/editor`,
      );
      expect(editor.statusCode, editor.body.slice(0, 300)).toBe(200);
      expect(editor.json().semAcesso).toBe(false);
      expect(editor.json().editor).not.toBeNull();

      // Versão otimista: carimbo velho não grava.
      const velho = await admin.pedir(
        "POST",
        `${SU}/formularios/${fid}/rascunho/descartar`,
        { atualizadoEm: "2001-01-01T00:00:00.000000Z" },
      );
      expect(velho.statusCode).toBe(200);
      expect(velho.json().ok).toBeUndefined();

      const excluido = await admin.pedir("DELETE", `${SU}/formularios/${fid}`);
      expect(excluido.json().ok, excluido.body).toBe(true);
    },
    DEMORADO,
  );

  it(
    "importação: o envio é preparado preso à pasta de importações e descartado",
    async () => {
      const xls = await admin.pedir("POST", `${SU}/importacoes/envio`, {
        tipo: "entrevistas",
        nome: "planilha.xls",
        tamanho: 10,
      });
      expect(xls.statusCode).toBe(200);
      expect(xls.json().ok).toBe(false);

      const envio = await admin.pedir("POST", `${SU}/importacoes/envio`, {
        tipo: "entrevistas",
        nome: `${MARCA}.csv`,
        tamanho: 10,
      });
      expect(envio.statusCode, envio.body).toBe(200);
      if (!envio.json().ok) return;
      const caminho: string = envio.json().caminho;
      expect(caminho.startsWith("importacoes/")).toBe(true);

      // Caminho fora da pasta de importações não é lido.
      const fora = await admin.pedir("POST", `${SU}/importacoes`, {
        tipo: "entrevistas",
        caminho: "../outra/planilha.csv",
        nome: "planilha.csv",
      });
      expect(fora.json().ok).not.toBe(true);

      const descartado = await admin.pedir(
        "POST",
        `${SU}/importacoes/envio/descartar`,
        { caminho },
      );
      expect(descartado.statusCode, descartado.body).toBe(200);
    },
    DEMORADO,
  );
});
