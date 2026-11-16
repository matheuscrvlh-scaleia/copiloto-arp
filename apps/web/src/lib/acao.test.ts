import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFalsa, erro, json } from "@/teste/api-falsa";
import { acaoDaApi, formParaObjeto } from "./acao";
import { clienteDeConsultas } from "./consulta";

function form(campos: [string, string | File][]): FormData {
  const f = new FormData();
  for (const [chave, valor] of campos) f.append(chave, valor);
  return f;
}

afterEach(() => clienteDeConsultas.clear());

describe("formParaObjeto", () => {
  it("campo único vira texto; repetido vira lista", () => {
    expect(
      formParaObjeto(
        form([
          ["nome", "Ana"],
          ["setor", "a"],
          ["setor", "b"],
        ]),
      ),
    ).toEqual({ nome: "Ana", setor: ["a", "b"] });
  });

  it("`listas` força lista com um valor ou nenhum", () => {
    expect(
      formParaObjeto(form([["setor", "a"]]), { listas: ["setor", "dias"] }),
    ).toEqual({ setor: ["a"], dias: [] });
  });

  it("arquivo vazio (campo não preenchido) fica de fora", () => {
    const foto = new File(["x"], "foto.png");
    const objeto = formParaObjeto(
      form([
        ["anexo", new File([], "")],
        ["foto", foto],
      ]),
    );
    expect(Object.keys(objeto)).toEqual(["foto"]);
    expect(objeto.foto).toBeInstanceOf(File);
  });
});

describe("acaoDaApi", () => {
  it("envia o formulário em JSON e devolve a mensagem da API", async () => {
    const falsa = apiFalsa({
      "POST /api/v1/os/setores": json({ mensagem: "Setor criado." }, 201),
    });
    const acao = acaoDaApi({ metodo: "POST", caminho: "/os/setores" });
    expect(await acao({}, form([["nome", "Elétrica"]]))).toEqual({
      ok: "Setor criado.",
    });
    expect(falsa.pedidos[0]?.corpo).toBe('{"nome":"Elétrica"}');
    expect(falsa.pedidos[0]?.headers.get("X-ARP")).toBe("1");
  });

  it("`mensagem` vale mais que a da resposta; sem nenhuma, 'Salvo.'", async () => {
    apiFalsa({
      "PATCH /api/v1/a": json({ mensagem: "Da API." }),
      "PATCH /api/v1/b": json({ id: 3 }),
    });
    const a = acaoDaApi({ metodo: "PATCH", caminho: "/a", mensagem: "Minha." });
    const b = acaoDaApi({ metodo: "PATCH", caminho: "/b" });
    expect(await a({}, new FormData())).toEqual({ ok: "Minha." });
    expect(await b({}, new FormData())).toEqual({ ok: "Salvo." });
  });

  it("caminho e corpo podem sair do formulário", async () => {
    const falsa = apiFalsa({ "PATCH /api/v1/os/setores/7": json({}) });
    const acao = acaoDaApi({
      metodo: "PATCH",
      caminho: (f) => `/os/setores/${String(f.get("id"))}`,
      corpo: (f) => ({ ativo: f.get("ativo") === "on" }),
    });
    await acao(
      {},
      form([
        ["id", "7"],
        ["ativo", "on"],
      ]),
    );
    expect(falsa.pedidos[0]?.corpo).toBe('{"ativo":true}');
  });

  it("corpo FormData vai como multipart; DELETE não leva corpo", async () => {
    const falsa = apiFalsa({
      "POST /api/v1/arquivos": json({}),
      "DELETE /api/v1/arquivos/1": json({ mensagem: "Excluído." }),
    });
    const f = form([["arquivo", new File(["x"], "a.txt")]]);
    await acaoDaApi({ metodo: "POST", caminho: "/arquivos", corpo: (x) => x })(
      {},
      f,
    );
    expect(falsa.pedidos[0]?.corpo).toBe(f);
    const r = await acaoDaApi({ metodo: "DELETE", caminho: "/arquivos/1" })(
      {},
      form([["id", "1"]]),
    );
    expect(r).toEqual({ ok: "Excluído." });
    expect(falsa.pedidos[1]?.corpo).toBeUndefined();
  });

  it("erro da API vira { erro } com o texto para a pessoa", async () => {
    apiFalsa({
      "POST /api/v1/a": erro(422, "regra", "Já existe um setor com esse nome."),
      "POST /api/v1/b": erro(400, "validacao", "Confira os campos.", {
        nome: "Informe o nome.",
      }),
    });
    const a = await acaoDaApi({ metodo: "POST", caminho: "/a" })(
      {},
      new FormData(),
    );
    const b = await acaoDaApi({ metodo: "POST", caminho: "/b" })(
      {},
      new FormData(),
    );
    expect(a).toEqual({ erro: "Já existe um setor com esse nome." });
    expect(b).toEqual({ erro: "Informe o nome." });
  });

  it("invalida as consultas do que mudou, só no sucesso", async () => {
    apiFalsa({
      "POST /api/v1/ok": json({}),
      "POST /api/v1/falha": erro(422, "regra"),
    });
    const invalidar = vi.spyOn(clienteDeConsultas, "invalidateQueries");
    await acaoDaApi({
      metodo: "POST",
      caminho: "/falha",
      invalida: [["os", "setores"]],
    })({}, new FormData());
    expect(invalidar).not.toHaveBeenCalled();

    await acaoDaApi({
      metodo: "POST",
      caminho: "/ok",
      invalida: (f) => [
        ["os", "setores"],
        ["os", "setor", f.get("id")],
      ],
    })({}, form([["id", "7"]]));
    expect(invalidar.mock.calls.map(([filtro]) => filtro?.queryKey)).toEqual([
      ["os", "setores"],
      ["os", "setor", "7"],
    ]);
  });

  it("aoGravar recebe a resposta depois de gravar", async () => {
    apiFalsa({ "POST /api/v1/os/chamados": json({ id: 42 }, 201) });
    const aoGravar = vi.fn();
    await acaoDaApi({ metodo: "POST", caminho: "/os/chamados", aoGravar })(
      {},
      new FormData(),
    );
    expect(aoGravar.mock.calls[0]?.[0]).toEqual({ id: 42 });
  });
});
