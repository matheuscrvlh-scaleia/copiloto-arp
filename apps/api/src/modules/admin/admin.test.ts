import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { eventosPendentes } from "@/infra/eventos";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";

// A sincronização é de outro módulo e chama sistemas externos: aqui só se
// confere que a rota chega nela depois da permissão.
const sincronizarAgora = vi.hoisted(() =>
  vi.fn(async () => ({ mensagem: "Sincronização de teste." })),
);
vi.mock("@/modules/sync/sync.service", () => ({ sincronizarAgora }));

const ADMIN = "/api/v1/admin";
const sufixo = randomBytes(4).toString("hex");
const SENHA = `Provisoria-${randomBytes(6).toString("hex")}`;
// Cada teste faz dezenas de pedidos ao banco de homologação (por túnel).
vi.setConfig({ testTimeout: 180_000 });

descreverComBanco("administração (/api/v1/admin)", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  let euId: string;
  /** O que o teste criou e precisa sair mesmo se algo falhar no meio. */
  const criados = { usuario: "", cargo: "" };

  beforeAll(async () => {
    app = await criarApp();
    admin = new Navegador(app);
    semAcesso = new Navegador(app);
    const eu = await admin.pedir("POST", "/api/v1/auth/entrar", {
      email: TESTE.email,
      senha: TESTE.senha,
    });
    expect(eu.statusCode).toBe(200);
    euId = eu.json().usuario.id;
    const outro = await semAcesso.pedir("POST", "/api/v1/auth/entrar", {
      email: TESTE.emailSemAcesso,
      senha: TESTE.senha,
    });
    expect(outro.statusCode).toBe(200);
  });
  afterAll(async () => {
    await eventosPendentes();
    await banco.comoServico(async (tx) => {
      if (criados.usuario)
        await tx
          .deleteFrom("auth.users")
          .where("id", "=", criados.usuario)
          .execute();
      if (criados.cargo)
        await tx
          .deleteFrom("core.cargos")
          .where("id", "=", criados.cargo)
          .execute();
    });
    await app.close();
    await banco.encerrar();
  });

  it("sem a permissão ninguém lê nem grava (403)", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    const pedidos: [
      "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
      string,
      Record<string, unknown>?,
    ][] = [
      ["GET", "/usuarios"],
      ["GET", `/usuarios/${id}`],
      ["POST", "/usuarios", { nome: "Fulano", email: "a@b.co", senha: SENHA }],
      ["PATCH", `/usuarios/${id}`, { nome: "Fulano" }],
      ["PATCH", `/usuarios/${id}/situacao`, { ativo: false }],
      ["POST", `/usuarios/${id}/senha`, { senha: SENHA }],
      ["DELETE", `/usuarios/${id}/permissoes`],
      ["DELETE", `/usuarios/${id}`],
      ["GET", "/cargos"],
      ["GET", "/permissoes-de-programa"],
      ["POST", "/cargos", { nome: "Cargo" }],
      ["PATCH", `/cargos/${id}`, { nome: "Cargo" }],
      ["PATCH", `/cargos/${id}/situacao`, { ativo: false }],
      ["DELETE", `/cargos/${id}`],
      ["PATCH", "/empresa", { nome: "Empresa" }],
      ["GET", "/historico"],
      ["GET", "/historico/autores"],
      ["GET", "/integracoes"],
      ["GET", "/integracoes?modulo=marketing"],
      [
        "PUT",
        "/integracoes/secullum",
        {
          campos: {},
          segredos: {},
          ativa: false,
          sem_teste: false,
          autorizar: false,
        },
      ],
      ["POST", "/integracoes/secullum/teste"],
      ["POST", "/integracoes/secullum/sincronizacao"],
      ["DELETE", "/integracoes/secullum"],
    ];
    for (const [metodo, caminho, corpo] of pedidos) {
      const r = await semAcesso.pedir(metodo, `${ADMIN}${caminho}`, corpo);
      expect(`${metodo} ${caminho}: ${r.statusCode}`).toBe(
        `${metodo} ${caminho}: 403`,
      );
    }
    expect(sincronizarAgora).not.toHaveBeenCalled();
  });

  it("cargos: cria, altera as permissões, inativa e exclui", async () => {
    const nome = `Porte ${sufixo}`;
    const criou = await admin.pedir("POST", `${ADMIN}/cargos`, {
      nome,
      descricao: "",
      permissoes: "rh.painel",
    });
    expect(criou.statusCode).toBe(201);
    criados.cargo = criou.json().id;
    const caminho = `${ADMIN}/cargos/${criados.cargo}`;

    const salvou = await admin.pedir("PATCH", caminho, {
      nome,
      descricao: "Criado pelo teste",
      permissoes: ["rh.quadro", "rh.jornada"],
    });
    expect(salvou.json().mensagem).toBe(
      "Salvo. Vale para todos os usuários deste cargo.",
    );
    const ler = async () => {
      const r = await admin.pedir("GET", `${ADMIN}/cargos`);
      expect(r.statusCode).toBe(200);
      const lista: { id: string; ativo: boolean; permissoes: string[] }[] =
        r.json().cargos;
      return lista.find((c) => c.id === criados.cargo);
    };
    expect(await ler()).toMatchObject({
      nome,
      descricao: "Criado pelo teste",
      ativo: true,
      usuarios: 0,
    });
    expect((await ler())?.permissoes.sort()).toEqual([
      "rh.jornada",
      "rh.quadro",
    ]);

    const desconhecida = await admin.pedir("PATCH", caminho, {
      nome,
      permissoes: ["nao.existe"],
    });
    expect(desconhecida.statusCode).toBe(400);

    // "Programa – lançar": o código passa pelo formato, mas o programa
    // precisa existir no banco; nada do cargo muda quando não existe.
    const semPrograma = await admin.pedir("PATCH", caminho, {
      nome,
      permissoes: [
        "rh.quadro",
        "sustentabilidade.programa.00000000-0000-4000-8000-000000000000",
      ],
      programas_vistas: [],
    });
    expect(semPrograma.statusCode).toBe(422);
    expect(semPrograma.json().erro.mensagem).toBe(
      "Há um programa que não existe mais. Recarregue a página e tente de novo.",
    );
    expect((await ler())?.permissoes.sort()).toEqual([
      "rh.jornada",
      "rh.quadro",
    ]);

    const programas = await admin.pedir(
      "GET",
      `${ADMIN}/permissoes-de-programa`,
    );
    expect(programas.statusCode).toBe(200);
    const lista: { codigo: string; descricao: string }[] =
      programas.json().programas;
    expect(Array.isArray(lista)).toBe(true);
    for (const p of lista)
      expect(p.codigo.startsWith("sustentabilidade.programa.")).toBe(true);

    const inativou = await admin.pedir("PATCH", `${caminho}/situacao`, {
      ativo: "false",
    });
    expect(inativou.json().mensagem).toBe("Cargo inativado.");
    expect((await ler())?.ativo).toBe(false);

    expect((await admin.pedir("DELETE", caminho)).statusCode).toBe(200);
    expect(await ler()).toBeUndefined();
    criados.cargo = "";
  });

  it("usuários: cria com senha provisória, edita, troca a senha, inativa e exclui", async () => {
    const email = `porte-${sufixo}@teste.invalid`;
    const invalido = await admin.pedir("POST", `${ADMIN}/usuarios`, {
      nome: "P",
      email,
      senha: "curta",
    });
    expect(invalido.statusCode).toBe(400);
    expect(invalido.json().erro.campos.nome).toBe("Nome: informe o nome");

    const criou = await admin.pedir("POST", `${ADMIN}/usuarios`, {
      nome: "Pessoa do Porte",
      email: email.toUpperCase(),
      senha: SENHA,
      cargo_id: "",
    });
    expect(criou.statusCode).toBe(201);
    criados.usuario = criou.json().id;
    const caminho = `${ADMIN}/usuarios/${criados.usuario}`;

    const repetido = await admin.pedir("POST", `${ADMIN}/usuarios`, {
      nome: "Pessoa do Porte",
      email,
      senha: SENHA,
    });
    expect(repetido.statusCode).toBe(409);
    expect(repetido.json().erro.mensagem).toBe(
      "Já existe um usuário com esse e-mail.",
    );

    const lido = await admin.pedir("GET", caminho);
    expect(lido.json().usuario).toMatchObject({
      nome: "Pessoa do Porte",
      email,
      ativo: true,
      cargoId: null,
      permissoes: [],
      ultimoAcesso: null,
    });
    const lista = await admin.pedir("GET", `${ADMIN}/usuarios`);
    expect(lista.statusCode).toBe(200);
    expect(
      lista
        .json()
        .usuarios.some((u: { id: string }) => u.id === criados.usuario),
    ).toBe(true);

    // A pessoa entra com a provisória e só pode trocar a senha.
    const dela = new Navegador(app);
    const entrou = await dela.pedir("POST", "/api/v1/auth/entrar", {
      email,
      senha: SENHA,
    });
    expect(entrou.statusCode).toBe(200);
    expect(entrou.json().senha_provisoria).toBe(true);

    const salvou = await admin.pedir("PATCH", caminho, {
      nome: "Pessoa do Porte 2",
      cargo_id: "",
    });
    expect(salvou.json().mensagem).toBe("Salvo.");
    expect((await admin.pedir("GET", caminho)).json().usuario.nome).toBe(
      "Pessoa do Porte 2",
    );
    expect(
      (await admin.pedir("DELETE", `${caminho}/permissoes`)).json().mensagem,
    ).toBe("Removidas. O acesso agora vem só do cargo.");

    // Senha nova pelo administrador: provisória, e a sessão dela cai.
    const nova = `${SENHA}-2`;
    const trocou = await admin.pedir("POST", `${caminho}/senha`, {
      senha: nova,
    });
    expect(trocou.json().mensagem).toBe(
      "Senha trocada. Passe a senha à pessoa; no próximo acesso ela define uma nova.",
    );
    expect((await dela.pedir("GET", "/api/v1/auth/eu")).statusCode).toBe(401);
    const deNovo = await dela.pedir("POST", "/api/v1/auth/entrar", {
      email,
      senha: nova,
    });
    expect(deNovo.statusCode).toBe(200);

    // Inativar bloqueia o login e encerra as sessões.
    const inativou = await admin.pedir("PATCH", `${caminho}/situacao`, {
      ativo: "false",
    });
    expect(inativou.json().mensagem).toBe("Usuário inativado.");
    expect((await dela.pedir("GET", "/api/v1/auth/eu")).statusCode).toBe(401);
    const barrado = await new Navegador(app).pedir(
      "POST",
      "/api/v1/auth/entrar",
      { email, senha: nova },
    );
    expect(barrado.statusCode).toBe(401);
    const reativou = await admin.pedir("PATCH", `${caminho}/situacao`, {
      ativo: true,
    });
    expect(reativou.json().mensagem).toBe("Acesso reativado.");

    const excluiu = await admin.pedir("DELETE", caminho);
    expect(excluiu.statusCode).toBe(200);
    expect((await admin.pedir("GET", caminho)).statusCode).toBe(404);
    const noLogin = await banco.comoServico((tx) =>
      tx
        .selectFrom("auth.users")
        .select("id")
        .where("id", "=", criados.usuario)
        .executeTakeFirst(),
    );
    expect(noLogin).toBeUndefined();
    criados.usuario = "";
  });

  it("ninguém inativa nem exclui a si mesmo, e a própria senha pede confirmação", async () => {
    const eu = `${ADMIN}/usuarios/${euId}`;
    const inativar = await admin.pedir("PATCH", `${eu}/situacao`, {
      ativo: false,
    });
    expect(inativar.statusCode).toBe(422);
    expect(inativar.json().erro.mensagem).toBe(
      "Você não pode inativar o seu próprio acesso.",
    );
    const excluir = await admin.pedir("DELETE", eu);
    expect(excluir.statusCode).toBe(422);
    expect(excluir.json().erro.mensagem).toBe(
      "Você não pode excluir a si mesmo.",
    );
    const senha = await admin.pedir("POST", `${eu}/senha`, { senha: SENHA });
    expect(senha.json().erro.mensagem).toBe(
      "Confirmação: repita a nova senha.",
    );
    const diferente = await admin.pedir("POST", `${eu}/senha`, {
      senha: SENHA,
      confirmacao: `${SENHA}x`,
    });
    expect(diferente.statusCode).toBe(400);
    expect(diferente.json().erro.campos.confirmacao).toBe(
      "Confirmação: as senhas não conferem",
    );
    expect((await admin.pedir("GET", "/api/v1/auth/eu")).statusCode).toBe(200);
  });

  it("empresa: toda pessoa logada lê; quem tem admin.empresa grava", async () => {
    const lida = await semAcesso.pedir("GET", `${ADMIN}/empresa`);
    expect(lida.statusCode).toBe(200);
    const atual = (await admin.pedir("GET", `${ADMIN}/empresa`)).json().empresa;
    expect(typeof atual.nome).toBe("string");

    const invalida = await admin.pedir("PATCH", `${ADMIN}/empresa`, {
      ...atual,
      cnpj: "11.111.111/1111-11",
    });
    expect(invalida.statusCode).toBe(400);
    expect(invalida.json().erro.campos.cnpj).toBe("CNPJ: dígitos não conferem");

    // Regrava os mesmos dados: nada muda para ninguém.
    const { atualizado_em: _, ...dados } = atual;
    const salvou = await admin.pedir("PATCH", `${ADMIN}/empresa`, dados);
    expect(salvou.statusCode).toBe(200);
    expect(salvou.json().mensagem).toBe("Salvo.");
    const depois = (await admin.pedir("GET", `${ADMIN}/empresa`)).json()
      .empresa;
    expect({ ...depois, atualizado_em: null }).toEqual({
      ...atual,
      atualizado_em: null,
    });
  });

  it("histórico: página, filtros e autores", async () => {
    const r = await admin.pedir("GET", `${ADMIN}/historico`);
    expect(r.statusCode).toBe(200);
    const { linhas, total } = r.json();
    expect(linhas.length).toBeGreaterThan(0);
    expect(linhas.length).toBeLessThanOrEqual(50);
    expect(total).toBeGreaterThanOrEqual(linhas.length);

    const eventos = await admin.pedir(
      "GET",
      `${ADMIN}/historico?tipo=evento&modulo=acesso&usuario=${euId}&pagina=1`,
    );
    expect(eventos.statusCode).toBe(200);
    for (const l of eventos.json().linhas)
      expect(l).toMatchObject({
        tipo: "evento",
        modulo: "acesso",
        usuarioId: euId,
      });
    const invalido = await admin.pedir("GET", `${ADMIN}/historico?tipo=x`);
    expect(invalido.statusCode).toBe(400);

    const autores = await admin.pedir("GET", `${ADMIN}/historico/autores`);
    expect(autores.statusCode).toBe(200);
    expect(
      autores.json().autores.some((a: { id: string }) => a.id === euId),
    ).toBe(true);
  });

  it("integrações: lista as da Administração e as do Marketing, sem segredo", async () => {
    const r = await admin.pedir("GET", `${ADMIN}/integracoes`);
    expect(r.statusCode).toBe(200);
    const { integracoes, historico, cofre } = r.json();
    expect(cofre).toBe(true);
    expect(integracoes.map((i: { sistema: string }) => i.sistema)).toEqual([
      "secullum",
      "wps",
      "diario_de_obras",
      "copiloto_rh",
      "rd_crm",
      "cameras",
      "mkt_rd_station",
    ]);
    expect(historico.length).toBeLessThanOrEqual(15);
    expect(r.body).not.toContain("segredo");

    const mkt = await admin.pedir(
      "GET",
      `${ADMIN}/integracoes?modulo=marketing`,
    );
    expect(mkt.statusCode).toBe(200);
    expect(mkt.json().integracoes.length).toBe(6);
  });

  it("integrações: valida o sistema e os campos antes de qualquer conexão", async () => {
    const desconhecida = await admin.pedir(
      "POST",
      `${ADMIN}/integracoes/nao_existe/teste`,
    );
    expect(desconhecida.statusCode).toBe(400);
    const semCampos = await admin.pedir("PUT", `${ADMIN}/integracoes/wps`, {
      campos: { base_url: "isto não é url" },
      segredos: {},
      ativa: false,
      sem_teste: false,
      autorizar: false,
    });
    expect(semCampos.statusCode).toBe(400);
    expect(semCampos.json().erro.codigo).toBe("validacao");
  });

  it("sincronizar agora: confere a permissão, registra o pedido e chama o módulo sync", async () => {
    const r = await admin.pedir(
      "POST",
      `${ADMIN}/integracoes/secullum/sincronizacao`,
    );
    expect(r.statusCode).toBe(200);
    expect(r.json().mensagem).toBe("Sincronização de teste.");
    expect(sincronizarAgora).toHaveBeenCalledTimes(1);
    expect(sincronizarAgora).toHaveBeenCalledWith(
      expect.anything(),
      "secullum",
    );
  });

  it("volta do RD Station CRM sem o cookie da autorização: nada é gravado", async () => {
    const r = await app.inject({
      method: "GET",
      url: "/api/integracoes/rd-crm/retorno?code=abc&state=xyz",
    });
    expect(r.statusCode).toBe(302);
    expect(r.headers.location).toMatch(
      /\/admin\/integracoes\?rdcrm=state#rd_crm$/,
    );
  });
});
