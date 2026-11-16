import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";

// RH parte B (custo de pessoal, planejamento orçamentário e configurações)
// de ponta a ponta na homologação: quem não tem acesso recebe 403 em toda
// leitura e gravação; o administrador lê todas as telas. As gravações criam
// só registros do próprio teste e os apagam no fim; nenhuma recalcula o custo.

vi.mock("@/modules", async () => {
  const { auth } = await import("@/modules/auth");
  const { rh } = await import("@/modules/rh");
  return {
    MODULOS: [
      { prefixo: "/auth", plugin: auth },
      { prefixo: "/rh", plugin: rh },
    ],
    EXTERNOS: [],
    ROTINAS: [],
  };
});

const RH = "/api/v1/rh";
const MARCA = `Teste porte ${randomUUID().slice(0, 8)}`;

descreverComBanco("rh parte B (/api/v1/rh)", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  const criados = { beneficios: [] as string[], categorias: [] as string[] };

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
    // Só o que este teste criou (pelo id); os gastos já saíram pela API.
    await banco.comoServico(async (tx) => {
      if (criados.beneficios.length)
        await tx
          .deleteFrom("rh.beneficios")
          .where("id", "in", criados.beneficios)
          .execute();
      if (criados.categorias.length)
        await tx
          .deleteFrom("rh.categorias_gasto")
          .where("id", "in", criados.categorias)
          .execute();
    });
    await app.close();
    await banco.encerrar();
  });

  it("sem acesso: 403 em toda leitura e gravação", async () => {
    const id = randomUUID();
    const pedidos = [
      ["GET", `${RH}/custo-de-pessoal`],
      ["GET", `${RH}/custo-de-pessoal/comparacao`],
      ["POST", `${RH}/custo-de-pessoal/recalcular`, {}],
      ["GET", `${RH}/orcamento`],
      ["POST", `${RH}/orcamento/gastos`, {}],
      ["DELETE", `${RH}/orcamento/gastos/${id}`],
      ["POST", `${RH}/orcamento/2026/finalizar`, {}],
      ["GET", `${RH}/categorias-de-gasto`],
      ["POST", `${RH}/categorias-de-gasto`, { nome: MARCA }],
      ["POST", `${RH}/categorias-de-gasto/${id}/ativa`, { ativa: "false" }],
      ["GET", `${RH}/cadastros`],
      ["PATCH", `${RH}/departamentos/${id}`, {}],
      ["POST", `${RH}/rubricas/grupo`, {}],
      ["POST", `${RH}/financeiro`, {}],
      ["POST", `${RH}/parametros/jornadas`, {}],
      ["DELETE", `${RH}/parametros/jornadas/empresa`],
      ["POST", `${RH}/parametros/metas`, {}],
      ["POST", `${RH}/parametros/empresa`, {}],
      ["POST", `${RH}/parametros/encargos`, {}],
      ["GET", `${RH}/beneficios`],
      ["POST", `${RH}/beneficios`, {}],
      ["POST", `${RH}/beneficios/vinculos`, {}],
      ["PATCH", `${RH}/beneficios/vinculos`, {}],
      ["DELETE", `${RH}/beneficios/vinculos/${id}`],
      ["POST", `${RH}/beneficios/contratos`, {}],
      ["DELETE", `${RH}/beneficios/contratos/${id}`],
      ["POST", `${RH}/beneficios/${id}/vincular-pela-folha`, {}],
      ["POST", `${RH}/beneficios/valores`, {}],
      ["POST", `${RH}/beneficios/totais`, {}],
      ["GET", `${RH}/importacoes`],
      ["POST", `${RH}/folhas/confirmar`, {}],
      ["DELETE", `${RH}/folhas/${id}`],
      ["GET", `${RH}/folhas/${id}`],
      ["PATCH", `${RH}/folhas/${id}/pessoas/${id}`, {}],
      ["POST", `${RH}/rubricas/classificar`, {}],
      ["POST", `${RH}/planos/confirmar`, {}],
      ["PATCH", `${RH}/planos/tabelas/${id}/faixas`, {}],
    ] as const;
    for (const [metodo, url, corpo] of pedidos) {
      const r = await semAcesso.pedir(metodo, url, corpo);
      expect(r.statusCode, `${metodo} ${url}`).toBe(403);
    }
    // Um pedido por rota (pelo túnel até a homologação).
  }, 120_000);

  describe("administrador", () => {
    it("custo de pessoal: dashboard e comparação", async () => {
      const r = await admin.pedir("GET", `${RH}/custo-de-pessoal`);
      expect(r.statusCode).toBe(200);
      const c = r.json();
      expect(c.vazio).toBe(false);
      expect(c.meses.length).toBeGreaterThan(0);
      expect(c.mes).toBe(c.meses[0]);
      expect(c.linhas.length).toBeGreaterThan(0);
      // O administrador tem o custo individual.
      expect(Array.isArray(c.pessoas)).toBe(true);

      const outro = await admin.pedir(
        "GET",
        `${RH}/custo-de-pessoal?mes=${c.meses.at(-1).slice(0, 7)}`,
      );
      expect(outro.json().mes).toBe(c.meses.at(-1));

      const cmp = await admin.pedir("GET", `${RH}/custo-de-pessoal/comparacao`);
      expect(cmp.statusCode).toBe(200);
      const p = cmp.json();
      if (!p.vazio) expect(p.comparar).not.toBe(p.mes);
    });

    it("orçamento: tela, categorias, lançar e excluir um gasto", async () => {
      const tela = await admin.pedir("GET", `${RH}/orcamento`);
      expect(tela.statusCode).toBe(200);
      const t = tela.json();
      expect(t.lanca).toBe(true);
      expect(
        (await admin.pedir("GET", `${RH}/categorias-de-gasto`)).statusCode,
      ).toBe(200);

      const nova = await admin.pedir("POST", `${RH}/categorias-de-gasto`, {
        nome: MARCA,
      });
      expect(nova.statusCode).toBe(200);
      const lista = (
        await admin.pedir("GET", `${RH}/categorias-de-gasto`)
      ).json();
      const cat = lista.categorias.find(
        (c: { nome: string }) => c.nome === MARCA,
      );
      expect(cat).toBeDefined();
      criados.categorias.push(cat.id);
      const repetida = await admin.pedir("POST", `${RH}/categorias-de-gasto`, {
        nome: MARCA,
      });
      expect(repetida.statusCode).toBe(409);
      expect(repetida.json().erro.mensagem).toBe(
        "Já existe uma categoria com esse nome.",
      );

      const invalido = await admin.pedir("POST", `${RH}/orcamento/gastos`, {
        data: "",
        valor: "",
      });
      expect(invalido.statusCode).toBe(400);
      expect(invalido.json().erro.mensagem).toBe("Data: informe a data");

      if (!t.finalizado) {
        const gasto = {
          data: `${t.ano}-01-15`,
          valor: "1,23",
          categoria_id: cat.id,
          descricao: MARCA,
          finalidade: MARCA,
          observacao: "",
        };
        const g = await admin.pedir("POST", `${RH}/orcamento/gastos`, gasto);
        expect(g.statusCode).toBe(200);
        const doAno = (
          await admin.pedir("GET", `${RH}/orcamento?ano=${t.ano}`)
        ).json();
        const lancado = doAno.gastos.find(
          (x: { descricao: string }) => x.descricao === MARCA,
        );
        expect(lancado).toMatchObject({ valor: 1.23, categoria_id: cat.id });
        const fora = await admin.pedir(
          "DELETE",
          `${RH}/orcamento/gastos/${lancado.id}`,
        );
        expect(fora.statusCode).toBe(200);
      }

      const desativada = await admin.pedir(
        "POST",
        `${RH}/categorias-de-gasto/${cat.id}/ativa`,
        { ativa: "false" },
      );
      expect(desativada.statusCode).toBe(200);
    });

    it("cadastros e parâmetros: leitura e gravações sem efeito", async () => {
      const r = await admin.pedir("GET", `${RH}/cadastros`);
      expect(r.statusCode).toBe(200);
      expect(r.json().departamentos.length).toBeGreaterThan(0);

      // Departamento que não existe: o RLS deixa e nada muda.
      const dep = await admin.pedir(
        "PATCH",
        `${RH}/departamentos/${randomUUID()}`,
        { nome: MARCA, codigo_folha: "" },
      );
      expect(dep.statusCode).toBe(200);

      const jornada = await admin.pedir("POST", `${RH}/parametros/jornadas`, {
        alvo: "planeta:1",
        horas: "220",
      });
      expect(jornada.statusCode).toBe(400);

      const grupo = await admin.pedir("POST", `${RH}/rubricas/grupo`, {
        codigo: "999999",
        grupo: "salario",
      });
      expect(grupo.statusCode).toBe(422);
      expect(grupo.json().erro.mensagem).toBe("Rubrica não encontrada.");
    });

    it("benefícios: leitura, criar (inativo) e validação", async () => {
      const r = await admin.pedir("GET", `${RH}/beneficios`);
      expect(r.statusCode).toBe(200);
      expect(r.json().mesAtual).toMatch(/^\d{4}-\d{2}-01$/);

      const semNome = await admin.pedir("POST", `${RH}/beneficios`, {
        nome: "",
        tipo: "outro",
        dependente_regra: "nao_paga",
      });
      expect(semNome.statusCode).toBe(400);
      expect(semNome.json().erro.mensagem).toBe("Nome: informe o nome");

      const novo = await admin.pedir("POST", `${RH}/beneficios`, {
        nome: MARCA,
        tipo: "outro",
        valor_padrao: "10,00",
        rubricas_desconto: "",
        rubricas_desconto_dependente: "",
        dependente_regra: "nao_paga",
        dependente_valor: "",
        forma_calculo: "por_funcionario",
      });
      expect(novo.statusCode).toBe(201);
      const { id } = novo.json();
      criados.beneficios.push(id);
      const lido = (await admin.pedir("GET", `${RH}/beneficios`)).json();
      expect(
        lido.beneficios.find((b: { id: string }) => b.id === id),
      ).toMatchObject({ nome: MARCA, ativo: false, valor_padrao: 10 });

      const vinculo = await admin.pedir(
        "DELETE",
        `${RH}/beneficios/vinculos/nao-e-uuid`,
      );
      expect(vinculo.statusCode).toBe(422);
      expect(vinculo.json().erro.mensagem).toBe("Vínculo inválido.");
    });

    it("importações: folhas, rubricas pendentes e tabelas do plano", async () => {
      const r = await admin.pedir("GET", `${RH}/importacoes`);
      expect(r.statusCode).toBe(200);
      const i = r.json();
      expect(i.folha).not.toBeNull();
      expect(i.plano).not.toBeNull();
      const [folha] = i.folha.folhas;
      expect(folha).toBeDefined();

      const editar = await admin.pedir("GET", `${RH}/folhas/${folha.id}`);
      expect(editar.statusCode).toBe(200);
      expect(editar.json().pessoas.length).toBe(folha.pessoas);
      expect(
        (await admin.pedir("GET", `${RH}/folhas/${randomUUID()}`)).statusCode,
      ).toBe(404);
      expect(
        (await admin.pedir("GET", `${RH}/folhas/nao-e-uuid`)).statusCode,
      ).toBe(404);

      // Confirmar uma prévia que não existe: nada é gravado.
      const confirma = await admin.pedir("POST", `${RH}/folhas/confirmar`, {
        importacao_id: randomUUID(),
      });
      expect(confirma.statusCode).toBe(422);
    });
  });
});
