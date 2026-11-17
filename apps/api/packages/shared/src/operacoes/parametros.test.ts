import { describe, expect, it } from "vitest";
import {
  COLUNAS_DO_GRUPO,
  camposDoForm,
  ESQUEMAS,
  mudancasDosParametros,
  ROTULOS_PARAMETROS,
} from "./parametros";

const lista = (l: unknown) => JSON.stringify(l);

describe("validação (espelha os checks do banco)", () => {
  it("água: limite maior que zero, blocos com 2 dígitos, modelo sem vazios", () => {
    const ok = ESQUEMAS.agua.parse({
      agua_limite_m3: "30",
      agua_tolerancia: "0,01",
      agua_blocos: lista(["01", " 05 ", "05"]),
      agua_parceiro: "Parceiro",
      agua_variacao_pct: "50",
      agua_variacao_meses: "3",
      agua_variacao_min_m3: "5",
      agua_modelo: lista({ hidrometro: "E", sala: "" }),
    });
    expect(ok.agua_blocos).toEqual(["01", "05"]);
    expect(ok.agua_tolerancia).toBe(0.01);
    expect(ok.agua_modelo).toEqual({ hidrometro: "E" });
    const r = ESQUEMAS.agua.safeParse({
      ...ok,
      agua_limite_m3: "0",
      agua_blocos: lista(["01"]),
      agua_modelo: "{}",
    });
    expect(r.success).toBe(false);
    expect(
      ESQUEMAS.agua.safeParse({
        ...ok,
        agua_blocos: lista(["1"]),
        agua_modelo: "{}",
      }).success,
    ).toBe(false);
    expect(
      ESQUEMAS.agua.safeParse({
        ...ok,
        agua_blocos: lista(["01"]),
        agua_variacao_meses: "13",
        agua_modelo: "{}",
      }).success,
    ).toBe(false);
  });

  it("termo: CNPJ com dígito verificador", () => {
    const base = {
      termo_razao_social: "ARP",
      termo_cnpj: "11.222.333/0001-81",
      termo_endereco: "Rua",
      termo_cidade: "Cidade",
      termo_qualificacao_cpf: "pessoa física",
      termo_qualificacao_cnpj: "pessoa jurídica",
      termo_nome_arquivo: "TERMO [sala]",
    };
    expect(ESQUEMAS.termo.safeParse(base).success).toBe(true);
    expect(
      ESQUEMAS.termo.safeParse({ ...base, termo_cnpj: "11.222.333/0001-82" })
        .success,
    ).toBe(false);
  });

  it("limpeza: área comum + rateados até a base; extras com valor brasileiro", () => {
    const base = {
      limpeza_empresa: "Empresa",
      limpeza_func_base: "9",
      limpeza_func_area_comum: "5",
      limpeza_func_rateados: "4",
      limpeza_blocos: lista(["01", "02"]),
      limpeza_dia_util_envio: "5",
      limpeza_extras_padrao: lista([
        { descricao: "Vigia", valor_dia: "315,00" },
      ]),
    };
    const ok = ESQUEMAS.limpeza.parse(base);
    expect(ok.limpeza_extras_padrao).toEqual([
      { descricao: "Vigia", valor_dia: 315 },
    ]);
    const r = ESQUEMAS.limpeza.safeParse({
      ...base,
      limpeza_func_rateados: "5",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["limpeza_func_rateados"]);
    expect(
      ESQUEMAS.limpeza.safeParse({ ...base, limpeza_dia_util_envio: "21" })
        .success,
    ).toBe(false);
  });

  it("obras: intervalo da lista, dias sem repetir e desvio negativo", () => {
    const ok = ESQUEMAS.obras.parse({
      obras_intervalo_min: "60",
      obras_dias_relatorio: ["3", "1", "1"],
      obras_limite_desvio: "-10",
      obras_limite_orcamento_pct: "10",
    });
    expect(ok.obras_dias_relatorio).toEqual([1, 3]);
    expect(ok.obras_limite_desvio).toBe(-10);
    expect(
      ESQUEMAS.obras.safeParse({ ...ok, obras_intervalo_min: "45" }).success,
    ).toBe(false);
  });

  it("decimais: no máximo 2 casas", () => {
    expect(
      ESQUEMAS.contas.safeParse({
        energia_alerta_pct: "20,555",
        solar_fonte: "planilha",
      }).success,
    ).toBe(false);
  });
});

describe("grupos e rótulos", () => {
  it("toda coluna de um grupo tem rótulo e nenhuma está em dois grupos", () => {
    const todas = Object.values(COLUNAS_DO_GRUPO).flat();
    expect(new Set(todas).size).toBe(todas.length);
    for (const c of todas) expect(ROTULOS_PARAMETROS[c]).toBeTruthy();
  });

  it("checkboxes dos dias viram lista; nenhum marcado vira lista vazia", () => {
    const f = new FormData();
    f.set("grupo", "obras");
    f.append("obras_dias_relatorio", "1");
    f.append("obras_dias_relatorio", "2");
    expect(camposDoForm(f).obras_dias_relatorio).toEqual(["1", "2"]);
    const vazio = new FormData();
    vazio.set("grupo", "obras");
    expect(camposDoForm(vazio).obras_dias_relatorio).toEqual([]);
  });
});

describe("histórico", () => {
  it("só o que mudou, com rótulo e valor legível", () => {
    expect(
      mudancasDosParametros(
        {
          agua_limite_m3: 25,
          obras_dias_relatorio: [1, 2],
          atualizado_em: "x",
          solar_fonte: "a_confirmar",
        },
        {
          agua_limite_m3: 30,
          obras_dias_relatorio: [1, 2],
          atualizado_em: "y",
          solar_fonte: "planilha",
        },
      ),
    ).toEqual([
      {
        campo: "agua_limite_m3",
        rotulo: "Limite de consumo para alerta (m³)",
        antes: "25",
        depois: "30",
      },
      {
        campo: "solar_fonte",
        rotulo: "Fonte da geração solar",
        antes: "A confirmar com a Sustentabilidade",
        depois: "Planilha mensal",
      },
    ]);
  });
});
