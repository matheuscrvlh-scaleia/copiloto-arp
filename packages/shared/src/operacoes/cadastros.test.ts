import { describe, expect, it } from "vitest";
import { codigoDaSala, esquemaHidrometro, esquemaSala } from "./cadastros";

describe("cadastros de Operações", () => {
  it("hidrômetro: número em maiúsculas, bloco com dois dígitos, ativo do checkbox", () => {
    const h = esquemaHidrometro.parse({
      numero: " a19l036553 ",
      bloco: "5",
      sala: "311",
      sala_id: "",
      descricao: "",
      ativo: "on",
    });
    expect(h).toMatchObject({
      id: null,
      numero: "A19L036553",
      bloco: "05",
      sala_id: null,
      descricao: null,
      ativo: true,
    });
    expect(esquemaHidrometro.parse({ numero: "X", bloco: "12" }).ativo).toBe(
      false,
    );
  });

  it("recusa número vazio e bloco inválido, com a mensagem do campo", () => {
    const sem = esquemaHidrometro.safeParse({ numero: " ", bloco: "05" });
    expect(sem.error?.issues[0]?.message).toMatch(/número do hidrômetro/);
    const bloco = esquemaHidrometro.safeParse({ numero: "A1", bloco: "1a" });
    expect(bloco.error?.issues[0]?.message).toMatch(/Bloco/);
  });

  it("sala: exige a sala e monta o código BLxx-sala", () => {
    expect(esquemaSala.safeParse({ bloco: "04", sala: "" }).success).toBe(
      false,
    );
    const s = esquemaSala.parse({ bloco: "4", sala: "311", rota: "" });
    expect(codigoDaSala(s.bloco, s.sala)).toBe("BL04-311");
    expect(s.rota).toBeNull();
  });
});
