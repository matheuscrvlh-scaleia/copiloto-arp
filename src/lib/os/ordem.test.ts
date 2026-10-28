import { describe, expect, it } from "vitest";
import { calcularOS } from "./calculos";
import {
  almocoQueCabe,
  assinaturaDoLink,
  envioGrandeDemais,
  erroDaSessao,
  erroDoArquivo,
  etapaDoTerceirizado,
  fecharSessao,
  horaCurta,
  linkAtivo,
  localDaOS,
  motivoParaNaoConcluir,
  nomeArquivoPdf,
  paraSessao,
  prazoRetornoDias,
  precisaAprovacao,
  rateioDaOS,
  relogio,
  resultadoParaBanco,
  rotaPdfOS,
  rotuloLote,
  type SituacaoParaConcluir,
  tipoDeServico,
} from "./ordem";

describe("sessões do banco", () => {
  it("corta os segundos do time e junta os técnicos", () => {
    expect(horaCurta("08:00:00")).toBe("08:00");
    expect(horaCurta(null)).toBeNull();
    expect(
      paraSessao({
        id: "s1",
        data: "2026-10-21",
        inicio: "08:00:00",
        fim: null,
        almoco_inicio: "12:00:00",
        almoco_fim: "13:00:00",
        sessao_tecnicos: [{ tecnico_id: "ana" }, { tecnico_id: "bia" }],
      }),
    ).toEqual({
      id: "s1",
      data: "2026-10-21",
      inicio: "08:00",
      fim: null,
      almoco_inicio: "12:00",
      almoco_fim: "13:00",
      tecnicos: ["ana", "bia"],
    });
  });

  it("almoço só fica se cair dentro da sessão", () => {
    const almoco = { inicio: "12:00", fim: "13:00" };
    const s = { data: "2026-10-21", inicio: "08:00" };
    expect(almocoQueCabe({ ...s, fim: "17:00" }, almoco)).toEqual(almoco);
    expect(almocoQueCabe({ ...s, fim: "12:30" }, almoco)).toEqual(almoco);
    expect(almocoQueCabe({ ...s, fim: "11:00" }, almoco)).toBeNull();
    expect(almocoQueCabe({ ...s, fim: null }, almoco)).toBeNull();
    expect(almocoQueCabe({ ...s, fim: "17:00" }, null)).toBeNull();
  });

  it("valida a sessão digitada", () => {
    const base = {
      data: "2026-10-21",
      inicio: "08:00",
      fim: "12:00",
      almoco: null,
      tecnicos: ["ana"],
      hoje: "2026-10-23",
    };
    expect(erroDaSessao(base)).toBeNull();
    expect(erroDaSessao({ ...base, data: "2026-10-24" })).toMatch(/futura/);
    expect(erroDaSessao({ ...base, fim: "08:00" })).toMatch(/diferente/);
    expect(erroDaSessao({ ...base, tecnicos: [] })).toMatch(/técnico/);
    expect(
      erroDaSessao({ ...base, almoco: { inicio: "13:00", fim: "12:00" } }),
    ).toMatch(/almoço/);
    // Passar da meia-noite é permitido (fim antes do início).
    expect(erroDaSessao({ ...base, inicio: "22:00", fim: "02:00" })).toBeNull();
  });

  it("fecha o cronômetro na hora de Brasília e avisa se ficou esquecido", () => {
    const s = { data: "2026-10-21", inicio: "08:00" };
    expect(fecharSessao(s, new Date("2026-10-21T11:20:30-03:00"))).toEqual({
      fim: "11:20",
      minutos: 200,
      esquecida: false,
    });
    expect(
      fecharSessao(s, new Date("2026-10-22T09:00:00-03:00")).esquecida,
    ).toBe(true);
  });

  it("relógio do cronômetro", () => {
    const desde = new Date("2026-10-21T08:00:00-03:00");
    expect(relogio(desde, new Date("2026-10-21T09:05:09-03:00"))).toBe(
      "01:05:09",
    );
    expect(relogio(desde, new Date("2026-10-21T07:00:00-03:00"))).toBe(
      "00:00:00",
    );
  });
});

describe("rateio e resultado", () => {
  it("monta o rateio do cálculo", () => {
    expect(rateioDaOS(false, "manual", 10)).toBeNull();
    expect(rateioDaOS(true, null, null)).toEqual({ regra: "hora_trabalhada" });
    expect(rateioDaOS(true, "manual", 40)).toEqual({
      regra: "manual",
      valor: 40,
    });
    expect(rateioDaOS(true, "percentual", 30)).toEqual({
      regra: "percentual",
      percentual: 30,
    });
    expect(rateioDaOS(true, "terceirizado", 99)).toEqual({
      regra: "terceirizado",
    });
  });

  it("grava o resultado com os nomes do banco", () => {
    const r = calcularOS({
      sessoes: [
        {
          data: "2026-10-21",
          inicio: "08:00",
          fim: "11:20",
          almoco_inicio: null,
          almoco_fim: null,
          tecnicos: ["ana"],
        },
      ],
      vigencias: [
        {
          tecnico_id: "ana",
          vigente_desde: "2026-01-01",
          valor_minuto: 0.4485,
        },
      ],
      rateio: rateioDaOS(true, "percentual", 50),
    });
    expect(resultadoParaBanco(r)).toEqual({
      minutos: 200,
      minuto_homem: 200,
      custo_mao_obra: 89.7,
      custo_materiais: 0,
      custo_total: 89.7,
      valor_rateio: 44.85,
      completo: true,
      memoria: r.memoria,
    });
  });
});

describe("conclusão", () => {
  const base: SituacaoParaConcluir = {
    tipo: "os",
    execucao: "interna",
    solucao: null,
    sessoesAbertas: 0,
    valorTerceirizado: null,
    teto: 1000,
    orcamentoAprovado: false,
    assinaturaTerceirizado: null,
    assinadaPelaArp: false,
  };

  it("interna sem pendência conclui", () => {
    expect(motivoParaNaoConcluir(base)).toBeNull();
  });
  it("cronômetro rodando impede (qualquer tipo)", () => {
    expect(motivoParaNaoConcluir({ ...base, sessoesAbertas: 1 })).toMatch(
      /cronômetro/,
    );
    expect(
      motivoParaNaoConcluir({
        ...base,
        tipo: "solicitacao",
        sessoesAbertas: 1,
      }),
    ).toMatch(/cronômetro/);
  });
  it("terceirizada exige a solução", () => {
    const t = { ...base, execucao: "terceirizada" as const };
    expect(motivoParaNaoConcluir(t)).toMatch(/solução/);
    expect(motivoParaNaoConcluir({ ...t, solucao: "  " })).toMatch(/solução/);
    expect(
      motivoParaNaoConcluir({ ...t, solucao: "Troca do disjuntor" }),
    ).toBeNull();
  });
  it("acima do teto exige a aprovação", () => {
    expect(precisaAprovacao(1000, 1000)).toBe(false);
    expect(precisaAprovacao(1000.01, 1000)).toBe(true);
    expect(precisaAprovacao(5000, null)).toBe(false);
    const caro = { ...base, valorTerceirizado: 1500 };
    expect(motivoParaNaoConcluir(caro)).toMatch(/teto/);
    expect(
      motivoParaNaoConcluir({ ...caro, orcamentoAprovado: true }),
    ).toBeNull();
  });
  it("com link, o terceirizado assina primeiro e a ARP por último", () => {
    const t = {
      ...base,
      execucao: "terceirizada" as const,
      solucao: "Troca do disjuntor",
    };
    expect(
      motivoParaNaoConcluir({ ...t, assinaturaTerceirizado: false }),
    ).toMatch(/terceirizado ainda não/);
    expect(
      motivoParaNaoConcluir({ ...t, assinaturaTerceirizado: true }),
    ).toMatch(/assine como ARP/);
    expect(
      motivoParaNaoConcluir({
        ...t,
        assinaturaTerceirizado: true,
        assinadaPelaArp: true,
      }),
    ).toBeNull();
    // Sem link (ou cancelado/recusado), segue como antes.
    expect(motivoParaNaoConcluir(t)).toBeNull();
  });
});

describe("textos e arquivos", () => {
  it("tipo de serviço", () => {
    expect(tipoDeServico("Elétrica")).toBe("ELÉTRICA");
    expect(tipoDeServico(null)).toBe("ROTINA");
    expect(tipoDeServico(" ")).toBe("ROTINA");
  });

  it("local", () => {
    expect(
      localDaOS({
        bloco: "B",
        local: "Casa de máquinas",
        loja: { luc: "101", nome: "Loja Exemplo" },
      }),
    ).toBe("101 · Loja Exemplo · Bloco B · Casa de máquinas");
    expect(localDaOS({ bloco: "Bloco A", local: null, loja: null })).toBe(
      "Bloco A",
    );
    expect(localDaOS({ bloco: null, local: null, loja: null })).toBe(
      "Área comum",
    );
  });

  it("nome do PDF e rótulo do lote", () => {
    expect(nomeArquivoPdf([1234])).toBe("os-1234.pdf");
    expect(nomeArquivoPdf([1212, 1201, 1205])).toBe("os-lote-1201-a-1212.pdf");
    expect(rotuloLote([1234])).toBeNull();
    expect(rotuloLote(Array.from({ length: 12 }, (_, i) => 1212 - i))).toBe(
      "Lote: 12 O.S. (Nº 1201 a Nº 1212)",
    );
    expect(rotaPdfOS(["a", "b"])).toBe("/os/ordens/pdf?ids=a,b");
    expect(rotaPdfOS(["a"], false)).toBe("/os/ordens/pdf?ids=a&fotos=0");
  });
});

describe("link do terceirizado", () => {
  const link = {
    criado_em: "2026-10-21T10:00:00Z",
    aceito_em: null,
    recusado_em: null,
    chegada_em: null,
    terminado_em: null,
    cancelado_em: null,
    assinado_em: null,
  };

  it("assinatura: só espera pelo link que vale", () => {
    expect(assinaturaDoLink([])).toBeNull();
    expect(assinaturaDoLink([link])).toBe(false);
    expect(assinaturaDoLink([{ ...link, assinado_em: "x" }])).toBe(true);
    expect(assinaturaDoLink([{ ...link, recusado_em: "x" }])).toBeNull();
    expect(assinaturaDoLink([{ ...link, cancelado_em: "x" }, link])).toBe(
      false,
    );
  });

  it("etapa pelo que ele marcou", () => {
    expect(etapaDoTerceirizado(link)).toBe("enviado");
    expect(etapaDoTerceirizado({ ...link, aceito_em: "x" })).toBe("aceito");
    expect(
      etapaDoTerceirizado({ ...link, aceito_em: "x", chegada_em: "y" }),
    ).toBe("no_local");
    expect(
      etapaDoTerceirizado({ ...link, chegada_em: "y", terminado_em: "z" }),
    ).toBe("terminado");
    expect(
      etapaDoTerceirizado({ ...link, terminado_em: "z", assinado_em: "w" }),
    ).toBe("assinado");
    expect(etapaDoTerceirizado({ ...link, recusado_em: "x" })).toBe("recusado");
    expect(
      etapaDoTerceirizado({ ...link, terminado_em: "z", cancelado_em: "w" }),
    ).toBe("cancelado");
  });

  it("deixa de valer quando a OS fecha, cancela ou o link é cancelado", () => {
    const aberta = { status: "em_andamento" as const };
    expect(linkAtivo(link, aberta)).toBe(true);
    expect(linkAtivo(link, { ...aberta, status: "concluido" })).toBe(true);
    expect(linkAtivo(link, { ...aberta, status: "fechado" })).toBe(false);
    expect(linkAtivo(link, { ...aberta, status: "cancelado" })).toBe(false);
    expect(linkAtivo({ cancelado_em: "x" }, aberta)).toBe(false);
  });

  it("prazo de retorno: categoria, empresa, padrão", () => {
    expect(prazoRetornoDias(7, 3, 5)).toBe(7);
    expect(prazoRetornoDias(null, 3, 5)).toBe(3);
    expect(prazoRetornoDias(undefined, null, 5)).toBe(5);
  });
});

describe("arquivos", () => {
  it("aceita foto e, onde cabe documento, PDF", () => {
    const foto = { nome: "a.jpg", tipo: "image/jpeg", tamanho: 300_000 };
    expect(erroDoArquivo(foto, false)).toBeNull();
    expect(erroDoArquivo({ ...foto, tamanho: 0 }, false)).toMatch(/vazio/);
    expect(erroDoArquivo({ ...foto, tamanho: 5 * 1024 * 1024 }, true)).toMatch(
      /4 MB/,
    );
    const pdf = { nome: "orc.pdf", tipo: "application/pdf", tamanho: 1000 };
    expect(erroDoArquivo(pdf, false)).toMatch(/foto/);
    expect(erroDoArquivo(pdf, true)).toBeNull();
    expect(
      erroDoArquivo(
        { nome: "x.exe", tipo: "application/x-msdownload", tamanho: 1 },
        true,
      ),
    ).toMatch(/PDF/);
  });

  it("o envio inteiro cabe no limite da requisição (4 MB)", () => {
    expect(envioGrandeDemais([2 * 1024 * 1024, 1024 * 1024])).toBe(false);
    expect(envioGrandeDemais([3 * 1024 * 1024, 2 * 1024 * 1024])).toBe(true);
  });
});
