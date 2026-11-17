import { describe, expect, it } from "vitest";
import {
  diferencaDeLinhas,
  ESQUEMAS,
  esquemaChamadoFixo,
  esquemaCustosDoTour,
  esquemaEquivalencias,
  esquemaMarcos,
  esquemaPrecosRcc,
  esquemaReabertura,
  esquemaSetores,
  esquemaVigenciaRcc,
  lerMetasDoForm,
  mudancasDoHistorico,
  recorrenciaDoChamadoFixo,
} from "./painel-parametros";

const lista = (...itens: string[]) => JSON.stringify(itens);

describe("parâmetros: validação por aba", () => {
  it("entrevistas: padrões do spec são aceitos", () => {
    const r = ESQUEMAS.entrevistas.safeParse({
      meses_primeira_entrevista: "6",
      validade_padrao_meses: "24",
      aviso_dias: "30",
      tipos_loja_dispensados: lista("Área Publicitária"),
      data_inauguracao: "ativacao",
      motivos_dispensa: lista("Contrato temporário", "Outro"),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.meses_primeira_entrevista).toBe(6);
      expect(r.data.tipos_loja_dispensados).toEqual(["Área Publicitária"]);
    }
  });

  it("entrevistas: valores fora da faixa e lista vazia são recusados", () => {
    const base = {
      meses_primeira_entrevista: "6",
      validade_padrao_meses: "24",
      aviso_dias: "30",
      tipos_loja_dispensados: lista(),
      data_inauguracao: "ativacao",
      motivos_dispensa: lista("Outro"),
    };
    expect(ESQUEMAS.entrevistas.safeParse(base).success).toBe(true); // dispensados pode ficar vazio
    expect(
      ESQUEMAS.entrevistas.safeParse({ ...base, validade_padrao_meses: "0" })
        .success,
    ).toBe(false);
    expect(
      ESQUEMAS.entrevistas.safeParse({ ...base, aviso_dias: "-1" }).success,
    ).toBe(false);
    expect(
      ESQUEMAS.entrevistas.safeParse({ ...base, data_inauguracao: "outra" })
        .success,
    ).toBe(false);
    expect(
      ESQUEMAS.entrevistas.safeParse({ ...base, motivos_dispensa: lista() })
        .success,
    ).toBe(false);
  });

  it("listas: tira vazios e repetidos", () => {
    const r = ESQUEMAS.clube.safeParse({
      termo_validade_meses: "12",
      termo_aviso_dias: "30",
      clube_formas: lista(" Pagante ", "Pagante", "", "Engajado"),
      formas_contribuicao: lista("PIX"),
      tipos_acao: lista("Oficina"),
    });
    expect(r.success && r.data.clube_formas).toEqual(["Pagante", "Engajado"]);
  });

  it("coletores: limite de 1 a 100 e setor opcional", () => {
    expect(
      ESQUEMAS.coletores.safeParse({
        limite_ocupacao_pct: "90",
        recolhimento_setor_id: "",
      }).success,
    ).toBe(true);
    expect(
      ESQUEMAS.coletores.safeParse({
        limite_ocupacao_pct: "101",
        recolhimento_setor_id: "",
      }).success,
    ).toBe(false);
    expect(
      ESQUEMAS.coletores.safeParse({
        limite_ocupacao_pct: "90",
        recolhimento_setor_id: "nao-e-uuid",
      }).success,
    ).toBe(false);
  });

  it("programas: dia da cobrança de 1 a 28", () => {
    const base = {
      areas_impacto: lista("Ambiental"),
      grupos_impacto: lista("Oficinas"),
      unidades: lista("kg"),
    };
    expect(
      ESQUEMAS.programas.safeParse({ ...base, cobranca_dia: "5" }).success,
    ).toBe(true);
    expect(
      ESQUEMAS.programas.safeParse({ ...base, cobranca_dia: "29" }).success,
    ).toBe(false);
    expect(
      ESQUEMAS.programas.safeParse({ ...base, cobranca_dia: "0" }).success,
    ).toBe(false);
  });

  it("custos do tour: vírgula, 2 casas, sem negativo", () => {
    const r = esquemaCustosDoTour.safeParse({
      tour_custo_album: "2,48",
      tour_custo_copo: "2,92",
    });
    expect(r.success && r.data).toEqual({
      tour_custo_album: 2.48,
      tour_custo_copo: 2.92,
    });
    expect(
      esquemaCustosDoTour.safeParse({
        tour_custo_album: "-1",
        tour_custo_copo: "1",
      }).success,
    ).toBe(false);
    expect(
      esquemaCustosDoTour.safeParse({
        tour_custo_album: "1,234",
        tour_custo_copo: "1",
      }).success,
    ).toBe(false);
  });
});

describe("parâmetros: tabelas editáveis", () => {
  it("validade por setor: meses de 1 a 120 e sem setor repetido", () => {
    expect(
      esquemaSetores.safeParse(
        JSON.stringify([
          { setor: "Saúde", meses: 24 },
          { setor: "Gastronômico", meses: "12" },
        ]),
      ).success,
    ).toBe(true);
    expect(
      esquemaSetores.safeParse(
        JSON.stringify([
          { setor: "Saúde", meses: 24 },
          { setor: "saúde", meses: 12 },
        ]),
      ).success,
    ).toBe(false);
    expect(
      esquemaSetores.safeParse(JSON.stringify([{ setor: "Saúde", meses: 0 }]))
        .success,
    ).toBe(false);
  });

  it("marcos: indicador do catálogo, ano e valor; sem repetir o par", () => {
    expect(
      esquemaMarcos.safeParse(
        JSON.stringify([
          { indicador: "volume_reciclado", ano: 2024, valor: "18.420" },
          { indicador: "volume_reciclado", ano: 2025, valor: "22830" },
        ]),
      ).success,
    ).toBe(true);
    expect(
      esquemaMarcos.safeParse(
        JSON.stringify([{ indicador: "outro", ano: 2024, valor: "1" }]),
      ).success,
    ).toBe(false);
    expect(
      esquemaMarcos.safeParse(
        JSON.stringify([{ indicador: "oficinas", ano: 2024, valor: "1" }]),
      ).success,
    ).toBe(false); // oficinas não tem marco
    expect(
      esquemaMarcos.safeParse(
        JSON.stringify([
          { indicador: "rcc_total", ano: 2024, valor: "1" },
          { indicador: "rcc_total", ano: 2024, valor: "2" },
        ]),
      ).success,
    ).toBe(false);
    expect(
      esquemaMarcos.safeParse(
        JSON.stringify([{ indicador: "rcc_total", ano: 2024, valor: "-5" }]),
      ).success,
    ).toBe(false);
  });

  it("equivalências: fator maior que zero, confirmação opcional, sem nome repetido", () => {
    const r = esquemaEquivalencias.safeParse(
      JSON.stringify([
        {
          nome: "Árvores",
          fator: "17,5",
          unidade: "árvores",
          confirmado: false,
        },
        { nome: "Água", fator: 3, unidade: "", confirmado: true },
      ]),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data[0]?.fator).toBe(17.5);
      expect(r.data[1]?.unidade).toBeNull();
      expect(r.data[1]?.confirmado).toBe(true);
    }
    expect(
      esquemaEquivalencias.safeParse(
        JSON.stringify([
          { nome: "X", fator: 0, unidade: "", confirmado: false },
        ]),
      ).success,
    ).toBe(false);
    expect(
      esquemaEquivalencias.safeParse(
        JSON.stringify([
          { nome: "X", fator: 1, unidade: "", confirmado: false },
          { nome: "x", fator: 2, unidade: "", confirmado: false },
        ]),
      ).success,
    ).toBe(false);
  });

  it("RCC: nova vigência com data, fator e volume positivos; preço sem negativo", () => {
    expect(
      esquemaVigenciaRcc.safeParse({
        vigente_desde: "2026-12-01",
        toneladas_por_cacamba: "7",
        volume_m3: "5",
      }).success,
    ).toBe(true);
    expect(
      esquemaVigenciaRcc.safeParse({
        vigente_desde: "01/12/2026",
        toneladas_por_cacamba: "7",
        volume_m3: "5",
      }).success,
    ).toBe(false);
    expect(
      esquemaVigenciaRcc.safeParse({
        vigente_desde: "2026-12-01",
        toneladas_por_cacamba: "0",
        volume_m3: "5",
      }).success,
    ).toBe(false);
    expect(
      esquemaPrecosRcc.safeParse({ preco_a: "150,00", preco_b: "400" }).success,
    ).toBe(true);
    expect(
      esquemaPrecosRcc.safeParse({ preco_a: "-1", preco_b: "400" }).success,
    ).toBe(false);
  });
});

describe("metas por indicador e ano", () => {
  const form = (dados: Record<string, string>) => ({
    get: (n: string) => (n in dados ? (dados[n] as string) : null),
  });

  it("lê as preenchidas e deixa vazio sem meta", () => {
    const r = lerMetasDoForm(
      form({
        meta_volume_reciclado: "26.000",
        meta_oficinas: "",
        meta_rcc_total: "300,5",
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const por = Object.fromEntries(r.metas.map((m) => [m.chave, m.meta]));
      expect(por.volume_reciclado).toBe(26000);
      expect(por.rcc_total).toBe(300.5);
      expect(por.oficinas).toBeNull();
      // campo ausente: a meta não é tocada
      expect("energia_gerada" in por).toBe(false);
      expect("ocupacao_coletores" in por).toBe(false);
    }
  });

  it("recusa texto e negativo, dizendo o indicador", () => {
    const a = lerMetasDoForm(form({ meta_volume_reciclado: "muito" }));
    expect(a).toEqual({
      ok: false,
      erro: "Volume reciclado no ano: informe um número.",
    });
    const b = lerMetasDoForm(form({ meta_oficinas: "-3" }));
    expect(b.ok).toBe(false);
  });
});

describe("fechar e reabrir o ano", () => {
  it("reabrir exige motivo", () => {
    expect(
      esquemaReabertura.safeParse({ ano: "2026", motivo: "" }).success,
    ).toBe(false);
    expect(
      esquemaReabertura.safeParse({ ano: "2026", motivo: "abc" }).success,
    ).toBe(false);
    expect(
      esquemaReabertura.safeParse({
        ano: "2026",
        motivo: "Faltou lançar uma coleta",
      }).success,
    ).toBe(true);
  });
});

describe("chamados fixos", () => {
  it("ronda semanal no dia escolhido; nota do RCC e relatório mensais", () => {
    expect(recorrenciaDoChamadoFixo("ronda", { diaSemana: 2 })).toEqual({
      frequencia: "semanal",
      dias_semana: [2],
    });
    expect(recorrenciaDoChamadoFixo("rcc", { diaMes: 5 })).toEqual({
      frequencia: "mensal",
      dia_mes: 5,
    });
    expect(recorrenciaDoChamadoFixo("relatorio", { diaMes: 31 })).toEqual({
      frequencia: "mensal",
      dia_mes: 31,
    });
  });

  it("valida tipo e responsável", () => {
    const ok = esquemaChamadoFixo.safeParse({
      tipo: "ronda",
      responsavel: "11111111-1111-4111-8111-111111111111",
      dia_semana: "2",
    });
    expect(ok.success && ok.data.dia_semana).toBe(2);
    expect(
      esquemaChamadoFixo.safeParse({ tipo: "outro", responsavel: "x" }).success,
    ).toBe(false);
    expect(
      esquemaChamadoFixo.safeParse({
        tipo: "rcc",
        responsavel: "11111111-1111-4111-8111-111111111111",
        dia_mes: "32",
      }).success,
    ).toBe(false);
  });
});

describe("histórico de alterações", () => {
  it("linha única: só o que mudou, com a aba e o rótulo", () => {
    const m = mudancasDoHistorico(
      "sustentabilidade.parametros",
      "update",
      { limite_ocupacao_pct: 80, aviso_dias: 30, atualizado_em: "a" },
      { limite_ocupacao_pct: 90, aviso_dias: 30, atualizado_em: "b" },
    );
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({
      campo: "Coletores · Limite de alerta de ocupação (%)",
      aba: "coletores",
      antes: "80",
      depois: "90",
    });
  });

  it("listas, datas de inauguração e setor viram texto legível", () => {
    const m = mudancasDoHistorico(
      "sustentabilidade.parametros",
      "update",
      {
        tipos_loja_dispensados: ["Área Publicitária"],
        data_inauguracao: "ativacao",
        recolhimento_setor_id: null,
      },
      {
        tipos_loja_dispensados: ["Área Publicitária", "Quiosque"],
        data_inauguracao: "inicio",
        recolhimento_setor_id: "s1",
      },
      { setores: new Map([["s1", "Operações"]]) },
    );
    const por = Object.fromEntries(m.map((x) => [x.campo, x]));
    expect(por["Entrevistas · Tipos de loja dispensados"]?.depois).toBe(
      "Área Publicitária, Quiosque",
    );
    expect(
      por["Entrevistas · Data do contrato que conta como inauguração"]?.depois,
    ).toBe("Data de início");
    expect(
      por["Coletores · Quem recebe o chamado de recolhimento (setor)"],
    ).toMatchObject({ antes: "vazio", depois: "Operações" });
  });

  it("vigência nova do RCC é inclusão, não sobrescrita", () => {
    const m = mudancasDoHistorico(
      "sustentabilidade.rcc_fatores",
      "insert",
      null,
      { vigente_desde: "2026-12-01", toneladas_por_cacamba: 7, volume_m3: 5 },
    );
    expect(m).toEqual([
      {
        chave: "sustentabilidade.rcc_fatores:novo",
        campo: "Fator do RCC · a partir de 01/12/2026",
        aba: "rcc",
        antes: "—",
        depois: "incluído",
      },
    ]);
  });

  it("validade por setor alterada e marco removido", () => {
    const a = mudancasDoHistorico(
      "sustentabilidade.setor_validades",
      "update",
      { setor: "Saúde", meses: 24 },
      { setor: "Saúde", meses: 36 },
    );
    expect(a[0]).toMatchObject({
      campo: "Validade por setor · Saúde · Validade (meses)",
      antes: "24",
      depois: "36",
      aba: "entrevistas",
    });
    const b = mudancasDoHistorico(
      "sustentabilidade.marcos",
      "delete",
      { indicador: "volume_reciclado", ano: 2024, valor: 18420 },
      null,
    );
    expect(b[0]?.campo).toBe("Marco inicial · Volume reciclado (kg) 2024");
    expect(b[0]?.depois).toBe("removido");
  });

  it("meta do painel: nome do indicador e a partir de quando", () => {
    const m = mudancasDoHistorico(
      "core.metas",
      "update",
      {
        indicador: "sustentabilidade.volume_reciclado",
        meta: 20000,
        vigente_desde: "2026-01-01",
        direcao: "maior_melhor",
      },
      {
        indicador: "sustentabilidade.volume_reciclado",
        meta: 26000,
        vigente_desde: "2026-01-01",
        direcao: "maior_melhor",
      },
    );
    expect(m).toHaveLength(1);
    expect(m[0]?.campo).toBe(
      "Meta · Volume reciclado no ano (a partir de 01/01/2026) · Meta",
    );
    expect(m[0]).toMatchObject({
      antes: "20000",
      depois: "26000",
      aba: "painel",
    });
  });

  it("consolidado: situação e motivo; os totais não aparecem com números", () => {
    const m = mudancasDoHistorico(
      "sustentabilidade.consolidados",
      "update",
      {
        ano: 2026,
        situacao: "fechado",
        totais: { a: 1 },
        reaberto_motivo: null,
      },
      {
        ano: 2026,
        situacao: "reaberto",
        totais: { a: 2 },
        reaberto_motivo: "Faltou coleta",
      },
    );
    const por = Object.fromEntries(m.map((x) => [x.campo, x]));
    expect(por["Consolidado anual · ano 2026 · Situação"]).toMatchObject({
      antes: "fechado",
      depois: "reaberto",
    });
    expect(por["Consolidado anual · ano 2026 · Totais"]?.depois).toBe(
      "regravados",
    );
  });
});

describe("diferença de linhas das tabelas editáveis", () => {
  const chave = (l: { setor: string }) => l.setor;
  const igual = (a: { meses: number }, b: { meses: number }) =>
    a.meses === b.meses;
  it("separa o novo, o alterado e o removido", () => {
    const r = diferencaDeLinhas(
      [
        { setor: "Saúde", meses: 24 },
        { setor: "Educação", meses: 24 },
        { setor: "Industrial", meses: 12 },
      ],
      [
        { setor: "Saúde", meses: 36 },
        { setor: "Educação", meses: 24 },
        { setor: "Gastronômico", meses: 12 },
      ],
      chave,
      igual,
    );
    expect(r.inserir).toEqual([{ setor: "Gastronômico", meses: 12 }]);
    expect(r.atualizar).toEqual([{ setor: "Saúde", meses: 36 }]);
    expect(r.apagar).toEqual([{ setor: "Industrial", meses: 12 }]);
  });
  it("nada mudou: nada a gravar", () => {
    const l = [{ setor: "Saúde", meses: 24 }];
    expect(diferencaDeLinhas(l, l, chave, igual)).toEqual({
      inserir: [],
      atualizar: [],
      apagar: [],
    });
  });
});
