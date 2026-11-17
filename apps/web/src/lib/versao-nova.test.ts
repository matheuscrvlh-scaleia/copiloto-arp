import { beforeEach, describe, expect, it, vi } from "vitest";

// Cada carga da página avalia o módulo de novo: os testes fazem o mesmo
// (vi.resetModules) para simular "a página recarregou".
async function paginaCarregada() {
  vi.resetModules();
  return import("./versao-nova");
}

const SUMIU = new TypeError(
  "Failed to fetch dynamically imported module: https://arp.test/assets/painel-abc123.js",
);
const telaQueSumiu = () => Promise.reject(SUMIU);

/** A promessa já terminou (deu certo ou errado)? */
async function terminou(promessa: Promise<unknown>): Promise<boolean> {
  const pendente = Symbol("pendente");
  const r = await Promise.race([
    promessa.catch(() => "erro"),
    new Promise((resolve) => setTimeout(() => resolve(pendente), 20)),
  ]);
  return r !== pendente;
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.useRealTimers();
});

describe("aba aberta durante um deploy", () => {
  it("reconhece a falha de import() dos navegadores e do Vite", async () => {
    const { ehFalhaAoCarregarModulo } = await paginaCarregada();
    for (const mensagem of [
      "Failed to fetch dynamically imported module: https://x/assets/a.js",
      "error loading dynamically imported module: https://x/assets/a.js",
      "Importing a module script failed.",
      "Unable to preload CSS for /assets/a.css",
    ])
      expect(ehFalhaAoCarregarModulo(new TypeError(mensagem)), mensagem).toBe(
        true,
      );
    expect(ehFalhaAoCarregarModulo(new Error("x is not a function"))).toBe(
      false,
    );
    expect(ehFalhaAoCarregarModulo("Failed to fetch")).toBe(false);
  });

  it("a tela que sumiu recarrega a página uma vez e segura o esqueleto", async () => {
    const { carregarTela, TRAVA_DA_RECARGA } = await paginaCarregada();
    const recarregar = vi.fn();
    const carga = carregarTela(telaQueSumiu, recarregar);
    expect(await terminou(carga)).toBe(false);
    expect(recarregar).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(TRAVA_DA_RECARGA)).not.toBeNull();

    // Outra tela falha enquanto o navegador ainda está saindo: nada de
    // segunda recarga nem de erro piscando.
    const outra = carregarTela(telaQueSumiu, recarregar);
    expect(await terminou(outra)).toBe(false);
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("se falhar de novo depois de recarregar, o erro segue para o limite de erro (sem laço)", async () => {
    const recarregar = vi.fn();
    const antes = await paginaCarregada();
    void antes.carregarTela(telaQueSumiu, recarregar);
    await vi.waitFor(() => expect(recarregar).toHaveBeenCalledTimes(1));

    // A página recarregou e o arquivo continua faltando.
    const depois = await paginaCarregada();
    await expect(depois.carregarTela(telaQueSumiu, recarregar)).rejects.toBe(
      SUMIU,
    );
    await expect(depois.carregarTela(telaQueSumiu, recarregar)).rejects.toBe(
      SUMIU,
    );
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("outro deploy, tempos depois, na mesma aba: recarrega de novo", async () => {
    const recarregar = vi.fn();
    const { TRAVA_DA_RECARGA } = await paginaCarregada();
    window.sessionStorage.setItem(
      TRAVA_DA_RECARGA,
      String(Date.now() - 6 * 60_000),
    );
    const { carregarTela } = await paginaCarregada();
    expect(await terminou(carregarTela(telaQueSumiu, recarregar))).toBe(false);
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("erro que não é de arquivo faltando não recarrega", async () => {
    const { carregarTela } = await paginaCarregada();
    const recarregar = vi.fn();
    const defeito = new Error("defeito da tela");
    await expect(
      carregarTela(() => Promise.reject(defeito), recarregar),
    ).rejects.toBe(defeito);
    expect(recarregar).not.toHaveBeenCalled();
    expect(await carregarTela(async () => "tela", recarregar)).toBe("tela");
  });

  it("sem internet não recarrega (a tela viraria o erro do navegador)", async () => {
    const { carregarTela } = await paginaCarregada();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const recarregar = vi.fn();
    await expect(carregarTela(telaQueSumiu, recarregar)).rejects.toBe(SUMIU);
    expect(recarregar).not.toHaveBeenCalled();
  });

  it("vite:preloadError (import de biblioteca na hora do uso) também recarrega uma vez", async () => {
    const { ligarRecargaPorVersaoNova, TRAVA_DA_RECARGA } =
      await paginaCarregada();
    // jsdom não navega: a recarga de verdade só registra um aviso.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    ligarRecargaPorVersaoNova();
    window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
    expect(window.sessionStorage.getItem(TRAVA_DA_RECARGA)).not.toBeNull();
  });
});
