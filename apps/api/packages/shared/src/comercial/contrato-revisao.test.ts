import { describe, expect, it } from "vitest";
import {
  type DadosContrato,
  lerDados,
  novoFiador,
  novoRepresentante,
} from "./contrato";
import {
  type ContextoRevisao,
  checklist,
  idCampo,
  lerObrigatorios,
  pendencias,
  porEtapa,
} from "./contrato-revisao";

// Os mesmos obrigatórios por garantia do ponto de partida dos parâmetros.
const OBRIGATORIOS = lerObrigatorios({
  fiador: ["quantidade", "fiadores"],
  capitalizacao: ["instituicao", "valor", "proposta", "comprovante"],
  seguro_fianca: [
    "seguradora",
    "susep_seguradora",
    "corretora",
    "susep_corretora",
    "proposta",
    "apolice",
    "vigencia_inicio",
    "vigencia_fim",
    "documento_apolice",
  ],
  caucao: ["aluguel_base", "quantidade", "data_deposito"],
  sem_garantia: [],
});
const CTX: ContextoRevisao = { obrigatorios: OBRIGATORIOS, anexos: [] };

const endereco = {
  cep: "28613001",
  logradouro: "AV. CONSELHEIRO JULIUS ARP",
  numero: "80",
  complemento: "",
  bairro: "CENTRO",
  cidade: "NOVA FRIBURGO",
  uf: "RJ",
};

/** Contrato PF com tudo preenchido, sem garantia. */
function completo(): DadosContrato {
  return lerDados({
    imovel: {
      lucs: ["11_132"],
      empreendimento: "ARP",
      bloco: "11",
      pavimento: "1º PAVIMENTO (TÉRREO)",
      unidade: "132",
      area: 50.01,
      endereco,
    },
    partes: {
      tipo: "pf",
      pf: {
        nome: "MARIA DA SILVA",
        cpf: "52998224725",
        doc_tipo: "RG",
        doc_numero: "123456789",
        orgao: "DETRAN",
        orgao_uf: "RJ",
        expedicao: "2010-01-01",
        nascimento: "1990-01-01",
        nacionalidade: "BRASILEIRA",
        estado_civil: "solteiro",
        email: "maria@exemplo.com",
        telefone: "(22) 99999-0000",
        endereco,
      },
      destinacao: { atividades: "COMÉRCIO DE PRESENTES" },
    },
    condicoes: {
      prazo: 36,
      aluguel: 2400,
      dia_vencimento: 10,
      multa_alugueis: 3,
    },
    garantia: { tipo: "sem_garantia" },
    entrega: {
      tipo_imovel: "LOJA",
      padrao: "SHELL",
      prazo_implantacao: 60,
      nc004: "JUL/26",
      fisica: { paredes: "ALVENARIA" },
    },
  });
}

const etapas = (d: DadosContrato, ctx = CTX) =>
  Object.keys(porEtapa(pendencias(d, ctx))).map(Number);

describe("revisão", () => {
  it("contrato completo não tem pendência", () => {
    expect(pendencias(completo(), CTX)).toEqual([]);
  });

  it("rascunho vazio bloqueia em todas as etapas com obrigatório", () => {
    expect(etapas(lerDados({}))).toEqual([1, 2, 3, 4, 5]);
  });

  it("seguro-fiança sem apólice bloqueia e leva ao campo", () => {
    const d = completo();
    d.garantia.tipo = "seguro_fianca";
    Object.assign(d.garantia.seguro_fianca, {
      seguradora: "POTTENCIAL SEGURADORA S/A",
      susep_seguradora: "03263",
      corretora: "CORRETORA X",
      susep_corretora: "1234",
      proposta: "998",
      vigencia_inicio: "2026-11-01",
      vigencia_fim: "2027-10-31",
    });
    const sem = pendencias(d, { ...CTX, anexos: ["apolice"] });
    expect(sem.map((p) => p.campo)).toEqual([
      idCampo("gar", "seguro_fianca", "apolice"),
    ]);
    expect(sem[0]?.etapa).toBe(4);
    d.garantia.seguro_fianca.apolice = "77001";
    expect(pendencias(d, CTX).map((p) => p.campo)).toEqual([
      idCampo("gar", "seguro_fianca", "documento_apolice"),
    ]);
    expect(pendencias(d, { ...CTX, anexos: ["apolice"] })).toEqual([]);
  });

  it("obrigatórios de cada garantia vêm dos parâmetros", () => {
    const d = completo();
    d.garantia.tipo = "caucao";
    expect(pendencias(d, CTX).map((p) => p.campo)).toEqual([
      idCampo("gar", "caucao", "aluguel_base"),
      idCampo("gar", "caucao", "quantidade"),
      idCampo("gar", "caucao", "data_deposito"),
    ]);
    d.garantia.caucao = {
      aluguel_base: 2000,
      quantidade: 3,
      data_deposito: "2026-11-05",
      prazo_dias: 5,
    };
    expect(pendencias(d, CTX)).toEqual([]);
    // Parâmetro sem "data_deposito": deixa de cobrar.
    d.garantia.caucao.data_deposito = "";
    expect(
      pendencias(d, {
        ...CTX,
        obrigatorios: { caucao: ["aluguel_base", "quantidade"] },
      }),
    ).toEqual([]);

    d.garantia.tipo = "capitalizacao";
    expect(pendencias(d, CTX).map((p) => p.rotulo)).toEqual([
      "instituição (capitalização)",
      "valor da garantia (capitalização)",
      "nº da proposta (capitalização)",
      "comprovante (capitalização)",
    ]);
  });

  it("fiador: cada um completo; casado pede regime e cônjuge", () => {
    const d = completo();
    d.garantia.tipo = "fiador";
    d.garantia.fiador.quantidade = 1;
    const f = novoFiador();
    d.garantia.fiador.fiadores = [f];
    f.pf = { ...d.partes.pf, nome: "JOSÉ FIADOR", estado_civil: "casado" };
    const campos = pendencias(d, CTX).map((p) => p.campo);
    expect(campos).toContain(idCampo("fiador-0", "regime"));
    expect(campos).toContain(idCampo("fiador-0-cj", "nome"));
    expect(campos.every((c) => c.startsWith("c-fiador-0"))).toBe(true);
  });

  it("PJ pede CNPJ válido e representante completo; casado pede cônjuge na PF", () => {
    const d = completo();
    d.partes.tipo = "pj";
    const p = pendencias(d, CTX).map((x) => x.campo);
    expect(p).toContain(idCampo("pj", "cnpj"));
    expect(p).toContain(idCampo("rep", "adicionar"));
    d.partes.representantes = [novoRepresentante()];
    expect(pendencias(d, CTX).map((x) => x.campo)).toContain(
      idCampo("rep-0", "cpf"),
    );

    const pf = completo();
    pf.partes.pf.estado_civil = "uniao_estavel";
    expect(pendencias(pf, CTX).map((x) => x.campo)).toContain(
      idCampo("cj", "cpf"),
    );
  });

  it("condições: data fixa, percentual, linhas e multa escalonada", () => {
    const d = completo();
    d.condicoes.inicio = "data_fixa";
    d.condicoes.forma = "percentual";
    d.condicoes.carencias_descontos = [
      {
        tipo: "desconto_fixo",
        inicio: "2026-12-01",
        fim: "2026-11-01",
        valor: null,
      },
    ];
    d.condicoes.multa = "escalonada";
    const r = pendencias(d, CTX).map((x) => x.rotulo);
    expect(r).toEqual([
      "data de início da vigência",
      "faixa do aluguel percentual",
      "data final antes da inicial da condição 1",
      "valor da condição 1",
      "faixa da multa escalonada",
    ]);
  });
});

describe("checklist da etapa Documentos", () => {
  it("kit vencido em vermelho; apólice obrigatória no seguro-fiança", () => {
    const d = completo();
    d.garantia.tipo = "seguro_fianca";
    const itens = checklist(d, {
      ...CTX,
      hoje: "2026-11-04",
      kit: [
        {
          nome: "01 — Regimento Interno",
          versao: "2ª alteração",
          validade: null,
        },
        {
          nome: "07 — Certificado de manutenção",
          versao: "2025",
          validade: "2026-10-31",
        },
      ],
    });
    const por = Object.fromEntries(itens.map((i) => [i.chave, i.status]));
    expect(por.partes).toBe("ok");
    expect(por.garantia).toBe("obrigatorio");
    expect(por["kit-01 — Regimento Interno"]).toBe("ok");
    expect(por["kit-07 — Certificado de manutenção"]).toBe("vencido");
    expect(por.credencial).toBeUndefined();
  });
});
