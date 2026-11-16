import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, expect, it } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";

// Calendário de ponta a ponta na homologação: quem não tem acesso recebe
// 403; o administrador lê tudo e grava um tipo e um item de teste ("só
// eu"), que são apagados no fim.

const CAL = "/api/v1/calendario";

descreverComBanco("calendário (/api/v1/calendario)", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  const criados = { tipos: [] as string[], itens: [] as string[] };
  const nome = `Teste ${randomUUID().slice(0, 8)}`;

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
      if (criados.itens.length)
        await tx
          .deleteFrom("calendario.itens")
          .where("id", "in", criados.itens)
          .execute();
      if (criados.tipos.length)
        await tx
          .deleteFrom("calendario.tipos")
          .where("id", "in", criados.tipos)
          .execute();
    });
    await app.close();
    await banco.encerrar();
  });

  it("sem acesso ao calendário: 403 em toda leitura e gravação", async () => {
    const pedidos = [
      ["GET", `${CAL}/itens?de=2026-11-01&ate=2026-11-30`],
      ["GET", `${CAL}/tipos`],
      ["GET", `${CAL}/publico`],
    ] as const;
    for (const [metodo, url] of pedidos)
      expect((await semAcesso.pedir(metodo, url)).statusCode).toBe(403);
    const tipo = await semAcesso.pedir("POST", `${CAL}/tipos`, {
      nome,
      cor: "#2a78d6",
      icone: "evento",
      visibilidade_padrao: "todos",
      ordem: "1",
    });
    expect(tipo.statusCode).toBe(403);
    const item = await semAcesso.pedir("POST", `${CAL}/itens`, {
      tipo_id: randomUUID(),
      titulo: "x",
      inicio: "2026-11-16",
      visibilidade: "privado",
    });
    expect(item.statusCode).toBe(403);
    const excluir = await semAcesso.pedir(
      "DELETE",
      `${CAL}/itens/${randomUUID()}`,
    );
    expect(excluir.statusCode).toBe(403);
  });

  it("administrador lê tipos, opções de público e itens", async () => {
    const tipos = await admin.pedir("GET", `${CAL}/tipos`);
    expect(tipos.statusCode).toBe(200);
    expect(Array.isArray(tipos.json().tipos)).toBe(true);
    const publico = await admin.pedir("GET", `${CAL}/publico`);
    expect(publico.statusCode).toBe(200);
    expect(Object.keys(publico.json()).sort()).toEqual([
      "cargos",
      "pessoas",
      "setores",
    ]);
    const itens = await admin.pedir(
      "GET",
      `${CAL}/itens?de=2026-11-01&ate=2026-12-06`,
    );
    expect(itens.statusCode).toBe(200);
    expect(Array.isArray(itens.json().itens)).toBe(true);
  });

  it("valida a entrada com as mensagens do formulário", async () => {
    const r = await admin.pedir("POST", `${CAL}/itens`, {
      tipo_id: randomUUID(),
      titulo: " ",
      inicio: "2026-11-16",
      visibilidade: "todos",
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().erro.campos.titulo).toBe("Título: informe o título");
  });

  it("cria, conclui, altera e exclui um tipo e um item", async () => {
    const tipo = await admin.pedir("POST", `${CAL}/tipos`, {
      nome,
      descricao: "",
      cor: "#2A78D6",
      icone: "tarefa",
      usa_horario: "on",
      usa_conclusao: "on",
      visibilidade_padrao: "privado",
      ordem: "999",
      ativo: "on",
    });
    expect(tipo.statusCode).toBe(201);
    expect(tipo.json().mensagem).toBe("Tipo criado.");
    const lidos: { id: string; nome: string; cor: string }[] = (
      await admin.pedir("GET", `${CAL}/tipos`)
    ).json().tipos;
    const novo = lidos.find((t) => t.nome === nome);
    if (!novo) throw new Error("o tipo criado não voltou");
    criados.tipos.push(novo.id);
    expect(novo.cor).toBe("#2a78d6");

    const regra = await admin.pedir("POST", `${CAL}/itens`, {
      tipo_id: novo.id,
      titulo: "Item de teste",
      inicio: "2026-11-16",
      visibilidade: "privado",
    });
    expect(regra.statusCode).toBe(422);
    expect(regra.json().erro.mensagem).toBe(
      "Hora de início: informe ou marque Dia inteiro.",
    );

    const item = await admin.pedir("POST", `${CAL}/itens`, {
      tipo_id: novo.id,
      titulo: "Item de teste",
      inicio: "2026-11-16",
      dia_inteiro: "on",
      local: "não grava: o tipo não usa local",
      visibilidade: "privado",
    });
    expect(item.statusCode).toBe(201);
    const daAgenda = (
      await admin.pedir("GET", `${CAL}/itens?de=2026-11-16&ate=2026-11-16`)
    )
      .json()
      .itens.find((i: { tipo_id: string }) => i.tipo_id === novo.id);
    expect(daAgenda).toMatchObject({
      titulo: "Item de teste",
      local: null,
      hora_inicio: null,
      podeEditar: true,
      podeConcluir: true,
    });
    criados.itens.push(daAgenda.id);

    const feito = await admin.pedir(
      "POST",
      `${CAL}/itens/${daAgenda.id}/concluir`,
      { feito: true },
    );
    expect(feito.json().mensagem).toBe("Marcado como feito.");

    const alterado = await admin.pedir("PATCH", `${CAL}/itens/${daAgenda.id}`, {
      tipo_id: novo.id,
      titulo: "Item de teste alterado",
      inicio: "2026-11-16",
      hora_inicio: "09:00",
      hora_fim: "10:00",
      visibilidade: "privado",
    });
    expect(alterado.json().mensagem).toBe("Item atualizado.");

    // Tipo com item não sai: desativa.
    const comItem = await admin.pedir("DELETE", `${CAL}/tipos/${novo.id}`);
    expect(comItem.statusCode).toBe(422);

    const fora = await admin.pedir("DELETE", `${CAL}/itens/${daAgenda.id}`);
    expect(fora.json().mensagem).toBe("Item excluído.");
    const tipoFora = await admin.pedir("DELETE", `${CAL}/tipos/${novo.id}`);
    expect(tipoFora.json().mensagem).toBe("Tipo excluído.");
  });
});
