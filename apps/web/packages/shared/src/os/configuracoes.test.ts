import { describe, expect, it } from "vitest";
import {
  camposDoModelo,
  dimensoesDaImagem,
  erroDaMeta,
  erroDoPapelTimbrado,
  faixaDaMeta,
  lerFiltrosHistoricoOS,
  lerMensagens,
  lerTextosVistoria,
  mensagensParaGravar,
  nomeDoRegistro,
  normalizarCnpj,
  numeroBuscado,
  textoDosDias,
  urlDoHistoricoOS,
  valorPorHora,
  valorVigente,
} from "./configuracoes";
import { TEXTOS_PADRAO } from "./vistoria";
import { MENSAGENS_PADRAO } from "./whatsapp";

describe("textoDosDias", () => {
  it("resume seguidos e lista os soltos", () => {
    expect(textoDosDias([1, 2, 3, 4, 5])).toBe("Seg a Sex");
    expect(textoDosDias([1, 3, 5])).toBe("Seg, Qua, Sex");
    expect(textoDosDias([0, 1, 2, 3, 4, 5, 6])).toBe("Todos os dias");
    expect(textoDosDias([])).toBe("Nenhum dia");
    expect(textoDosDias([6, 0])).toBe("Sáb, Dom");
  });
});

describe("normalizarCnpj", () => {
  it("formata o CNPJ válido digitado de qualquer jeito", () => {
    expect(normalizarCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(normalizarCnpj(" 11.222.333/0001-81 ")).toBe("11.222.333/0001-81");
  });

  it("vazio é null; errado é undefined", () => {
    expect(normalizarCnpj("")).toBeNull();
    expect(normalizarCnpj("11222333000182")).toBeUndefined();
    expect(normalizarCnpj("1122233300018")).toBeUndefined();
    expect(normalizarCnpj("00000000000000")).toBeUndefined();
  });
});

describe("valor por minuto", () => {
  const vigencias = [
    { vigente_desde: "2026-01-01", valor_minuto: 0.5 },
    { vigente_desde: "2026-07-01", valor_minuto: 0.6 },
  ];

  it("vale o mais recente até a data", () => {
    expect(valorVigente(vigencias, "2026-06-30")?.valor_minuto).toBe(0.5);
    expect(valorVigente(vigencias, "2026-07-01")?.valor_minuto).toBe(0.6);
    expect(valorVigente(vigencias, "2025-12-31")).toBeNull();
  });

  it("por hora é × 60", () => {
    expect(valorPorHora(0.5)).toBe(30);
    expect(valorPorHora(0.123456)).toBe(7.41);
  });
});

describe("metas", () => {
  it("% no prazo: limite abaixo da meta", () => {
    expect(erroDaMeta("pct_no_prazo", 90, 80)).toBeNull();
    expect(erroDaMeta("pct_no_prazo", 90, 95)).not.toBeNull();
    expect(erroDaMeta("pct_no_prazo", 120, null)).not.toBeNull();
    expect(faixaDaMeta("pct_no_prazo", 92, 90, 80)).toBe("na_meta");
    expect(faixaDaMeta("pct_no_prazo", 85, 90, 80)).toBe("atencao");
    expect(faixaDaMeta("pct_no_prazo", 79, 90, 80)).toBe("fora");
    expect(faixaDaMeta("pct_no_prazo", 85, 90, null)).toBe("fora");
  });

  it("tempo médio: limite acima da meta", () => {
    expect(erroDaMeta("tempo_medio_horas", 24, 36)).toBeNull();
    expect(erroDaMeta("tempo_medio_horas", 24, 12)).not.toBeNull();
    expect(erroDaMeta("tempo_medio_horas", 0, null)).not.toBeNull();
    expect(faixaDaMeta("tempo_medio_horas", 20, 24, 36)).toBe("na_meta");
    expect(faixaDaMeta("tempo_medio_horas", 30, 24, 36)).toBe("atencao");
    expect(faixaDaMeta("tempo_medio_horas", 40, 24, 36)).toBe("fora");
  });
});

describe("mensagens", () => {
  it("usa a padrão onde não há texto gravado", () => {
    const m = lerMensagens({ os: "Minha O.S. {{numero}}", chamado: " " });
    expect(m.os).toBe("Minha O.S. {{numero}}");
    expect(m.chamado).toBe(MENSAGENS_PADRAO.chamado);
    expect(lerMensagens(null).remarcar).toBe(MENSAGENS_PADRAO.remarcar);
  });

  it("grava só o que difere do padrão", () => {
    expect(
      mensagensParaGravar({
        os: MENSAGENS_PADRAO.os,
        chamado: "Oi\r\n{{link}} ",
        outra: "x",
      }),
    ).toEqual({ chamado: "Oi\n{{link}}" });
  });

  it("lista os campos do modelo", () => {
    expect(camposDoModelo("{{numero}} e {{ link }} e {{numero}}")).toEqual([
      "numero",
      "link",
    ]);
  });
});

describe("textos do laudo", () => {
  it("completa com o padrão tipo a tipo", () => {
    const t = lerTextosVistoria({ entrada: { termo: "Meu termo" } });
    expect(t.entrada.termo).toBe("Meu termo");
    expect(t.entrada.observacao).toBe(TEXTOS_PADRAO.entrada.observacao);
    expect(t.saida).toEqual(TEXTOS_PADRAO.saida);
  });
});

describe("papel timbrado", () => {
  it("lê o tamanho do PNG", () => {
    const b = new Uint8Array(24);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    b.set([0, 0, 0x06, 0x76], 16); // 1654
    b.set([0, 0, 0x09, 0x23], 20); // 2339
    expect(dimensoesDaImagem(b)).toEqual({
      formato: "png",
      largura: 1654,
      altura: 2339,
    });
  });

  it("lê o tamanho do JPG pulando os segmentos", () => {
    const b = new Uint8Array([
      0xff,
      0xd8, // início
      0xff,
      0xe0,
      0x00,
      0x04,
      0x00,
      0x00, // APP0 de 4 bytes
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      0x09,
      0x23,
      0x06,
      0x76,
      0x03,
      0,
      0,
      0,
    ]);
    expect(dimensoesDaImagem(b)).toEqual({
      formato: "jpg",
      largura: 1654,
      altura: 2339,
    });
  });

  it("não reconhece outro formato", () => {
    expect(dimensoesDaImagem(new Uint8Array([0x47, 0x49, 0x46]))).toBeNull();
  });

  it("exige A4 em pé com boa resolução", () => {
    expect(erroDoPapelTimbrado({ largura: 1654, altura: 2339 })).toBeNull();
    expect(erroDoPapelTimbrado({ largura: 2480, altura: 3508 })).toBeNull();
    expect(erroDoPapelTimbrado({ largura: 2339, altura: 1654 })).toMatch(
      /A4 em pé/,
    );
    expect(erroDoPapelTimbrado({ largura: 595, altura: 842 })).toMatch(
      /pequena/,
    );
  });
});

describe("filtros do histórico", () => {
  it("lê a URL e ignora o que é inválido", () => {
    const f = lerFiltrosHistoricoOS({
      q: " telhado ",
      tabela: "core.usuarios",
      quem: "x",
      de: "2026-10-20",
      ate: "2026-10-01",
      registro: "abc-123",
      pagina: "3",
    });
    expect(f).toEqual({
      busca: "telhado",
      tabela: null,
      usuario: null,
      de: "2026-10-01",
      ate: "2026-10-20",
      registro: "abc-123",
      pagina: 3,
    });
    expect(urlDoHistoricoOS(f, 1)).toBe(
      "?q=telhado&de=2026-10-01&ate=2026-10-20&registro=abc-123",
    );
    expect(lerFiltrosHistoricoOS({ tabela: "os.chamados" }).tabela).toBe(
      "os.chamados",
    );
  });

  it("dá nome ao registro alterado", () => {
    expect(nomeDoRegistro(null, { numero: 12, titulo: "Tomada" })).toBe(
      "#12 · Tomada",
    );
    expect(nomeDoRegistro({ nome: "Elétrica" }, null)).toBe("Elétrica");
    expect(
      nomeDoRegistro(null, { nome: "Aniversário", data: "2026-05-16" }),
    ).toBe("Aniversário (16/05/2026)");
    expect(
      nomeDoRegistro(null, { vigente_desde: "2026-07-01", valor_minuto: 1 }),
    ).toBe("Vigência desde 01/07/2026");
    expect(nomeDoRegistro(null, { id: 1 })).toBeNull();
  });

  it("reconhece número de chamado", () => {
    expect(numeroBuscado("#123")).toBe(123);
    expect(numeroBuscado("nº 45")).toBe(45);
    expect(numeroBuscado("telhado")).toBeNull();
  });
});
