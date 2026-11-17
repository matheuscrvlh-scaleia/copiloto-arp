import { describe, expect, it } from "vitest";
import {
  blocoDaAuditoria,
  classificarLandingPages,
  conferirAsana,
  conferirFaixasReputacao,
  conferirLinkGoogle,
  corrigirLinhaDaCarga,
  ErroPlanilha,
  type LinhaAuditoria,
  lerCsv,
  lerPlanilhaDeLocatarios,
  locatarioRepetido,
  montarVoltar,
  mudancas,
  planoDaCarga,
} from "./parametros";

describe("conferirLinkGoogle", () => {
  it("aceita os formatos de link de perfil", () => {
    for (const url of [
      "https://maps.google.com/?cid=1001",
      "https://www.google.com/maps/place/Bistr%C3%B4+Tear/@-26.9,-49.0,17z",
      "https://www.google.com.br/maps/place/Loja",
      "https://maps.app.goo.gl/AbC123xyz",
      "https://g.page/bistro-tear",
      "https://goo.gl/maps/abc",
    ])
      expect(conferirLinkGoogle(url), url).toEqual({
        valido: true,
        aviso: null,
      });
  });

  it("avisa (sem bloquear) link vazio, inválido ou que não é de perfil", () => {
    expect(conferirLinkGoogle("").aviso).toMatch(/sem dados/);
    expect(conferirLinkGoogle("maps bistro").aviso).toMatch(/inválido/);
    expect(conferirLinkGoogle("https://instagram.com/bistro").aviso).toMatch(
      /perfil do Google não encontrado/,
    );
    expect(
      conferirLinkGoogle("https://www.google.com/search?q=x").aviso,
    ).toMatch(/Perfil do Google não encontrado/);
    expect(conferirLinkGoogle("https://google.com.evil.io/maps").valido).toBe(
      false,
    );
  });
});

describe("conferências do cadastro", () => {
  const lista = [
    { id: "1", nome: "Bistrô Tear" },
    { id: "2", nome: "Pet Carretel" },
  ];
  it("acha locatário repetido ignorando maiúsculas e espaços, fora o próprio", () => {
    expect(locatarioRepetido("  bistrô   TEAR ", lista)).toBe("Bistrô Tear");
    expect(locatarioRepetido("Bistrô Tear", lista, "1")).toBeNull();
    expect(locatarioRepetido("Novo", lista)).toBeNull();
  });

  it("exige Alerta > Atenção", () => {
    expect(conferirFaixasReputacao(1, 3)).toBeNull();
    expect(conferirFaixasReputacao(3, 3)).toMatch(/maior/);
    expect(conferirFaixasReputacao(4, 2)).toMatch(/maior/);
  });

  it("confere projetos e tags no Asana", () => {
    const c = conferirAsana(
      {
        asana_projetos_marketing: ["Marketing", "Projeto velho"],
        asana_projeto_calendario: "calendário de eventos",
        asana_projeto_ronda: null,
        asana_tag_locatario: "Locatário",
        asana_tag_terceiro: "Tag sumida",
        asana_tag_gratuita: "",
        asana_tag_paga: "Pago",
      },
      {
        projetos: ["Marketing", "Calendário de eventos"],
        tags: ["Locatário", "Pago"],
      },
    );
    expect(c.filter((x) => !x.existe).map((x) => x.nome)).toEqual([
      "Projeto velho",
      "Tag sumida",
    ]);
    expect(c).toHaveLength(6);
  });

  it("landing page do RD sem cadastro entra como Sem tipo, primeiro", () => {
    const ls = classificarLandingPages(
      [
        { conversion_identifier: "lp-a", nome: "A" },
        { conversion_identifier: "lp-a", nome: "A" },
        { conversion_identifier: "lp-nova", nome: "Nova" },
      ],
      [{ identificador: "lp-a", nome: "A", interesse: "evento" }],
    );
    expect(ls.map((l) => [l.identificador, l.interesse, l.cadastrada])).toEqual(
      [
        ["lp-nova", null, false],
        ["lp-a", "evento", true],
      ],
    );
  });
});

describe("planilha de locatários", () => {
  it("aceita cabeçalhos variados, acha o cabeçalho abaixo do título e ignora linhas vazias", () => {
    const r = lerPlanilhaDeLocatarios([
      ["Locatários-chave 2026", null, null],
      [],
      ["Loja", "Segmento", "Perfil no Google", "Tipo de acesso"],
      ["Bistrô Tear", "Gastronomia", "https://maps.app.goo.gl/x1", "Gerente"],
      [null, "", null, null],
      ["Pet Carretel", "Loja do térreo", "", ""],
      ["Ótica", "Loja", "instagram.com/otica", "público"],
    ]);
    expect(r.colunas).toMatchObject({
      nome: "Loja",
      categoria: "Segmento",
      perfil_url: "Perfil no Google",
      forma_acesso: "Tipo de acesso",
    });
    expect(r.faltando).toEqual([]);
    expect(r.linhas.map((l) => [l.linha, l.nome, l.forma_acesso])).toEqual([
      [4, "Bistrô Tear", "gerente"],
      [6, "Pet Carretel", "sem_acesso"],
      [7, "Ótica", "consulta_publica"],
    ]);
    expect(r.linhas.every((l) => l.problemas.length === 0)).toBe(true);
    // Link ruim não impede: só avisa "sem dados".
    expect(r.linhas[2]?.avisos.join(" ")).toMatch(/não é do Google/);
  });

  it("coluna faltando: aponta na prévia e marca as linhas com problema", () => {
    const r = lerPlanilhaDeLocatarios([
      ["Nome", "Link"],
      ["Bistrô Tear", "https://maps.google.com/?cid=1"],
      ["bistrô  tear ", ""],
    ]);
    expect(r.faltando).toEqual(["categoria"]);
    expect(r.linhas[0]?.problemas).toEqual(["Sem categoria"]);
    // Sem coluna de acesso, link de perfil vira consulta pública.
    expect(r.linhas[0]?.forma_acesso).toBe("consulta_publica");
    expect(r.linhas[1]?.problemas).toEqual([
      "Sem categoria",
      "Repetido na planilha (linha 2)",
    ]);
  });

  it("correção na prévia confere de novo a linha e as repetidas", () => {
    const { linhas } = lerPlanilhaDeLocatarios([
      ["Nome", "Categoria"],
      ["A", ""],
      ["A", "Loja"],
    ]);
    expect(linhas[1]?.problemas).toEqual(["Repetido na planilha (linha 2)"]);
    const corrigidas = corrigirLinhaDaCarga(linhas, 1, { nome: "B" });
    expect(corrigidas.map((l) => l.problemas)).toEqual([["Sem categoria"], []]);
    expect(
      corrigirLinhaDaCarga(corrigidas, 0, { categoria: "Gastronomia" })[0]
        ?.problemas,
    ).toEqual([]);
  });

  it("sem coluna de nome: erro claro", () => {
    expect(() =>
      lerPlanilhaDeLocatarios([
        ["a", "b"],
        ["1", "2"],
      ]),
    ).toThrow(ErroPlanilha);
  });

  it("lê CSV com ponto e vírgula e aspas", () => {
    expect(
      lerCsv('﻿Nome;Categoria\r\n"Ateliê; Cia";Loja\r\n\r\nB;"Diz ""oi"""'),
    ).toEqual([
      ["Nome", "Categoria"],
      ["Ateliê; Cia", "Loja"],
      [""],
      ["B", 'Diz "oi"'],
    ]);
  });

  it("plano da carga: inclui novos, atualiza os do mesmo nome, tira ausentes só se pedido", () => {
    const { linhas } = lerPlanilhaDeLocatarios([
      ["Nome", "Categoria", "Link"],
      ["bistrô tear", "Gastronomia", "https://maps.google.com/?cid=1"],
      ["Novo", "Serviços", ""],
      ["", "Sem nome", ""],
    ]);
    const existentes = [
      { id: "1", nome: "Bistrô Tear", ativo: true },
      { id: "2", nome: "Pet Carretel", ativo: true },
      { id: "3", nome: "Antigo", ativo: false },
    ];
    const p = planoDaCarga(linhas, existentes, false);
    expect(p.incluir.map((l) => l.nome)).toEqual(["Novo"]);
    expect(p.atualizar.map((l) => l.id)).toEqual(["1"]);
    expect(p.tirar).toEqual([]);
    expect(p.deFora).toBe(1);
    expect(planoDaCarga(linhas, existentes, true).tirar).toEqual([
      { id: "2", nome: "Pet Carretel" },
    ]);
  });
});

describe("histórico e voltar", () => {
  const base: LinhaAuditoria = {
    id: 1,
    tabela: "marketing.parametros",
    registro_id: "true",
    acao: "update",
    antes: null,
    depois: null,
    usuario_id: null,
    em: "2026-10-29T12:00:00Z",
  };

  it("alteração: volta só os campos editáveis que ela mudou", () => {
    const l = {
      ...base,
      antes: {
        id: true,
        reclamacoes_alerta: 3,
        nota_atencao: 4,
        atualizado_em: "a",
      },
      depois: {
        id: true,
        reclamacoes_alerta: 5,
        nota_atencao: 4,
        atualizado_em: "b",
      },
    };
    expect(montarVoltar(l)).toEqual({
      tipo: "alterar",
      tabela: "marketing.parametros",
      chave: { coluna: "id", valor: true },
      valores: { reclamacoes_alerta: 3 },
    });
    expect(blocoDaAuditoria(l)).toBe("reputacao");
    expect(mudancas(l)).toEqual([
      {
        campo: "reclamacoes_alerta",
        rotulo: "Reclamações para Alerta",
        antes: "3",
        depois: "5",
      },
    ]);
  });

  it("inclusão: apaga; remoção: reinclui a linha como era", () => {
    const loc = {
      id: "u1",
      nome: "Bistrô Tear",
      categoria: "Gastronomia",
      perfil_url: null,
      forma_acesso: "gerente",
      ativo: true,
      entrada_em: "2026-01-05",
      saida_em: null,
      criado_em: "x",
      atualizado_em: "x",
    };
    const t = { ...base, tabela: "marketing.locatarios", registro_id: "u1" };
    expect(montarVoltar({ ...t, acao: "insert", depois: loc })).toEqual({
      tipo: "apagar",
      tabela: "marketing.locatarios",
      chave: { coluna: "id", valor: "u1" },
    });
    const v = montarVoltar({ ...t, acao: "delete", antes: loc });
    expect(v.tipo).toBe("incluir");
    if (v.tipo === "incluir")
      expect(v.valores).toEqual({
        id: "u1",
        nome: "Bistrô Tear",
        categoria: "Gastronomia",
        perfil_url: null,
        forma_acesso: "gerente",
        ativo: true,
        entrada_em: "2026-01-05",
        saida_em: null,
      });
  });

  it("recusa o que não é do Marketing ou não se desfaz", () => {
    expect(
      montarVoltar({
        ...base,
        tabela: "core.metas",
        antes: { id: "m", indicador: "rh.turnover", meta: 1 },
        depois: { id: "m", indicador: "rh.turnover", meta: 2 },
      }).tipo,
    ).toBe("impossivel");
    expect(
      montarVoltar({
        ...base,
        tabela: "marketing.regras_alerta",
        acao: "insert",
        depois: { regra: "tarefa_atrasada" },
      }).tipo,
    ).toBe("impossivel");
    expect(
      montarVoltar({
        ...base,
        antes: { id: true, atualizado_em: "a" },
        depois: { id: true, atualizado_em: "b" },
      }).tipo,
    ).toBe("impossivel");
    expect(montarVoltar({ ...base, tabela: "rh.jornadas" }).tipo).toBe(
      "impossivel",
    );
  });
});
