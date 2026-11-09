import { describe, expect, it } from "vitest";
import {
  centavosBr,
  classificar,
  corDaBandeira,
  dadosDoNome,
  dataBr,
  ErroEnergisa,
  type FaturaLida,
  faturaLidaSchema,
  faturaParaGravar,
  itensParaGravar,
  lerFaturaEnergisa,
  linhasDaPagina,
  mesDeGeracao,
  numeroBr,
} from "./energisa";
import {
  type FaturaSintetica,
  faturaExemplo,
  itensDaFatura,
  pdfDaFatura,
} from "./energisa.fixtures";
import { ehPdf, lerPdfEnergisa, textosDoPdf } from "./energisa-pdf";

// As faturas reais ficam fora do repositório (têm dados do cliente). Estes
// testes usam uma fatura sintética que reproduz as posições e os rótulos do
// layout real (energisa.fixtures.ts), com valores fictícios.

const NOME = "ENERGISAMR-Fat-Matricula-0009100001-09-2026.PDF";
const ler = (f: FaturaSintetica, nome: string | undefined = NOME) =>
  lerFaturaEnergisa(itensDaFatura(f), nome);
const com = (muda: Partial<FaturaSintetica>): FaturaSintetica => ({
  ...faturaExemplo(),
  ...muda,
});
const mensagens = (f: FaturaLida) => f.avisos.map((a) => a.mensagem).join("\n");

describe("números, datas e meses", () => {
  it("lê número no formato brasileiro", () => {
    expect(numeroBr("1.172,55")).toBe(1172.55);
    expect(numeroBr("146.814")).toBe(146814);
    expect(numeroBr("880")).toBe(880);
    expect(numeroBr("1,332443")).toBe(1.332443);
    expect(numeroBr("18,00%")).toBe(18);
    expect(numeroBr("R$ 332,80")).toBe(332.8);
  });

  it("aceita os três jeitos de escrever negativo", () => {
    expect(numeroBr("-804,73")).toBe(-804.73);
    expect(numeroBr("804,73-")).toBe(-804.73);
    expect(numeroBr("(804,73)")).toBe(-804.73);
    expect(numeroBr("−83,09")).toBe(-83.09);
    expect(numeroBr("-0,00")).toBe(0);
  });

  it("recusa o que não é número", () => {
    for (const t of [
      "",
      "KWH",
      "9/2026",
      "1,2,3",
      "12.34",
      "(R$)",
      "%",
      "abc1",
    ])
      expect(numeroBr(t)).toBeNull();
  });

  it("converte reais em centavos sem erro de ponto flutuante", () => {
    expect(centavosBr("1.172,55")).toBe(117255);
    expect(centavosBr("0,07")).toBe(7);
    expect(centavosBr("-804,73")).toBe(-80473);
    expect(centavosBr("1.234.567,89")).toBe(123456789);
    expect(centavosBr("texto")).toBeNull();
  });

  it("lê datas que existem", () => {
    expect(dataBr("24/08/2026")).toBe("2026-08-24");
    expect(dataBr("31/02/2026")).toBeNull();
    expect(dataBr("2026-08-24")).toBeNull();
    expect(dataBr(undefined)).toBeNull();
  });

  it("lê o mês de geração do crédito", () => {
    expect(mesDeGeracao("9/2026")).toBe("2026-09-01");
    expect(mesDeGeracao("06/2024")).toBe("2024-06-01");
    expect(mesDeGeracao("3/26")).toBe("2026-03-01");
    expect(mesDeGeracao("13/2026")).toBeNull();
  });

  it("tira matrícula e mês do nome do arquivo", () => {
    expect(dadosDoNome(NOME)).toEqual({
      matricula: "0009100001",
      referencia: "2026-09-01",
    });
    expect(dadosDoNome("energisamr-fat-matricula-9100001-1-2026.pdf")).toEqual({
      matricula: "0009100001",
      referencia: "2026-01-01",
    });
    expect(dadosDoNome("fatura.pdf")).toEqual({
      matricula: null,
      referencia: null,
    });
  });
});

describe("tipo de cada item", () => {
  it("separa consumo, crédito, bandeira, iluminação e outros", () => {
    expect(classificar("Consumo em kWh").tipo).toBe("consumo");
    expect(classificar("Consumo Reativo Excedente").tipo).toBe("outro");
    expect(classificar("Adic. B. Amarela").tipo).toBe("bandeira");
    expect(classificar("Juros de mora").tipo).toBe("outro");
    expect(classificar("Multa por atraso").tipo).toBe("outro");
  });

  it("reconhece a iluminação pública pelos vários rótulos", () => {
    for (const d of [
      "CONTRIBUIÇÃO ILUM PUBLICA",
      "Contrib de Ilum Pub",
      "Contribuição Iluminação Pública",
      "CONTRIB. ILUM. PÚBLICA MUNICIPAL",
      "COSIP",
      "CIP - Contribuição Iluminação",
      "Ilum. Pública",
    ])
      expect(classificar(d).tipo, d).toBe("iluminacao");
  });

  it("lê a origem do crédito e o mês em que foi gerado", () => {
    expect(classificar("Energia Atv Injetada GDI oUC 9/2026 mPT")).toEqual({
      tipo: "injetada",
      origem: "oUC",
      mesGeracao: "2026-09-01",
    });
    expect(classificar("Energia Atv Injetada GDI mUC 6/2024 mPT")).toEqual({
      tipo: "injetada",
      origem: "mUC",
      mesGeracao: "2024-06-01",
    });
    expect(classificar("Energia Injetada TUSD").origem).toBeNull();
  });

  it("normaliza a cor da bandeira", () => {
    expect(corDaBandeira("Adic. B. Amarela")).toBe("Amarela");
    expect(corDaBandeira("Adic. Band. Vermelha P1")).toBe("Vermelha P1");
    expect(corDaBandeira("Adicional Bandeira Vermelha Patamar 2")).toBe(
      "Vermelha P2",
    );
    expect(corDaBandeira("ADIC. B. VERMELHA")).toBe("Vermelha");
    expect(corDaBandeira("Adic. Bandeira Escassez Hídrica")).toBe(
      "Escassez hídrica",
    );
    expect(corDaBandeira("Consumo em kWh")).toBeNull();
  });
});

describe("linhas da página", () => {
  it("junta textos com y um pouco diferente e ordena pelo x", () => {
    const linhas = linhasDaPagina([
      { str: "b", x: 50, y: 99, w: 5 },
      { str: "a", x: 10, y: 100, w: 5 },
      { str: "c", x: 10, y: 80, w: 5 },
      { str: "  ", x: 90, y: 100, w: 5 },
    ]);
    expect(linhas.map((l) => l.texto)).toEqual(["a b", "c"]);
  });
});

describe("fatura completa (layout real, valores fictícios)", () => {
  const f = ler(faturaExemplo());

  it("lê o cabeçalho", () => {
    expect(f.matricula).toBe("0009100001");
    expect(f.referencia).toBe("2026-09-01");
    expect(f.vencimento).toBe("2026-10-11");
    expect(f.totalAPagar).toBe(34250);
    expect(f.endereco).toBe("RUA DAS FLORES, 100 - BL 01 SL 101 1 PAV");
    // Quebrada em duas linhas, com "LIGAÇÃO:" à direita da segunda.
    expect(f.classificacao).toBe(
      "MTC-CONVENCIONAL BAIXA TENSÃO / B3 COMERCIAL / COMERCIAL",
    );
    expect(f.ligacao).toBe("Trifásico");
  });

  it("lê as datas de leitura e o medidor", () => {
    expect(f.leituraAnteriorData).toBe("2026-08-24");
    expect(f.leituraAtualData).toBe("2026-09-23");
    expect(f.dias).toBe(30);
    expect(f.proximaLeitura).toBe("2026-10-23");
    expect(f.medidor).toBe("XY123456");
    expect(f.leituraAnterior).toBe(52300);
    expect(f.leituraAtual).toBe(53320);
    expect(f.consumoMedidoKwh).toBe(1020);
    expect(f.injetadaKwh).toBeNull();
  });

  it("lê os itens com todas as colunas", () => {
    expect(f.itens).toHaveLength(5);
    expect(f.itens[0]).toEqual({
      descricao: "Consumo em kWh",
      tipo: "consumo",
      origem: null,
      mesGeracao: null,
      unidade: "KWH",
      quantidade: 1020,
      precoUnitario: 1.298431,
      valor: 132440,
      pisCofins: 2195,
      baseIcms: 132440,
      aliquotaIcms: 18,
      icms: 23839,
      tarifaUnitaria: 0.90122,
    });
    expect(
      f.itens.map((i) => [i.tipo, i.origem, i.mesGeracao, i.valor]),
    ).toEqual([
      ["consumo", null, null, 132440],
      ["injetada", "oUC", "2026-09-01", -91100],
      ["injetada", "mUC", "2024-06-01", -12117],
      ["bandeira", null, null, 315],
      ["iluminacao", null, null, 4712],
    ]);
    // Bandeira e iluminação sem quantidade, unidade, preço nem tarifa.
    for (const i of f.itens.slice(3)) {
      expect(i.quantidade).toBeNull();
      expect(i.unidade).toBeNull();
      expect(i.precoUnitario).toBeNull();
      expect(i.tarifaUnitaria).toBeNull();
    }
    expect(f.itens[4]).toMatchObject({
      pisCofins: 0,
      icms: 0,
      aliquotaIcms: 0,
    });
  });

  it("calcula consumo, compensação (positiva) e totais", () => {
    expect(f.consumoKwh).toBe(1020);
    expect(f.valorConsumo).toBe(132440);
    expect(f.compensadoKwh).toBe(920);
    expect(f.valorCompensado).toBe(103217);
    expect(f.bandeira).toBe("Amarela");
    expect(f.valorBandeira).toBe(315);
    expect(f.iluminacaoPublica).toBe(4712);
    expect(f.total).toBe(34250);
    expect(f.pisCofins).toBe(489);
    expect(f.icms).toBe(5317);
  });

  it("confere: a soma dos itens é o total", () => {
    expect(f.somaItens).toBe(34250);
    expect(f.bate).toBe(true);
    expect(f.avisos).toEqual([]);
  });

  it("lê saldo de créditos, GD e nota fiscal", () => {
    expect(f.saldoKwh).toBe(1621);
    expect(f.expirarKwh).toBe(0);
    expect(f.classificacaoGd).toBe("GD_I");
    expect(f.notaFiscal).toBe(
      "Nº 000.123.456, série 001, emitida em 25/09/2026, chave 33260900000000000000550010001234561000123456",
    );
    expect(f.observacao).toBe("Nota fiscal emitida em contingência.");
  });

  it("passa no schema guardado na prévia", () => {
    expect(faturaLidaSchema.parse(f)).toEqual(f);
  });
});

describe("variações do layout", () => {
  const base = ler(faturaExemplo());
  const essencial = (f: FaturaLida) => ({
    itens: f.itens,
    total: f.total,
    bate: f.bate,
    compensadoKwh: f.compensadoKwh,
  });

  it("rótulos do cabeçalho com uma palavra por texto", () => {
    expect(essencial(ler(com({ palavrasSeparadas: true })))).toEqual(
      essencial(base),
    );
  });

  it("números numa linha de base um pouco diferente da descrição", () => {
    expect(essencial(ler(com({ tremido: true })))).toEqual(essencial(base));
  });

  it("textos fora da tabela, à direita, são ignorados", () => {
    expect(essencial(ler(com({ ruidoDireita: true })))).toEqual(
      essencial(base),
    );
  });

  it('rótulo "TOTAL:" em outra coluna', () => {
    expect(essencial(ler(com({ totalNaColuna: true })))).toEqual(
      essencial(base),
    );
  });

  it("descrição quebrada em duas linhas continua no mesmo item", () => {
    const f0 = faturaExemplo();
    const [consumo, ouc, ...resto] = f0.itens;
    const f = ler({
      ...f0,
      itens: [
        consumo as (typeof f0.itens)[number],
        {
          ...(ouc as (typeof f0.itens)[number]),
          descricao: "Energia Atv Injetada GDI",
          continua: "oUC 9/2026 mPT",
        },
        ...resto,
      ],
    });
    expect(f.itens[1]?.descricao).toBe(
      "Energia Atv Injetada GDI oUC 9/2026 mPT",
    );
    expect(f.itens[1]?.origem).toBe("oUC");
    expect(f.itens[1]?.mesGeracao).toBe("2026-09-01");
    expect(f.itens).toHaveLength(5);
  });

  it("negativo com o sinal no fim", () => {
    const f0 = faturaExemplo();
    const f = ler({
      ...f0,
      itens: f0.itens.map((i) => ({
        ...i,
        valor: i.valor.startsWith("-") ? `${i.valor.slice(1)}-` : i.valor,
      })),
    });
    expect(f.valorCompensado).toBe(103217);
    expect(f.bate).toBe(true);
  });

  it("outro rótulo da iluminação pública", () => {
    const f = ler(
      com({
        lancamentos: [{ descricao: "Contrib de Ilum Pub", valor: "47,12" }],
      }),
    );
    expect(f.iluminacaoPublica).toBe(4712);
    expect(f.bate).toBe(true);
  });

  it("duas bandeiras no mesmo período", () => {
    const f0 = faturaExemplo();
    const f = ler({
      ...f0,
      itens: [
        ...f0.itens.slice(0, 3),
        { descricao: "Adic. B. Amarela", valor: "1,15" },
        { descricao: "Adic. B. Vermelha P1", valor: "2,00" },
      ],
    });
    expect(f.bandeira).toBe("Amarela e Vermelha P1");
    expect(f.valorBandeira).toBe(315);
    expect(f.bate).toBe(true);
  });

  it("consumo dividido em TE e TUSD conta o kWh uma vez", () => {
    const f0 = faturaExemplo();
    const consumo = f0.itens[0] as (typeof f0.itens)[number];
    const f = ler({
      ...f0,
      medidor: { ...f0.medidor, grandeza: "Outra grandeza" },
      itens: [
        { ...consumo, descricao: "Consumo em kWh TUSD", valor: "700,00" },
        { ...consumo, descricao: "Consumo em kWh TE", valor: "624,40" },
        ...f0.itens.slice(1),
      ],
    });
    expect(f.consumoMedidoKwh).toBeNull();
    // O número do medidor vem do pé da página 2 ("Medidor: XY123456").
    expect(f.medidor).toBe("XY123456");
    expect(f.consumoKwh).toBe(1020);
    expect(f.valorConsumo).toBe(132440);
    expect(f.bate).toBe(true);
  });

  it("unidade geradora: lê a energia injetada do medidor", () => {
    const f0 = faturaExemplo();
    const f = ler({
      ...f0,
      medidorInjetada: {
        ...f0.medidor,
        grandeza: "Energia ativa injetada em kWh",
        anterior: "10.000",
        atual: "19.500",
        consumo: "9.500",
      },
    });
    expect(f.injetadaKwh).toBe(9500);
    expect(f.consumoMedidoKwh).toBe(1020);
  });
});

describe("conferência e avisos", () => {
  it("soma dos itens diferente do total: erro na prévia, não bate", () => {
    const f = ler(
      com({
        total: { valor: "342,60", pis: "4,89", base: "295,38", icms: "53,17" },
        totalAPagar: "R$ 342,60",
      }),
    );
    expect(f.bate).toBe(false);
    expect(f.somaItens).toBe(34250);
    expect(f.total).toBe(34260);
    expect(f.avisos).toContainEqual({
      nivel: "erro",
      mensagem:
        "A soma dos itens (342,50) não bate com o total da fatura (342,60): diferença de 0,10.",
    });
  });

  it("total a pagar diferente do total dos itens vira aviso", () => {
    const f = ler(com({ totalAPagar: "R$ 400,00" }));
    expect(f.bate).toBe(true);
    expect(mensagens(f)).toMatch(/total a pagar \(400,00\) é diferente/);
  });

  it("sem a linha TOTAL usa o total a pagar e avisa", () => {
    const f0 = faturaExemplo();
    const itens = itensDaFatura(f0).map((p) =>
      p.filter((i) => !/^TOTAL:$/.test(i.str)),
    );
    const f = lerFaturaEnergisa(itens, NOME);
    expect(f.total).toBe(34250);
    expect(mensagens(f)).toMatch(/Não achei a linha "TOTAL:"/);
    // A tabela acaba no vão depois do último item: a linha dos números do
    // total e a do medidor, bem abaixo, não viram itens.
    expect(f.itens).toHaveLength(5);
    expect(f.bate).toBe(true);
    expect(mensagens(f)).not.toMatch(/sem descrição/);
  });

  it("matrícula só no nome do arquivo", () => {
    const f = ler(com({ debitoAutomatico: null }));
    expect(f.matricula).toBe("0009100001");
    expect(f.avisos[0]?.nivel).toBe("aviso");
    expect(mensagens(f)).toMatch(/Matrícula lida do nome do arquivo/);
  });

  it("matrícula do nome diferente da fatura: vale a da fatura, com erro", () => {
    const f = ler(
      faturaExemplo(),
      "ENERGISAMR-Fat-Matricula-0009999999-09-2026.PDF",
    );
    expect(f.matricula).toBe("0009100001");
    expect(f.avisos).toContainEqual(expect.objectContaining({ nivel: "erro" }));
  });

  it("mês do nome diferente da fatura", () => {
    const f = ler(
      faturaExemplo(),
      "ENERGISAMR-Fat-Matricula-0009100001-08-2026.PDF",
    );
    expect(f.referencia).toBe("2026-09-01");
    expect(mensagens(f)).toMatch(/mês da fatura \(09\/2026\) é diferente/);
  });

  it("crédito compensado sem saldo acumulado avisa", () => {
    const f = ler(com({ saldo: null }));
    expect(f.saldoKwh).toBeNull();
    expect(mensagens(f)).toMatch(/Saldo Acumulado/);
  });

  it("sem nota em contingência, sem observação", () => {
    expect(ler(com({ contingencia: false })).observacao).toBeNull();
  });
});

describe("o que não dá para ler", () => {
  it("PDF sem texto (escaneado)", () => {
    expect(() => lerFaturaEnergisa([[]], NOME)).toThrow(ErroEnergisa);
    expect(() => lerFaturaEnergisa([[]], NOME)).toThrow(/escaneada/);
  });

  it("PDF de outra empresa", () => {
    expect(() =>
      ler(com({ distribuidora: "OUTRA DISTRIBUIDORA S.A." })),
    ).toThrow(/Não parece uma fatura da Energisa/);
  });

  it("sem matrícula em lugar nenhum", () => {
    expect(() => ler(com({ debitoAutomatico: null }), "fatura.pdf")).toThrow(
      /Não achei a matrícula/,
    );
  });

  it("sem a tabela de itens", () => {
    const itens = itensDaFatura(faturaExemplo()).map((p) =>
      p.filter((i) => i.str !== "Itens da Fatura"),
    );
    expect(() => lerFaturaEnergisa(itens, NOME)).toThrow(
      /Não achei a tabela "Itens da Fatura"/,
    );
  });

  it("tabela sem a coluna Valor", () => {
    const itens = itensDaFatura(faturaExemplo()).map((p) =>
      p.filter((i) => i.str !== "Valor (R$)"),
    );
    expect(() => lerFaturaEnergisa(itens, NOME)).toThrow(/coluna "Valor"/);
  });

  it("sem o mês de referência", () => {
    expect(() => ler(com({ referencia: "—" }), "fatura-sem-mes.pdf")).toThrow(
      /mês de referência/,
    );
  });
});

describe("gravação", () => {
  const f = ler(faturaExemplo());

  it("monta a linha da fatura em reais", () => {
    const g = faturaParaGravar(f);
    expect(g).toMatchObject({
      matricula: "0009100001",
      referencia: "2026-09-01",
      consumo_kwh: 1020,
      compensado_kwh: 920,
      valor_compensado: 1032.17,
      valor_consumo: 1324.4,
      total: 342.5,
      iluminacao_publica: 47.12,
      bandeira: "Amarela",
      saldo_kwh: 1621,
      expirar_kwh: 0,
      injetada_kwh: null,
    });
  });

  it("monta os itens na ordem da fatura", () => {
    const itens = itensParaGravar(f);
    expect(itens.map((i) => i.ordem)).toEqual([1, 2, 3, 4, 5]);
    expect(itens[1]).toMatchObject({
      tipo: "injetada",
      origem: "oUC",
      mes_geracao: "2026-09-01",
      valor: -911,
      icms: -163.98,
    });
    // A soma em reais (com arredondamento de centavos) é o total.
    const soma = itens.reduce((s, i) => s + Math.round(i.valor * 100), 0);
    expect(soma).toBe(34250);
  });
});

describe("PDF de verdade (pdf-lib → pdf.js → leitor)", () => {
  it("lê a fatura sintética desenhada num PDF", async () => {
    const bytes = await pdfDaFatura(faturaExemplo());
    expect(ehPdf(bytes)).toBe(true);
    const f = await lerPdfEnergisa(bytes, NOME);
    const esperado = ler(faturaExemplo());
    // As larguras reais da fonte mudam só a posição; o resultado é o mesmo.
    expect(f).toEqual(esperado);
  }, 20_000);

  it("devolve os textos com posição", async () => {
    const paginas = await textosDoPdf(await pdfDaFatura(faturaExemplo()));
    expect(paginas).toHaveLength(2);
    const consumo = paginas[0]?.find((i) => i.str === "Consumo em kWh");
    expect(consumo?.x).toBeCloseTo(27.1, 1);
    expect(consumo?.y).toBeCloseTo(489.4, 1);
    expect(consumo?.w).toBeGreaterThan(0);
  }, 20_000);

  it("reconhece o que não é PDF", () => {
    expect(ehPdf(new TextEncoder().encode("PK\u0003\u0004"))).toBe(false);
  });
});
