import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Preparo de todos os testes da tela (vite.config.ts → test.setupFiles).

// O jsdom não rola a página; o roteador chama ao trocar de tela.
window.scrollTo = () => undefined;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
