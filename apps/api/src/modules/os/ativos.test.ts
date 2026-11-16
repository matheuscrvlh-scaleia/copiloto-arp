import { randomUUID } from "node:crypto";
import {
  fichaDoAtivo,
  respostaAtivos,
  respostaCategoriasDeAtivo,
  respostaSaidas,
} from "@arp/shared/os/contratos/ativos";
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
import {
  exportarAtivos,
  lerAtivos,
  lerCategorias,
  lerEtiquetas,
  lerFicha,
  pdfDeEtiquetas,
  salvarAtivo,
  salvarCategoria,
} from "./ativos.service";
import { preventivasDevidas } from "./ativos-preventivas.service";
import { lerSaidas, registrarSaida } from "./ativos-saidas.service";
import { removerArquivos } from "./base.service";

// Ativos (lista, ficha, cadastro, planos, categorias, etiquetas e saídas):
// quem não pode recebe 403 com as mensagens de antes; o administrador lê
// tudo e grava um ativo de teste (com plano e saída), desfeito no fim.

const OS = "/api/v1/os";
const NADA = "00000000-0000-4000-8000-000000000000";
const LONGO = 240_000;

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

describe("ativos: permissão conferida no service", () => {
  const semAtivos = contexto(["os.acessar"]);

  it("lista, ficha e saídas pedem os.ativos ou os.ativos_gerenciar", async () => {
    await expect(falha(() => lerAtivos(semAtivos, {}))).rejects.toThrow(
      ErroDePermissao,
    );
    await expect(falha(() => lerFicha(semAtivos, NADA))).rejects.toThrow(
      ErroDePermissao,
    );
    await expect(falha(() => lerSaidas(semAtivos, {}))).rejects.toThrow(
      ErroDePermissao,
    );
  });

  it("cadastro, categorias e etiquetas pedem os.ativos_gerenciar", async () => {
    const soVer = contexto(["os.ativos"]);
    await expect(
      falha(() => salvarAtivo(soVer, { nome: "X" }, undefined)),
    ).rejects.toThrow("Você não tem permissão para gerenciar ativos.");
    await expect(falha(() => lerCategorias(soVer))).rejects.toThrow(
      ErroDePermissao,
    );
    await expect(
      falha(() =>
        salvarCategoria(soVer, { nome: "X", vida_util_padrao_anos: null }),
      ),
    ).rejects.toThrow(ErroDePermissao);
    await expect(falha(() => lerEtiquetas(soVer))).rejects.toThrow(
      ErroDePermissao,
    );
    await expect(falha(() => pdfDeEtiquetas(soVer, [NADA], 1))).rejects.toThrow(
      "Você não tem permissão para imprimir etiquetas.",
    );
  });

  it("exportar pede os.exportar", async () => {
    await expect(
      falha(() => exportarAtivos(contexto(["os.ativos"]), {})),
    ).rejects.toThrow("Sem permissão para exportar.");
  });

  it("saída de ativo pede os.ativos_saida", async () => {
    await expect(
      falha(() =>
        registrarSaida(
          contexto(["os.ativos"]),
          { ativo_id: NADA, tipo: "Descarte", data: "2026-01-02" },
          [],
        ),
      ),
    ).rejects.toThrow(ErroDePermissao);
  });
});

descreverComBanco("os: ativos", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  const marca = `[TESTE ${randomUUID().slice(0, 8)}]`;
  let ativoId = "";
  let categoriaId = "";
  const arquivos: string[] = [];

  /** Formulário multipart (sem arquivo), como a tela envia. */
  function enviarFormulario(url: string, campos: Record<string, string>) {
    const limite = `----teste${randomUUID()}`;
    const corpo = Buffer.from(
      `${Object.entries(campos)
        .map(
          ([nome, valor]) =>
            `--${limite}\r\nContent-Disposition: form-data; name="${nome}"\r\n\r\n${valor}\r\n`,
        )
        .join("")}--${limite}--\r\n`,
    );
    const acesso = admin.cookie(COOKIE_ACESSO);
    return app.inject({
      method: "POST",
      url,
      headers: {
        "x-forwarded-for": admin.ip,
        ...(acesso ? { cookie: `${COOKIE_ACESSO}=${acesso}` } : {}),
        origin: env.SITE_URL,
        "x-arp": "1",
        "content-type": `multipart/form-data; boundary=${limite}`,
      },
      payload: corpo,
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
  }, LONGO);

  afterAll(async () => {
    // Só o que este teste criou: o ativo (planos, saídas, situações e
    // anexos saem junto ou antes) e a categoria.
    await banco.comoServico(async (tx) => {
      if (ativoId) {
        const anexos = await tx
          .deleteFrom("os.anexos")
          .where("ativo_id", "=", ativoId)
          .returning("path")
          .execute();
        arquivos.push(...anexos.map((a) => a.path));
        await tx
          .deleteFrom("os.ativo_saidas")
          .where("ativo_id", "=", ativoId)
          .execute();
        await tx
          .deleteFrom("os.planos_preventivos")
          .where("ativo_id", "=", ativoId)
          .execute();
        await tx
          .deleteFrom("os.ativo_situacoes")
          .where("ativo_id", "=", ativoId)
          .execute();
        await tx.deleteFrom("os.ativos").where("id", "=", ativoId).execute();
      }
      if (categoriaId)
        await tx
          .deleteFrom("os.ativo_categorias")
          .where("id", "=", categoriaId)
          .execute();
    });
    await removerArquivos(arquivos);
    await app.close();
    await banco.encerrar();
  }, LONGO);

  it("sem acesso recebe 403 nas telas e nas gravações", async () => {
    for (const url of [
      `${OS}/ativos`,
      `${OS}/ativos/exportacao`,
      `${OS}/ativos/opcoes`,
      `${OS}/ativos/categorias`,
      `${OS}/ativos/etiquetas`,
      `${OS}/ativos/etiquetas/pdf?id=${NADA}`,
      `${OS}/ativos/saidas`,
      `${OS}/ativos/${NADA}`,
      `${OS}/ativos/${NADA}/edicao`,
    ])
      expect((await semAcesso.pedir("GET", url)).statusCode, url).toBe(403);
    const r = await semAcesso.pedir("POST", `${OS}/ativos/categorias`, {
      nome: "X",
    });
    expect(r.statusCode).toBe(403);
  });

  it(
    "o administrador lê a lista, a decisão de troca, as opções e as etiquetas",
    async () => {
      for (const busca of ["", "?visao=decisao", "?situacao=todas&q=a"]) {
        const r = await admin.pedir("GET", `${OS}/ativos${busca}`);
        expect(r.statusCode, busca).toBe(200);
        respostaAtivos.parse(r.json());
      }
      for (const url of [
        `${OS}/ativos/opcoes`,
        `${OS}/ativos/etiquetas`,
        `${OS}/ativos/exportacao`,
      ])
        expect((await admin.pedir("GET", url)).statusCode, url).toBe(200);
      const saidas = await admin.pedir("GET", `${OS}/ativos/saidas`);
      expect(saidas.statusCode).toBe(200);
      respostaSaidas.parse(saidas.json());
      // As preventivas que vencem (a leitura da rotina) não gravam nada.
      const devidas = await banco.comoServico((tx) =>
        preventivasDevidas(tx, new Date()),
      );
      expect(Array.isArray(devidas.devidas)).toBe(true);
    },
    LONGO,
  );

  it(
    "categoria: cria, edita e exclui",
    async () => {
      const nome = `${marca} Categoria`;
      const criada = await admin.pedir("POST", `${OS}/ativos/categorias`, {
        nome,
        vida_util_padrao_anos: "7",
      });
      expect(criada.statusCode).toBe(200);
      expect(criada.json()).toEqual({ mensagem: "Categoria criada." });
      const lista = respostaCategoriasDeAtivo.parse(
        (await admin.pedir("GET", `${OS}/ativos/categorias`)).json(),
      );
      categoriaId = lista.categorias.find((c) => c.nome === nome)?.id ?? "";
      expect(categoriaId).not.toBe("");
      const editada = await admin.pedir("POST", `${OS}/ativos/categorias`, {
        id: categoriaId,
        nome,
        vida_util_padrao_anos: "abc",
      });
      expect(editada.statusCode).toBe(400);
      expect(editada.json().erro.mensagem).toMatch(/^Vida útil padrão: /);
    },
    LONGO,
  );

  it(
    "ativo: cadastra, abre a ficha, muda a situação, cria plano e registra saída",
    async () => {
      const salvo = await enviarFormulario(`${OS}/ativos`, {
        id: "",
        nome: `${marca} Ativo`,
        categoria_id: categoriaId,
        ...Object.fromEntries(
          [
            "fabricante",
            "modelo",
            "numero_serie",
            "bloco",
            "loja_id",
            "area",
            "ponto",
            "compra_data",
            "garantia_fim",
            "fornecedor_id",
            "vida_util_anos",
            "setor_id",
            "responsavel_id",
            "observacao",
          ].map((c) => [c, ""]),
        ),
      });
      expect(salvo.statusCode, salvo.body).toBe(200);
      ativoId = salvo.json().id;
      expect(salvo.json().semFoto).toBe(false);

      const ficha = await admin.pedir("GET", `${OS}/ativos/${ativoId}`);
      expect(ficha.statusCode).toBe(200);
      const f = fichaDoAtivo.parse(ficha.json());
      expect(f.ativo.situacao).toBe("em_uso");
      expect(f.faltas.length).toBeGreaterThan(0);
      expect(
        (await admin.pedir("GET", `${OS}/ativos/${ativoId}/edicao`)).statusCode,
      ).toBe(200);
      const pdf = await admin.pedir(
        "GET",
        `${OS}/ativos/etiquetas/pdf?id=${ativoId}`,
      );
      expect(pdf.headers["content-type"]).toBe("application/pdf");

      const situacao = await admin.pedir(
        "POST",
        `${OS}/ativos/${ativoId}/situacao`,
        { situacao: "parado" },
      );
      expect(situacao.json()).toEqual({ mensagem: "Situação atualizada." });

      const plano = await admin.pedir("POST", `${OS}/ativos/planos`, {
        ativo_id: ativoId,
        titulo: `${marca} Plano`,
        descricao: "",
        unidade: "meses",
        frequencia: "6",
        proxima_data: "2099-01-01",
        antecedencia_dias: "",
        setor_id: f.padraoDoPlano.setorId,
        categoria_id: f.padraoDoPlano.categoriaId,
        responsavel_id: "",
        checklist: "Item 1\nItem 2",
      });
      expect(plano.json()).toEqual({ mensagem: "Plano criado." });
      const comPlano = fichaDoAtivo.parse(
        (await admin.pedir("GET", `${OS}/ativos/${ativoId}`)).json(),
      );
      const planoId = comPlano.planos[0]?.id ?? "";
      const pausa = await admin.pedir(
        "POST",
        `${OS}/ativos/planos/${planoId}/alternar`,
        { ativo: "false" },
      );
      expect(pausa.json()).toEqual({ mensagem: "Plano pausado." });
      const excluido = await admin.pedir(
        "DELETE",
        `${OS}/ativos/planos/${planoId}`,
      );
      expect(excluido.statusCode).toBe(200);

      const saida = await enviarFormulario(`${OS}/ativos/saidas`, {
        ativo_id: ativoId,
        tipo: comPlano.listasDeSaida?.tipos.find((t) => t !== "Venda") ?? "",
        data: "2026-01-02",
        ...Object.fromEntries(
          [
            "quantidade",
            "valor",
            "forma",
            "recebido_por",
            "destinatario",
            "documento",
            "responsavel_id",
            "motivo",
            "nf",
            "nf_numero",
            "observacoes",
          ].map((c) => [c, ""]),
        ),
      });
      expect(saida.statusCode, saida.body).toBe(200);
      const depois = fichaDoAtivo.parse(
        (await admin.pedir("GET", `${OS}/ativos/${ativoId}`)).json(),
      );
      expect(depois.ativo.situacao).toBe("baixado");
      const saidaId = depois.saidas[0]?.id ?? "";
      const recibo = await admin.pedir(
        "GET",
        `${OS}/ativos/saidas/${saidaId}/recibo`,
      );
      expect(recibo.headers["content-type"]).toBe("application/pdf");
      const desfeita = await admin.pedir(
        "POST",
        `${OS}/ativos/saidas/${saidaId}/desfazer`,
        { motivo: "Teste automático" },
      );
      expect(desfeita.json()).toEqual({
        mensagem: "Saída desfeita. O ativo voltou à situação de antes.",
      });
    },
    LONGO,
  );
});
