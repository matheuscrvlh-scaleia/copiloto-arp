import { gerarEnet } from "@arp/shared/comercial/exemplo/enet";
import { COM_META, campoMeta } from "@arp/shared/comercial/painel";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";
import { semAluguel } from "./ocupacao.service";

// Comercial (parte A) na homologação: quem não usa o módulo recebe 403; o
// administrador lê todas as telas. As consultas públicas (CEP, CNPJ,
// feriados, índices) e o fetch respondem com falha: a tela segue sem a
// estimativa, como quando o serviço não responde. As gravações de teste
// apagam o que criaram.

vi.mock("@/connectors/publicos", async (original) => {
  const falha = () =>
    Promise.reject(new Error("chamada externa bloqueada no teste"));
  return {
    ...(await original<typeof import("@/connectors/publicos")>()),
    buscarCep: falha,
    buscarCnpj: falha,
    buscarFeriados: falha,
    buscarIndice: falha,
    acumulado12Meses: falha,
  };
});

const COM = "/api/v1/comercial";

/** Leituras de cada tela (a permissão de cada uma está na rota/service). */
const LEITURAS = [
  "/painel",
  "/metas",
  "/funil",
  "/ocupacao",
  "/vencimentos",
  "/relacionamento/config",
  "/relacionamento/locatarios",
  "/relacionamento/aniversarios",
  "/relacionamento/contatos?periodo=todos",
  "/contratos",
  "/contratos/apoio",
  "/contratos/distratos/enet",
  "/contratos/vistorias?luc=A1&tipo=saida",
  "/configuracoes/parametros",
  "/configuracoes/parametros/funil",
  "/configuracoes/parametros/ocupacao",
  "/configuracoes/parametros/eventos",
  "/configuracoes/parametros/calendario",
  "/configuracoes/historico",
  "/importacoes",
];

describe("semAluguel", () => {
  it("sem a permissão de valores, o aluguel vira 0", () => {
    const contratos = gerarEnet("2026-11-16").contratos.slice(0, 3);
    expect(semAluguel(contratos, true)).toEqual(contratos);
    for (const c of semAluguel(contratos, false))
      expect(c.valor_aluguel).toBe(0);
  });
});

descreverComBanco("comercial (/api/v1/comercial)", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;

  beforeAll(async () => {
    vi.stubGlobal("fetch", () =>
      Promise.reject(new Error("chamada externa bloqueada no teste")),
    );
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
    vi.unstubAllGlobals();
    await app.close();
    await banco.encerrar();
  });

  it("sem acesso ao módulo: 403 em toda leitura", async () => {
    for (const caminho of LEITURAS) {
      const r = await semAcesso.pedir("GET", `${COM}${caminho}`);
      expect(r.statusCode, caminho).toBe(403);
    }
    // Sem tipo para importar: a lista de tipos vem vazia (esconde a aba).
    const tipos = await semAcesso.pedir("GET", `${COM}/importacoes/tipos`);
    expect(tipos.statusCode).toBe(200);
    expect(tipos.json().tipos).toEqual([]);
  }, 120_000);

  it("sem acesso ao módulo: 403 nas gravações", async () => {
    const gravacoes: [string, string, Record<string, unknown>][] = [
      ["PUT", "/metas", { ano: 2099 }],
      ["POST", "/relacionamento/contatos", {}],
      ["PUT", "/configuracoes/parametros", { bloco: "funil" }],
      ["POST", "/configuracoes/feriados", { data: "2099-12-30", nome: "x" }],
      ["POST", "/contratos", { id: null, lido: null, etapa: 1, dados: {} }],
      [
        "POST",
        "/importacoes/contatos/confirmar",
        {
          importacao_id: "00000000-0000-4000-8000-000000000000",
        },
      ],
    ];
    for (const [metodo, caminho, corpo] of gravacoes) {
      const r = await semAcesso.pedir(
        metodo === "PUT" ? "PUT" : "POST",
        `${COM}${caminho}`,
        corpo,
      );
      expect(r.statusCode, caminho).toBe(403);
    }
  });

  it("o administrador lê todas as telas", async () => {
    for (const caminho of LEITURAS) {
      const r = await admin.pedir("GET", `${COM}${caminho}`);
      expect(r.statusCode, caminho).toBe(200);
    }
    const tipos = await admin.pedir("GET", `${COM}/importacoes/tipos`);
    expect(tipos.statusCode).toBe(200);
  }, 120_000);

  it("um LUC e um contrato do ENET; o inexistente dá 404", async () => {
    const ocupacao = (await admin.pedir("GET", `${COM}/ocupacao`)).json();
    const luc = ocupacao.lucs[0].numero;
    const r = await admin.pedir(
      "GET",
      `${COM}/ocupacao/lucs/${encodeURIComponent(luc)}`,
    );
    expect(r.statusCode).toBe(200);
    expect(r.json().luc.numero).toBe(luc);
    expect(
      (await admin.pedir("GET", `${COM}/ocupacao/lucs/nao-existe`)).statusCode,
    ).toBe(404);

    const venc = (await admin.pedir("GET", `${COM}/vencimentos`)).json();
    const contrato = venc.contratos[0].codigo;
    const v = await admin.pedir(
      "GET",
      `${COM}/vencimentos/${encodeURIComponent(contrato)}`,
    );
    expect(v.statusCode).toBe(200);
    // Índices fora do ar: a tela segue sem a estimativa.
    expect(v.json().acumulados).toEqual({ IGPM: null, IPCA: null });
  });

  it("calendário sem a BrasilAPI: nacionais null, cadastrados continuam", async () => {
    const r = await admin.pedir(
      "GET",
      `${COM}/configuracoes/parametros/calendario`,
    );
    expect(r.json().nacionais).toBeNull();
    expect(Array.isArray(r.json().cadastrados)).toBe(true);
  });

  it("contato: registra, altera e exclui o próprio registro", async () => {
    const [config, locs] = await Promise.all([
      admin.pedir("GET", `${COM}/relacionamento/config`),
      admin.pedir("GET", `${COM}/relacionamento/locatarios`),
    ]);
    const { tipos, canais, hoje } = config.json();
    const locatario = locs.json().locatarios[0];
    const corpo = {
      contrato: locatario.contrato,
      data: hoje,
      tipo: tipos[0],
      canal: canais[0],
      descricao: "Registro de teste automático",
      outro_setor: "nao",
    };
    const vazio = await admin.pedir("POST", `${COM}/relacionamento/contatos`, {
      ...corpo,
      descricao: "",
    });
    expect(vazio.statusCode).toBe(400);

    const criado = await admin.pedir(
      "POST",
      `${COM}/relacionamento/contatos`,
      corpo,
    );
    expect(criado.statusCode).toBe(201);
    expect(criado.json().mensagem).toBe("Contato registrado.");
    const lista = (
      await admin.pedir(
        "GET",
        `${COM}/relacionamento/contatos?periodo=30&cliente=${encodeURIComponent(locatario.cliente)}`,
      )
    ).json();
    const meu = lista.contatos.find(
      (c: { descricao: string }) => c.descricao === corpo.descricao,
    );
    expect(meu).toBeDefined();
    try {
      const alterado = await admin.pedir(
        "PATCH",
        `${COM}/relacionamento/contatos/${meu.id}`,
        { ...corpo, descricao: `${corpo.descricao} (alterado)` },
      );
      expect(alterado.statusCode).toBe(200);
      expect(alterado.json().mensagem).toBe("Registro alterado.");
      const um = await admin.pedir(
        "GET",
        `${COM}/relacionamento/contatos/${meu.id}`,
      );
      expect(um.json().contato.descricao).toBe(`${corpo.descricao} (alterado)`);
    } finally {
      const excluido = await admin.pedir(
        "DELETE",
        `${COM}/relacionamento/contatos/${meu.id}`,
      );
      expect(excluido.json().mensagem).toBe("Registro excluído.");
    }
  });

  it("feriado: inclui e remove um cadastrado de teste", async () => {
    const data = "2099-12-30";
    const incluido = await admin.pedir(
      "POST",
      `${COM}/configuracoes/feriados`,
      {
        data,
        nome: "Feriado de teste",
      },
    );
    try {
      expect(incluido.statusCode).toBe(200);
      expect(incluido.json().mensagem).toBe("Feriado incluído.");
    } finally {
      const removido = await admin.pedir(
        "DELETE",
        `${COM}/configuracoes/feriados/${data}`,
      );
      expect(removido.json().mensagem).toBe("Feriado removido.");
    }
  });

  it("metas: grava uma célula de 2099 e apaga", async () => {
    const [i] = COM_META;
    if (!i) throw new Error("sem indicador com meta");
    const campo = campoMeta(i, 1);
    const gravada = await admin.pedir("PUT", `${COM}/metas`, {
      ano: 2099,
      [campo]: "10",
    });
    try {
      expect(gravada.statusCode).toBe(200);
      expect(gravada.json().mensagem).toBe("Salvo: 1 meta alterada.");
    } finally {
      const apagada = await admin.pedir("PUT", `${COM}/metas`, {
        ano: 2099,
        [campo]: "",
      });
      expect(apagada.json().mensagem).toBe("Salvo: 1 meta alterada.");
    }
    const nada = await admin.pedir("PUT", `${COM}/metas`, { ano: 2099 });
    expect(nada.json().mensagem).toBe("Nada mudou.");
  });

  it("contratos: entrada fora do formato não grava", async () => {
    const r = await admin.pedir("POST", `${COM}/contratos`, {
      id: null,
      lido: null,
      etapa: 1,
      dados: "fora do formato",
    });
    expect(r.statusCode).toBe(422);
    const outro = await admin.pedir(
      "GET",
      `${COM}/contratos/00000000-0000-4000-8000-000000000000`,
    );
    expect(outro.statusCode).toBe(404);
  });

  it("importação: tipo sem leitor ainda responde em preparação", async () => {
    const r = await admin.pedir("POST", `${COM}/importacoes/censo/confirmar`, {
      importacao_id: "00000000-0000-4000-8000-000000000000",
    });
    expect(r.statusCode).toBe(422);
    expect(r.json().erro.mensagem).toMatch(/em preparação/);
  });
});
