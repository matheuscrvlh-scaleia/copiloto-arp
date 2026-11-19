import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, expect, it } from "vitest";
import { criarApp } from "@/app";
import { env } from "@/config/env";
import { banco } from "@/infra/banco";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";

// Formulários de ponta a ponta na homologação: quem não tem acesso recebe
// 403; o administrador cria um formulário de teste, publica, responde pelo
// link público (com um arquivo), lê as respostas e apaga tudo no fim.

const REL = "/api/v1/relatorios";
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4,
]);

/** Corpo multipart com o campo da pergunta e um arquivo. */
function multipart(campo: string, nome: string, bytes: Buffer) {
  const limite = `----teste${randomUUID()}`;
  const corpo = Buffer.concat([
    Buffer.from(
      `--${limite}\r\nContent-Disposition: form-data; name="campo"\r\n\r\n${campo}\r\n` +
        `--${limite}\r\nContent-Disposition: form-data; name="arquivo"; filename="${nome}"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${limite}--\r\n`),
  ]);
  return { corpo, tipo: `multipart/form-data; boundary=${limite}` };
}

descreverComBanco("formulários (/api/v1/relatorios)", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  let visitante: Navegador;
  const criados: string[] = [];

  beforeAll(async () => {
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
    // Rede de segurança: só o que este teste criou (respostas em cascata).
    if (criados.length)
      await banco.comoServico((tx) =>
        tx
          .deleteFrom("formularios.formularios")
          .where("id", "in", criados)
          .execute(),
      );
    await app.close();
    await banco.encerrar();
    await fs.rm(env.ARQUIVOS_DIR, { recursive: true, force: true });
  });

  it("sem acesso: 403 em leitura e gravação", async () => {
    const id = randomUUID();
    for (const url of [
      REL,
      `${REL}/${id}`,
      `${REL}/${id}/respostas`,
      `${REL}/${id}/arquivo?caminho=x&nome=y`,
    ])
      expect((await semAcesso.pedir("GET", url)).statusCode).toBe(403);
    const novo = await semAcesso.pedir("POST", REL, { modelo: "branco" });
    expect(novo.statusCode).toBe(403);
    expect(novo.json().erro.mensagem).toBe(
      "Você não tem permissão para editar formulários.",
    );
    expect((await semAcesso.pedir("DELETE", `${REL}/${id}`)).statusCode).toBe(
      403,
    );
  });

  it("link inexistente: o motivo, sem login", async () => {
    const r = await visitante.pedir("GET", `${REL}/publico/curto`);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ motivo: "inexistente" });
  });

  it("cria, publica, recebe resposta com arquivo e exclui", async () => {
    const lista = await admin.pedir("GET", REL);
    expect(lista.statusCode).toBe(200);
    expect(Array.isArray(lista.json().formularios)).toBe(true);

    const novo = await admin.pedir("POST", REL, { modelo: "branco" });
    expect(novo.statusCode).toBe(201);
    const id: string = novo.json().id;
    criados.push(id);

    const conteudo = await admin.pedir("PATCH", `${REL}/${id}/conteudo`, {
      titulo: "Formulário de teste",
      descricao: "",
      campos: [
        { id: "nome0001", tipo: "texto", titulo: "Nome", obrigatorio: true },
        { id: "foto0001", tipo: "arquivo", titulo: "Foto" },
      ],
    });
    expect(conteudo.json()).toEqual({ mensagem: "Formulário salvo." });

    const config = await admin.pedir("PATCH", `${REL}/${id}/configuracoes`, {
      mensagem_final: "Obrigado.",
      encerra_em: "",
      limite_respostas: "",
    });
    expect(config.json().mensagem).toBe("Configurações salvas.");
    const aparencia = await admin.pedir("PATCH", `${REL}/${id}/aparencia`, {
      cor: "azul",
      paginas: false,
      redirecionar_para: "",
    });
    expect(aparencia.json().mensagem).toBe("Aparência salva.");

    const rascunho = await admin.pedir("GET", `${REL}/${id}`);
    const token = new URL(rascunho.json().link).pathname.split("/").at(-1);
    expect(
      (await visitante.pedir("GET", `${REL}/publico/${token}`)).json(),
    ).toEqual({ motivo: "rascunho" });

    const publicar = await admin.pedir("POST", `${REL}/${id}/situacao`, {
      acao: "publicar",
    });
    expect(publicar.json().mensagem).toBe(
      "Formulário publicado: o link já recebe respostas.",
    );

    const aberto = await visitante.pedir("GET", `${REL}/publico/${token}`);
    expect(aberto.json().formulario).toMatchObject({
      titulo: "Formulário de teste",
      cor: "#1d4ed8",
    });
    expect(aberto.json().formulario.id).toBeUndefined();

    const { corpo, tipo } = multipart("foto0001", "foto.png", PNG);
    const subida = await app.inject({
      method: "POST",
      url: `${REL}/publico/${token}/arquivos`,
      headers: {
        origin: env.SITE_URL,
        "x-arp": "1",
        "content-type": tipo,
        "x-forwarded-for": visitante.ip,
      },
      payload: corpo,
    });
    expect(subida.statusCode).toBe(200);
    const arquivo = subida.json().arquivo;
    expect(arquivo.caminho.startsWith(`${id}/`)).toBe(true);

    const faltando = await visitante.pedir(
      "POST",
      `${REL}/publico/${token}/respostas`,
      { respostas: JSON.stringify({}) },
    );
    expect(faltando.statusCode).toBe(400);
    expect(faltando.json().erro.campos).toEqual({
      nome0001: "Resposta obrigatória.",
    });

    const falsificado = await visitante.pedir(
      "POST",
      `${REL}/publico/${token}/respostas`,
      {
        respostas: JSON.stringify({
          nome0001: "Pessoa de teste",
          foto0001: [{ ...arquivo, assinatura: "x" }],
        }),
      },
    );
    expect(falsificado.statusCode).toBe(400);

    const enviada = await visitante.pedir(
      "POST",
      `${REL}/publico/${token}/respostas`,
      {
        respostas: JSON.stringify({
          nome0001: "Pessoa de teste",
          foto0001: [arquivo],
        }),
      },
    );
    expect(enviada.json()).toEqual({ enviado: true });

    const respostas = await admin.pedir("GET", `${REL}/${id}/respostas`);
    expect(respostas.json().respostas).toHaveLength(1);
    const respostaId: string = respostas.json().respostas[0].id;
    const uma = await admin.pedir(
      "GET",
      `${REL}/${id}/respostas/${respostaId}`,
    );
    expect(uma.json().perguntas).toEqual({
      nome0001: "Nome",
      foto0001: "Foto",
    });

    const baixar = await admin.pedir(
      "GET",
      `${REL}/${id}/arquivo?${new URLSearchParams({ caminho: arquivo.caminho, nome: "foto.png" })}`,
    );
    expect(baixar.statusCode).toBe(302);
    expect(baixar.headers.location).toContain("/api/v1/arquivos/");

    const comResposta = await admin.pedir("POST", `${REL}/${id}/situacao`, {
      acao: "rascunho",
    });
    expect(comResposta.statusCode).toBe(422);

    const copia = await admin.pedir("POST", `${REL}/${id}/duplicar`);
    expect(copia.statusCode).toBe(201);
    criados.push(copia.json().id);
    expect(
      (await admin.pedir("GET", `${REL}/${copia.json().id}`)).json().titulo,
    ).toBe("Formulário de teste (cópia)");

    const link = await admin.pedir("POST", `${REL}/${id}/novo-link`);
    expect(link.json().mensagem).toBe(
      "Link novo gerado. O anterior não abre mais.",
    );
    expect(
      (await visitante.pedir("GET", `${REL}/publico/${token}`)).json(),
    ).toEqual({ motivo: "inexistente" });

    const semResposta = await admin.pedir(
      "DELETE",
      `${REL}/${id}/respostas/${respostaId}`,
    );
    expect(semResposta.json().mensagem).toBe("Resposta excluída.");
    expect(
      (await admin.pedir("GET", `${REL}/${id}`)).json().total_respostas,
    ).toBe(0);

    for (const alvo of [id, copia.json().id]) {
      const fora = await admin.pedir("DELETE", `${REL}/${alvo}`);
      expect(fora.json().mensagem).toBe("Formulário excluído.");
    }
    expect((await admin.pedir("GET", `${REL}/${id}`)).statusCode).toBe(404);
  }, 120_000);
});
