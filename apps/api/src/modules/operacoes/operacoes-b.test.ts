import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, expect, it } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";

// Operações (parte B: obras, Diário de Obra, rateio da limpeza e
// configurações) de ponta a ponta na homologação: quem não tem acesso
// recebe 403; o administrador lê tudo e grava um hidrômetro, uma sala, um
// mês de teste do rateio (dez/2099) e os mesmos valores numa obra e nos
// parâmetros das obras. O que foi criado é apagado no fim. O "Atualizar
// agora" do Diário nunca é chamado pelo administrador (consultaria o
// aplicativo de verdade).

const OP = "/api/v1/operacoes";
const LONGO = 180_000;
/** Mês de teste do rateio: longe de qualquer mês de verdade. */
const MES_TESTE = "2099-12";
const MOTIVO = "teste automatizado";

descreverComBanco("operações, parte B (/api/v1/operacoes)", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  const marca = randomUUID().slice(0, 6).toUpperCase();
  const hidrometro = `TESTE-${marca}`;
  const sala = `T${marca}`;
  let criouMes = false;

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
    // Rede de segurança: só o que este teste criou (prefixo e marca de
    // teste, nunca dado de verdade).
    await banco.comoServico(async (tx) => {
      await tx
        .deleteFrom("operacoes.hidrometros")
        .where("numero", "like", "TESTE-%")
        .where("descricao", "=", MOTIVO)
        .execute();
      await tx
        .deleteFrom("operacoes.salas")
        .where("bloco", "=", "99")
        .where("observacoes", "=", MOTIVO)
        .execute();
      if (criouMes)
        await tx
          .deleteFrom("operacoes.limpeza_meses")
          .where("referencia", "=", `${MES_TESTE}-01`)
          .execute();
    });
    await app.close();
  });

  it(
    "sem acesso ao módulo: 403 em toda leitura e gravação",
    async () => {
      const id = randomUUID();
      const pedidos = [
        ["GET", `${OP}/obras`],
        ["GET", `${OP}/obras/para-importar`],
        ["GET", `${OP}/obras/diario-para-vincular`],
        ["GET", `${OP}/obras/ligada/123`],
        ["GET", `${OP}/obras/${id}`],
        ["PATCH", `${OP}/obras/${id}`],
        ["POST", `${OP}/obras/orcamento`],
        ["POST", `${OP}/obras/orcamento/${id}/confirmar`],
        ["POST", `${OP}/obras/orcamento/${id}/descartar`],
        ["POST", `${OP}/obras/realizado`],
        ["DELETE", `${OP}/obras/realizado/${id}`],
        ["GET", `${OP}/diario/estado`],
        ["GET", `${OP}/diario/obras`],
        ["GET", `${OP}/diario/obras/123`],
        ["GET", `${OP}/diario/obras/123/partes?partes=galeria`],
        ["GET", `${OP}/diario/relatorios?de=2026-10-01&ate=2026-10-31`],
        ["GET", `${OP}/diario/relatorios/opcoes`],
        ["GET", `${OP}/diario/relatorios/123`],
        ["POST", `${OP}/diario/atualizar`],
        ["GET", `${OP}/limpeza/meses`],
        ["GET", `${OP}/limpeza/meses/2026-09`],
        ["GET", `${OP}/limpeza/meses/2026-09/demonstrativo`],
        ["GET", `${OP}/limpeza/meses/2026-09/planilha`],
        ["GET", `${OP}/limpeza/meses/2026-09/anterior`],
        ["GET", `${OP}/limpeza/anexos/${id}/link`],
        ["POST", `${OP}/limpeza/meses/2026-09/fechar`],
        ["POST", `${OP}/limpeza/meses/2026-09/reabrir`],
        ["POST", `${OP}/limpeza/meses/2026-09/enviar`],
        ["DELETE", `${OP}/limpeza/anexos/${id}`],
        ["POST", `${OP}/limpeza/historico/${id}/confirmar`],
        ["POST", `${OP}/limpeza/historico/${id}/descartar`],
        ["PATCH", `${OP}/parametros`],
        ["DELETE", `${OP}/parametros/exemplos`],
        ["POST", `${OP}/parametros/unidades-energia`],
        ["DELETE", `${OP}/cadastros/hidrometros/${id}`],
        ["DELETE", `${OP}/cadastros/salas/${id}`],
      ] as const;
      for (const [metodo, url] of pedidos)
        expect(
          (
            await semAcesso.pedir(
              metodo,
              url,
              metodo === "GET" ? undefined : {},
            )
          ).statusCode,
          `${metodo} ${url}`,
        ).toBe(403);
      for (const [url, corpo] of [
        [`${OP}/limpeza/meses`, { referencia: MES_TESTE, copiar: false }],
        [`${OP}/cadastros/hidrometros`, { numero: hidrometro, bloco: "99" }],
        [`${OP}/cadastros/salas`, { bloco: "99", sala }],
      ] as const)
        expect(
          (await semAcesso.pedir("POST", url, corpo)).statusCode,
          url,
        ).toBe(403);
      // Como antes: sem a permissão de importar, simplesmente não há prévia.
      const previa = await semAcesso.pedir(
        "GET",
        `${OP}/limpeza/historico/previa-aberta`,
      );
      expect(previa.json()).toEqual({ previa: null });
    },
    LONGO,
  );

  it(
    "administrador: lê as obras, o Diário de Obra e o rateio da limpeza",
    async () => {
      for (const url of [
        `${OP}/obras`,
        `${OP}/obras/para-importar`,
        `${OP}/obras/diario-para-vincular`,
        `${OP}/diario/estado`,
        `${OP}/diario/obras`,
        `${OP}/diario/relatorios?de=2026-01-01&ate=2026-12-31`,
        `${OP}/diario/relatorios/opcoes`,
        `${OP}/limpeza/meses`,
        `${OP}/limpeza/historico/previa-aberta`,
      ])
        expect((await admin.pedir("GET", url)).statusCode, url).toBe(200);

      const obras = (await admin.pedir("GET", `${OP}/obras`)).json();
      const obra: string | undefined = obras.obras[0]?.id;
      if (obra)
        expect(
          (await admin.pedir("GET", `${OP}/obras/${obra}`)).statusCode,
        ).toBe(200);
      expect(
        (await admin.pedir("GET", `${OP}/obras/${randomUUID()}`)).statusCode,
      ).toBe(404);

      const doApp = (await admin.pedir("GET", `${OP}/diario/obras`)).json();
      const obraApp: string | undefined = doApp.obras[0]?.id;
      if (obraApp) {
        const e = encodeURIComponent(obraApp);
        for (const url of [
          `${OP}/diario/obras/${e}`,
          `${OP}/diario/obras/${e}/partes?partes=ocorrencias,galeria`,
          `${OP}/obras/ligada/${e}`,
        ])
          expect((await admin.pedir("GET", url)).statusCode, url).toBe(200);
      }
      const rel: string | undefined = doApp.relatorios[0]?.id;
      if (rel)
        expect(
          (
            await admin.pedir(
              "GET",
              `${OP}/diario/relatorios/${encodeURIComponent(rel)}`,
            )
          ).statusCode,
        ).toBe(200);
      expect(
        (await admin.pedir("GET", `${OP}/diario/relatorios/nao-existe`))
          .statusCode,
      ).toBe(404);

      const meses = (await admin.pedir("GET", `${OP}/limpeza/meses`)).json();
      const ref: string | undefined = meses.meses[0]?.referencia;
      if (ref) {
        const m = ref.slice(0, 7);
        for (const url of [
          `${OP}/limpeza/meses/${m}`,
          `${OP}/limpeza/meses/${m}/anterior`,
          `${OP}/limpeza/meses/${m}/demonstrativo`,
          `${OP}/limpeza/meses/${m}/planilha`,
        ])
          expect((await admin.pedir("GET", url)).statusCode, url).toBe(200);
      }
    },
    LONGO,
  );

  it(
    "administrador: cadastra e exclui um hidrômetro e uma sala de teste",
    async () => {
      const h = await admin.pedir("POST", `${OP}/cadastros/hidrometros`, {
        numero: hidrometro,
        bloco: "99",
        descricao: MOTIVO,
      });
      expect(h.statusCode, h.body).toBe(200);
      const lista = (
        await admin.pedir("GET", `${OP}/cadastros/hidrometros`)
      ).json();
      const hid: string | undefined = lista.hidrometros.find(
        (x: { numero: string }) => x.numero === hidrometro,
      )?.id;
      expect(hid).toBeTruthy();
      const repetido = await admin.pedir(
        "POST",
        `${OP}/cadastros/hidrometros`,
        {
          numero: hidrometro,
          bloco: "99",
          descricao: MOTIVO,
        },
      );
      expect(repetido.statusCode).toBe(409);
      expect(
        (await admin.pedir("DELETE", `${OP}/cadastros/hidrometros/${hid}`))
          .statusCode,
      ).toBe(200);

      const s = await admin.pedir("POST", `${OP}/cadastros/salas`, {
        bloco: "99",
        sala,
        observacoes: MOTIVO,
      });
      expect(s.statusCode, s.body).toBe(200);
      const salas = (await admin.pedir("GET", `${OP}/cadastros/salas`)).json();
      const sid: string | undefined = salas.salas.find(
        (x: { codigo: string; bloco: string }) =>
          x.bloco === "99" && x.codigo.includes(sala),
      )?.id;
      expect(sid).toBeTruthy();
      expect(
        (await admin.pedir("DELETE", `${OP}/cadastros/salas/${sid}`))
          .statusCode,
      ).toBe(200);
    },
    LONGO,
  );

  it(
    "administrador: grava os mesmos parâmetros das obras e os mesmos dados de uma obra",
    async () => {
      const { parametros: p } = (
        await admin.pedir("GET", `${OP}/parametros`)
      ).json();
      const r = await admin.pedir("PATCH", `${OP}/parametros`, {
        grupo: "obras",
        obras_intervalo_min: String(p.obras_intervalo_min),
        obras_dias_relatorio: p.obras_dias_relatorio.map(String),
        obras_limite_desvio: Number(p.obras_limite_desvio),
        obras_limite_orcamento_pct: Number(p.obras_limite_orcamento_pct),
      });
      expect(r.statusCode, r.body).toBe(200);
      const depois = (await admin.pedir("GET", `${OP}/parametros`)).json();
      expect(depois.parametros.obras_dias_relatorio).toEqual(
        p.obras_dias_relatorio,
      );

      const ruim = await admin.pedir("PATCH", `${OP}/parametros`, {
        grupo: "obras",
        obras_intervalo_min: "7",
        obras_dias_relatorio: [],
        obras_limite_desvio: 0,
        obras_limite_orcamento_pct: 0,
      });
      expect(ruim.statusCode).toBe(400);

      const obras = (await admin.pedir("GET", `${OP}/obras`)).json();
      const o = obras.obras[0];
      if (o) {
        const salvo = await admin.pedir("PATCH", `${OP}/obras/${o.id}`, {
          nome: o.nome,
          responsavel: o.responsavel ?? "",
          diario_obra_id: o.diarioObraId ?? "",
          ...(o.ativa && { ativa: "on" }),
        });
        expect(salvo.statusCode, salvo.body).toBe(200);
        const de = (await admin.pedir("GET", `${OP}/obras/${o.id}`)).json();
        expect(de.obra.nome).toBe(o.nome);
        expect(de.obra.ativa).toBe(o.ativa);
      }
    },
    LONGO,
  );

  it(
    "administrador: cria, lê e lança um mês de teste do rateio",
    async () => {
      const ja = await admin.pedir("GET", `${OP}/limpeza/meses/${MES_TESTE}`);
      expect(ja.statusCode).toBe(200);
      // Só mexe no mês de teste se ele não existia (nunca apaga o que não criou).
      if (ja.json().detalhe) return;
      const r = await admin.pedir("POST", `${OP}/limpeza/meses`, {
        referencia: MES_TESTE,
        copiar: false,
      });
      expect(r.statusCode, r.body).toBe(200);
      criouMes = true;
      const de = await admin.pedir("GET", `${OP}/limpeza/meses/${MES_TESTE}`);
      expect(de.statusCode).toBe(200);
      expect(de.json().detalhe.mes.status).toBe("aberto");
      const repetido = await admin.pedir("POST", `${OP}/limpeza/meses`, {
        referencia: MES_TESTE,
        copiar: false,
      });
      expect(repetido.statusCode).toBe(409);
      // Mês aberto ainda não foi ao Financeiro: sem PDF para quem só vê.
      expect(
        (
          await admin.pedir(
            "GET",
            `${OP}/limpeza/meses/${MES_TESTE}/demonstrativo?bloco=ZZ`,
          )
        ).statusCode,
      ).toBeGreaterThanOrEqual(400);
    },
    LONGO,
  );
});
