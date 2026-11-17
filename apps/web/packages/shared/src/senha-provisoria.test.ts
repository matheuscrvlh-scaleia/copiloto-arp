import { describe, expect, it } from "vitest";
import { SENHA_PROVISORIA, temSenhaProvisoria } from "./senha-provisoria";

describe("temSenhaProvisoria", () => {
  it("só vale com a marca ligada no app_metadata", () => {
    expect(
      temSenhaProvisoria({ app_metadata: { [SENHA_PROVISORIA]: true } }),
    ).toBe(true);
    expect(
      temSenhaProvisoria({ app_metadata: { [SENHA_PROVISORIA]: false } }),
    ).toBe(false);
    expect(temSenhaProvisoria({ app_metadata: {} })).toBe(false);
    expect(temSenhaProvisoria({})).toBe(false);
    expect(temSenhaProvisoria(null)).toBe(false);
  });

  it("não aceita a marca em user_metadata, que a própria pessoa edita", () => {
    expect(
      temSenhaProvisoria({
        user_metadata: { [SENHA_PROVISORIA]: true },
      } as never),
    ).toBe(false);
  });
});
