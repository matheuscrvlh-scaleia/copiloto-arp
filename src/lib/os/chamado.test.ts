import { describe, expect, it } from "vitest";
import {
  checklistInicial,
  extrairMencoes,
  filtrarPessoas,
  lerCamposExtras,
  lerChecklist,
  lerDataHoraLocal,
  lerEtiquetas,
  marcarItem,
  mencaoEmDigitacao,
  mensagemDoChamado,
  motivoParaNaoConcluir,
  quemAvisarDoComentario,
  textoDoCampo,
  validarCampos,
} from "./chamado";
import type { CampoExtra } from "./rotulos";

const campos: CampoExtra[] = [
  { chave: "local", rotulo: "Local", tipo: "texto", obrigatorio: true },
  { chave: "qtd", rotulo: "Quantidade", tipo: "numero" },
  { chave: "dia", rotulo: "Dia", tipo: "data" },
  { chave: "cor", rotulo: "Cor", tipo: "lista", opcoes: ["Azul", "Verde"] },
  { chave: "urgente", rotulo: "Urgente", tipo: "sim_nao" },
  { chave: "foto", rotulo: "Foto do local", tipo: "foto", obrigatorio: true },
];

describe("campos extras", () => {
  it("lê só o que está no formato", () => {
    expect(
      lerCamposExtras([
        { chave: "a", rotulo: "A", tipo: "texto" },
        { chave: "", tipo: "texto" },
        { chave: "b", tipo: "desconhecido" },
        "lixo",
        { chave: "c", tipo: "lista", opcoes: ["x", 1], obrigatorio: true },
      ]),
    ).toEqual([
      {
        chave: "a",
        rotulo: "A",
        tipo: "texto",
        opcoes: undefined,
        obrigatorio: false,
      },
      {
        chave: "c",
        rotulo: "c",
        tipo: "lista",
        opcoes: ["x"],
        obrigatorio: true,
      },
    ]);
    expect(lerCamposExtras(null)).toEqual([]);
  });

  it("obrigatório vazio e foto obrigatória sem arquivo recusam", () => {
    expect(validarCampos(campos, {}, { foto: 1 }).erro).toBe(
      "Local: preencha.",
    );
    expect(validarCampos(campos, { local: "Bloco A" }).erro).toBe(
      "Foto do local: envie a foto.",
    );
  });

  it("converte número, data, lista e sim/não", () => {
    const r = validarCampos(
      campos,
      {
        local: " Bloco A ",
        qtd: "1.234,5",
        dia: "2026-10-23",
        cor: "Azul",
        urgente: "sim",
      },
      { foto: 2 },
    );
    expect(r).toEqual({
      erro: null,
      valores: {
        local: "Bloco A",
        qtd: 1234.5,
        dia: "2026-10-23",
        cor: "Azul",
        urgente: true,
      },
    });
  });

  it("recusa valor fora do tipo", () => {
    const base = { local: "x" };
    const arq = { foto: 1 };
    expect(validarCampos(campos, { ...base, qtd: "abc" }, arq).erro).toBe(
      "Quantidade: número inválido.",
    );
    expect(validarCampos(campos, { ...base, dia: "23/10" }, arq).erro).toBe(
      "Dia: data inválida.",
    );
    expect(validarCampos(campos, { ...base, cor: "Roxo" }, arq).erro).toBe(
      "Cor: escolha uma das opções.",
    );
  });

  it("mostra o valor gravado", () => {
    const [, qtd, dia, , urgente] = campos;
    expect(textoDoCampo(qtd as CampoExtra, 1234.5)).toBe("1.234,50");
    expect(textoDoCampo(qtd as CampoExtra, 3)).toBe("3");
    expect(textoDoCampo(dia as CampoExtra, "2026-10-23")).toBe("23/10/2026");
    expect(textoDoCampo(urgente as CampoExtra, false)).toBe("Não");
    expect(textoDoCampo(urgente as CampoExtra, null)).toBe("—");
  });
});

describe("checklist", () => {
  const itens = checklistInicial([
    { texto: "Desligar o disjuntor", obrigatorio: true, feito: true },
    { texto: "Foto do antes" },
    { texto: "" },
  ]);

  it("copia da categoria sem nada feito", () => {
    expect(itens).toHaveLength(2);
    expect(itens.every((i) => !i.feito)).toBe(true);
  });

  it("marca com quem e quando; desmarcar limpa", () => {
    const em = new Date("2026-10-23T13:00:00Z");
    const marcado = marcarItem(itens, 0, true, "ana", em);
    expect(marcado[0]).toMatchObject({
      feito: true,
      por: "ana",
      em: em.toISOString(),
    });
    expect(marcarItem(marcado, 0, false, "ana", em)[0]).toMatchObject({
      feito: false,
      por: null,
      em: null,
    });
    expect(() => marcarItem(itens, 5, true, "ana", em)).toThrow();
  });

  it("item obrigatório pendente impede concluir", () => {
    expect(motivoParaNaoConcluir({ checklist: itens })).toBe(
      "Falta o item obrigatório do checklist: “Desligar o disjuntor”.",
    );
    const feito = lerChecklist([
      { texto: "x", obrigatorio: true, feito: true },
    ]);
    expect(motivoParaNaoConcluir({ checklist: feito })).toBeNull();
  });

  it("terceirizado acima do teto precisa de aprovação", () => {
    const p = { checklist: [], valorTerceirizado: 5000, teto: 3000 };
    expect(motivoParaNaoConcluir(p)).toMatch(/teto/);
    expect(motivoParaNaoConcluir({ ...p, orcamentoAprovado: true })).toBeNull();
    expect(motivoParaNaoConcluir({ ...p, teto: null })).toBeNull();
    expect(motivoParaNaoConcluir({ ...p, valorTerceirizado: 3000 })).toBeNull();
  });
});

describe("menções", () => {
  const pessoas = [
    { id: "1", nome: "Ana" },
    { id: "2", nome: "Ana Paula Lima" },
    { id: "3", nome: "João Silva" },
    { id: "4", nome: "Bia" },
  ];

  it("acha pelo nome, sem acento nem caixa, preferindo o mais longo", () => {
    expect(
      extrairMencoes("@ana paula lima e @joao silva, vejam", pessoas).sort(),
    ).toEqual(["2", "3"]);
    expect(extrairMencoes("Oi @Ana!", pessoas)).toEqual(["1"]);
  });

  it("não casa no meio de outra palavra", () => {
    expect(extrairMencoes("@Biatriz e email@bia.com", pessoas)).toEqual([]);
    expect(extrairMencoes("(@bia)", pessoas)).toEqual(["4"]);
    expect(extrairMencoes("@Biatriz", pessoas)).toEqual([]);
  });

  it("menção sendo digitada", () => {
    expect(mencaoEmDigitacao("fala com @an", 12)).toEqual({
      inicio: 9,
      termo: "an",
    });
    expect(mencaoEmDigitacao("@", 1)).toEqual({ inicio: 0, termo: "" });
    expect(mencaoEmDigitacao("email@bia", 9)).toBeNull();
    expect(mencaoEmDigitacao("sem arroba", 10)).toBeNull();
  });

  it("filtra pessoas, quem começa com o termo primeiro", () => {
    expect(filtrarPessoas(pessoas, "an").map((p) => p.id)).toEqual(["1", "2"]);
    expect(filtrarPessoas(pessoas, "silva").map((p) => p.id)).toEqual(["3"]);
  });
});

describe("formulário", () => {
  it("etiquetas sem repetir", () => {
    expect(lerEtiquetas("Elétrica, urgente , elétrica;#bloco A,,")).toEqual([
      "Elétrica",
      "urgente",
      "bloco A",
    ]);
  });

  it("data e hora de Brasília", () => {
    expect(lerDataHoraLocal("2026-10-23T14:30")?.toISOString()).toBe(
      "2026-10-23T17:30:00.000Z",
    );
    expect(lerDataHoraLocal("")).toBeNull();
  });
});

describe("avisos e mensagem", () => {
  it("comentário avisa citados e os demais, nunca o autor", () => {
    expect(
      quemAvisarDoComentario({
        autor: "eu",
        abertoPor: "ana",
        responsavel: "eu",
        seguidores: ["bia", "ana"],
        mencionados: ["bia", "eu"],
      }),
    ).toEqual({ mencionados: ["bia"], demais: ["ana"] });
  });

  it("mensagem do WhatsApp com o modelo ou o padrão", () => {
    const dados = {
      numero: "#12",
      titulo: "Lâmpada queimada",
      status: "Aberto",
      prazo: "24/10/2026 18:00",
      tipo: "Solicitação",
      setor: "Operações",
      descricao: "",
      link: "https://x/os/chamados/1",
    };
    expect(mensagemDoChamado(null, dados)).toBe(
      [
        "*CHAMADO #12*",
        "*Assunto:* Lâmpada queimada",
        "*Status:* Aberto",
        "*Prazo:* 24/10/2026 18:00",
        "",
        "Detalhes: https://x/os/chamados/1",
      ].join("\n"),
    );
    expect(mensagemDoChamado("{{titulo}} ({{setor}})", dados)).toBe(
      "Lâmpada queimada (Operações)",
    );
  });
});
