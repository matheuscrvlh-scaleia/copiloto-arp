import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fecharNotificacao,
  notificacoesAtuais,
  notificar,
} from "./notificacoes";

const textos = () => notificacoesAtuais().map((n) => n.texto);

describe("notificações", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it("sucesso some sozinho; erro fica mais tempo", () => {
    notificar("ok", "Salvo.");
    notificar("erro", "Nome: informe o nome.");
    vi.advanceTimersByTime(4500 + 220);
    expect(textos()).toEqual(["Nome: informe o nome."]);
    vi.advanceTimersByTime(10_000);
    expect(textos()).toEqual([]);
  });

  it("a mesma mensagem repetida troca a anterior; no máximo 4", () => {
    notificar("ok", "Salvo.");
    notificar("ok", "Salvo.");
    expect(textos()).toEqual(["Salvo."]);
    for (const t of ["a", "b", "c", "d"]) notificar("info", t);
    expect(textos()).toEqual(["a", "b", "c", "d"]);
  });

  it("texto longo fica mais tempo; fechar tira na hora (depois da animação)", () => {
    const longo = "Folha importada: ".padEnd(120, "x");
    notificar("ok", longo);
    vi.advanceTimersByTime(4500 + 220);
    expect(textos()).toContain(longo);
    const id = notificacoesAtuais().find((n) => n.texto === longo)?.id ?? 0;
    fecharNotificacao(id);
    expect(notificacoesAtuais().find((n) => n.id === id)?.saindo).toBe(true);
    vi.advanceTimersByTime(220);
    expect(textos()).not.toContain(longo);
  });
});
