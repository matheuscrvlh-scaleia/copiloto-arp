import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { ROTINAS } from "@/modules/index";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";

// Comercial (parte B: Censo, Fichas, Kit, Eventos e Pesquisa) na
// homologação: quem não usa o módulo recebe 403; o administrador lê todas as
// telas; cada recurso grava uma vez e o teste apaga o que criou. As consultas
// públicas (CEP, CNPJ, feriados, índices) e o fetch respondem com falha:
// nenhuma chamada externa sai daqui.

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
const NADA = "00000000-0000-4000-8000-000000000000";
const MARCA = "Teste automático parte B";

const LEITURAS = [
  "/censo",
  "/censo/indicadores",
  "/censo/demonstracao",
  `/censo/feedbacks?rodada=${NADA}`,
  "/censo/rodadas",
  "/fichas",
  "/fichas/demonstracao",
  "/kit",
  "/eventos",
  "/eventos/apoio",
  "/pesquisa",
  "/pesquisa/apoio",
];

// O banco de homologação fica num túnel: cada teste tem até 2 minutos.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

descreverComBanco("comercial parte B (/api/v1/comercial)", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  let visitante: Navegador;

  beforeAll(async () => {
    vi.stubGlobal("fetch", () =>
      Promise.reject(new Error("chamada externa bloqueada no teste")),
    );
    app = await criarApp();
    admin = new Navegador(app);
    semAcesso = new Navegador(app);
    visitante = new Navegador(app);
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

  it("a rotina diária está agendada no horário de antes", () => {
    const r = ROTINAS.find((x) => x.nome === "comercial.rotinas");
    expect(r?.cron).toBe("0 11 * * *");
  });

  it("sem acesso ao módulo: 403 em toda leitura", async () => {
    for (const caminho of LEITURAS) {
      const r = await semAcesso.pedir("GET", `${COM}${caminho}`);
      expect(r.statusCode, caminho).toBe(403);
    }
  }, 120_000);

  it("sem acesso ao módulo: 403 nas gravações", async () => {
    const gravacoes: [string, Record<string, unknown>][] = [
      ["/censo/temas", { nome: MARCA }],
      [
        "/censo/rodadas",
        { nome: MARCA, inicio: "2099-01-01", fim: "2099-01-02" },
      ],
      ["/censo/respostas", { modo: "demonstracao" }],
      ["/fichas/links", { tipo: "pf" }],
      [`/fichas/${NADA}/cancelar`, {}],
      [
        "/kit/documentos",
        {
          documento: {
            nome: MARCA,
            categoria: "",
            blocos: [],
            todoContrato: false,
          },
          versao: { versao: "1", data: null, validade: null, paginas: null },
        },
      ],
      ["/eventos/propostas", { cliente: MARCA }],
      ["/pesquisa/imoveis", { endereco: MARCA }],
    ];
    for (const [caminho, corpo] of gravacoes) {
      const r = await semAcesso.pedir("POST", `${COM}${caminho}`, corpo);
      expect(r.statusCode, caminho).toBe(403);
    }
    const pdf = await semAcesso.pedir("GET", `${COM}/censo/panorama`);
    expect(pdf.statusCode).toBe(403);
  });

  it("o administrador lê todas as telas e os detalhes", async () => {
    for (const caminho of LEITURAS) {
      const r = await admin.pedir("GET", `${COM}${caminho}`);
      expect(r.statusCode, caminho).toBe(200);
    }
    const censo = (await admin.pedir("GET", `${COM}/censo`)).json();
    const rodada = censo.rodadas[0];
    if (rodada) {
      for (const c of [
        `/censo/rodadas/${rodada.id}`,
        `/censo/feedbacks?rodada=${rodada.id}`,
      ]) {
        const r = await admin.pedir("GET", `${COM}${c}`);
        expect(r.statusCode, c).toBe(200);
      }
      const pdf = await admin.pedir("GET", `${COM}/censo/panorama`);
      expect(pdf.statusCode).toBe(200);
      expect(pdf.headers["content-type"]).toBe("application/pdf");
    }
    const fichas = (await admin.pedir("GET", `${COM}/fichas`)).json();
    if (fichas.fichas[0]) {
      const r = await admin.pedir(
        "GET",
        `${COM}/fichas/${fichas.fichas[0].id}`,
      );
      expect(r.statusCode).toBe(200);
    }
    const kit = (await admin.pedir("GET", `${COM}/kit`)).json();
    if (kit.documentos[0]) {
      const r = await admin.pedir(
        "GET",
        `${COM}/kit/documentos/${kit.documentos[0].id}`,
      );
      expect(r.statusCode).toBe(200);
    }
    const eventos = (await admin.pedir("GET", `${COM}/eventos`)).json();
    if (eventos.propostas[0]) {
      const id = eventos.propostas[0].id;
      const r = await admin.pedir("GET", `${COM}/eventos/propostas/${id}`);
      expect(r.statusCode).toBe(200);
    }
    const pesquisa = (await admin.pedir("GET", `${COM}/pesquisa`)).json();
    if (pesquisa.imoveis[0]) {
      const id = pesquisa.imoveis[0].id;
      const r = await admin.pedir("GET", `${COM}/pesquisa/imoveis/${id}`);
      expect(r.statusCode).toBe(200);
    }
    // Feriados com a BrasilAPI bloqueada: só os cadastrados.
    const feriados = await admin.pedir(
      "GET",
      `${COM}/eventos/feriados?anos=2099`,
    );
    expect(feriados.statusCode).toBe(200);
    expect(feriados.json().semNacionais).toBe(true);
    const nada = await admin.pedir("GET", `${COM}/fichas/${NADA}`);
    expect(nada.statusCode).toBe(404);
  }, 120_000);

  it("fichas: gera o link, o interessado abre, cancela e reenvia", async () => {
    const gerado = await admin.pedir("POST", `${COM}/fichas/links`, {
      tipo: "pf",
      luc: "",
      nome: MARCA,
      rd: "",
    });
    expect(gerado.statusCode).toBe(200);
    const { link, mensagem } = gerado.json();
    expect(mensagem).toBe("Link gerado. Copie e envie ao interessado.");
    const token = String(link).split("/ficha/")[1] ?? "";
    const criada = await banco.comoServico((tx) =>
      tx
        .selectFrom("comercial.fichas")
        .select("id")
        .where("token", "=", token)
        .executeTakeFirstOrThrow(),
    );
    try {
      const pagina = await visitante.pedir("GET", `/api/v1/ficha/${token}`);
      expect(pagina.statusCode).toBe(200);
      expect(pagina.json().ficha.tipo).toBe("pf");
      const semAceite = await visitante.pedir(
        "POST",
        `/api/v1/ficha/${token}`,
        {
          acao: "salvar",
          respostas: "{}",
        },
      );
      expect(semAceite.json().erro).toMatch(/aceite do termo da LGPD/);
      const cep = await visitante.pedir(
        "GET",
        `/api/v1/ficha/${token}/consultas/cep/28600000`,
      );
      expect(cep.json()).toEqual({ endereco: null });
      const inexistente = await visitante.pedir(
        "GET",
        `/api/v1/ficha/${"a".repeat(64)}`,
      );
      expect(inexistente.json()).toEqual({ motivo: "inexistente" });

      const detalhe = await admin.pedir("GET", `${COM}/fichas/${criada.id}`);
      expect(detalhe.json().ficha.link).toBe(link);
      const cancelado = await admin.pedir(
        "POST",
        `${COM}/fichas/${criada.id}/cancelar`,
      );
      expect(cancelado.json().mensagem).toBe("Link cancelado.");
      const depois = await visitante.pedir("GET", `/api/v1/ficha/${token}`);
      expect(depois.json()).toEqual({ motivo: "cancelada" });
      const reenviado = await admin.pedir(
        "POST",
        `${COM}/fichas/${criada.id}/reenviar`,
      );
      expect(reenviado.json().mensagem).toMatch(/^Link valendo até/);
      expect(reenviado.json().link).not.toBe(link);
    } finally {
      await banco.comoServico((tx) =>
        tx.deleteFrom("comercial.fichas").where("id", "=", criada.id).execute(),
      );
    }
  });

  it("censo: tema criado e apagado; demonstração confere sem gravar; link inválido", async () => {
    const nome = `${MARCA} ${Date.now()}`;
    const criado = await admin.pedir("POST", `${COM}/censo/temas`, {
      id: "",
      nome,
    });
    try {
      expect(criado.statusCode).toBe(200);
      expect(criado.json().mensagem).toBe(`Tema “${nome}” criado.`);
    } finally {
      await banco.comoServico((tx) =>
        tx
          .deleteFrom("comercial.censo_temas")
          .where("nome", "=", nome)
          .execute(),
      );
    }
    const demo = await admin.pedir("POST", `${COM}/censo/respostas`, {
      modo: "demonstracao",
    });
    expect(demo.statusCode).toBe(400);
    expect(demo.json().erro.mensagem).toBe(
      "Confira as respostas marcadas antes de enviar.",
    );
    expect(Object.keys(demo.json().erro.campos ?? {}).length).toBeGreaterThan(
      0,
    );
    const pagina = await visitante.pedir("GET", "/api/v1/censo/curto");
    expect(pagina.json()).toEqual({ motivo: "inexistente" });
    const envio = await visitante.pedir("POST", "/api/v1/censo/curto", {});
    expect(envio.json().erro.mensagem).toMatch(/não está mais ativo/);
  });

  it("pesquisa: cadastra, corrige e o teste apaga", async () => {
    const apoio = (await admin.pedir("GET", `${COM}/pesquisa/apoio`)).json();
    const corpo = {
      data_pesquisa: "2099-01-01",
      cep: "",
      endereco: MARCA,
      bairro: apoio.bairros[0] ?? "",
      tipo: apoio.tipos[0] ?? "",
      area_m2: "50",
      aluguel: "1000",
      condominio: "",
      iptu: "",
      vagas: "",
      observacao: "",
      fonte: "",
    };
    const criado = await admin.pedir("POST", `${COM}/pesquisa/imoveis`, corpo);
    expect(criado.statusCode).toBe(201);
    const { id } = criado.json();
    try {
      const corrigido = await admin.pedir(
        "PATCH",
        `${COM}/pesquisa/imoveis/${id}`,
        { ...corpo, aluguel: "1100" },
      );
      expect(corrigido.json().mensagem).toBe(
        "Imóvel corrigido. A alteração ficou no histórico.",
      );
    } finally {
      await banco.comoServico((tx) =>
        tx
          .deleteFrom("comercial.pesquisa_imoveis")
          .where("id", "=", id)
          .execute(),
      );
    }
  });

  it("eventos: salva a proposta, muda o status, baixa o PDF e o teste apaga", async () => {
    const criado = await admin.pedir("POST", `${COM}/eventos/propostas`, {
      cliente: MARCA,
      tipo_data: "comum",
      area_m2: "100",
      dias: "1",
    });
    expect(criado.statusCode).toBe(201);
    const { id } = criado.json();
    try {
      const status = await admin.pedir(
        "PATCH",
        `${COM}/eventos/propostas/${id}/status`,
        { status: "perdida" },
      );
      expect(status.statusCode).toBe(200);
      const pdf = await admin.pedir(
        "GET",
        `${COM}/eventos/propostas/${id}/pdf`,
      );
      expect(pdf.headers["content-type"]).toBe("application/pdf");
    } finally {
      await banco.comoServico((tx) =>
        tx
          .deleteFrom("comercial.propostas_evento")
          .where("id", "=", id)
          .execute(),
      );
    }
  });

  it("kit: cadastra o documento (sem arquivo) e o teste apaga", async () => {
    const kit = (await admin.pedir("GET", `${COM}/kit`)).json();
    const criado = await admin.pedir("POST", `${COM}/kit/documentos`, {
      documento: {
        nome: MARCA,
        categoria: kit.categorias[0] ?? "",
        blocos: [],
        todoContrato: false,
      },
      versao: { versao: "1", data: null, validade: null, paginas: null },
    });
    expect(criado.statusCode).toBe(201);
    const { documentoId, versaoId } = criado.json();
    try {
      const semArquivo = await admin.pedir(
        "GET",
        `${COM}/kit/arquivo/${versaoId}`,
      );
      expect(semArquivo.statusCode).toBe(404);
    } finally {
      await banco.comoServico((tx) =>
        tx
          .deleteFrom("comercial.kit_documentos")
          .where("id", "=", documentoId)
          .execute(),
      );
    }
  });

  it("importação: censo, fichas e pesquisa têm leitor (sem prévia: não encontrada)", async () => {
    for (const tipo of ["censo", "fichas", "pesquisa"]) {
      const r = await admin.pedir(
        "POST",
        `${COM}/importacoes/${tipo}/confirmar`,
        {
          importacao_id: NADA,
        },
      );
      expect(r.statusCode, tipo).toBe(422);
      expect(r.json().erro.mensagem, tipo).toMatch(/Importação não encontrada/);
    }
  });
});
