import { INDICADORES_META } from "@arp/shared/os/configuracoes";
import {
  respostaCategorias,
  respostaHistorico,
  respostaModelos,
  respostaParametros,
  respostaSetores,
  respostaTerceirizados,
  resumoDoCatalogo,
} from "@arp/shared/os/contratos/configuracoes";
import type { Permissao } from "@arp/shared/permissions";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp } from "@/app";
import type { Contexto } from "@/contexto";
import { ErroDePermissao } from "@/erros";
import { banco } from "@/infra/banco";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";
import {
  exigirUma,
  lerHistorico,
  lerTerceirizados,
} from "./configuracoes.service";
import { criarChamadoSistema } from "./criar.service";
import {
  removerAtivoCategoria,
  salvarAtivoCategoria,
} from "./parametros.service";
import { rodarRotinas, rotinaAceite } from "./rotinas.service";

// Tickets › Configurações e rotinas: quem não pode recebe 403; o
// administrador lê tudo e grava em registros criados aqui (nome "[teste]"),
// que o próprio teste desfaz. As rotinas rodam só com o recorte de um
// chamado de teste num setor de teste sem ninguém (nada chega a pessoas
// reais) e com o relógio controlado.

const CFG = "/api/v1/os/configuracoes";
const NADA = "00000000-0000-4000-8000-000000000000";
const LONGO = 240_000;
const MARCA = `[teste] config ${Date.now()}`;

const contexto = (permissoes: Permissao[]): Contexto => ({
  ip: "198.18.0.1",
  agente: null,
  requisicaoId: "teste",
  usuario: { id: NADA, nome: "Teste", email: "teste@example.com" },
  permissoes: new Set(permissoes),
  senhaProvisoria: false,
  sessao: {
    id: NADA,
    inicio: new Date(),
    ultimoUso: new Date(),
    acessoExpiraEm: new Date(),
  },
});

describe("configurações: permissão conferida no service", () => {
  it("internos e terceirizados exigem os.terceirizados ou os.parametros", () => {
    expect(() => lerTerceirizados(contexto(["os.acessar"]))).toThrow(
      ErroDePermissao,
    );
  });

  it("histórico exige os.historico ou admin.historico", () => {
    expect(() => lerHistorico(contexto(["os.acessar"]), {})).toThrow(
      ErroDePermissao,
    );
  });

  it("categoria de ativo exige os.parametros ou os.ativos_gerenciar", async () => {
    const ctx = contexto(["os.acessar"]);
    await expect(
      salvarAtivoCategoria(ctx, {
        id: null,
        nome: "x",
        vida_util_padrao_anos: null,
      }),
    ).rejects.toThrow("Você não tem permissão para esta alteração.");
    expect(() => removerAtivoCategoria(ctx, NADA)).toThrow(ErroDePermissao);
    expect(() =>
      exigirUma(
        contexto(["os.ativos_gerenciar"]),
        "os.parametros",
        "os.ativos_gerenciar",
      ),
    ).not.toThrow();
  });
});

/**
 * Apaga só o que tem a marca no nome (todo registro criado aqui começa com
 * ela) e o que ficou no setor de teste.
 */
async function desfazer(marca: string): Promise<void> {
  const como = `${marca}%`;
  await banco.comoServico(async (tx) => {
    const setores = (
      await tx
        .selectFrom("os.setores")
        .select("id")
        .where("nome", "like", como)
        .execute()
    ).map((s) => s.id);
    await tx.deleteFrom("os.chamados").where("titulo", "like", como).execute();
    const modelos = tx
      .selectFrom("os.modelos")
      .select("id")
      .where("nome", "like", como);
    await tx
      .deleteFrom("os.modelo_itens")
      .where("modelo_id", "in", modelos)
      .execute();
    await tx.deleteFrom("os.modelos").where("nome", "like", como).execute();
    await tx.deleteFrom("os.tecnicos").where("nome", "like", como).execute();
    const empresas = tx
      .selectFrom("os.empresas")
      .select("id")
      .where("nome", "like", como);
    await tx
      .deleteFrom("os.profissionais")
      .where("empresa_id", "in", empresas)
      .execute();
    await tx.deleteFrom("os.empresas").where("nome", "like", como).execute();
    await tx.deleteFrom("os.contatos").where("nome", "like", como).execute();
    await tx
      .deleteFrom("os.ativo_categorias")
      .where("nome", "like", como)
      .execute();
    await tx.deleteFrom("os.feriados").where("nome", "like", como).execute();
    if (setores.length) {
      await tx
        .deleteFrom("os.metas")
        .where("setor_id", "in", setores)
        .execute();
      await tx
        .deleteFrom("os.categorias")
        .where("setor_id", "in", setores)
        .execute();
      await tx
        .deleteFrom("os.setor_membros")
        .where("setor_id", "in", setores)
        .execute();
      await tx.deleteFrom("os.setores").where("id", "in", setores).execute();
    }
  });
}

descreverComBanco("os: configurações e rotinas", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  let adminId = "";
  let setorId = "";

  beforeAll(async () => {
    app = await criarApp();
    admin = new Navegador(app);
    semAcesso = new Navegador(app);
    await admin.pedir("POST", "/api/v1/auth/entrar", {
      email: TESTE.email,
      senha: TESTE.senha,
    });
    await semAcesso.pedir("POST", "/api/v1/auth/entrar", {
      email: TESTE.emailSemAcesso,
      senha: TESTE.senha,
    });
    adminId = await banco.comoServico(async (tx) => {
      const u = await tx
        .selectFrom("core.usuarios")
        .select("id")
        .where("email", "=", TESTE.email)
        .executeTakeFirstOrThrow();
      return u.id;
    });
  }, LONGO);

  afterAll(async () => {
    await desfazer(MARCA);
    await app.close();
    await banco.encerrar();
  }, LONGO);

  it(
    "sem acesso recebe 403 nas leituras e nas gravações",
    async () => {
      for (const url of [
        `${CFG}/categorias`,
        `${CFG}/catalogo/resumo?setor=${NADA}`,
        `${CFG}/setores`,
        `${CFG}/terceirizados`,
        `${CFG}/modelos`,
        `${CFG}/parametros`,
        `${CFG}/historico`,
      ])
        expect((await semAcesso.pedir("GET", url)).statusCode, url).toBe(403);
      for (const [metodo, url] of [
        ["POST", `${CFG}/categorias`],
        ["POST", `${CFG}/setores`],
        ["POST", `${CFG}/empresas`],
        ["POST", `${CFG}/contatos`],
        ["POST", `${CFG}/modelos`],
        ["POST", `${CFG}/rotinas`],
        ["PATCH", `${CFG}/parametros/portal`],
        ["POST", `${CFG}/feriados`],
        ["POST", `${CFG}/tecnicos`],
        ["POST", `${CFG}/metas`],
        ["POST", `${CFG}/ativo-categorias`],
        ["DELETE", `${CFG}/papel-timbrado`],
      ] as const)
        expect(
          (await semAcesso.pedir(metodo, url, {})).statusCode,
          `${metodo} ${url}`,
        ).toBeOneOf([400, 403]);
      // Sem corpo válido a validação vem antes; com corpo válido, 403.
      const r = await semAcesso.pedir("POST", `${CFG}/contatos`, {
        nome: "x",
        telefone: "22999999999",
      });
      expect(r.statusCode).toBe(403);
      expect((await semAcesso.pedir("POST", `${CFG}/rotinas`)).statusCode).toBe(
        403,
      );
    },
    LONGO,
  );

  it(
    "o administrador lê categorias, resumo, setores, terceirizados, modelos, parâmetros e histórico",
    async () => {
      const cat = await admin.pedir("GET", `${CFG}/categorias`);
      expect(cat.statusCode).toBe(200);
      const { setores } = respostaCategorias.parse(cat.json());
      const primeiro = setores[0];
      if (primeiro) {
        const r = await admin.pedir(
          "GET",
          `${CFG}/catalogo/resumo?setor=${primeiro.id}`,
        );
        expect(r.statusCode).toBe(200);
        resumoDoCatalogo.parse(r.json());
      }
      for (const [url, esquema] of [
        [`${CFG}/setores`, respostaSetores],
        [`${CFG}/terceirizados`, respostaTerceirizados],
        [`${CFG}/modelos`, respostaModelos],
        [`${CFG}/parametros`, respostaParametros],
        [`${CFG}/historico?q=setor`, respostaHistorico],
      ] as const) {
        const r = await admin.pedir("GET", url);
        expect(r.statusCode, url).toBe(200);
        esquema.parse(r.json());
      }
    },
    LONGO,
  );

  it(
    "setor, pessoas e categoria: cria, move, duplica, desativa e exclui",
    async () => {
      let r = await admin.pedir("POST", `${CFG}/setores`, {
        nome: MARCA,
        cor: "#336699",
        icone: "tag",
        ativo: "on",
      });
      expect(r.json()).toEqual({
        mensagem: "Setor criado. Inclua as pessoas e monte o catálogo dele.",
      });
      setorId = await banco.comoServico(async (tx) => {
        const s = await tx
          .selectFrom("os.setores")
          .select("id")
          .where("nome", "=", MARCA)
          .executeTakeFirstOrThrow();
        return s.id;
      });

      // Pessoas: inclui, marca gestor e tira (volta ao que era).
      r = await admin.pedir("POST", `${CFG}/setores/membros`, {
        setor_id: setorId,
        usuario_id: adminId,
      });
      expect(r.json()).toEqual({ mensagem: "Pessoa incluída." });
      r = await admin.pedir("PATCH", `${CFG}/setores/membros`, {
        setor_id: setorId,
        usuario_id: adminId,
        gestor: "true",
      });
      expect(r.statusCode).toBe(200);
      const membros = respostaSetores.parse(
        (await admin.pedir("GET", `${CFG}/setores`)).json(),
      ).membros;
      expect(
        membros.find((m) => m.setor_id === setorId && m.usuario_id === adminId)
          ?.gestor,
      ).toBe(true);
      r = await admin.pedir(
        "DELETE",
        `${CFG}/setores/${setorId}/membros/${adminId}`,
      );
      expect(r.statusCode).toBe(200);

      // Categoria: nome vazio volta a mensagem com o rótulo.
      r = await admin.pedir("POST", `${CFG}/categorias`, {
        nome: "",
        setor_id: setorId,
        icone: "tag",
        tipo_padrao: "solicitacao",
        prioridade_padrao: "media",
      });
      expect(r.statusCode).toBe(400);
      r = await admin.pedir("POST", `${CFG}/categorias`, {
        nome: `${MARCA} cat`,
        setor_id: setorId,
        icone: "tag",
        ativo: "on",
        tipo_padrao: "solicitacao",
        prioridade_padrao: "media",
        prazo_unidade: "dias_uteis",
        precisa_confirmacao: "on",
        campos: "[]",
        checklist: "[]",
      });
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json()).toMatchObject({ criada: true, setor_id: setorId });
      const lista = respostaCategorias
        .parse((await admin.pedir("GET", `${CFG}/categorias`)).json())
        .categorias.filter((c) => c.setor_id === setorId);
      expect(lista).toHaveLength(1);
      const id = lista[0]?.id ?? "";

      r = await admin.pedir("POST", `${CFG}/categorias/${id}/duplicar`, {});
      expect(r.statusCode).toBe(201);
      const copia = String(r.json().id);
      r = await admin.pedir("POST", `${CFG}/categorias/${copia}/mover`, {
        delta: "-1",
      });
      expect(r.statusCode).toBe(200);
      r = await admin.pedir("POST", `${CFG}/categorias/${copia}/ativo`, {
        ativo: "false",
      });
      expect(r.statusCode).toBe(200);
      for (const c of [copia, id]) {
        r = await admin.pedir("DELETE", `${CFG}/categorias/${c}`);
        expect(r.json()).toEqual({ mensagem: "", setor_id: setorId });
      }
    },
    LONGO,
  );

  it(
    "terceirizados: empresa, profissional e contato",
    async () => {
      let r = await admin.pedir("POST", `${CFG}/empresas`, {
        nome: `${MARCA} empresa`,
        ativo: "on",
      });
      expect(r.json()).toEqual({ mensagem: "Empresa cadastrada." });
      const lida = respostaTerceirizados
        .parse((await admin.pedir("GET", `${CFG}/terceirizados`)).json())
        .empresas.find((e) => e.nome === `${MARCA} empresa`);
      expect(lida).toBeDefined();
      r = await admin.pedir("POST", `${CFG}/profissionais`, {
        empresa_id: lida?.id,
        nome: `${MARCA} profissional`,
        ativo: "on",
      });
      expect(r.statusCode).toBe(200);

      r = await admin.pedir("POST", `${CFG}/contatos`, {
        nome: `${MARCA} contato`,
        telefone: "(22) 99999-0000",
      });
      expect(r.json()).toEqual({ mensagem: "Contato salvo na lista." });
      const contato = respostaTerceirizados
        .parse((await admin.pedir("GET", `${CFG}/terceirizados`)).json())
        .contatos.find((c) => c.nome === `${MARCA} contato`);
      r = await admin.pedir("DELETE", `${CFG}/contatos/${contato?.id}`);
      expect(r.statusCode).toBe(200);
    },
    LONGO,
  );

  it(
    "modelo manual: cria com um item e desativa",
    async () => {
      expect(setorId).not.toBe("");
      let r = await admin.pedir("POST", `${CFG}/modelos`, {
        nome: `${MARCA} modelo`,
        gatilho: "manual",
        itens: JSON.stringify([
          {
            setor_id: setorId,
            titulo: "Item de teste",
            prazo_dias: "1",
            condicao: "sempre",
            acao: "nenhuma",
          },
        ]),
      });
      expect(r.statusCode, r.body).toBe(200);
      const m = respostaModelos
        .parse((await admin.pedir("GET", `${CFG}/modelos`)).json())
        .modelos.find((x) => x.nome === `${MARCA} modelo`);
      expect(m?.itens).toHaveLength(1);
      r = await admin.pedir("POST", `${CFG}/modelos/${m?.id}/ativo`, {
        ativo: "false",
      });
      expect(r.statusCode).toBe(200);
    },
    LONGO,
  );

  it(
    "parâmetros: feriado, técnico e valor, categoria de ativo, meta e portal",
    async () => {
      // Feriado numa data longe, que não existe.
      let r = await admin.pedir("POST", `${CFG}/feriados`, {
        data: "2099-12-24",
        nome: MARCA,
      });
      expect(r.json()).toEqual({ mensagem: "Feriado incluído." });
      r = await admin.pedir("DELETE", `${CFG}/feriados/2099-12-24`);
      expect(r.statusCode).toBe(200);

      r = await admin.pedir("POST", `${CFG}/tecnicos`, {
        nome: `${MARCA} técnico`,
      });
      expect(r.statusCode).toBe(200);
      let p = respostaParametros.parse(
        (await admin.pedir("GET", `${CFG}/parametros`)).json(),
      );
      const t = p.tecnicos.find((x) => x.nome === `${MARCA} técnico`);
      r = await admin.pedir("POST", `${CFG}/tecnicos/valores`, {
        tecnico_id: t?.id,
        vigente_desde: "2099-01-01",
        valor_minuto: "1,25",
      });
      expect(r.statusCode, r.body).toBe(200);
      p = respostaParametros.parse(
        (await admin.pedir("GET", `${CFG}/parametros`)).json(),
      );
      const v = p.tecnicos.find((x) => x.id === t?.id)?.valores[0];
      expect(v?.valor_minuto).toBe(1.25);
      r = await admin.pedir("DELETE", `${CFG}/tecnicos/valores/${v?.id}`);
      expect(r.statusCode).toBe(200);

      r = await admin.pedir("POST", `${CFG}/ativo-categorias`, {
        nome: `${MARCA} ativo`,
        vida_util_padrao_anos: "5",
      });
      expect(r.json()).toEqual({ mensagem: "Categoria incluída." });
      p = respostaParametros.parse(
        (await admin.pedir("GET", `${CFG}/parametros`)).json(),
      );
      const ac = p.ativoCategorias.find((x) => x.nome === `${MARCA} ativo`);
      r = await admin.pedir("DELETE", `${CFG}/ativo-categorias/${ac?.id}`);
      expect(r.statusCode).toBe(200);

      const indicador = Object.keys(INDICADORES_META)[0];
      r = await admin.pedir("POST", `${CFG}/metas`, {
        escopo: `setor:${setorId}`,
        indicador,
        meta: "10",
      });
      expect(r.statusCode, r.body).toBe(200);
      p = respostaParametros.parse(
        (await admin.pedir("GET", `${CFG}/parametros`)).json(),
      );
      const meta = p.metas.find((x) => x.setor_id === setorId);
      r = await admin.pedir("DELETE", `${CFG}/metas/${meta?.id}`);
      expect(r.statusCode).toBe(200);

      // Portal: grava o mesmo texto (nada muda de fato).
      r = await admin.pedir("PATCH", `${CFG}/parametros/portal`, {
        portal_boas_vindas: p.parametros.portal_boas_vindas,
      });
      expect(r.json()).toEqual({ mensagem: "Salvo." });
    },
    LONGO,
  );

  it(
    "rotinas: o aceite fecha o Concluído vencido (só o chamado de teste)",
    async () => {
      expect(setorId).not.toBe("");
      const agora = new Date();
      const criado = await banco.comoServico(async (tx) => {
        const c = await criarChamadoSistema(
          tx,
          {
            setorId,
            titulo: `${MARCA} aceite`,
            origem: "sistema",
            autorNome: "Teste",
            abertoPor: null,
            responsavelId: null,
          },
          agora,
        );
        if (!c) throw new Error("não criou o chamado de teste");
        // O gatilho do banco põe concluido_em = now() ao mudar o status:
        // a data antiga vai numa segunda gravação (status igual).
        await tx
          .updateTable("os.chamados")
          .set({ status: "concluido" })
          .where("id", "=", c.id)
          .execute();
        await tx
          .updateTable("os.chamados")
          .set({
            concluido_em: new Date(
              agora.getTime() - 60 * 86_400_000,
            ).toISOString(),
          })
          .where("id", "=", c.id)
          .execute();
        return c.id;
      });

      expect(await rotinaAceite(agora, [criado])).toBeGreaterThanOrEqual(1);
      const status = await banco.comoServico(async (tx) => {
        const c = await tx
          .selectFrom("os.chamados")
          .select("status")
          .where("id", "=", criado)
          .executeTakeFirstOrThrow();
        return c.status;
      });
      expect(status).toBe("fechado");

      // Todas em sequência, no mesmo recorte: nada mais a fazer e nada falha.
      const resultados = await rodarRotinas(agora, null, [criado]);
      expect(resultados.map((x) => x.chave)).toEqual([
        "aceite",
        "recorrencias",
        "modelos",
        "preventivas",
        "cobranca",
      ]);
      expect(resultados.filter((x) => !x.ok)).toEqual([]);
      expect(resultados.find((x) => x.chave === "aceite")?.registros).toBe(0);
    },
    LONGO,
  );
});
