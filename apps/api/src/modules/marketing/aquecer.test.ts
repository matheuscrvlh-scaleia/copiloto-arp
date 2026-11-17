import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { iniciarAgendador } from "@/infra/agendador";
import { banco } from "@/infra/banco";
import { descreverComBanco } from "@/testes/apoio";
import { rotinasDoMarketing } from "./jobs";
import { esquecerLeituras } from "./memoria";

// Aquecimento das leituras ao vivo na subida da API (a memória é do
// processo: cada deploy a esvazia). Conectores simulados: nenhuma ferramenta
// externa é chamada.

const { conectores } = vi.hoisted(() => {
  const simulado = (valor: unknown[]) =>
    vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => valor);
  return {
    conectores: {
      meta: {
        insights: simulado([{ campaign_id: "c1" }]),
        quebras: simulado([]),
        campanhas: simulado([{ id: "c1" }]),
        instagramPosts: simulado([]),
        instagramDemografia: simulado([]),
      },
      google: {
        adsCampanhasPorDia: simulado([]),
        adsTermos: simulado([]),
        ga4Relatorio: simulado([]),
        buscas: simulado([]),
      },
    },
  };
});

vi.mock("@/modules/sync/credenciais.service", async (original) => ({
  ...(await original<typeof import("@/modules/sync/credenciais.service")>()),
  meta: async () => ({
    api: conectores.meta,
    contaDeAnuncios: "act_de_teste",
    pagina: "",
    instagram: "ig_de_teste",
  }),
  google: async () => ({
    api: conectores.google,
    contaAds: "ads_de_teste",
    loginAds: "",
    propriedadeGa4: "ga4_de_teste",
    siteSearchConsole: "site_de_teste",
  }),
}));

const todos = () => [
  ...Object.values(conectores.meta),
  ...Object.values(conectores.google),
];
const chamadas = () =>
  todos().reduce((soma, f) => soma + f.mock.calls.length, 0);

const esperar = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

descreverComBanco("marketing: aquecimento na subida da API", () => {
  const naSubida = rotinasDoMarketing.filter((r) => r.naSubida);

  beforeEach(() => {
    esquecerLeituras("meta", "google");
    for (const f of todos()) f.mockClear();
  });
  afterEach(() => {
    conectores.meta.insights.mockImplementation(async () => [
      { campaign_id: "c1" },
    ]);
    conectores.google.ga4Relatorio.mockImplementation(async () => []);
  });
  afterAll(() => banco.encerrar());

  it("uma rotina de aquecer (só uma) roda também na subida", () => {
    expect(naSubida.map((r) => r.nome)).toEqual(["marketing.aquecer-manha"]);
  });

  it("aquece em segundo plano: a subida não espera, e a memória fica pronta", async () => {
    // A fonte demora: a subida não pode esperar por ela.
    conectores.meta.insights.mockImplementation(async () => {
      await esperar(400);
      return [{ campaign_id: "c1" }];
    });
    const agendador = iniciarAgendador(rotinasDoMarketing);
    try {
      // O agendador já devolveu o controle e nada foi lido ainda.
      expect(conectores.meta.campanhas).not.toHaveBeenCalled();
      await agendador.emAndamento();

      // Meta: anúncios (insights, 2 quebras, campanhas) e Instagram (posts,
      // demografia). Google: Ads (campanhas, termos), GA4 e Search Console.
      expect(conectores.meta.insights).toHaveBeenCalledTimes(1);
      expect(conectores.meta.quebras).toHaveBeenCalledTimes(2);
      expect(conectores.meta.campanhas).toHaveBeenCalledTimes(1);
      expect(conectores.meta.instagramPosts).toHaveBeenCalledTimes(1);
      expect(conectores.meta.instagramDemografia).toHaveBeenCalledTimes(1);
      expect(conectores.google.adsCampanhasPorDia).toHaveBeenCalledTimes(1);
      expect(conectores.google.adsTermos).toHaveBeenCalledTimes(1);
      expect(conectores.google.ga4Relatorio).toHaveBeenCalledTimes(1);
      expect(conectores.google.buscas).toHaveBeenCalledTimes(1);

      // Quem abre o Painel depois não espera fonte nenhuma: está na memória.
      const antes = chamadas();
      for (const r of naSubida) await r.executar();
      expect(chamadas()).toBe(antes);
    } finally {
      agendador.parar();
    }
  });

  it("fonte externa que não responde não derruba a subida", async () => {
    const fora = async () => {
      throw new Error("fonte fora do ar (simulada)");
    };
    conectores.meta.insights.mockImplementation(fora);
    conectores.google.ga4Relatorio.mockImplementation(fora);
    const agendador = iniciarAgendador(rotinasDoMarketing);
    try {
      await expect(agendador.emAndamento()).resolves.toBeUndefined();
      expect(conectores.meta.insights).toHaveBeenCalledTimes(1);
    } finally {
      agendador.parar();
    }
  });

  it("usa a trava da rotina: se ela já está rodando, a subida não roda outra", async () => {
    let soltar: () => void = () => undefined;
    const segurando = new Promise<void>((resolve) => {
      soltar = resolve;
    });
    let travou: () => void = () => undefined;
    const travada = new Promise<void>((resolve) => {
      travou = resolve;
    });
    const outra = banco.comTrava(`rotina:${naSubida[0]?.nome}`, async () => {
      travou();
      await segurando;
    });
    await travada;
    const agendador = iniciarAgendador(rotinasDoMarketing);
    try {
      await agendador.emAndamento();
      expect(chamadas()).toBe(0);
    } finally {
      agendador.parar();
      soltar();
      await outra;
    }
  });

  it("sem a marca, nenhuma rotina roda na subida", async () => {
    let execucoes = 0;
    const agendador = iniciarAgendador([
      {
        nome: `teste.sem-marca.${Date.now()}`,
        cron: "0 0 1 1 *",
        executar: async () => {
          execucoes++;
        },
      },
    ]);
    await agendador.emAndamento();
    agendador.parar();
    expect(execucoes).toBe(0);
  });
});
