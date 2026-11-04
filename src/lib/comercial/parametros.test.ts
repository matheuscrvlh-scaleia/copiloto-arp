import { describe, expect, it } from "vitest";
import {
  blocoDaAuditoria,
  CAMPOS,
  conferirFaixasEvento,
  descreverRegistro,
  ESQUEMAS,
  type ItemLista,
  mudancas,
  obrigatoriosDoForm,
  planoDaLista,
  validarBloco,
} from "./parametros";

describe("validarBloco", () => {
  it("ocupação: faixa B precisa ser maior que a A", () => {
    expect(
      validarBloco("ocupacao", {
        transferencia_dias: "30",
        curva_a_pct: "70",
        curva_b_pct: "90",
      }),
    ).toEqual({
      ok: true,
      dados: { transferencia_dias: 30, curva_a_pct: 70, curva_b_pct: 90 },
    });
    const r = validarBloco("ocupacao", {
      transferencia_dias: "30",
      curva_a_pct: "90",
      curva_b_pct: "70",
    });
    expect(r).toEqual({
      ok: false,
      erro: "Faixa B da curva até (%): precisa ser maior que a faixa A",
    });
  });

  it("vencimentos: faixa 2 maior que a 1, números inteiros positivos", () => {
    const base = {
      vencimento_faixa1_dias: "30",
      vencimento_faixa2_dias: "90",
      lembrete_aniversario_dias: "3",
      reajuste_previsto_dias: "60",
    };
    expect(validarBloco("vencimentos", base).ok).toBe(true);
    expect(
      validarBloco("vencimentos", { ...base, vencimento_faixa2_dias: "30" }),
    ).toMatchObject({ ok: false, erro: expect.stringContaining("faixa 1") });
    expect(
      validarBloco("vencimentos", { ...base, vencimento_faixa1_dias: "0" }),
    ).toMatchObject({
      ok: false,
      erro: expect.stringContaining("no mínimo 1"),
    });
    expect(
      validarBloco("vencimentos", {
        ...base,
        lembrete_aniversario_dias: "2,5",
      }),
    ).toMatchObject({ ok: false, erro: expect.stringContaining("sem casas") });
    expect(
      validarBloco("vencimentos", { ...base, reajuste_previsto_dias: "abc" }),
    ).toMatchObject({ ok: false });
  });

  it("contratos: aceita vírgula, formata o CEP e recusa caução zero", () => {
    const form = {
      empreendimento_nome: "ARP",
      endereco_cep: "28613001",
      endereco_logradouro: "Av. Exemplo",
      endereco_numero: "80",
      endereco_complemento: "",
      endereco_bairro: "Centro",
      endereco_cidade: "Nova Friburgo",
      endereco_uf: "rj",
      indice_padrao: "IGPM",
      dia_vencimento_padrao: "10",
      caucao_alugueis: "2,5",
      caucao_prazo_dias: "5",
      capitalizacao_prazo_dias: "7",
      nc004_versao: "JUL/26",
      obras_tapume_dias: "7",
      obras_retirada_dias: "60",
      obras_projetos_dias: "60",
      multa_alugueis: "3",
      vaga_promocional_padrao: "1",
      consumo_agua_padrao: "on",
      entrega_tipo_imovel: "Loja",
      entrega_padrao: "Shell",
      entrega_prazo_implantacao_dias: "60",
    };
    const r = validarBloco("contratos", form);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados.endereco_cep).toBe("28613-001");
      expect(r.dados.endereco_uf).toBe("RJ");
      expect(r.dados.caucao_alugueis).toBe(2.5);
      expect(r.dados.endereco_complemento).toBeNull();
      expect(r.dados.consumo_agua_padrao).toBe(true);
    }
    expect(
      validarBloco("contratos", { ...form, consumo_agua_padrao: undefined }),
    ).toMatchObject({ ok: true, dados: { consumo_agua_padrao: false } });
    expect(
      validarBloco("contratos", { ...form, caucao_alugueis: "0" }),
    ).toMatchObject({ ok: false, erro: expect.stringContaining("caução") });
    expect(
      validarBloco("contratos", { ...form, dia_vencimento_padrao: "32" }),
    ).toMatchObject({ ok: false });
    expect(
      validarBloco("contratos", { ...form, indice_padrao: "INPC" }),
    ).toMatchObject({ ok: false });
  });

  it("eventos: desconto até 100% e notas uma por linha", () => {
    const form = {
      evento_reajuste_pct: "10",
      evento_desconto_pct: "30",
      evento_pessoas_por_seguranca: "100",
      evento_m2_por_agente: "200",
      evento_fechamento_dias_uteis: "30",
      evento_validade_dias: "30",
      evento_horario: "10h às 22h",
      evento_condicao_pagamento: "50% e 50%",
      evento_montagem: "Dia anterior",
      evento_desmontagem: "Até 02h",
      evento_area_texto: "Planta anexa",
      evento_notas: "Nota 1\r\n\r\n  Nota 2  ",
    };
    expect(validarBloco("eventos", form)).toMatchObject({
      ok: true,
      dados: { evento_notas: ["Nota 1", "Nota 2"], evento_desconto_pct: 30 },
    });
    expect(
      validarBloco("eventos", { ...form, evento_desconto_pct: "101" }),
    ).toMatchObject({ ok: false });
    expect(
      validarBloco("eventos", { ...form, evento_pessoas_por_seguranca: "0" }),
    ).toMatchObject({ ok: false });
  });

  it("pesquisa: faixas de m² crescentes e positivas", () => {
    expect(
      validarBloco("pesquisa", { pesquisa_faixas_m2: "30; 50; 80,5; 100" }),
    ).toEqual({ ok: true, dados: { pesquisa_faixas_m2: [30, 50, 80.5, 100] } });
    expect(
      validarBloco("pesquisa", { pesquisa_faixas_m2: "50; 30" }),
    ).toMatchObject({ ok: false, erro: expect.stringContaining("crescente") });
    expect(
      validarBloco("pesquisa", { pesquisa_faixas_m2: "0; 30" }),
    ).toMatchObject({ ok: false });
    expect(validarBloco("pesquisa", { pesquisa_faixas_m2: "" })).toMatchObject({
      ok: false,
    });
  });

  it("todo campo dos esquemas tem rótulo no catálogo", () => {
    for (const esquema of Object.values(ESQUEMAS)) {
      const forma =
        "shape" in esquema
          ? esquema.shape
          : (esquema as unknown as { _def: { schema: { shape: object } } })._def
              .schema.shape;
      for (const campo of Object.keys(forma ?? {}))
        expect(CAMPOS[campo], campo).toBeDefined();
    }
  });
});

describe("obrigatoriosDoForm", () => {
  it("monta o objeto por garantia na ordem do catálogo, ignorando campo estranho", () => {
    const form: [string, string][] = [
      ["garantia.caucao", "data_deposito"],
      ["garantia.caucao", "aluguel_base"],
      ["garantia.caucao", "hackeado"],
      ["garantia.fiador", "fiadores"],
      ["bloco", "contratos"],
    ];
    const r = obrigatoriosDoForm(form);
    expect(r.caucao).toEqual(["aluguel_base", "data_deposito"]);
    expect(r.fiador).toEqual(["fiadores"]);
    expect(r.seguro_fianca).toEqual([]);
    expect(r.sem_garantia).toEqual([]);
  });
});

describe("planoDaLista", () => {
  const atuais: ItemLista[] = [
    { id: "a", valor: "Presencial", ordem: 1, ativo: true, extra: {} },
    { id: "b", valor: "WhatsApp", ordem: 2, ativo: true, extra: {} },
    { id: "c", valor: "Telefone", ordem: 3, ativo: false, extra: {} },
  ];

  it("inclui o novo, reordena, reativa e desativa o que saiu", () => {
    const r = planoDaLista(atuais, "WhatsApp\ntelefone\nE-mail\n\n");
    expect(r).toEqual({
      plano: {
        incluir: [{ valor: "E-mail", ordem: 3, extra: {} }],
        atualizar: [
          { id: "b", ordem: 1, ativo: true, extra: {} },
          { id: "c", ordem: 2, ativo: true, extra: {} },
        ],
        desativar: ["a"],
      },
    });
  });

  it("nada muda quando o texto é igual", () => {
    expect(planoDaLista(atuais, "Presencial\nWhatsApp")).toEqual({
      plano: { incluir: [], atualizar: [], desativar: [] },
    });
  });

  it("recusa lista vazia e valor repetido", () => {
    expect(planoDaLista(atuais, "  \n")).toEqual({
      erro: "a lista precisa de ao menos um valor",
    });
    expect(planoDaLista(atuais, "Presencial\npresencial")).toEqual({
      erro: "“presencial” está repetido",
    });
  });

  it("grava a marca (obrigatório) de cada valor", () => {
    const docs: ItemLista[] = [
      {
        id: "x",
        valor: "RG",
        ordem: 1,
        ativo: true,
        extra: { obrigatorio: true },
      },
    ];
    const r = planoDaLista(docs, "RG\nCNH", {
      chave: "obrigatorio",
      marcados: new Set(["cnh"]),
    });
    expect(r).toEqual({
      plano: {
        incluir: [{ valor: "CNH", ordem: 2, extra: { obrigatorio: true } }],
        atualizar: [
          { id: "x", ordem: 1, ativo: true, extra: { obrigatorio: false } },
        ],
        desativar: [],
      },
    });
  });
});

describe("conferirFaixasEvento", () => {
  const f = (nome: string, de: number, ate: number, fixo = false) => ({
    nome,
    area_de: de,
    area_ate: ate,
    fixo,
    valor_comum: 1,
    valor_sazonal: 2,
    ordem: 0,
  });
  it("aceita as faixas contíguas e a fixa por cima", () => {
    expect(
      conferirFaixasEvento([
        f("Fixo", 0, 25, true),
        f("1", 0, 100),
        f("2", 100, 300),
        f("3", 300, 1000),
      ]),
    ).toBeNull();
  });
  it("recusa sobreposição e duas fixas", () => {
    expect(conferirFaixasEvento([f("1", 0, 100), f("2", 90, 300)])).toContain(
      "faixa 2",
    );
    expect(
      conferirFaixasEvento([f("A", 0, 25, true), f("B", 0, 30, true)]),
    ).toContain("Só uma");
  });
});

describe("histórico", () => {
  it("mostra quem mudou o quê: antes e depois, no bloco certo", () => {
    const l = {
      tabela: "comercial.parametros",
      registro_id: "true",
      acao: "update",
      antes: { id: true, evento_desconto_pct: 25, atualizado_em: "x" },
      depois: { id: true, evento_desconto_pct: 30, atualizado_em: "y" },
    };
    expect(mudancas(l)).toEqual([
      {
        campo: "evento_desconto_pct",
        rotulo: "Desconto padrão (%)",
        antes: "25",
        depois: "30",
      },
    ]);
    expect(blocoDaAuditoria(l)).toBe("eventos");
    expect(descreverRegistro(l)).toBe("Eventos");
  });

  it("de-para, listas e feriados", () => {
    const dp = {
      tabela: "comercial.fontes_de_para",
      registro_id: "Busca Paga | Google",
      acao: "update",
      antes: { fonte_rd: "Busca Paga | Google", fonte_ajustada: "Outros" },
      depois: {
        fonte_rd: "Busca Paga | Google",
        fonte_ajustada: "Google Pago",
      },
    };
    expect(blocoDaAuditoria(dp)).toBe("funil");
    expect(mudancas(dp)[0]).toMatchObject({
      antes: "Outros",
      depois: "Google Pago",
    });
    const lista = {
      tabela: "comercial.listas",
      registro_id: "1",
      acao: "insert",
      antes: null,
      depois: {
        lista: "tipo_contato",
        valor: "Elogio",
        ordem: 9,
        ativo: true,
        extra: { feedback: true },
      },
    };
    expect(blocoDaAuditoria(lista)).toBe("vencimentos");
    expect(descreverRegistro(lista)).toBe("Tipos de contato · Elogio");
    expect(mudancas(lista).find((m) => m.campo === "extra")?.depois).toBe(
      "entra em Feedbacks",
    );
    const fer = {
      tabela: "os.feriados",
      registro_id: "2026-05-16",
      acao: "delete",
      antes: { data: "2026-05-16", nome: "Aniversário" },
      depois: null,
    };
    expect(blocoDaAuditoria(fer)).toBe("calendario");
    expect(descreverRegistro(fer)).toBe("16/05/2026 · Aniversário");
  });
});
