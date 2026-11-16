import { describe, expect, it } from "vitest";
import { ORDEM_PRIORIDADE, STATUS_ABERTOS, statusNoPortal } from "./rotulos";

describe("rótulos", () => {
  it("o lojista só vê 'Aguardando você' quando depende dele", () => {
    expect(statusNoPortal("aberto", null)).toBe("Recebido");
    expect(statusNoPortal("em_andamento", null)).toBe("Em atendimento");
    expect(statusNoPortal("aguardando", "material")).toBe("Em atendimento");
    expect(statusNoPortal("aguardando", "lojista")).toBe("Aguardando você");
    expect(statusNoPortal("concluido", null)).toBe("Concluído");
    expect(statusNoPortal("fechado", null)).toBe("Concluído");
    expect(statusNoPortal("cancelado", null)).toBe("Cancelado");
  });

  it("abertos não incluem fechado e cancelado", () => {
    expect(STATUS_ABERTOS).not.toContain("fechado");
    expect(STATUS_ABERTOS).not.toContain("cancelado");
    expect(STATUS_ABERTOS).toContain("concluido");
  });

  it("urgente pesa mais", () => {
    expect(ORDEM_PRIORIDADE.urgente).toBeGreaterThan(ORDEM_PRIORIDADE.alta);
    expect(ORDEM_PRIORIDADE.media).toBeGreaterThan(ORDEM_PRIORIDADE.baixa);
  });
});
