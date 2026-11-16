import { randomUUID } from "node:crypto";
import {
  detalheDaVistoria,
  paginaDaVistoria,
  respostaVistorias,
} from "@arp/shared/os/contratos/vistorias";
import { rotaVistoria } from "@arp/shared/os/rotas";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import type { Permissao } from "@arp/shared/permissions";
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
import { ACOES_DO_MODELO } from "./modelos.service";
import { assinarPeloLink } from "./vistoria-publica.service";
import {
  exportarVistorias,
  laudoDaVistoria,
  lerVistoria,
  lerVistorias,
} from "./vistorias.service";
import { iniciarVistoria, salvarVistoria } from "./vistorias-acoes.service";

// Vistorias e o link do locatário: quem não pode recebe 403; o
// administrador cria uma vistoria de teste, preenche, assina, manda o link,
// o locatário assina sem login e o laudo sai em PDF. Tudo desfeito no fim.

const OS = "/api/v1/os";
const NADA = "00000000-0000-4000-8000-000000000000";
const LONGO = 240_000;
/** PNG de 1 × 1 transparente (foto e assinaturas de teste). */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** A chamada como promessa (o service pode recusar antes de abrir o banco). */
const falha = (fn: () => unknown) => Promise.resolve().then(fn);

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

describe("vistorias: permissão conferida no service", () => {
  const sem = contexto(["os.acessar"]);

  it("telas e gravações pedem os.vistorias", async () => {
    await expect(falha(() => lerVistorias(sem, {}))).rejects.toThrow(
      ErroDePermissao,
    );
    await expect(falha(() => lerVistoria(sem, NADA))).rejects.toThrow(
      ErroDePermissao,
    );
    await expect(
      falha(() => laudoDaVistoria(sem, NADA, false)),
    ).rejects.toThrow("Você não tem acesso às vistorias.");
    await expect(falha(() => iniciarVistoria(sem, {}))).rejects.toThrow(
      "Você não tem permissão para mexer em vistorias.",
    );
    await expect(falha(() => salvarVistoria(sem, NADA, {}))).rejects.toThrow(
      ErroDePermissao,
    );
  });

  it("exportar pede os.exportar", async () => {
    expect(() => exportarVistorias(contexto(["os.vistorias"]), {})).toThrow(
      "Sem permissão para exportar.",
    );
  });

  it("link com token fora do formato não está ativo", async () => {
    await expect(
      falha(() =>
        assinarPeloLink("curto", { nome: "Fulano", concordo: "1" }, undefined),
      ),
    ).rejects.toThrow("Este link não está mais ativo. Fale com a ARP.");
  });

  it("o modelo de entrada e saída de cliente cria a vistoria", () => {
    expect(ACOES_DO_MODELO.vistoria_entrada).toBeTypeOf("function");
    expect(ACOES_DO_MODELO.vistoria_saida).toBeTypeOf("function");
  });
});

descreverComBanco("os: vistorias", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  let visitante: Navegador;
  const marca = `[TESTE ${randomUUID().slice(0, 8)}]`;
  const criadas: string[] = [];

  /** Formulário multipart com um PNG, como a tela envia. */
  function enviarPng(
    quem: Navegador,
    url: string,
    campo: string,
    campos: Record<string, string> = {},
  ) {
    const limite = `----teste${randomUUID()}`;
    const partes = Object.entries(campos).map(([nome, valor]) =>
      Buffer.from(
        `--${limite}\r\nContent-Disposition: form-data; name="${nome}"\r\n\r\n${valor}\r\n`,
      ),
    );
    partes.push(
      Buffer.from(
        `--${limite}\r\nContent-Disposition: form-data; name="${campo}"; filename="teste.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      PNG,
      Buffer.from(`\r\n--${limite}--\r\n`),
    );
    const acesso = quem.cookie(COOKIE_ACESSO);
    return app.inject({
      method: "POST",
      url,
      headers: {
        "x-forwarded-for": quem.ip,
        ...(acesso ? { cookie: `${COOKIE_ACESSO}=${acesso}` } : {}),
        origin: env.SITE_URL,
        "x-arp": "1",
        "content-type": `multipart/form-data; boundary=${limite}`,
      },
      payload: Buffer.concat(partes),
    });
  }

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
  }, LONGO);

  afterAll(async () => {
    await avisosPendentes();
    // Só o que este teste criou: as vistorias (ambientes e anexos saem em
    // cascata), os arquivos delas e o aviso da assinatura pelo link.
    const arquivos = await banco.comoServico(async (tx) => {
      if (!criadas.length) return [];
      const anexos = await tx
        .selectFrom("os.anexos")
        .select("path")
        .where("vistoria_id", "in", criadas)
        .execute();
      const assinaturas = await tx
        .selectFrom("os.vistorias")
        .select(["assinatura_locador_path", "assinatura_locatario_path"])
        .where("id", "in", criadas)
        .execute();
      await tx
        .deleteFrom("os.notificacoes")
        .where(
          "href",
          "in",
          criadas.map((id) => rotaVistoria(id)),
        )
        .execute();
      await tx.deleteFrom("os.vistorias").where("id", "in", criadas).execute();
      return [
        ...anexos.map((a) => a.path),
        ...assinaturas.flatMap((v) =>
          [v.assinatura_locador_path, v.assinatura_locatario_path].filter(
            (p): p is string => !!p,
          ),
        ),
      ];
    });
    await removerArquivos(arquivos);
    await app.close();
    await banco.encerrar();
  }, LONGO);

  it("sem acesso recebe 403 nas telas, no laudo e nas gravações", async () => {
    for (const url of [
      `${OS}/vistorias`,
      `${OS}/vistorias/exportacao`,
      `${OS}/vistorias/nova`,
      `${OS}/vistorias/${NADA}`,
      `${OS}/vistorias/${NADA}/laudo`,
    ])
      expect((await semAcesso.pedir("GET", url)).statusCode, url).toBe(403);
    const r = await semAcesso.pedir("POST", `${OS}/vistorias`, {
      tipo: "preventiva",
      locatario: "X",
      data: "2026-01-02",
    });
    expect(r.statusCode).toBe(403);
    expect(
      (await visitante.pedir("GET", `${OS}/vistoria-publica/${"x".repeat(40)}`))
        .statusCode,
    ).toBe(404);
  });

  it(
    "o administrador lê a lista, os cartões e a nova vistoria",
    async () => {
      for (const busca of ["", "?cartao=com_os", "?cartao=concluidas&q=a"]) {
        const r = await admin.pedir("GET", `${OS}/vistorias${busca}`);
        expect(r.statusCode, busca).toBe(200);
        respostaVistorias.parse(r.json());
      }
      for (const url of [`${OS}/vistorias/nova`, `${OS}/vistorias/exportacao`])
        expect((await admin.pedir("GET", url)).statusCode, url).toBe(200);
    },
    LONGO,
  );

  it(
    "vistoria: cria, preenche, assina, manda o link e o locatário assina",
    async () => {
      const hoje = hojeEmBrasilia(new Date());
      const nova = await admin.pedir("POST", `${OS}/vistorias`, {
        tipo: "preventiva",
        loja_id: "",
        locatario: `${marca} Locatário`,
        bloco: "",
        unidade: "",
        data: hoje,
      });
      expect(nova.statusCode, nova.body).toBe(200);
      const id: string = nova.json().id;
      criadas.push(id);

      const lida = detalheDaVistoria.parse(
        (await admin.pedir("GET", `${OS}/vistorias/${id}`)).json(),
      );
      expect(lida.ambientes.length).toBeGreaterThan(0);

      // Ambiente novo: inclui, salva, reordena, recebe e perde uma foto, sai.
      const incluido = await admin.pedir(
        "POST",
        `${OS}/vistorias/${id}/ambientes`,
        { titulo: `${marca} Ambiente`, ordem: lida.ambientes.length },
      );
      expect(incluido.json().mensagem).toBe("Ambiente incluído.");
      const ambiente: string = incluido.json().id;
      const salvo = await admin.pedir(
        "PATCH",
        `${OS}/vistorias/${id}/ambientes/${ambiente}`,
        {
          titulo: `${marca} Ambiente`,
          resposta: "respondido",
          descricao: "Tudo certo.",
          problema: false,
        },
      );
      expect(salvo.json()).toEqual({ mensagem: "Salvo." });
      const ordem = await admin.pedir(
        "PUT",
        `${OS}/vistorias/${id}/ambientes/ordem`,
        { ids: [ambiente, ...lida.ambientes.map((a) => a.id)] },
      );
      expect(ordem.json()).toEqual({ mensagem: "Ordem salva." });
      const foto = await enviarPng(
        admin,
        `${OS}/vistorias/${id}/ambientes/${ambiente}/fotos`,
        "arquivo",
      );
      expect(foto.statusCode, foto.body).toBe(200);
      const removida = await admin.pedir(
        "DELETE",
        `${OS}/vistorias/fotos/${foto.json().foto.id}`,
      );
      expect(removida.json()).toEqual({ mensagem: "Foto removida." });
      expect(
        (await admin.pedir("DELETE", `${OS}/vistorias/ambientes/${ambiente}`))
          .statusCode,
      ).toBe(200);

      // Salva como rascunho, assina como locador e finaliza.
      const { vistoria: v } = lida;
      const campos = {
        rascunho: true,
        tipo: v.tipo,
        codigo: v.codigo,
        status: v.status,
        data: v.data,
        hora: "",
        vistoriador_id: v.vistoriador_id,
        vistoriador_nome: v.vistoriador_nome,
        locador: v.locador,
        loja_id: v.loja_id,
        locatario: v.locatario,
        bloco: v.bloco,
        unidade: v.unidade,
        campo_tipo: null,
        itens_anteriores: null,
        observacao: v.observacao,
        consideracoes: null,
        termo: v.termo,
        local_data: v.local_data,
        comparar_no_laudo: false,
        ambientes: lida.ambientes.map((a) => ({
          id: a.id,
          titulo: a.titulo,
          resposta: a.resposta,
          descricao: a.descricao,
          problema: false,
        })),
      };
      const rascunho = await admin.pedir(
        "PATCH",
        `${OS}/vistorias/${id}`,
        campos,
      );
      expect(rascunho.json()).toEqual({ mensagem: "Rascunho salvo." });
      const locador = await enviarPng(
        admin,
        `${OS}/vistorias/${id}/assinaturas/locador`,
        "arquivo",
      );
      expect(locador.json().mensagem).toBe("Assinatura salva.");
      const final = await admin.pedir("PATCH", `${OS}/vistorias/${id}`, {
        ...campos,
        rascunho: false,
        status: "finalizado",
      });
      expect(final.json()).toEqual({ mensagem: "Vistoria salva." });

      // Link para o locatário: abre sem login, mostra o laudo e recebe a
      // assinatura dele.
      const link = await admin.pedir(
        "POST",
        `${OS}/vistorias/${id}/link-assinatura`,
      );
      expect(link.json().mensagem).toBe(
        "Link pronto para o locatário assinar.",
      );
      const token = String(link.json().link).split("/").pop() ?? "";
      const pagina = await visitante.pedir(
        "GET",
        `${OS}/vistoria-publica/${token}`,
      );
      expect(pagina.statusCode).toBe(200);
      expect(paginaDaVistoria.parse(pagina.json()).motivo).toBeNull();
      const laudoPublico = await visitante.pedir(
        "GET",
        `${OS}/vistoria-publica/${token}/laudo`,
      );
      expect(laudoPublico.headers["content-type"]).toBe("application/pdf");
      const assinou = await enviarPng(
        visitante,
        `${OS}/vistoria-publica/${token}/assinatura`,
        "assinatura",
        { nome: "Locatário de teste", documento: "", concordo: "1" },
      );
      expect(assinou.json()).toEqual({
        mensagem: "Vistoria assinada. Obrigado!",
      });
      const deNovo = await enviarPng(
        visitante,
        `${OS}/vistoria-publica/${token}/assinatura`,
        "assinatura",
        { nome: "Locatário de teste", documento: "", concordo: "1" },
      );
      expect(deNovo.json()).toEqual({ mensagem: "Vistoria já assinada." });

      // Laudo, envio pelo WhatsApp e duplicar.
      const laudo = await admin.pedir("GET", `${OS}/vistorias/${id}/laudo`);
      expect(laudo.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
      const envio = await admin.pedir("POST", `${OS}/vistorias/${id}/envio`);
      expect(envio.json().mensagem).toBe("Laudo pronto para enviar.");
      const copia = await admin.pedir("POST", `${OS}/vistorias/${id}/duplicar`);
      expect(copia.statusCode).toBe(200);
      criadas.push(copia.json().id);
      const apagada = await admin.pedir(
        "DELETE",
        `${OS}/vistorias/${id}/assinaturas/locatario`,
      );
      expect(apagada.json()).toEqual({ mensagem: "Assinatura apagada." });
    },
    LONGO,
  );
});
