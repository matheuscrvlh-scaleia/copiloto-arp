import { INDICADORES_MKT } from "@arp/shared/marketing/contratos/base";
import { textoDoConteudo } from "@arp/shared/marketing/marca";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { criarApp } from "@/app";
import { banco } from "@/infra/banco";
import { ROTINAS } from "@/modules";
import { descreverComBanco, Navegador, TESTE } from "@/testes/apoio";
import { rotinasDoMarketing } from "./jobs";

// Marketing (parte B) na homologação: Configurações, Integrações, Marca e
// Reputação. Quem não usa o módulo recebe 403; o administrador lê e grava um
// registro de teste por cadastro, desfeito em seguida. Nenhuma ferramenta
// externa é chamada: os conectores e o fetch respondem com falha.

const { bloqueado } = vi.hoisted(() => ({
  bloqueado: () =>
    new Proxy(
      {},
      {
        get: () => () =>
          Promise.reject(new Error("chamada externa bloqueada no teste")),
      },
    ),
}));

vi.mock("@/connectors/marketing/meta", async (original) => ({
  ...(await original<typeof import("@/connectors/marketing/meta")>()),
  createMetaClient: bloqueado,
}));
vi.mock("@/connectors/marketing/google", async (original) => ({
  ...(await original<typeof import("@/connectors/marketing/google")>()),
  createGoogleClient: bloqueado,
}));
vi.mock("@/connectors/marketing/asana", async (original) => ({
  ...(await original<typeof import("@/connectors/marketing/asana")>()),
  createAsanaClient: bloqueado,
}));
vi.mock("@/connectors/marketing/site", async (original) => ({
  ...(await original<typeof import("@/connectors/marketing/site")>()),
  createSiteClient: bloqueado,
}));

const MKT = "/api/v1/marketing";
const CONF = `${MKT}/configuracoes`;
const sufixo = () => Math.random().toString(36).slice(2, 7);

describe("rotinas do Marketing", () => {
  it("aquecem a memória nos horários da antiga /api/cron/marketing", () => {
    expect(rotinasDoMarketing.map((r) => r.cron)).toEqual([
      "10 3 * * *",
      "50 10 * * *",
    ]);
    for (const r of rotinasDoMarketing) expect(ROTINAS).toContain(r);
  });
});

descreverComBanco("marketing parte B", () => {
  let app: FastifyInstance;
  let admin: Navegador;
  let semAcesso: Navegador;
  let anonimo: Navegador;

  beforeAll(async () => {
    vi.stubGlobal("fetch", () =>
      Promise.reject(new Error("chamada externa bloqueada no teste")),
    );
    app = await criarApp();
    admin = new Navegador(app);
    semAcesso = new Navegador(app);
    anonimo = new Navegador(app);
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

  it("sem acesso: 403 nas leituras e nas gravações", async () => {
    for (const caminho of [
      "/marca/blocos",
      "/marca/versoes",
      "/marca/arquivos",
      "/marca/pdf",
      "/integracoes/mkt_google/descobertas",
    ]) {
      const r = await semAcesso.pedir("GET", `${MKT}${caminho}`);
      expect(r.statusCode, caminho).toBe(403);
    }
    // Corpo válido: a validação vem antes da permissão, como antes.
    for (const [metodo, caminho, corpo] of [
      ["PATCH", `${CONF}/termos-marca`, { termos_marca: "arp" }],
      ["DELETE", `${CONF}/referencias/00000000-0000-0000-0000-000000000000`],
      ["DELETE", `${CONF}/codigos-ronda/ZZ`],
      ["POST", `${MKT}/historico/1/volta`],
      ["POST", `${MKT}/marca/blocos`, { chave: "x", versao: "1", texto: "x" }],
    ] as const) {
      const r = await semAcesso.pedir(metodo, caminho, corpo);
      expect(r.statusCode, caminho).toBe(403);
    }
  });
  it("administrador lê a Marca, o PDF e as descobertas (sem chamar o Google)", async () => {
    const b = await admin.pedir("GET", `${MKT}/marca/blocos`);
    expect(b.statusCode).toBe(200);
    expect(b.json().blocos.length).toBeGreaterThan(0);
    for (const caminho of ["/marca/versoes", "/marca/arquivos"]) {
      const r = await admin.pedir("GET", `${MKT}${caminho}`);
      expect(r.statusCode, caminho).toBe(200);
    }
    const pdf = await admin.pedir("GET", `${MKT}/marca/pdf`);
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect(pdf.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
    for (const s of ["mkt_google", "mkt_youtube"]) {
      const r = await admin.pedir("GET", `${MKT}/integracoes/${s}/descobertas`);
      expect(r.statusCode, s).toBe(200);
    }
  }, 60_000);

  it("bloco da Marca: sem mudança não grava; versão velha não sobrescreve", async () => {
    const { blocos } = (await admin.pedir("GET", `${MKT}/marca/blocos`)).json();
    const b = blocos.find((x: { tipo: string }) => x.tipo === "texto");
    const igual = await admin.pedir("POST", `${MKT}/marca/blocos`, {
      chave: b.chave,
      versao: String(b.versao),
      texto: textoDoConteudo(b.conteudo),
    });
    expect(igual.json().mensagem).toBe("Nada mudou neste bloco.");
    const velha = await admin.pedir("POST", `${MKT}/marca/blocos`, {
      chave: b.chave,
      versao: String(b.versao + 1000),
      texto: `${textoDoConteudo(b.conteudo)} teste`,
    });
    expect(velha.statusCode).toBe(422);
  });

  it("locatário: inclui e remove", async () => {
    const nome = `Teste parte B ${sufixo()}`;
    const r = await admin.pedir("POST", `${CONF}/locatarios`, {
      nome,
      categoria: "Teste",
      perfil_url: "",
      forma_acesso: "sem_acesso",
      ativo: "on",
      entrada_em: "2026-01-01",
    });
    expect(r.statusCode, r.body).toBe(200);
    const { locatarios } = (
      await admin.pedir("GET", `${MKT}/locatarios`)
    ).json();
    const l = locatarios.find((x: { nome: string }) => x.nome === nome);
    expect(l).toBeTruthy();
    const d = await admin.pedir("DELETE", `${CONF}/locatarios/${l.id}`);
    expect(d.statusCode).toBe(200);
  });

  it("meta: inclui num mês distante e remove", async () => {
    const indicador = Object.keys(INDICADORES_MKT)[0];
    const r = await admin.pedir("POST", `${CONF}/metas`, {
      indicador,
      mes: "2099-01",
      meta: "1",
      limite_atencao: "",
    });
    expect(r.statusCode, r.body).toBe(200);
    const { metas } = (await admin.pedir("GET", `${MKT}/metas`)).json();
    const m = metas.find(
      (x: { indicador: string; vigente_desde: string }) =>
        x.indicador === indicador && x.vigente_desde.startsWith("2099-01"),
    );
    expect(m).toBeTruthy();
    expect(
      (await admin.pedir("DELETE", `${CONF}/metas/${m.id}`)).statusCode,
    ).toBe(200);
  });

  it("referência do benchmark: inclui e remove", async () => {
    const nome = `Teste B ${sufixo()}`;
    const r = await admin.pedir("POST", `${CONF}/referencias`, {
      nome,
      ativo: "on",
    });
    expect(r.statusCode, r.body).toBe(200);
    const { referencias } = (
      await admin.pedir("GET", `${MKT}/referencias`)
    ).json();
    const ref = referencias.find((x: { nome: string }) => x.nome === nome);
    expect(
      (await admin.pedir("DELETE", `${CONF}/referencias/${ref.id}`)).statusCode,
    ).toBe(200);
  });

  it("código da ronda: inclui e o Voltar do histórico apaga", async () => {
    const codigo = `Z${Math.floor(1000 + Math.random() * 9000)}`;
    const r = await admin.pedir("POST", `${CONF}/codigos-ronda`, {
      codigo,
      descricao: "Teste parte B",
      area: "marketing",
      novo: "on",
    });
    expect(r.statusCode, r.body).toBe(200);
    try {
      const { alteracoes } = (
        await admin.pedir("GET", `${MKT}/historico?limite=20`)
      ).json();
      const a = alteracoes.find(
        (x: { acao: string; depois: { codigo?: string } | null }) =>
          x.acao === "insert" && x.depois?.codigo === codigo,
      );
      expect(a).toBeTruthy();
      const v = await admin.pedir("POST", `${MKT}/historico/${a.id}/volta`);
      expect(v.statusCode, v.body).toBe(200);
      const { codigos } = (
        await admin.pedir("GET", `${MKT}/temas-e-codigos`)
      ).json();
      expect(codigos.some((c: { codigo: string }) => c.codigo === codigo)).toBe(
        false,
      );
    } finally {
      await admin.pedir("DELETE", `${CONF}/codigos-ronda/${codigo}`);
    }
  });

  it("termos da marca: grava os mesmos termos", async () => {
    const { parametros } = (
      await admin.pedir("GET", `${MKT}/parametros`)
    ).json();
    const r = await admin.pedir("PATCH", `${CONF}/termos-marca`, {
      termos_marca: parametros.termos_marca.join(", "),
    });
    expect(r.statusCode, r.body).toBe(200);
  });

  it("volta do OAuth sem o cookie do state: leva ao cartão com o aviso", async () => {
    const g = await anonimo.pedir(
      "GET",
      "/api/integracoes/google/callback?code=x&state=y",
    );
    expect(g.statusCode).toBe(302);
    expect(g.headers.location).toContain(
      "/admin/configuracoes/integracoes?google=state",
    );
    const t = await anonimo.pedir(
      "GET",
      "/api/integracoes/tiktok/retorno?auth_code=x&state=y",
    );
    expect(t.headers.location).toContain("tiktok=state");
    const rd = await anonimo.pedir(
      "GET",
      "/api/integracoes/rd-station/retorno?code=x&state=rd.y",
    );
    expect(rd.headers.location).toContain(
      "/admin/configuracoes/integracoes?rd=state",
    );
  });
});
