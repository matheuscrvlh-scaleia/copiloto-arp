import { permissaoDoPrograma } from "@arp/shared/permissions";
import { describe, expect, it } from "vitest";
import { navigationFor } from "@/config/navigation";
import { euDeTeste } from "@/teste/api-falsa";
import { montarSessao } from "./sessao";

// "Programa – lançar" (sustentabilidade.programa.<id>): fica fora do catálogo
// fixo, mas precisa chegar à tela e abrir o item Programas do menu.

const PROGRAMA = permissaoDoPrograma("a0000000-0000-4000-8000-000000000002");

const itensDe = (s: ReturnType<typeof montarSessao>) =>
  navigationFor(
    (p) => s.usuario.permissoes.includes(p),
    s.usuario.programas.length > 0,
  )
    .filter((secao) => secao.titulo === "Sustentabilidade")
    .flatMap((secao) => secao.itens.map((i) => i.href));

describe("sessão: permissões por programa", () => {
  it("separa as fixas das de programa e descarta o que o sistema não conhece", () => {
    const s = montarSessao(
      euDeTeste([
        "os.acessar",
        PROGRAMA,
        "nao.existe",
        "sustentabilidade.programa.abc",
      ]),
    );
    expect(s.usuario.permissoes).toEqual(["os.acessar"]);
    expect(s.usuario.programas).toEqual([PROGRAMA]);
    expect(s.pode("os.acessar")).toBe(true);
    expect(s.pode(PROGRAMA)).toBe(true);
    expect(s.pode([PROGRAMA, "admin.usuarios"])).toBe(true);
    expect(
      s.pode(permissaoDoPrograma("b0000000-0000-4000-8000-000000000003")),
    ).toBe(false);
    expect(s.pode("sustentabilidade.programas.gerenciar")).toBe(false);
  });

  it("quem só lança num programa vê só o item Programas", () => {
    expect(itensDe(montarSessao(euDeTeste([PROGRAMA])))).toEqual([
      "/sustentabilidade/programas",
    ]);
    expect(itensDe(montarSessao(euDeTeste(["os.acessar"])))).toEqual([]);
    expect(
      itensDe(montarSessao(euDeTeste(["sustentabilidade.painel"]))),
    ).toEqual(["/sustentabilidade"]);
  });
});
