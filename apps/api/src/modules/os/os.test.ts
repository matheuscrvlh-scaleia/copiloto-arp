import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp } from "@/app";
import { env } from "@/config/env";
import type { Contexto } from "@/contexto";
import { ErroDePermissao } from "@/erros";
import { COOKIE_ACESSO } from "@/http/sessao";
import { banco } from "@/infra/banco";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";
import { avisosPendentes, removerArquivos } from "./base.service";
import { criarCategoriaRapida } from "./formulario.service";
import { dispararModeloManual } from "./modelos.service";
import { exportarLista, exportarQuadro } from "./visoes.service";

// Tickets (base e chamados) de ponta a ponta na homologação: quem não tem
// acesso recebe 403; o administrador lê todas as telas e abre um chamado de
// teste para si mesmo, passa pelo ciclo e ele é apagado no fim.

const OS = "/api/v1/os";
const NADA = "00000000-0000-4000-8000-000000000000";
/** A homologação fica atrás de um túnel: os testes longos pedem mais tempo. */
const LONGO = 240_000;

/** Contexto sem permissão alguma (o service barra antes de ir ao banco). */
const semPermissao: Contexto = {
  ip: "198.18.0.1",
  agente: null,
  requisicaoId: "teste",
  usuario: { id: NADA, nome: "Teste", email: "teste@example.com" },
  permissoes: new Set(),
  senhaProvisoria: false,
  sessao: {
    id: NADA,
    inicio: new Date(),
    ultimoUso: new Date(),
    acessoExpiraEm: new Date(),
  },
};

describe("tickets: permissão conferida no service", () => {
  it("exportar exige os.acessar e os.exportar", () => {
    expect(() => exportarLista(semPermissao, "caixa", {})).toThrow(
      "Sem permissão para exportar.",
    );
    expect(() => exportarQuadro(semPermissao, {}, false)).toThrow(
      ErroDePermissao,
    );
  });

  it("categoria rápida exige os.acessar", async () => {
    await expect(
      criarCategoriaRapida(semPermissao, {
        nome: "x",
        setorId: NADA,
        icone: "x",
        tipo: "tarefa",
      }),
    ).rejects.toBeInstanceOf(ErroDePermissao);
  });
});

descreverComBanco("tickets, base e chamados (/api/v1/os)", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  const marca = `Teste porte ${randomUUID().slice(0, 8)}`;
  const criados = { chamados: [] as string[] };

  /** Formulário com arquivo, como a tela envia. */
  async function enviarFormulario(
    url: string,
    campos: Record<string, string>,
    arquivo?: { campo: string; nome: string; texto: string },
  ) {
    const limite = `----teste${randomUUID()}`;
    const partes = Object.entries(campos).map(
      ([nome, valor]) =>
        `--${limite}\r\nContent-Disposition: form-data; name="${nome}"\r\n\r\n${valor}\r\n`,
    );
    if (arquivo)
      partes.push(
        `--${limite}\r\nContent-Disposition: form-data; name="${arquivo.campo}"; filename="${arquivo.nome}"\r\nContent-Type: text/plain\r\n\r\n${arquivo.texto}\r\n`,
      );
    return app.inject({
      method: "POST",
      url,
      headers: {
        "x-forwarded-for": admin.ip,
        cookie: `${COOKIE_ACESSO}=${admin.cookie(COOKIE_ACESSO)}`,
        origin: env.SITE_URL,
        "x-arp": "1",
        "content-type": `multipart/form-data; boundary=${limite}`,
      },
      payload: `${partes.join("")}--${limite}--\r\n`,
    });
  }

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
    await avisosPendentes();
    // Rede de segurança: só o que este teste criou (as filhas do chamado
    // saem em cascata; os arquivos, do disco).
    const arquivos = await banco.comoServico(async (tx) => {
      const anexos = criados.chamados.length
        ? await tx
            .selectFrom("os.anexos")
            .select("path")
            .where("chamado_id", "in", criados.chamados)
            .execute()
        : [];
      if (criados.chamados.length)
        await tx
          .deleteFrom("os.chamados")
          .where("id", "in", criados.chamados)
          .execute();
      await tx.deleteFrom("os.categorias").where("nome", "=", marca).execute();
      await tx.deleteFrom("os.empresas").where("nome", "=", marca).execute();
      return anexos.map((a) => a.path);
    });
    await removerArquivos(arquivos);
    await app.close();
    await banco.encerrar();
  });

  it(
    "sem acesso ao módulo: 403 em toda leitura e gravação",
    async () => {
      const leituras = [
        "/apoio",
        "/formulario",
        "/formulario/inicial",
        "/formulario/vinculos",
        `/agendas/${NADA}/horarios?data=2026-11-16`,
        `/chamados/${NADA}`,
        "/contatos",
        "/visoes/lista?tela=caixa",
        "/visoes/lista/exportacao?tela=caixa",
        "/visoes/quadro",
        "/visoes/quadro/exportacao",
        "/visoes/calendario",
        "/visoes/seu-dia",
        "/disparos",
      ];
      for (const url of leituras)
        expect((await semAcesso.pedir("GET", OS + url)).statusCode, url).toBe(
          403,
        );
      const gravacoes = [
        ["POST", `/chamados/${NADA}/acoes`, { acao: "iniciar" }],
        ["PATCH", `/chamados/${NADA}`, { prioridade: "alta" }],
        ["POST", `/chamados/${NADA}/checklist`, { indice: 0, feito: "1" }],
        ["POST", `/chamados/${NADA}/seguir`, { ligar: "1" }],
        ["POST", `/chamados/${NADA}/leitura`, undefined],
        ["POST", `/chamados/${NADA}/confirmar`, undefined],
        ["POST", `/chamados/${NADA}/reabrir`, { motivo: "teste" }],
        ["POST", `/chamados/${NADA}/mover`, { para: "concluido" }],
        [
          "POST",
          "/chamados/lote/prioridade",
          { ids: [NADA], prioridade: "alta" },
        ],
        ["POST", `/destinos/${NADA}/andar`, { acao: "ler" }],
        ["POST", `/destinos/${NADA}/mover`, { passo: "1" }],
        ["PATCH", `/destinos/${NADA}`, { tarefa: "x" }],
        ["PUT", "/preferencias/filtros/quadro", { valores: {} }],
        ["POST", "/preferencias/seu-dia", undefined],
        [
          "POST",
          "/categorias/rapida",
          { nome: "x", setorId: NADA, icone: "x", tipo: "tarefa" },
        ],
        ["POST", "/terceirizados/rapido", { nome: "x" }],
        ["POST", "/disparos", { modelo_id: NADA, loja_id: NADA }],
        ["POST", `/series/${NADA}/parar`, { ultima_id: NADA }],
      ] as const;
      for (const [metodo, url, corpo] of gravacoes)
        expect(
          (await semAcesso.pedir(metodo, OS + url, corpo)).statusCode,
          url,
        ).toBe(403);
    },
    LONGO,
  );

  it("disparar modelo confere os.modelos no banco (service role)", async () => {
    const eu = (await semAcesso.pedir("GET", "/api/v1/auth/eu")).json();
    await expect(
      dispararModeloManual(
        { ...semPermissao, usuario: { ...semPermissao.usuario, id: eu.id } },
        { modelo_id: NADA, loja_id: NADA },
      ),
    ).rejects.toBeInstanceOf(ErroDePermissao);
  });

  it(
    "administrador lê o apoio, o formulário e as visões",
    async () => {
      const apoio = await admin.pedir("GET", `${OS}/apoio`);
      expect(apoio.statusCode).toBe(200);
      expect(Object.keys(apoio.json()).sort()).toEqual([
        "avisoHoras",
        "categorias",
        "gestorDe",
        "meusSetores",
        "pessoas",
        "setores",
      ]);
      for (const url of [
        "/formulario",
        "/formulario/inicial?titulo=abc",
        "/formulario/inicial?os=1",
        "/formulario/vinculos",
        "/contatos",
        "/visoes/seu-dia",
        "/disparos",
      ])
        expect((await admin.pedir("GET", OS + url)).statusCode, url).toBe(200);

      for (const tela of ["caixa", "setor", "avisos", "os_caixa", "os_setor"]) {
        const r = await admin.pedir("GET", `${OS}/visoes/lista?tela=${tela}`);
        expect(r.statusCode, tela).toBe(200);
        const lista = r.json();
        expect(lista.linhas.length).toBeLessThanOrEqual(lista.total);
        expect(typeof lista.cartoes).toBe("object");
        const planilha = await admin.pedir(
          "GET",
          `${OS}/visoes/lista/exportacao?tela=${tela}&q=${encodeURIComponent(marca)}`,
        );
        expect(planilha.statusCode, tela).toBe(200);
        expect(planilha.json().linhas).toEqual([]);
      }
      const mandados = await admin.pedir(
        "GET",
        `${OS}/visoes/lista?tela=avisos&aberto_por=eu`,
      );
      expect(mandados.json().tela).toBe("avisos_mandados");
      const filtrada = await admin.pedir(
        "GET",
        `${OS}/visoes/lista?tela=setor&cartao=atrasados&ordem=prazo.desc&agrupar=responsavel&prioridade=alta&pagina=2`,
      );
      expect(filtrada.statusCode).toBe(200);
      expect(filtrada.json().filtros).toMatchObject({ prioridade: "alta" });

      for (const url of [
        "/visoes/quadro",
        "/visoes/quadro?ordens=1",
        "/visoes/quadro?recorte=todos&fechados=1&mais=aberto:20",
        "/visoes/quadro/exportacao",
        "/visoes/calendario",
        "/visoes/calendario?visao=semana&recorte=todos&data=2026-11-16",
        "/visoes/calendario?visao=periodo&de=2026-11-01&ate=2026-11-30&tipo=os",
      ])
        expect((await admin.pedir("GET", OS + url)).statusCode, url).toBe(200);
      const quadro = (await admin.pedir("GET", `${OS}/visoes/quadro`)).json();
      expect(quadro.colunas.map((c: { status: string }) => c.status)).toEqual([
        "aberto",
        "em_andamento",
        "aguardando",
        "concluido",
      ]);
      const lista = await admin.pedir("GET", `${OS}/visoes/lista?tela=errada`);
      expect(lista.statusCode).toBe(400);
    },
    LONGO,
  );

  it("chamado que não existe (ou id inválido): 404 com o aviso da tela", async () => {
    for (const id of [NADA, "abc"]) {
      const r = await admin.pedir("GET", `${OS}/chamados/${id}`);
      expect(r.statusCode).toBe(404);
      expect(r.json().erro.mensagem).toBe(
        "Chamado não encontrado, ou você não tem acesso a ele.",
      );
    }
  });

  it(
    "lembra os filtros da tela e os devolve na visita sem filtros",
    async () => {
      const antes = (await admin.pedir("GET", `${OS}/visoes/quadro`)).json();
      const gravar = await admin.pedir(
        "PUT",
        `${OS}/preferencias/filtros/quadro`,
        { valores: { prioridade: "alta", invalido: "x" } },
      );
      expect(gravar.statusCode).toBe(200);
      const depois = (await admin.pedir("GET", `${OS}/visoes/quadro`)).json();
      expect(depois.lembrados).toBe(true);
      expect(depois.filtros).toEqual({ prioridade: "alta" });
      // Com filtro na URL, vale a URL.
      const daUrl = (
        await admin.pedir("GET", `${OS}/visoes/quadro?f=0`)
      ).json();
      expect(daUrl.lembrados).toBe(false);
      expect(daUrl.filtros).toEqual({});
      await admin.pedir("PUT", `${OS}/preferencias/filtros/quadro`, {
        valores: antes.lembrados ? antes.filtros : {},
      });
    },
    LONGO,
  );

  it(
    "abre um chamado, passa pelo ciclo e fecha",
    async () => {
      const dados = (await admin.pedir("GET", `${OS}/formulario`)).json();
      const eu: string = dados.eu.id;
      const setor: string = dados.setores[0].id;
      const campos = {
        tipo: "solicitacao",
        setor_id: setor,
        categoria_id: "",
        titulo: marca,
        descricao: "Criado pelo teste automático.",
        prioridade: "",
        prazo: "",
        responsavel: eu,
        pessoal: "0",
        vinculado_numero: "",
        etiquetas: "teste",
      };

      const curto = await enviarFormulario(`${OS}/chamados`, {
        ...campos,
        titulo: "a",
      });
      expect(curto.statusCode).toBe(400);
      expect(curto.json().erro.mensagem).toBe("Título: escreva o título");

      const aberto = await enviarFormulario(`${OS}/chamados`, campos, {
        campo: "arquivos",
        nome: "teste.txt",
        texto: "arquivo de teste",
      });
      expect(aberto.statusCode).toBe(201);
      const { id, numero } = aberto.json();
      criados.chamados.push(id);
      expect(aberto.json().mensagem).toBe(`Chamado #${numero} aberto.`);
      const url = `${OS}/chamados/${id}`;

      let d = (await admin.pedir("GET", url)).json();
      expect(d.ch).toMatchObject({
        titulo: marca,
        status: "aberto",
        responsavel_id: eu,
        aberto_por: eu,
        etiquetas: ["teste"],
      });
      expect(d.anexos).toHaveLength(1);
      expect(d.anexos[0].url).toContain("/api/v1/arquivos/");
      expect(d.papel).toMatchObject({ solicitante: true, responsavel: true });
      expect(d.link).toBe(`${env.SITE_URL}/os/chamados/${id}`);

      // Aparece nas listas, com a busca, e na exportação.
      const lista = (
        await admin.pedir(
          "GET",
          `${OS}/visoes/lista?tela=caixa&q=${encodeURIComponent(marca)}`,
        )
      ).json();
      expect(lista.linhas.map((l: { id: string }) => l.id)).toEqual([id]);
      expect(lista.linhas[0]).toMatchObject({ podePrazo: true, numero });
      const inicial = (
        await admin.pedir("GET", `${OS}/formulario/inicial?duplicar=${id}`)
      ).json();
      expect(inicial).toMatchObject({ titulo: marca, setorId: setor });
      expect(inicial.contexto[0].rotulo).toBe("Cópia de");

      const passo = async (
        metodo: "POST" | "PATCH",
        caminho: string,
        corpo: Record<string, unknown> | undefined,
        mensagem: string,
      ) => {
        const r = await admin.pedir(metodo, url + caminho, corpo);
        expect(r.json(), caminho).toEqual({ mensagem });
      };
      await passo("POST", "/acoes", { acao: "iniciar" }, "Em andamento.");
      await passo("PATCH", "", { prioridade: "alta" }, "Alterado.");
      await passo(
        "PATCH",
        "",
        { prioridade: "alta", antes_prioridade: "alta" },
        "Nada mudou.",
      );
      await passo("POST", "/seguir", { ligar: "1" }, "Seguindo.");
      await passo("POST", "/seguir", { ligar: "0" }, "Deixou de seguir.");

      const comentario = await enviarFormulario(`${url}/comentarios`, {
        texto: "Comentário de teste",
        visivel_lojista: "0",
      });
      expect(comentario.statusCode).toBe(201);
      expect(comentario.json().mensagem).toBe("Enviado.");
      const vazio = await enviarFormulario(`${url}/comentarios`, { texto: "" });
      expect(vazio.statusCode).toBe(422);
      expect(vazio.json().erro.mensagem).toBe(
        "Escreva algo ou anexe um arquivo.",
      );
      const semItem = await admin.pedir("POST", `${url}/checklist`, {
        indice: 0,
        feito: "1",
      });
      expect(semItem.statusCode).toBe(422);

      // Alterações em lote (as mesmas regras, uma a uma).
      const lote = async (qual: string, corpo: Record<string, unknown>) =>
        (
          await admin.pedir("POST", `${OS}/chamados/lote/${qual}`, {
            ids: [id],
            ...corpo,
          })
        ).json();
      expect(await lote("prioridade", { prioridade: "media" })).toEqual({
        mensagem: "1 prioridade alterada",
      });
      expect(await lote("prazo", { prazo: "2026-12-30T10:00" })).toEqual({
        mensagem: "1 prazo alterado",
      });
      expect(await lote("responsavel", { responsavel: eu })).toEqual({
        mensagem: "1 chamado atribuído",
      });
      const foraDoAlcance = await admin.pedir(
        "POST",
        `${OS}/chamados/lote/prioridade`,
        { ids: [NADA], prioridade: "alta" },
      );
      expect(foraDoAlcance.statusCode).toBe(422);

      // Quadro: arrastar vira as ações do detalhe.
      await passo(
        "POST",
        "/mover",
        { para: "aguardando", aguardandoTipo: "material", motivo: "teste" },
        "Movido.",
      );
      await passo("POST", "/acoes", { acao: "retomar" }, "Em andamento.");
      await passo("POST", "/mover", { para: "concluido" }, "Movido.");
      const curtoDemais = await admin.pedir("POST", `${url}/reabrir`, {
        motivo: "a",
      });
      expect(curtoDemais.json().erro.campos.motivo).toBe(
        "Motivo: conte por que está reabrindo",
      );
      await passo(
        "POST",
        "/reabrir",
        { motivo: "teste automático" },
        "Reaberto. O responsável foi avisado.",
      );
      await passo("POST", "/mover", { para: "concluido" }, "Movido.");
      await passo("POST", "/confirmar", undefined, "Confirmado e fechado.");

      d = (await admin.pedir("GET", url)).json();
      expect(d.ch.status).toBe("fechado");
      expect(d.ch.reaberto_vezes).toBe(1);
      expect(d.acoes).toEqual([]);
      expect(d.eventos.length).toBeGreaterThanOrEqual(8);
      const parado = await admin.pedir("POST", `${url}/mover`, {
        para: "aberto",
      });
      expect(parado.statusCode).toBe(422);
    },
    LONGO,
  );

  it("destino, série e disparo que não existem: erro de regra, nada gravado", async () => {
    const andar = await admin.pedir("POST", `${OS}/destinos/${NADA}/andar`, {
      acao: "ler",
    });
    expect(andar.statusCode).toBe(422);
    expect(andar.json().erro.mensagem).toBe("Destino não encontrado.");
    const serie = await admin.pedir("POST", `${OS}/series/${NADA}/parar`, {
      ultima_id: NADA,
    });
    expect(serie.statusCode).toBe(422);
    const disparo = await admin.pedir("POST", `${OS}/disparos`, {
      modelo_id: NADA,
      loja_id: NADA,
    });
    expect(disparo.statusCode).toBe(422);
    const invalido = await admin.pedir("POST", `${OS}/disparos`, {
      modelo_id: "x",
      loja_id: NADA,
    });
    expect(invalido.json().erro.campos.modelo_id).toBe(
      "Modelo: escolha o modelo",
    );
  });

  it(
    "cadastros rápidos do Novo chamado: categoria e terceirizado",
    async () => {
      const dados = (await admin.pedir("GET", `${OS}/formulario`)).json();
      const setorId: string = dados.setores[0].id;
      const categoria = await admin.pedir("POST", `${OS}/categorias/rapida`, {
        nome: marca,
        setorId,
        icone: "wrench",
        tipo: "tarefa",
      });
      expect(categoria.statusCode).toBe(201);
      expect(categoria.json().categoria).toMatchObject({
        nome: marca,
        setorId,
        tipo: "tarefa",
        precisaConfirmacao: true,
      });
      const semNome = await admin.pedir("POST", `${OS}/categorias/rapida`, {
        nome: " ",
        setorId,
        icone: "wrench",
        tipo: "tarefa",
      });
      expect(semNome.json().erro.campos.nome).toBe("Nome: informe o nome");

      const empresa = await admin.pedir("POST", `${OS}/terceirizados/rapido`, {
        nome: marca,
        cnpj: "",
        telefone: "",
        email: "",
      });
      expect(empresa.statusCode).toBe(201);
      expect(empresa.json().mensagem).toBe(
        `${marca} cadastrado como terceirizado.`,
      );
      const cnpj = await admin.pedir("POST", `${OS}/terceirizados/rapido`, {
        nome: marca,
        cnpj: "123",
      });
      expect(cnpj.json().erro.campos.cnpj).toBe("CNPJ: CNPJ inválido");
    },
    LONGO,
  );

  it("horários livres de uma agenda (vazio para agenda que não existe)", async () => {
    const r = await admin.pedir(
      "GET",
      `${OS}/agendas/${NADA}/horarios?data=2026-11-16`,
    );
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ orientacao: null, livres: [] });
  });
});
