import { beforeAll, describe, expect, it } from "vitest";
import { DURACAO_MAXIMA_MS, INATIVIDADE_MS } from "@/config/sessao";
import { assinarSessao, lerSessao, sessaoVencida } from "./sessao";

const SUB = "6f1c2c1e-1111-4222-8333-944455556666";
const T0 = 1_800_000_000_000;

beforeAll(() => {
  process.env.SESSAO_CHAVE = Buffer.alloc(32, 7).toString("base64");
});

describe("cookie do prazo da sessão", () => {
  it("lê de volta o que assinou", async () => {
    const p = { sub: SUB, inicio: T0, ultima: T0 + 1000 };
    expect(await lerSessao(await assinarSessao(p))).toEqual(p);
  });

  it("recusa cookie alterado, malformado ou ausente", async () => {
    const valor = await assinarSessao({ sub: SUB, inicio: T0, ultima: T0 });
    const [sub, inicio, , assinatura] = valor.split(".");
    expect(
      await lerSessao(`${sub}.${inicio}.${T0 + 999_999}.${assinatura}`),
    ).toBeNull();
    expect(await lerSessao(`${sub}.${inicio}.${T0}.xx`)).toBeNull();
    expect(await lerSessao("lixo")).toBeNull();
    expect(await lerSessao(undefined)).toBeNull();
  });
});

describe("sessaoVencida", () => {
  const p = { sub: SUB, inicio: T0, ultima: T0 };

  it("vale dentro do prazo", () => {
    expect(sessaoVencida(p, SUB, T0 + INATIVIDADE_MS)).toBe(false);
  });

  it("vence após 30 min parada", () => {
    expect(sessaoVencida(p, SUB, T0 + INATIVIDADE_MS + 1)).toBe(true);
  });

  it("vence após 8h mesmo em uso", () => {
    const agora = T0 + DURACAO_MAXIMA_MS + 1;
    expect(sessaoVencida({ ...p, ultima: agora - 1000 }, SUB, agora)).toBe(
      true,
    );
  });

  it("vence sem prazo ou com prazo de outra pessoa", () => {
    expect(sessaoVencida(null, SUB, T0)).toBe(true);
    expect(sessaoVencida(p, "outra", T0)).toBe(true);
  });
});
