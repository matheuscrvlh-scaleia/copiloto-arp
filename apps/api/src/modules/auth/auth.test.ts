import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { sql } from "kysely";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { criarApp } from "@/app";
import { COOKIE_ACESSO, COOKIE_RENOVACAO } from "@/http/sessao";
import { banco } from "@/infra/banco";
import { eventosPendentes } from "@/infra/eventos";
import { MODULOS } from "@/modules";
import { descreverComBanco, ipDeTeste, Navegador, TESTE } from "@/testes/apoio";

const AUTH = "/api/v1/auth";

// Rotas de mentira para conferir as travas que valem para os módulos.
const deTeste: FastifyPluginAsyncZod = async (app) => {
  app.get("/logado", { config: { acesso: "autenticado" } }, async () => ({
    ok: true,
  }));
  app.get("/admin", { config: { permissao: "admin.usuarios" } }, async () => ({
    ok: true,
  }));
};

/** Mexe direto na sessão, como se o tempo tivesse passado. */
const envelhecer = (sessaoId: string, campos: Record<string, string>) =>
  banco.comoServico((tx) =>
    tx
      .updateTable("auth.sessoes")
      .set(
        Object.fromEntries(
          Object.entries(campos).map(([campo, intervalo]) => [
            campo,
            sql`now() - ${intervalo}::interval`,
          ]),
        ),
      )
      .where("id", "=", sessaoId)
      .execute(),
  );

const sessaoDe = (n: Navegador) =>
  n.cookie(COOKIE_RENOVACAO)?.split(".")[0] ?? "";

descreverComBanco("acesso (/api/v1/auth)", () => {
  let app: FastifyInstance;

  /** Os dois usuários voltam ao ponto de partida: senha herdada em bcrypt. */
  async function restaurarUsuarios() {
    const hash = await bcrypt.hash(TESTE.senha, 10);
    await banco.comoServico(async (tx) => {
      const emails = [TESTE.email, TESTE.emailSemAcesso].map((e) =>
        e.toLowerCase(),
      );
      await tx
        .updateTable("auth.users")
        .set({
          encrypted_password: hash,
          banned_until: null,
          raw_app_meta_data: sql`raw_app_meta_data || '{"senha_provisoria": false}'::jsonb`,
        })
        .where(sql`lower(email)`, "in", emails)
        .execute();
      await tx
        .updateTable("core.usuarios")
        .set({ ativo: true })
        .where(sql`lower(email)`, "in", emails)
        .where("ativo", "=", false)
        .execute();
    });
  }

  const doSemAcesso = (campos: Record<string, unknown>) =>
    banco.comoServico((tx) =>
      tx
        .updateTable("auth.users")
        .set(campos)
        .where(sql`lower(email)`, "=", TESTE.emailSemAcesso.toLowerCase())
        .execute(),
    );

  async function entrar(email = TESTE.email, senha = TESTE.senha) {
    const n = new Navegador(app);
    const r = await n.pedir("POST", `${AUTH}/entrar`, { email, senha });
    return { n, r };
  }

  beforeAll(async () => {
    app = await criarApp([...MODULOS, { prefixo: "/teste", plugin: deTeste }]);
  });
  beforeEach(restaurarUsuarios);
  afterAll(async () => {
    await restaurarUsuarios();
    await eventosPendentes();
    await app.close();
    await banco.encerrar();
  });

  it("entra com a senha certa, grava os cookies e devolve quem é", async () => {
    const { n, r } = await entrar();
    expect(r.statusCode).toBe(200);
    const corpo = r.json();
    expect(corpo.usuario.email.toLowerCase()).toBe(TESTE.email.toLowerCase());
    expect(corpo.usuario.permissoes).toContain("admin.usuarios");
    expect(corpo.senha_provisoria).toBe(false);
    expect(
      new Date(corpo.sessao.expira_em).getTime() -
        new Date(corpo.sessao.inicio).getTime(),
    ).toBe(8 * 60 * 60 * 1000);

    const cookies = Object.fromEntries(r.cookies.map((c) => [c.name, c]));
    expect(cookies[COOKIE_ACESSO]).toMatchObject({
      httpOnly: true,
      sameSite: "Strict",
      path: "/",
    });
    expect(cookies[COOKIE_RENOVACAO]).toMatchObject({
      httpOnly: true,
      sameSite: "Strict",
      path: AUTH,
    });
    expect(r.body).not.toContain(n.cookie(COOKIE_RENOVACAO));

    const eu = await n.pedir("GET", `${AUTH}/eu`);
    expect(eu.statusCode).toBe(200);
    expect(eu.json().usuario).toEqual(corpo.usuario);
    expect(eu.headers["cache-control"]).toBe("no-store");
  });

  it("troca a senha herdada (bcrypt) por argon2id no primeiro login", async () => {
    expect((await entrar()).r.statusCode).toBe(200);
    const { hash } = await banco.comoServico((tx) =>
      tx
        .selectFrom("auth.users")
        .select("encrypted_password as hash")
        .where(sql`lower(email)`, "=", TESTE.email.toLowerCase())
        .executeTakeFirstOrThrow(),
    );
    expect(hash).toMatch(/^\$argon2id\$/);
    expect((await entrar()).r.statusCode).toBe(200);
  });

  it("senha errada e e-mail que não existe respondem igual", async () => {
    const errada = (await entrar(TESTE.email, "senha-errada")).r;
    const ninguem = (
      await entrar(`ninguem-${randomUUID()}@teste.invalid`, "senha-errada")
    ).r;
    expect(errada.statusCode).toBe(401);
    expect(ninguem.statusCode).toBe(401);
    expect(errada.json()).toEqual(ninguem.json());
    expect(errada.json().erro).toEqual({
      codigo: "nao_autenticado",
      mensagem: "E-mail ou senha incorretos.",
    });
    expect(errada.cookies).toEqual([]);
  });

  it("valida a entrada e diz o campo", async () => {
    const r = (await entrar("nao-e-email", "x")).r;
    expect(r.statusCode).toBe(400);
    expect(r.json().erro.codigo).toBe("validacao");
    expect(r.json().erro.campos).toHaveProperty("email");
  });

  it("bloqueia depois de muitas tentativas, sem revelar se o e-mail existe", async () => {
    // LOGIN_TENTATIVAS=3 nos testes (testes/preparar.ts).
    const email = `limite-${randomUUID()}@teste.invalid`;
    const n = new Navegador(app);
    const tentar = (nav: Navegador) =>
      nav.pedir("POST", `${AUTH}/entrar`, { email, senha: "errada" });
    for (let i = 0; i < 3; i++) expect((await tentar(n)).statusCode).toBe(401);
    const bloqueada = await tentar(n);
    expect(bloqueada.statusCode).toBe(429);
    expect(bloqueada.json().erro).toMatchObject({
      codigo: "limite",
      mensagem: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    });
    // De outro lugar a pessoa ainda consegue tentar (não dá para trancar
    // alguém de fora só errando a senha dela).
    expect((await tentar(new Navegador(app))).statusCode).toBe(401);
  });

  it("usuário inativo ou bloqueado não entra, com a mesma mensagem", async () => {
    await doSemAcesso({ banned_until: sql`now() + interval '1 day'` });
    const bloqueado = (await entrar(TESTE.emailSemAcesso)).r;
    expect(bloqueado.statusCode).toBe(401);
    expect(bloqueado.json().erro.mensagem).toBe("E-mail ou senha incorretos.");
    await doSemAcesso({ banned_until: null });

    const { n, r } = await entrar(TESTE.emailSemAcesso);
    expect(r.statusCode).toBe(200);
    expect(r.json().usuario.permissoes).toEqual([]);
    // Desativado com a sessão aberta: cai na requisição seguinte.
    await banco.comoServico((tx) =>
      tx
        .updateTable("core.usuarios")
        .set({ ativo: false })
        .where(sql`lower(email)`, "=", TESTE.emailSemAcesso.toLowerCase())
        .execute(),
    );
    expect((await n.pedir("GET", `${AUTH}/eu`)).statusCode).toBe(401);
    expect((await entrar(TESTE.emailSemAcesso)).r.statusCode).toBe(401);
  });

  it("sem sessão: 401; com sessão e sem a permissão: 403", async () => {
    const visitante = new Navegador(app);
    expect((await visitante.pedir("GET", `${AUTH}/eu`)).statusCode).toBe(401);
    expect(
      (await visitante.pedir("GET", "/api/v1/teste/admin")).statusCode,
    ).toBe(401);

    const { n } = await entrar(TESTE.emailSemAcesso);
    expect((await n.pedir("GET", "/api/v1/teste/logado")).statusCode).toBe(200);
    const negado = await n.pedir("GET", "/api/v1/teste/admin");
    expect(negado.statusCode).toBe(403);
    expect(negado.json().erro.codigo).toBe("sem_permissao");

    const admin = (await entrar()).n;
    expect((await admin.pedir("GET", "/api/v1/teste/admin")).statusCode).toBe(
      200,
    );
  });

  it("cookie de acesso adulterado não vale", async () => {
    const { n } = await entrar();
    const jwt = n.cookie(COOKIE_ACESSO) ?? "";
    n.definirCookie(COOKIE_ACESSO, `${jwt.slice(0, -2)}xx`);
    expect((await n.pedir("GET", `${AUTH}/eu`)).statusCode).toBe(401);
  });

  it("gravação exige X-ARP e a origem do próprio site", async () => {
    const corpo = { email: TESTE.email, senha: TESTE.senha };
    const pedir = (headers: Record<string, string>) =>
      app.inject({
        method: "POST",
        url: `${AUTH}/entrar`,
        headers: { "x-forwarded-for": ipDeTeste(), ...headers },
        payload: corpo,
      });
    const origem = new URL(process.env.SITE_URL ?? "").origin;
    const incompletos: Record<string, string>[] = [
      {},
      { origin: origem },
      { "x-arp": "1" },
      { origin: "https://outro.example", "x-arp": "1" },
    ];
    for (const headers of incompletos) {
      const r = await pedir(headers);
      expect(r.statusCode).toBe(403);
      expect(r.cookies).toEqual([]);
    }
    expect((await pedir({ origin: origem, "x-arp": "1" })).statusCode).toBe(
      200,
    );
  });

  it("renovar troca o token; o antigo, reusado, encerra a sessão", async () => {
    const { n } = await entrar();
    const antigo = n.cookie(COOKIE_RENOVACAO) ?? "";

    const renovada = await n.pedir("POST", `${AUTH}/renovar`);
    expect(renovada.statusCode).toBe(200);
    const novo = n.cookie(COOKIE_RENOVACAO) ?? "";
    expect(novo).not.toBe(antigo);
    expect((await n.pedir("GET", `${AUTH}/eu`)).statusCode).toBe(200);

    // Outra aba, na mesma hora, ainda com o token antigo: recebe um acesso
    // novo, mas nenhum token de renovação.
    const outraAba = new Navegador(app);
    outraAba.definirCookie(COOKIE_RENOVACAO, antigo, AUTH);
    const junto = await outraAba.pedir("POST", `${AUTH}/renovar`);
    expect(junto.statusCode).toBe(200);
    expect(junto.cookies.map((c) => c.name)).toEqual([COOKIE_ACESSO]);

    // Passada a folga, o token antigo é reuso: a sessão inteira cai.
    const sessao = sessaoDe(n);
    await envelhecer(sessao, { renovada_em: "1 minute" });
    const ladrao = new Navegador(app);
    ladrao.definirCookie(COOKIE_RENOVACAO, antigo, AUTH);
    expect((await ladrao.pedir("POST", `${AUTH}/renovar`)).statusCode).toBe(
      401,
    );
    expect((await n.pedir("GET", `${AUTH}/eu`)).statusCode).toBe(401);
    expect((await n.pedir("POST", `${AUTH}/renovar`)).statusCode).toBe(401);
    expect(n.cookie(COOKIE_RENOVACAO)).toBeUndefined();

    // O reuso fica no Histórico (core.logs), uma vez, sem o token.
    await eventosPendentes();
    const registros = await banco.comoServico((tx) =>
      tx
        .selectFrom("core.logs")
        .select(["modulo", "detalhes"])
        .where("evento", "=", "sessao_reusada")
        .where(sql<boolean>`detalhes->>'sessao' = ${sessao}`)
        .execute(),
    );
    expect(registros).toHaveLength(1);
    expect(registros[0]?.modulo).toBe("acesso");
    expect(JSON.stringify(registros[0]?.detalhes)).not.toContain(antigo);
  });

  it("renovar sem token, ou com token inventado, não vale", async () => {
    const n = new Navegador(app);
    expect((await n.pedir("POST", `${AUTH}/renovar`)).statusCode).toBe(401);
    const { n: logado } = await entrar();
    n.definirCookie(
      COOKIE_RENOVACAO,
      `${sessaoDe(logado)}.${"a".repeat(43)}`,
      AUTH,
    );
    expect((await n.pedir("POST", `${AUTH}/renovar`)).statusCode).toBe(401);
  });

  it("30 min sem uso encerra a sessão; o aviso de uso adia", async () => {
    const { n } = await entrar();
    await envelhecer(sessaoDe(n), { ultimo_uso: "29 minutes" });
    const antes = (await n.pedir("GET", `${AUTH}/eu`)).json().sessao;
    const uso = await n.pedir("POST", `${AUTH}/uso`);
    expect(uso.statusCode).toBe(200);
    expect(
      new Date(uso.json().sessao.inatividade_em).getTime(),
    ).toBeGreaterThan(new Date(antes.inatividade_em).getTime());

    await envelhecer(sessaoDe(n), { ultimo_uso: "31 minutes" });
    const parada = await n.pedir("GET", `${AUTH}/eu`);
    expect(parada.statusCode).toBe(401);
    expect(parada.json().erro.mensagem).toMatch(/expirou/);
    expect((await n.pedir("POST", `${AUTH}/renovar`)).statusCode).toBe(401);
  });

  it("8 h depois de entrar a sessão acaba, mesmo em uso", async () => {
    const { n } = await entrar();
    await envelhecer(sessaoDe(n), { criada_em: "8 hours 1 minute" });
    expect((await n.pedir("POST", `${AUTH}/renovar`)).statusCode).toBe(401);
    expect((await n.pedir("GET", `${AUTH}/eu`)).statusCode).toBe(401);
  });

  it("senha provisória: só deixa ver quem é, trocar a senha e sair", async () => {
    await doSemAcesso({
      raw_app_meta_data: sql`raw_app_meta_data || '{"senha_provisoria": true}'::jsonb`,
    });
    const { n, r } = await entrar(TESTE.emailSemAcesso);
    expect(r.json().senha_provisoria).toBe(true);
    const outraSessao = (await entrar(TESTE.emailSemAcesso)).n;

    const barrada = await n.pedir("GET", "/api/v1/teste/logado");
    expect(barrada.statusCode).toBe(403);
    expect(barrada.json().erro.codigo).toBe("senha_provisoria");
    expect((await n.pedir("GET", `${AUTH}/eu`)).statusCode).toBe(200);

    const trocar = (senha: string, confirmacao = senha) =>
      n.pedir("POST", `${AUTH}/trocar-senha`, { senha, confirmacao });
    expect((await trocar("curta")).statusCode).toBe(400);
    const diferente = await trocar("uma-senha-nova-123", "outra-coisa-456");
    expect(diferente.json().erro.campos.confirmacao).toBe(
      "As senhas não conferem.",
    );
    const repetida = await trocar(TESTE.senha);
    expect(repetida.statusCode).toBe(422);
    expect(repetida.json().erro.mensagem).toBe(
      "Use uma senha diferente da provisória.",
    );

    const nova = `nova-${randomUUID()}`;
    expect((await trocar(nova)).statusCode).toBe(200);
    expect((await n.pedir("GET", `${AUTH}/eu`)).json().senha_provisoria).toBe(
      false,
    );
    expect((await n.pedir("GET", "/api/v1/teste/logado")).statusCode).toBe(200);
    // As outras sessões da pessoa caem; a senha antiga não entra mais.
    expect((await outraSessao.pedir("GET", `${AUTH}/eu`)).statusCode).toBe(401);
    expect((await entrar(TESTE.emailSemAcesso)).r.statusCode).toBe(401);
    expect((await entrar(TESTE.emailSemAcesso, nova)).r.statusCode).toBe(200);
    // Já definida: trocar de novo por aqui não vale.
    expect((await trocar(`outra-${randomUUID()}`)).statusCode).toBe(422);
  });

  it("sair encerra a sessão no servidor e limpa os cookies", async () => {
    const { n } = await entrar();
    const acesso = n.cookie(COOKIE_ACESSO) ?? "";
    const saiu = await n.pedir("POST", `${AUTH}/sair`);
    expect(saiu.statusCode).toBe(200);
    expect(n.cookie(COOKIE_ACESSO)).toBeUndefined();
    expect(n.cookie(COOKIE_RENOVACAO)).toBeUndefined();

    // O JWT ainda está no prazo, mas a sessão dele acabou.
    const comJwtAntigo = new Navegador(app);
    comJwtAntigo.definirCookie(COOKIE_ACESSO, acesso);
    expect((await comJwtAntigo.pedir("GET", `${AUTH}/eu`)).statusCode).toBe(
      401,
    );
    // Sair sem sessão também responde bem.
    expect(
      (await new Navegador(app).pedir("POST", `${AUTH}/sair`)).statusCode,
    ).toBe(200);
  });

  it("registra os acessos em core.logs", async () => {
    const { n } = await entrar();
    await n.pedir("POST", `${AUTH}/sair`);
    await eventosPendentes();
    const eventos = await banco.comoServico((tx) =>
      tx
        .selectFrom("core.logs as l")
        .innerJoin("core.usuarios as u", "u.id", "l.usuario_id")
        .select("l.evento")
        .where(sql`lower(u.email)`, "=", TESTE.email.toLowerCase())
        .where("l.modulo", "=", "acesso")
        .where("l.em", ">", sql<string>`now() - interval '1 minute'`)
        .execute(),
    );
    expect(eventos.map((e) => e.evento)).toEqual(
      expect.arrayContaining(["login", "logout"]),
    );
  });
});
