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
import { exportar } from "./ordens-consulta.service";

// Ordens de serviço de ponta a ponta na homologação: quem não tem acesso
// recebe 403; o administrador lê a lista, o bloco e o PDF e passa uma OS de
// teste (criada e apagada aqui) pelo tempo, materiais, custos, arquivos e
// pelo link do terceirizado.

const OS = "/api/v1/os";
const NADA = "00000000-0000-4000-8000-000000000000";
const LONGO = 240_000;
/** PNG de 1 × 1 (o tipo do arquivo é conferido pelo conteúdo). */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

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

describe("ordens: permissão conferida no service", () => {
  it("exportar exige os.acessar e os.exportar", () => {
    expect(() => exportar(semPermissao, {})).toThrow(ErroDePermissao);
    expect(() => exportar(semPermissao, {})).toThrow(
      "Sem permissão para exportar.",
    );
  });
});

descreverComBanco("tickets, ordens de serviço (/api/v1/os/ordens)", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  let visitante: Navegador;
  let ordemId = "";
  let tecnicoCriado: string | null = null;
  const marca = `Teste porte OS ${randomUUID().slice(0, 8)}`;

  /** Formulário com arquivo, como a tela envia. */
  function enviarFormulario(
    quem: Navegador,
    url: string,
    campos: Record<string, string>,
    arquivo: { campo: string; nome: string; tipo: string; bytes: Buffer },
  ) {
    const limite = `----teste${randomUUID()}`;
    const partes: Buffer[] = Object.entries(campos).map(([nome, valor]) =>
      Buffer.from(
        `--${limite}\r\nContent-Disposition: form-data; name="${nome}"\r\n\r\n${valor}\r\n`,
      ),
    );
    partes.push(
      Buffer.from(
        `--${limite}\r\nContent-Disposition: form-data; name="${arquivo.campo}"; filename="${arquivo.nome}"\r\nContent-Type: ${arquivo.tipo}\r\n\r\n`,
      ),
      arquivo.bytes,
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

  const bloco = async () =>
    (await admin.pedir("GET", `${OS}/ordens/${ordemId}/bloco`)).json();

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
    // A OS de teste: do administrador, num setor qualquer.
    const eu = (await admin.pedir("GET", "/api/v1/auth/eu")).json();
    ordemId = await banco.comoServico(async (tx) => {
      const setor = await tx
        .selectFrom("os.setores")
        .select("id")
        .where("ativo", "=", true)
        .orderBy("ordem")
        .executeTakeFirstOrThrow();
      const tecnico = await tx
        .selectFrom("os.tecnicos")
        .select("id")
        .where("usuario_id", "=", eu.id)
        .executeTakeFirst();
      // Sem técnico, o cronômetro cria um: sai no fim.
      if (!tecnico) tecnicoCriado = eu.id;
      const o = await tx
        .insertInto("os.ordens")
        .values({
          titulo: marca,
          setor_id: setor.id,
          aberto_por: eu.id,
          responsavel_id: eu.id,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      return o.id;
    });
  }, LONGO);

  afterAll(async () => {
    await avisosPendentes();
    // Só o que este teste criou (as filhas da OS saem em cascata).
    const arquivos = await banco.comoServico(async (tx) => {
      if (!ordemId) return [];
      const anexos = await tx
        .selectFrom("os.anexos")
        .select("path")
        .where("ordem_id", "=", ordemId)
        .execute();
      const o = await tx
        .selectFrom("os.ordens")
        .select("assinatura_path")
        .where("id", "=", ordemId)
        .executeTakeFirst();
      await tx.deleteFrom("os.ordens").where("id", "=", ordemId).execute();
      if (tecnicoCriado)
        await tx
          .deleteFrom("os.tecnicos")
          .where("usuario_id", "=", tecnicoCriado)
          .execute();
      return [
        ...anexos.map((a) => a.path),
        ...(o?.assinatura_path ? [o.assinatura_path] : []),
      ];
    });
    await removerArquivos(arquivos);
    await app.close();
    await banco.encerrar();
  }, LONGO);

  it(
    "sem acesso ao módulo: 403 em toda leitura e gravação",
    async () => {
      for (const url of [
        "/ordens",
        "/ordens/exportacao",
        `/ordens/pdf?ids=${NADA}`,
        `/ordens/${NADA}/bloco`,
      ])
        expect((await semAcesso.pedir("GET", OS + url)).statusCode, url).toBe(
          403,
        );
      const gravacoes = [
        ["POST", "tempo/iniciar", undefined],
        ["POST", "tempo/pausar", {}],
        ["POST", "sessoes", {}],
        ["DELETE", `sessoes/${NADA}`, undefined],
        ["PATCH", "execucao", {}],
        ["POST", "materiais", {}],
        ["DELETE", `materiais/${NADA}`, undefined],
        ["PATCH", "rateio", {}],
        ["PATCH", "custo-terceirizado", {}],
        ["PATCH", "outros-custos", {}],
        ["PATCH", "resultado", {}],
        ["POST", "concluir", undefined],
        ["POST", "arquivos", undefined],
        ["DELETE", `arquivos/${NADA}`, undefined],
        ["POST", "assinatura", undefined],
        ["POST", "terceirizado/link", {}],
        ["DELETE", "terceirizado/link", undefined],
        ["POST", "terceirizado/usar", {}],
        ["POST", "orcamento/aprovar", undefined],
      ] as const;
      for (const [metodo, url, corpo] of gravacoes)
        expect(
          (await semAcesso.pedir(metodo, `${OS}/ordens/${NADA}/${url}`, corpo))
            .statusCode,
          url,
        ).toBe(403);
    },
    LONGO,
  );

  it(
    "administrador lê a lista, os cartões, a exportação, o bloco e o PDF",
    async () => {
      const lista = await admin.pedir("GET", `${OS}/ordens?q=${marca}`);
      expect(lista.statusCode).toBe(200);
      const d = lista.json();
      expect(d.total).toBe(1);
      expect(d.linhas[0].id).toBe(ordemId);
      expect(d.linhas[0].href).toContain(`c=${ordemId}`);
      expect(Object.keys(d.contagem)).toHaveLength(5);

      for (const filtro of [
        "cartao=em_execucao",
        "cartao=atrasadas&status=em_aberto",
        "local=bloco&rateio=sim&periodo=ano",
        `tecnico=${NADA}&responsavel=fila`,
        "pagina=9999",
      ])
        expect(
          (await admin.pedir("GET", `${OS}/ordens?${filtro}`)).statusCode,
          filtro,
        ).toBe(200);

      const planilha = await admin.pedir(
        "GET",
        `${OS}/ordens/exportacao?q=${marca}`,
      );
      expect(planilha.statusCode).toBe(200);
      expect(planilha.json().linhas).toHaveLength(1);

      const b = await admin.pedir("GET", `${OS}/ordens/${ordemId}/bloco`);
      expect(b.statusCode).toBe(200);
      expect(b.json()).toMatchObject({ ehOS: true, podeEditar: true });
      expect(
        (await admin.pedir("GET", `${OS}/ordens/${NADA}/bloco`)).statusCode,
      ).toBe(404);

      const pdf = await admin.pedir("GET", `${OS}/ordens/pdf?ids=${ordemId}`);
      expect(pdf.statusCode).toBe(200);
      expect(pdf.headers["content-type"]).toBe("application/pdf");
      expect(pdf.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
      expect(
        (await admin.pedir("GET", `${OS}/ordens/pdf?ids=x`)).statusCode,
      ).toBe(400);
      expect(
        (await admin.pedir("GET", `${OS}/ordens/pdf?ids=${NADA}`)).statusCode,
      ).toBe(404);
    },
    LONGO,
  );

  it(
    "tempo: cronômetro, sessão à mão, correção e exclusão",
    async () => {
      const base = `${OS}/ordens/${ordemId}`;
      const inicio = await admin.pedir("POST", `${base}/tempo/iniciar`);
      expect(inicio.statusCode, inicio.body).toBe(200);
      expect(inicio.json().mensagem).toContain("Cronômetro iniciado.");
      let b = await bloco();
      expect(b.minhaSessaoAberta).not.toBeNull();
      expect(b.chamado.status).toBe("em_andamento");
      const repetido = await admin.pedir("POST", `${base}/tempo/iniciar`);
      expect(repetido.json().erro.mensagem).toBe(
        "Seu cronômetro já está rodando nesta OS.",
      );
      const pausa = await admin.pedir("POST", `${base}/tempo/pausar`, {
        finalizar: "1",
      });
      expect(pausa.statusCode, pausa.body).toBe(200);
      expect(pausa.json().mensagem).toContain("Tempo registrado:");
      expect(typeof pausa.json().concluir).toBe("boolean");

      b = await bloco();
      const tecnico: string = b.meuTecnico;
      expect(tecnico).toBeTruthy();
      const invalida = await admin.pedir("POST", `${base}/sessoes`, {
        data: "",
        inicio: "08:00",
        tecnicos: [tecnico],
      });
      expect(invalida.statusCode).toBe(400);
      expect(invalida.json().erro.mensagem).toBe("Data: informe a data");
      const sessao = {
        data: b.chamado.criado_em?.slice(0, 10) ?? "2026-01-05",
        inicio: "08:00",
        fim: "10:30",
        tecnicos: tecnico,
        observacao: "teste",
      };
      const incluida = await admin.pedir("POST", `${base}/sessoes`, {
        ...sessao,
        data: "2026-01-05",
      });
      expect(incluida.statusCode, incluida.body).toBe(200);
      expect(incluida.json().mensagem).toBe("Sessão incluída.");
      b = await bloco();
      const s = b.sessoes.find((x: { fim: string }) => x.fim === "10:30");
      expect(s).toBeTruthy();
      // Os 150 min da sessão à mão, mais o que o cronômetro contou.
      expect(b.resultado.minutos).toBeGreaterThanOrEqual(150);
      const corrigida = await admin.pedir("POST", `${base}/sessoes`, {
        ...sessao,
        data: "2026-01-05",
        id: s.id,
        fim: "11:00",
      });
      expect(corrigida.json().mensagem).toBe("Sessão corrigida.");
      const excluida = await admin.pedir("DELETE", `${base}/sessoes/${s.id}`);
      expect(excluida.json().mensagem).toBe("Sessão excluída.");
      expect(
        (await admin.pedir("DELETE", `${base}/sessoes/${s.id}`)).json().erro
          .mensagem,
      ).toBe("Sessão não encontrada.");
    },
    LONGO,
  );

  it(
    "materiais, custos, rateio, resultado e execução",
    async () => {
      const base = `${OS}/ordens/${ordemId}`;
      const semQtd = await admin.pedir("POST", `${base}/materiais`, {
        descricao: "Parafuso",
        quantidade: "0",
      });
      expect(semQtd.json().erro.mensagem).toBe(
        "Quantidade: informe um número maior que zero.",
      );
      const material = await admin.pedir("POST", `${base}/materiais`, {
        descricao: "Parafuso",
        quantidade: "2",
        unidade: "un",
        valor_unitario: "1,50",
      });
      expect(material.statusCode, material.body).toBe(200);
      let b = await bloco();
      expect(b.materiais).toHaveLength(1);
      expect(b.materiais[0].valor_unitario).toBe(1.5);
      expect(b.resultado.materiais).toBe(3);

      const outros = await admin.pedir("PATCH", `${base}/outros-custos`, {
        outros: JSON.stringify([{ descricao: "Frete", valor: "10,00" }]),
      });
      expect(outros.json().mensagem).toBe("Outros custos salvos.");
      const custo = await admin.pedir("PATCH", `${base}/custo-terceirizado`, {
        valor_terceirizado: "100,00",
        orcamento_numero: "T-1",
      });
      expect(custo.json().mensagem).toBe("Custo do terceirizado salvo.");
      const rateio = await admin.pedir("PATCH", `${base}/rateio`, {
        rateio: "sim",
        rateio_regra: "percentual",
        rateio_valor: "150",
      });
      expect(rateio.json().erro.mensagem).toBe("Percentual: no máximo 100%.");
      expect(
        (
          await admin.pedir("PATCH", `${base}/rateio`, {
            rateio: "sim",
            rateio_regra: "percentual",
            rateio_valor: "50",
          })
        ).json().mensagem,
      ).toBe("Rateio salvo.");
      b = await bloco();
      expect(b.chamado.rateio).toBe(true);
      expect(b.custos.valor_terceirizado).toBe(100);
      expect(b.resultado.total).toBe(113);
      expect(b.resultado.valorRateio).toBe(56.5);

      expect(
        (
          await admin.pedir("PATCH", `${base}/resultado`, {
            solucao: "Trocado",
            causa_falha: "",
          })
        ).json().mensagem,
      ).toBe("Resultado salvo.");
      const execucao = await admin.pedir("PATCH", `${base}/execucao`, {
        execucao: "terceirizada",
        local: "Doca",
        visita_data: "2026-12-01",
        visita_periodo: "manha",
      });
      expect(execucao.statusCode, execucao.body).toBe(200);
      b = await bloco();
      expect(b.chamado).toMatchObject({
        execucao: "terceirizada",
        local: "Doca",
        solucao: "Trocado",
      });
      expect(
        (
          await admin.pedir("DELETE", `${base}/materiais/${b.materiais[0].id}`)
        ).json().mensagem,
      ).toBe("Material excluído.");
    },
    LONGO,
  );

  it(
    "arquivos da OS: envia a foto e remove",
    async () => {
      const base = `${OS}/ordens/${ordemId}`;
      const envio = await enviarFormulario(
        admin,
        `${base}/arquivos`,
        { categoria: "antes" },
        { campo: "arquivos", nome: "antes.png", tipo: "image/png", bytes: PNG },
      );
      expect(envio.statusCode, envio.body).toBe(200);
      expect(envio.json().mensagem).toBe("Arquivo enviado.");
      const b = await bloco();
      expect(b.arquivos).toHaveLength(1);
      expect(b.arquivos[0]).toMatchObject({ categoria: "antes", meu: true });
      const errado = await enviarFormulario(
        admin,
        `${base}/arquivos`,
        { categoria: "antes" },
        {
          campo: "arquivos",
          nome: "x.png",
          tipo: "image/png",
          bytes: Buffer.from("isto não é uma imagem"),
        },
      );
      expect(errado.statusCode).toBe(422);
      expect(
        (
          await admin.pedir("DELETE", `${base}/arquivos/${b.arquivos[0].id}`)
        ).json().mensagem,
      ).toBe("Arquivo removido.");
    },
    LONGO,
  );

  it(
    "link do terceirizado: vale pelo token e para quando é cancelado",
    async () => {
      const base = `${OS}/ordens/${ordemId}`;
      const publica = `${OS}/ordem-publica`;
      expect(
        (await visitante.pedir("GET", `${publica}/${"a".repeat(32)}`))
          .statusCode,
      ).toBe(404);
      expect(
        (
          await visitante.pedir("POST", `${publica}/${"a".repeat(32)}/aceite`)
        ).json().erro.mensagem,
      ).toBe("Este link não está mais ativo. Fale com a ARP.");

      const envio = await admin.pedir("POST", `${base}/terceirizado/link`, {
        telefone: "(22) 99999-0000",
        nome: "Teste",
      });
      expect(envio.statusCode, envio.body).toBe(200);
      expect(envio.json().mensagem).toBe("Link gerado.");
      // Só monta o endereço do WhatsApp: nada é enviado pelo servidor.
      expect(envio.json().whatsapp).toMatch(/^https:\/\/wa\.me\//);
      const b = await bloco();
      const token: string = b.link.url.split("/ordem/")[1];
      expect(token).toMatch(/^[A-Za-z0-9_-]{32,64}$/);

      const pagina = await visitante.pedir("GET", `${publica}/${token}`);
      expect(pagina.statusCode, pagina.body).toBe(200);
      expect(pagina.json()).toMatchObject({ titulo: marca, local: "Doca" });
      // Nada de custos internos na página do terceirizado.
      expect(pagina.body).not.toContain("valor_terceirizado");

      expect(
        (await visitante.pedir("POST", `${publica}/${token}/aceite`)).json()
          .mensagem,
      ).toBe("OS aceita. Obrigado!");
      expect(
        (
          await visitante.pedir("POST", `${publica}/${token}/chegada`, {
            lat: "-22.28",
            lng: "-42.53",
            precisao: "12.4",
          })
        ).json().mensagem,
      ).toBe("Chegada registrada.");
      expect(
        (
          await visitante.pedir("POST", `${publica}/${token}/recusa`, {
            motivo: "Não posso",
          })
        ).json().erro.mensagem,
      ).toBe("O serviço já começou: fale com a ARP para desistir.");
      const foto = await enviarFormulario(
        visitante,
        `${publica}/${token}/arquivos`,
        { categoria: "depois" },
        {
          campo: "arquivos",
          nome: "depois.png",
          tipo: "image/png",
          bytes: PNG,
        },
      );
      expect(foto.statusCode, foto.body).toBe(200);
      expect(
        (
          await visitante.pedir("POST", `${publica}/${token}/relatorio`, {
            solucao: "Feito",
            valor: "250,00",
            orcamento_numero: "N-9",
          })
        ).json().mensagem,
      ).toBe("Enviado à ARP.");
      expect(
        (
          await visitante.pedir("POST", `${publica}/${token}/termino`, {})
        ).json().mensagem,
      ).toBe("Serviço registrado como terminado. Obrigado!");
      const assinatura = await enviarFormulario(
        visitante,
        `${publica}/${token}/assinatura`,
        { nome: "Fulano de Teste", documento: "" },
        {
          campo: "assinatura",
          nome: "assinatura.png",
          tipo: "image/png",
          bytes: PNG,
        },
      );
      expect(assinatura.statusCode, assinatura.body).toBe(200);
      expect(assinatura.json().mensagem).toBe(
        "OS assinada. A ARP vai validar e concluir. Obrigado!",
      );

      const depois = await bloco();
      expect(depois.link).toMatchObject({
        etapa: "assinado",
        solucao: "Feito",
        valor_informado: 250,
        chegada_local: { lat: -22.28, lng: -42.53 },
      });
      expect(
        (
          await admin.pedir("POST", `${base}/terceirizado/usar`, {
            campo: "valor",
          })
        ).json().mensagem,
      ).toBe("Atualizado na OS.");
      // Agora a ARP valida e assina.
      const arp = await enviarFormulario(
        admin,
        `${base}/assinatura`,
        { nome: "Responsável de Teste" },
        {
          campo: "assinatura",
          nome: "assinatura.png",
          tipo: "image/png",
          bytes: PNG,
        },
      );
      expect(arp.statusCode, arp.body).toBe(200);
      expect(arp.json().mensagem).toBe("Assinatura salva.");

      // Cancelado, o link para na hora.
      const cancelado = await admin.pedir(
        "DELETE",
        `${base}/terceirizado/link`,
      );
      expect(cancelado.json().mensagem).toBe(
        "Link cancelado: ele não abre mais.",
      );
      expect(
        (await visitante.pedir("GET", `${publica}/${token}`)).statusCode,
      ).toBe(404);
      expect(
        (
          await visitante.pedir("POST", `${publica}/${token}/relatorio`, {
            solucao: "x",
          })
        ).json().erro.mensagem,
      ).toBe("Este link não está mais ativo. Fale com a ARP.");
      // O arquivo da assinatura do link sai com a limpeza do teste.
      const link = await banco.comoServico((tx) =>
        tx
          .selectFrom("os.terceirizado_links")
          .select("assinatura_path")
          .where("ordem_id", "=", ordemId)
          .execute(),
      );
      await removerArquivos(
        link.flatMap((l) => (l.assinatura_path ? [l.assinatura_path] : [])),
      );
    },
    LONGO,
  );

  it(
    "concluir pela OS: fecha e o link para de funcionar",
    async () => {
      const base = `${OS}/ordens/${ordemId}`;
      const novo = await admin.pedir("POST", `${base}/terceirizado/link`, {});
      expect(novo.json().mensagem).toBe("Link gerado.");
      const token: string = (await bloco()).link.url.split("/ordem/")[1];
      const pendente = await admin.pedir("POST", `${base}/concluir`);
      // O link novo ainda não foi assinado pelo terceirizado.
      expect(pendente.statusCode).toBe(422);
      await admin.pedir("DELETE", `${base}/terceirizado/link`);
      const fim = await admin.pedir("POST", `${base}/concluir`);
      expect(fim.statusCode, fim.body).toBe(200);
      expect(fim.json().mensagem).toMatch(/^OS concluída/);
      expect(
        (await visitante.pedir("GET", `${OS}/ordem-publica/${token}`))
          .statusCode,
      ).toBe(404);
    },
    LONGO,
  );
});
