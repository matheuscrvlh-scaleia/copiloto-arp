import { randomInt } from "node:crypto";
import { digitosCnpj, documentoValido } from "@arp/shared/documentos";
import { LIMITES_PORTAL } from "@arp/shared/os/portal";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp } from "@/app";
import { env } from "@/config/env";
import type { Contexto } from "@/contexto";
import { ErroDePermissao } from "@/erros";
import { COOKIE_ACESSO } from "@/http/sessao";
import { banco } from "@/infra/banco";
import { eventosPendentes } from "@/infra/eventos";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";
import { avisosPendentes } from "./base.service";
import { ACOES_DO_MODELO } from "./modelos.service";
import { exportarLinks, exportarLojas } from "./portal.service";
import {
  CAMINHO_DO_PORTAL,
  COOKIE_DO_PORTAL,
  hashDoToken,
  tokenDoCookie,
  valorDoCookie,
} from "./portal-cookie";
import { SEM_SESSAO } from "./portal-publico.service";

// Portal do lojista: a sessão própria da loja (entrada pelo CNPJ, limite de
// tentativas, cookie assinado, encerramento na hora, isolamento entre lojas)
// e a tela interna (permissões e leituras). As lojas e o pedido de teste são
// criados aqui e apagados no fim.

const PUBLICO = "/api/v1/os/portal-publico";
const INTERNO = "/api/v1/os/portal";
const NADA = "00000000-0000-4000-8000-000000000000";
const LONGO = 240_000;

function cnpjDeTeste(): string {
  for (;;) {
    const base = `${randomInt(10_000_000, 99_999_999)}0001`;
    const cnpj = `${base}${digitosCnpj(base)}`;
    if (documentoValido(cnpj)) return cnpj;
  }
}

describe("portal: cookie da sessão da loja", () => {
  const token = "a".repeat(40);

  it("aceita só o valor que ele mesmo assinou", () => {
    const valor = valorDoCookie(token);
    expect(tokenDoCookie(valor)).toBe(token);
    expect(valor.startsWith(`${token}.`)).toBe(true);
  });

  it("recusa token trocado, assinatura trocada e valor sem assinatura", () => {
    const [, assinatura = ""] = valorDoCookie(token).split(".");
    expect(tokenDoCookie(`${"b".repeat(40)}.${assinatura}`)).toBeNull();
    expect(tokenDoCookie(`${token}.${assinatura.slice(0, -2)}xx`)).toBeNull();
    expect(tokenDoCookie(`${token}.`)).toBeNull();
    expect(tokenDoCookie(token)).toBeNull();
    expect(tokenDoCookie(undefined)).toBeNull();
    expect(tokenDoCookie("")).toBeNull();
    expect(tokenDoCookie(`${valorDoCookie(token)}.mais`)).toBeNull();
  });

  it("recusa um JWT (o formato da sessão dos usuários)", () => {
    expect(
      tokenDoCookie(
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4Iiwic2lkIjoieSJ9.c2lnbmF0dXJlLXF1YWxxdWVyLWFxdWk",
      ),
    ).toBeNull();
  });

  it("guarda no banco só o hash do token", () => {
    expect(hashDoToken(token)).not.toContain(token);
    expect(hashDoToken(token)).toHaveLength(43);
  });
});

describe("portal: tela interna sem ir ao banco", () => {
  const semExportar: Contexto = {
    ip: "198.18.0.1",
    agente: null,
    requisicaoId: "teste",
    usuario: { id: NADA, nome: "Teste", email: "teste@example.com" },
    permissoes: new Set(["os.portal"]),
    senhaProvisoria: false,
    sessao: {
      id: NADA,
      inicio: new Date(),
      ultimoUso: new Date(),
      acessoExpiraEm: new Date(),
    },
  };

  it("exportar exige os.exportar além de os.portal", () => {
    expect(() => exportarLinks(semExportar, {})).toThrow(
      "Sem permissão para exportar.",
    );
    return expect(exportarLojas(semExportar, {})).rejects.toBeInstanceOf(
      ErroDePermissao,
    );
  });

  it("registra as ações dos modelos de entrada e saída", () => {
    expect(ACOES_DO_MODELO.portal_gerar).toBeTypeOf("function");
    expect(ACOES_DO_MODELO.portal_cancelar).toBeTypeOf("function");
  });
});

descreverComBanco("portal do lojista", () => {
  let app: FastifyInstance;
  const cnpjA = cnpjDeTeste();
  const cnpjB = cnpjDeTeste();
  let lojaA = "";
  let lojaB = "";
  let pedidoB = "";
  const ips: string[] = [];

  /** Navegador de uma loja, já dentro do portal. */
  async function entrarComo(cnpj: string): Promise<Navegador> {
    const n = new Navegador(app);
    ips.push(n.ip);
    const r = await n.pedir("POST", `${PUBLICO}/entrar`, { cnpj });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ entrou: true });
    return n;
  }

  async function entrarComoAdmin(): Promise<Navegador> {
    const n = new Navegador(app);
    const r = await n.pedir("POST", "/api/v1/auth/entrar", {
      email: TESTE.email,
      senha: TESTE.senha,
    });
    expect(r.statusCode).toBe(200);
    return n;
  }

  const lojaDoInicio = async (n: Navegador) =>
    (await n.pedir("GET", `${PUBLICO}/inicio`)).json().loja;

  const quem = { nome: "Pessoa de teste", telefone: "(22) 99999-0000" };

  beforeAll(async () => {
    app = await criarApp();
    await banco.comoServico(async (tx) => {
      const sufixo = randomInt(1000, 9999);
      const criar = (letra: string, cnpj: string) =>
        tx
          .insertInto("os.lojas")
          .values({
            luc: `TESTE-${letra}${sufixo}`,
            nome: `Loja de teste do portal ${letra}`,
            cnpj,
            situacao: "vigente",
          })
          .returning("id")
          .executeTakeFirstOrThrow();
      lojaA = (await criar("A", cnpjA)).id;
      lojaB = (await criar("B", cnpjB)).id;
      const setor = await tx
        .selectFrom("os.setores")
        .select("id")
        .where("ativo", "=", true)
        .limit(1)
        .executeTakeFirstOrThrow();
      pedidoB = (
        await tx
          .insertInto("os.chamados")
          .values({
            titulo: "Pedido de teste do portal (loja B)",
            setor_id: setor.id,
            origem: "portal",
            tipo: "solicitacao",
            loja_id: lojaB,
            status: "concluido",
          })
          .returning("id")
          .executeTakeFirstOrThrow()
      ).id;
    });
  }, LONGO);

  afterAll(async () => {
    await avisosPendentes();
    await eventosPendentes();
    await banco.comoServico(async (tx) => {
      if (pedidoB) {
        await tx
          .deleteFrom("os.notificacoes")
          .where("chamado_id", "=", pedidoB)
          .execute();
        await tx
          .deleteFrom("os.eventos")
          .where("chamado_id", "=", pedidoB)
          .execute();
        await tx.deleteFrom("os.chamados").where("id", "=", pedidoB).execute();
      }
      const lojas = [lojaA, lojaB].filter(Boolean);
      if (lojas.length) {
        await tx
          .deleteFrom("os.portal_sessoes")
          .where("loja_id", "in", lojas)
          .execute();
        await tx.deleteFrom("os.lojas").where("id", "in", lojas).execute();
      }
      if (ips.length)
        await tx
          .deleteFrom("os.portal_tentativas")
          .where("ip", "in", ips)
          .execute();
    });
    await app.close();
    await banco.encerrar();
  }, LONGO);

  // -------------------------------------------------------------------------
  // Entrada pelo CNPJ
  // -------------------------------------------------------------------------

  it("sem sessão, o início só diz que não há loja", async () => {
    const n = new Navegador(app);
    const r = await n.pedir("GET", `${PUBLICO}/inicio`);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({
      loja: null,
      boasVindas: null,
      categorias: [],
      pedidos: [],
      documentos: [],
    });
  });

  it("documento malformado ou sem loja não entra e não ganha cookie", async () => {
    const n = new Navegador(app);
    ips.push(n.ip);
    const curto = await n.pedir("POST", `${PUBLICO}/entrar`, { cnpj: "123" });
    expect(curto.statusCode).toBe(422);
    expect(curto.json().erro.mensagem).toBe(
      "Informe o CPF (11 dígitos) ou o CNPJ (14 dígitos).",
    );
    const invalido = await n.pedir("POST", `${PUBLICO}/entrar`, {
      cnpj: "11111111111112",
    });
    expect(invalido.json().erro.mensagem).toBe(
      "CPF ou CNPJ inválido. Confira os números.",
    );
    const semLoja = await n.pedir("POST", `${PUBLICO}/entrar`, {
      cnpj: cnpjDeTeste(),
    });
    expect(semLoja.statusCode).toBe(422);
    expect(semLoja.json().erro.mensagem).toContain(
      "Nenhuma loja com contrato vigente",
    );
    expect(n.cookie(COOKIE_DO_PORTAL)).toBeUndefined();
    expect(await lojaDoInicio(n)).toBeNull();
  });

  it(
    "muitas tentativas erradas do mesmo IP bloqueiam até o documento certo",
    async () => {
      const n = new Navegador(app);
      ips.push(n.ip);
      for (let i = 0; i < LIMITES_PORTAL.tentativas; i++) {
        const r = await n.pedir("POST", `${PUBLICO}/entrar`, {
          cnpj: cnpjDeTeste(),
        });
        expect(r.statusCode).toBe(422);
      }
      const bloqueado = await n.pedir("POST", `${PUBLICO}/entrar`, {
        cnpj: cnpjA,
      });
      expect(bloqueado.statusCode).toBe(429);
      expect(bloqueado.json().erro.mensagem).toBe(
        "Muitas tentativas com documento errado. Espere alguns minutos e tente de novo.",
      );
      expect(n.cookie(COOKIE_DO_PORTAL)).toBeUndefined();
      // Outro IP não é afetado.
      await entrarComo(cnpjA);
    },
    LONGO,
  );

  it("entra com o CNPJ e recebe o cookie próprio do portal", async () => {
    const n = new Navegador(app);
    ips.push(n.ip);
    const r = await n.pedir("POST", `${PUBLICO}/entrar`, {
      cnpj: `${cnpjA.slice(0, 2)}.${cnpjA.slice(2, 5)}.${cnpjA.slice(5, 8)}/${cnpjA.slice(8, 12)}-${cnpjA.slice(12)}`,
    });
    expect(r.statusCode).toBe(200);
    const cookie = r.cookies.find((c) => c.name === COOKIE_DO_PORTAL);
    expect(cookie).toMatchObject({
      httpOnly: true,
      sameSite: "Lax",
      path: CAMINHO_DO_PORTAL,
    });
    expect(cookie?.secure ?? false).toBe(env.COOKIES_SEGUROS);
    expect(r.cookies.some((c) => c.name === COOKIE_ACESSO)).toBe(false);

    expect(await lojaDoInicio(n)).toMatchObject({ id: lojaA });

    // No banco fica o hash, nunca o token do cookie.
    const token = tokenDoCookie(n.cookie(COOKIE_DO_PORTAL)) ?? "";
    const linhas = await banco.comoServico((tx) =>
      tx
        .selectFrom("os.portal_sessoes")
        .select("token")
        .where("loja_id", "=", lojaA)
        .execute(),
    );
    expect(linhas.some((l) => l.token === hashDoToken(token))).toBe(true);
    expect(linhas.some((l) => l.token === token)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Cookie adulterado e separação das sessões
  // -------------------------------------------------------------------------

  it("cookie adulterado não abre o portal", async () => {
    const n = await entrarComo(cnpjA);
    const valor = n.cookie(COOKIE_DO_PORTAL) ?? "";
    const [token = "", assinatura = ""] = valor.split(".");
    const tentar = async (adulterado: string) => {
      const outro = new Navegador(app);
      outro.definirCookie(COOKIE_DO_PORTAL, adulterado, CAMINHO_DO_PORTAL);
      expect(await lojaDoInicio(outro)).toBeNull();
      const r = await outro.pedir(
        "POST",
        `${PUBLICO}/pedidos/${NADA}/avaliacao`,
        {
          ...quem,
          nota: 5,
          comentario: "",
        },
      );
      expect(r.statusCode).toBe(422);
      expect(r.json().erro.mensagem).toBe(SEM_SESSAO);
    };
    const trocado = `${token.startsWith("A") ? "B" : "A"}${token.slice(1)}`;
    await tentar(`${trocado}.${assinatura}`);
    await tentar(
      `${token}.${assinatura.slice(0, -1)}${assinatura.endsWith("A") ? "B" : "A"}`,
    );
    await tentar(token);
    // Assinado certo, mas de sessão que não existe.
    await tentar(valorDoCookie("z".repeat(40)));
    // O cookie verdadeiro continua valendo.
    expect(await lojaDoInicio(n)).toMatchObject({ id: lojaA });
  });

  it(
    "o cookie do portal não vale como usuário, nem o do usuário como loja",
    async () => {
      const loja = await entrarComo(cnpjA);
      const admin = await entrarComoAdmin();

      // Cookie do portal no lugar do cookie de acesso do sistema.
      const falso = new Navegador(app);
      falso.definirCookie(COOKIE_ACESSO, loja.cookie(COOKIE_DO_PORTAL) ?? "");
      expect((await falso.pedir("GET", `${INTERNO}/links`)).statusCode).toBe(
        401,
      );
      expect((await falso.pedir("GET", "/api/v1/auth/eu")).statusCode).toBe(
        401,
      );
      // Só com o cookie do portal (no caminho dele), a tela interna não abre.
      expect((await loja.pedir("GET", `${INTERNO}/links`)).statusCode).toBe(
        401,
      );

      // Usuário logado, sem cookie do portal: não é loja nenhuma.
      expect(await lojaDoInicio(admin)).toBeNull();
      // O JWT do usuário no cookie do portal também não.
      const invertido = new Navegador(app);
      invertido.definirCookie(
        COOKIE_DO_PORTAL,
        admin.cookie(COOKIE_ACESSO) ?? "",
        CAMINHO_DO_PORTAL,
      );
      expect(await lojaDoInicio(invertido)).toBeNull();
    },
    LONGO,
  );

  // -------------------------------------------------------------------------
  // Isolamento entre lojas
  // -------------------------------------------------------------------------

  it("uma loja não lê nem mexe no pedido de outra", async () => {
    const a = await entrarComo(cnpjA);
    const b = await entrarComo(cnpjB);

    const daDona = await b.pedir("GET", `${PUBLICO}/pedidos/${pedidoB}`);
    expect(daDona.json().detalhe.pedido.id).toBe(pedidoB);

    const deOutra = await a.pedir("GET", `${PUBLICO}/pedidos/${pedidoB}`);
    expect(deOutra.statusCode).toBe(200);
    expect(deOutra.json()).toMatchObject({
      loja: { id: lojaA },
      detalhe: null,
    });
    const inicio = (await a.pedir("GET", `${PUBLICO}/inicio`)).json();
    expect(inicio.pedidos).toEqual([]);

    for (const [caminho, corpo] of [
      ["avaliacao", { nota: 1, comentario: "" }],
      ["reabertura", { motivo: "não é meu" }],
      [
        "remarcacao",
        { agendamento: NADA, horario: "2030-01-01T10:00:00.000Z" },
      ],
    ] as const) {
      const r = await a.pedir(
        "POST",
        `${PUBLICO}/pedidos/${pedidoB}/${caminho}`,
        { ...quem, ...corpo },
      );
      expect(r.statusCode).toBe(422);
      expect(r.json().erro.mensagem).toBe("Pedido não encontrado.");
    }
    const intacto = await banco.comoServico((tx) =>
      tx
        .selectFrom("os.chamados")
        .select(["status", "avaliacao"])
        .where("id", "=", pedidoB)
        .executeTakeFirstOrThrow(),
    );
    expect(intacto).toEqual({ status: "concluido", avaliacao: null });
  });

  it("a dona avalia o próprio pedido (e ele fecha)", async () => {
    const b = await entrarComo(cnpjB);
    const semNome = await b.pedir(
      "POST",
      `${PUBLICO}/pedidos/${pedidoB}/avaliacao`,
      { nome: "", telefone: quem.telefone, nota: 5, comentario: "" },
    );
    expect(semNome.statusCode).toBe(400);
    expect(semNome.json().erro.campos.nome).toBe("Informe o seu nome.");

    const r = await b.pedir("POST", `${PUBLICO}/pedidos/${pedidoB}/avaliacao`, {
      ...quem,
      nota: 4,
      comentario: "teste",
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().mensagem).toBe("Obrigado pela avaliação!");
    const depois = (
      await b.pedir("GET", `${PUBLICO}/pedidos/${pedidoB}`)
    ).json();
    expect(depois.detalhe.pedido).toMatchObject({
      status: "fechado",
      avaliacao: 4,
    });
    const deNovo = await b.pedir(
      "POST",
      `${PUBLICO}/pedidos/${pedidoB}/avaliacao`,
      { ...quem, nota: 5, comentario: "" },
    );
    expect(deNovo.json().erro.mensagem).toBe("Este pedido já foi avaliado.");
  });

  // -------------------------------------------------------------------------
  // Encerrar o acesso
  // -------------------------------------------------------------------------

  it(
    "encerrar o acesso na tela interna derruba a loja na hora",
    async () => {
      const a = await entrarComo(cnpjA);
      const b = await entrarComo(cnpjB);
      const admin = await entrarComoAdmin();

      const links = await admin.pedir("GET", `${INTERNO}/links?q=TESTE-A`);
      expect(links.statusCode).toBe(200);
      const linha = links
        .json()
        .linhas.find((l: { loja: { id: string } }) => l.loja.id === lojaA);
      expect(linha.acesso.dentro).toBe(true);

      const r = await admin.pedir("POST", `${INTERNO}/acessos/encerrar`, {
        loja: lojaA,
      });
      expect(r.statusCode).toBe(200);
      expect(r.json().mensagem).toContain("Acesso encerrado.");

      expect(await lojaDoInicio(a)).toBeNull();
      const leitura = (
        await a.pedir("GET", `${PUBLICO}/pedidos/${pedidoB}`)
      ).json();
      expect(leitura).toEqual({ loja: null, detalhe: null, remarcar: {} });
      const gravacao = await a.pedir(
        "POST",
        `${PUBLICO}/pedidos/${NADA}/reabertura`,
        { ...quem, motivo: "teste" },
      );
      expect(gravacao.statusCode).toBe(422);
      expect(gravacao.json().erro.mensagem).toBe(SEM_SESSAO);
      // A outra loja continua dentro.
      expect(await lojaDoInicio(b)).toMatchObject({ id: lojaB });

      const deNovo = await admin.pedir("POST", `${INTERNO}/acessos/encerrar`, {
        loja: lojaA,
      });
      expect(deNovo.json().mensagem).toBe(
        "A loja não estava dentro do portal.",
      );
    },
    LONGO,
  );

  it("trocar de loja encerra a sessão e apaga o cookie", async () => {
    const b = await entrarComo(cnpjB);
    const valor = b.cookie(COOKIE_DO_PORTAL) ?? "";
    const r = await b.pedir("POST", `${PUBLICO}/sair`);
    expect(r.statusCode).toBe(200);
    expect(b.cookie(COOKIE_DO_PORTAL)).toBeUndefined();
    // O valor antigo, guardado por alguém, não volta a valer.
    const antigo = new Navegador(app);
    antigo.definirCookie(COOKIE_DO_PORTAL, valor, CAMINHO_DO_PORTAL);
    expect(await lojaDoInicio(antigo)).toBeNull();
  });

  it("contrato encerrado derruba a loja e não deixa entrar de novo", async () => {
    const b = await entrarComo(cnpjB);
    await banco.comoServico((tx) =>
      tx
        .updateTable("os.lojas")
        .set({ situacao: "encerrado" })
        .where("id", "=", lojaB)
        .execute(),
    );
    expect(await lojaDoInicio(b)).toBeNull();
    const n = new Navegador(app);
    ips.push(n.ip);
    const r = await n.pedir("POST", `${PUBLICO}/entrar`, { cnpj: cnpjB });
    expect(r.statusCode).toBe(422);
  });

  // -------------------------------------------------------------------------
  // Tela interna
  // -------------------------------------------------------------------------

  it(
    "sem permissão, a tela interna responde 403; sem sessão, 401",
    async () => {
      const n = new Navegador(app);
      expect((await n.pedir("GET", `${INTERNO}/links`)).statusCode).toBe(401);
      await n.pedir("POST", "/api/v1/auth/entrar", {
        email: TESTE.emailSemAcesso,
        senha: TESTE.senha,
      });
      for (const caminho of [
        "/links",
        "/links/exportacao",
        "/lojas",
        "/lojas/exportacao",
        `/lojas/${lojaA}`,
        "/agendas",
        `/agendas/${NADA}`,
      ])
        expect(
          (await n.pedir("GET", `${INTERNO}${caminho}`)).statusCode,
          caminho,
        ).toBe(403);
      for (const [metodo, caminho, corpo] of [
        ["POST", "/acessos/encerrar", { loja: lojaA }],
        ["POST", "/lojas", { luc: "X", nome: "Xis", situacao: "vigente" }],
        ["POST", "/agendas", {}],
        ["POST", "/bloqueios", {}],
        ["DELETE", `/bloqueios/${NADA}`, undefined],
        ["POST", `/agendamentos/${NADA}/remarcacao`, {}],
        ["POST", `/agendamentos/${NADA}/cancelamento`, {}],
      ] as const)
        expect(
          (await n.pedir(metodo, `${INTERNO}${caminho}`, corpo)).statusCode,
          caminho,
        ).toBe(403);
    },
    LONGO,
  );

  it(
    "o administrador lê as telas e salva uma loja",
    async () => {
      const admin = await entrarComoAdmin();
      for (const caminho of [
        "/links",
        "/links?f=sem_cnpj",
        "/links?f=pedidos",
        "/links?f=avaliadas",
        "/links?f=entraram&q=teste",
        "/links/exportacao?q=TESTE-A",
        "/lojas",
        "/lojas?s=todas&q=TESTE-",
        "/lojas/exportacao?s=todas&q=TESTE-",
        "/agendas",
      ])
        expect(
          (await admin.pedir("GET", `${INTERNO}${caminho}`)).statusCode,
          caminho,
        ).toBe(200);

      const loja = (
        await admin.pedir("GET", `${INTERNO}/lojas/${lojaA}`)
      ).json().loja;
      expect(loja).toMatchObject({ id: lojaA, cnpj: cnpjA });
      expect(
        (await admin.pedir("GET", `${INTERNO}/lojas/nao-e-uuid`)).json(),
      ).toEqual({ loja: null });
      expect(
        (await admin.pedir("GET", `${INTERNO}/agendas/${NADA}`)).json(),
      ).toEqual({ agenda: null });

      const invalida = await admin.pedir("POST", `${INTERNO}/lojas`, {
        id: lojaA,
        luc: loja.luc,
        nome: "",
        situacao: "vigente",
      });
      expect(invalida.statusCode).toBe(400);
      expect(invalida.json().erro.campos.nome).toBe(
        "Nome da loja: informe o nome",
      );

      const salva = await admin.pedir("POST", `${INTERNO}/lojas`, {
        id: lojaA,
        luc: loja.luc,
        nome: loja.nome,
        cnpj: cnpjA,
        situacao: "vigente",
        bloco: "T",
        telefone: "",
        tem_vaga: "sim",
      });
      expect(salva.statusCode).toBe(200);
      expect(salva.json()).toEqual({ mensagem: "Loja salva.", criado: false });
      const lida = (
        await admin.pedir("GET", `${INTERNO}/lojas/${lojaA}`)
      ).json().loja;
      expect(lida).toMatchObject({ bloco: "T", tem_vaga: true });

      const semHorario = await admin.pedir("POST", `${INTERNO}/bloqueios`, {
        agenda: NADA,
        data_inicio: "2030-01-10",
        motivo: "Chuva",
      });
      expect(semHorario.statusCode).toBe(422);
      expect(semHorario.json().erro.mensagem).toBe(
        "Informe o horário do bloqueio ou marque o dia inteiro.",
      );
      const cancelado = await admin.pedir(
        "POST",
        `${INTERNO}/agendamentos/${NADA}/cancelamento`,
        {},
      );
      expect(cancelado.json().erro.mensagem).toBe(
        "Este horário já foi cancelado.",
      );
    },
    LONGO,
  );
});
